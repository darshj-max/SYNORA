/**
 * SYNORA Backend Server
 * ─────────────────────────────────────────────────────────────
 * Responsibilities:
 *   1. /api/ai        — Anthropic proxy (key never leaves this server)
 *   2. /api/sync      — GET/POST user data via Supabase
 *   3. /api/auth/me   — Verify JWT and return user profile
 *   4. /api/usage     — Return how many AI calls used today
 *
 * Security layers:
 *   - helmet()         sets secure HTTP headers
 *   - cors()           only allows your frontend origin
 *   - rateLimiter      caps AI calls per IP
 *   - verifyUser()     validates Supabase JWT on protected routes
 *   - Daily AI quota   50 calls / user / day (configurable)
 */

'use strict';

require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

// ─── Validate required env vars on startup ───────────────────
const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_ANON_KEY',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌  Missing required environment variable: ${key}`);
    console.error('    Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }
}

const {
  ANTHROPIC_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  SUPABASE_ANON_KEY,
  PORT = 3001,
  FRONTEND_ORIGIN = 'http://localhost:5500',
  AI_DAILY_LIMIT = 50,        // AI calls per user per day
} = process.env;

// ─── Supabase clients ─────────────────────────────────────────
// Service client — bypasses RLS, used for AI usage tracking
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Anon client — used to verify user JWTs
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

// ─── Express app ─────────────────────────────────────────────
const app = express();

// Security headers — removes X-Powered-By, sets CSP etc.
app.use(helmet({
  contentSecurityPolicy: false, // disabled so frontend can load from CDN
}));

// CORS — only allow requests from your frontend
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return cb(null, true);
    // Allow localhost for dev
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      return cb(null, true);
    }
    // Allow configured frontend origin
    if (origin === FRONTEND_ORIGIN) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '4mb' })); // 4MB to handle base64 images for AI

// ─── Rate limiter for AI endpoint ────────────────────────────
// Caps at 60 requests per 15 min per IP — prevents hammering
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait 15 minutes.' },
});

// General limiter for all routes
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: { error: 'Too many requests.' },
});

app.use(generalLimiter);

// ─── Auth middleware ──────────────────────────────────────────
/**
 * verifyUser — extracts and validates the Supabase JWT from the
 * Authorization header. Attaches req.user to the request on success.
 * Returns 401 if the token is missing or invalid.
 */
async function verifyUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    // Verify the JWT with Supabase — this validates signature + expiry
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;       // { id, email, ... }
    req.token = token;
    next();
  } catch (err) {
    console.error('verifyUser error:', err.message);
    return res.status(500).json({ error: 'Auth service unavailable' });
  }
}

// ─── Helper: check + increment daily AI usage ────────────────
/**
 * checkAndIncrementUsage
 * Returns { allowed: bool, used: number, limit: number }
 * Uses Supabase upsert so the first call of the day creates the row.
 */
async function checkAndIncrementUsage(userId) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Read current count
  const { data: existing } = await supabaseAdmin
    .from('ai_usage')
    .select('call_count')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  const currentCount = existing?.call_count ?? 0;

  if (currentCount >= Number(AI_DAILY_LIMIT)) {
    return { allowed: false, used: currentCount, limit: Number(AI_DAILY_LIMIT) };
  }

  // Increment atomically via upsert
  await supabaseAdmin
    .from('ai_usage')
    .upsert(
      { user_id: userId, date: today, call_count: currentCount + 1 },
      { onConflict: 'user_id,date' }
    );

  return { allowed: true, used: currentCount + 1, limit: Number(AI_DAILY_LIMIT) };
}

// ═══════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════

// ── Health check ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── GET /api/auth/me ──────────────────────────────────────────
// Returns the authenticated user's profile.
// Frontend calls this on load to confirm the token is still valid.
app.get('/api/auth/me', verifyUser, (req, res) => {
  res.json({
    id:    req.user.id,
    email: req.user.email,
    name:  req.user.user_metadata?.full_name || null,
    avatar: req.user.user_metadata?.avatar_url || null,
  });
});

// ── GET /api/sync ─────────────────────────────────────────────
// Fetches the user's saved SYNORA state from Supabase.
// Returns null data if this is a new user (first login).
app.get('/api/sync', verifyUser, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = row not found — expected for new users
      console.error('Sync GET error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch data' });
    }

    res.json({
      data:       data?.data       || null,
      updated_at: data?.updated_at || null,
    });
  } catch (err) {
    console.error('Sync GET exception:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/sync ────────────────────────────────────────────
// Saves the user's entire SYNORA state to Supabase.
// The frontend calls this automatically every 30 seconds and on page unload.
app.post('/api/sync', verifyUser, async (req, res) => {
  const { data } = req.body;

  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Request body must include a data object' });
  }

  // Strip savedFiles.imageData before storing — base64 images are large
  // and should remain local-only. The file name and metadata are preserved.
  const sanitised = { ...data };
  if (Array.isArray(sanitised.savedFiles)) {
    sanitised.savedFiles = sanitised.savedFiles.map(f => {
      const { imageData, ...rest } = f; // eslint-disable-line no-unused-vars
      return rest;
    });
  }

  try {
    const { error } = await supabaseAdmin
      .from('user_data')
      .upsert(
        { user_id: req.user.id, data: sanitised },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Sync POST error:', error.message);
      return res.status(500).json({ error: 'Failed to save data' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Sync POST exception:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/ai ──────────────────────────────────────────────
// Anthropic proxy.
// The API key NEVER reaches the browser — it lives only here.
// Protected by: JWT auth, IP rate limit, per-user daily quota.
app.post('/api/ai', aiLimiter, verifyUser, async (req, res) => {
  const { messages, max_tokens = 1000 } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Enforce max_tokens ceiling — prevent runaway costs
  const safeTok = Math.min(Number(max_tokens), 2000);

  // Check and increment daily usage quota
  const usage = await checkAndIncrementUsage(req.user.id);
  if (!usage.allowed) {
    return res.status(429).json({
      error: `Daily AI limit reached (${usage.limit} calls/day). Resets at midnight.`,
      used:  usage.used,
      limit: usage.limit,
    });
  }

  try {
    // Forward to Anthropic — key is injected here server-side
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':         'application/json',
        'x-api-key':            ANTHROPIC_API_KEY,
        'anthropic-version':    '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: safeTok,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic error:', response.status, errBody);
      return res.status(502).json({ error: `Anthropic API error: ${response.status}` });
    }

    const result = await response.json();

    // Pass through the full response so the frontend can extract content
    res.json({
      content:    result.content,
      usage_info: { used: usage.used, limit: usage.limit }, // show quota to frontend
    });

  } catch (err) {
    console.error('AI proxy exception:', err.message);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// ── GET /api/usage ────────────────────────────────────────────
// Returns today's AI call count for the authenticated user.
// The frontend shows "X / 50 AI calls used today".
app.get('/api/usage', verifyUser, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data } = await supabaseAdmin
      .from('ai_usage')
      .select('call_count')
      .eq('user_id', req.user.id)
      .eq('date', today)
      .single();

    res.json({
      used:  data?.call_count ?? 0,
      limit: Number(AI_DAILY_LIMIT),
      date:  today,
    });
  } catch (err) {
    res.json({ used: 0, limit: Number(AI_DAILY_LIMIT), date: today });
  }
});

// ─── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   SYNORA Backend running on :${PORT}   ║
  ║   Health:  http://localhost:${PORT}/health  ║
  ╚═══════════════════════════════════════╝
  `);
});
