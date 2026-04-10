/* ============================================================
   BACKGROUND PATHS â€” compositor-thread opacity animation only.
   60 paths across 4 curve families for visual depth.
   NO stroke-dashoffset. ONLY opacity. Zero main-thread cost.
   ============================================================ */
(function(){
  const svg  = document.getElementById('paths-canvas');
  const gold = ['#ffd700','#ffb300','#ffe566','#cc8800','#ffc200','#e8c400'];

  /*
    Four families of curves covering every screen region:
    A (f=0) â€” flowing diagonals left-to-right              15 paths
    B (f=1) â€” shallow horizontals sweeping mid-screen       15 paths
    C (f=2) â€” steep S-curves from bottom-left               15 paths
    D (f=3) â€” reversed diagonals right-to-left, upper area  15 paths
  */
  function pathD(i){
    const f = i % 4;
    const s = Math.floor(i / 4);
    const o = s * 7;
    if(f === 0){
      const pos = s % 2 === 0 ? 1 : -1;
      const ox  = s * 6 * pos;
      return `M${-350+ox} ${-150+o} C${-280+ox} ${200+o} ${200+ox} ${340+o} ${600+ox} ${480+o} C${660+ox} ${640+o} ${660+ox} ${830+o} ${660+ox} ${830+o}`;
    } else if(f === 1){
      const sy = 60 + s * 35;
      return `M-400 ${sy+o} C-100 ${sy-70+o} 400 ${sy+90+o} 800 ${sy-50+o} C1100 ${sy+60+o} 1200 ${sy+o} 1200 ${sy+o}`;
    } else if(f === 2){
      const bx = -280 + s * 28;
      return `M${bx} ${720+o} C${bx+180} ${420+o} ${bx+480} ${520+o} ${bx+700} ${220+o} C${bx+880} ${-30+o} ${bx+1020} ${110+o} ${bx+1100} ${-80+o}`;
    } else {
      /* Family D: reversed â€” start top-right, sweep to bottom-left */
      const rx = 1200 - s * 30;
      return `M${rx} ${-100+o} C${rx-200} ${150+o} ${rx-500} ${80+o} ${rx-750} ${320+o} C${rx-950} ${500+o} ${rx-1050} ${680+o} ${rx-1100} ${850+o}`;
    }
  }

  /* 60 deterministic durations (16â€“31 s) and delays (0â€“7 s) */
  const dur = [
    18,22,26,20,24,28,16,30,19,23,25,17,21,27,29,15,20,24,18,26,
    22,19,25,23,20,17,24,22,28,19,26,21,18,23,27,16,25,20,22,24,
    18,21,31,17,23,28,20,26,19,24,16,29,22,25,27,18,21,30,23,19
  ];
  const del = [
    0,1.5,3,4.5,6,0.8,2.2,3.8,5.2,0.4,1.8,3.2,4.8,6.2,1,2.5,4,5.5,0.6,2,
    3.5,5,0.9,2.8,1.2,3.6,0.3,5.8,2.7,4.2,0.7,3.1,6.5,1.9,4.6,0.1,2.4,5.7,1.1,3.9,
    6.1,2.9,0.5,4.1,1.7,5.3,3.3,0.2,6.8,2.1,4.9,1.4,3.7,6.3,0.6,5.1,2.6,4.4,1.0,3.4
  ];

  const N = 60;
  for(let i = 0; i < N; i++){
    const el = document.createElementNS('http://www.w3.org/2000/svg','path');
    el.setAttribute('d', pathD(i));
    el.setAttribute('stroke', gold[i % gold.length]);
    const f  = i % 4;
    const sw = f === 1 ? 0.25 + Math.floor(i/4)*0.012   /* horizontals: thinner */
             : f === 3 ? 0.30 + Math.floor(i/4)*0.015   /* reversed: medium */
             :           0.38 + Math.floor(i/4)*0.018;   /* diagonals/S: thicker */
    el.setAttribute('stroke-width', Math.min(sw,1.0).toFixed(3));
    el.setAttribute('fill','none');
    const base = f === 0 ? 0.10 + Math.floor(i/4)*0.010
               : f === 1 ? 0.07 + Math.floor(i/4)*0.009
               : f === 2 ? 0.11 + Math.floor(i/4)*0.011
               :            0.08 + Math.floor(i/4)*0.009;
    el.style.cssText =
      `opacity:${Math.min(base,0.45).toFixed(3)};` +
      `animation:sbFade ${dur[i]}s ease-in-out ${del[i]}s infinite`;
    svg.appendChild(el);
  }

  const s = document.createElement('style');
  s.textContent =
    '@keyframes sbFade{0%,100%{opacity:.06}50%{opacity:.50}}' +
    'html.tab-hidden #paths-canvas path{animation-play-state:paused}';
  document.head.appendChild(s);

  function onViz(){ document.documentElement.classList.toggle('tab-hidden',document.hidden); }
  document.addEventListener('visibilitychange', onViz);
  onViz();
})();

/* ============================================================
   STATE & PERSISTENCE
   ============================================================ */
const STORAGE_KEY = 'synora_v4'; /* bumped from v3 â€” new fields added; migration handles old data */

function loadState(){
  try{
    /* Try new key first, fall back to old key for migration */
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('synora_v3');
    if(raw){
      const p = JSON.parse(raw);
      return {
        subjects:       p.subjects       || [],
        timetable:      p.timetable      || [],
        exams:          p.exams          || [],
        attendance:     p.attendance     || {},
        flashcards:     p.flashcards     || [],
        reminders:      p.reminders      || [],
        savedFiles:     p.savedFiles     || [],
        attThresh:      p.attThresh      || 75,
        settings:       p.settings       || {},
        seeded:         p.seeded         || false,
        /* v4 additions */
        focusPoints:    p.focusPoints    || {},   /* { subjectId: totalPoints } */
        focusSessions:  p.focusSessions  || [],   /* [{ subId, subName, date, type:'work'|'break' }] */
        grades:         p.grades         || []    /* [{ id, subId, subName, comp, scored, outof, weight }] */
      };
    }
  } catch(e){}
  return {
    subjects:[], timetable:[], exams:[], attendance:{},
    flashcards:[], reminders:[], savedFiles:[],
    attThresh:75, settings:{}, seeded:false,
    focusPoints:{}, focusSessions:[], grades:[]
  };
}

let S = loadState();
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }

/* ============================================================
   DEMO DATA â€” injected once on first-ever load so the dashboard
   never looks empty for new users. Guarded by S.seeded flag.
   ============================================================ */
function seedDemoData(){
  if(S.seeded || S.subjects.length > 0) return; /* already has real data */

  const now   = new Date();
  const fmtD  = d => d.toISOString().split('T')[0];
  const future = (days) => { const d=new Date(now); d.setDate(d.getDate()+days); return fmtD(d); };
  const past   = (days) => { const d=new Date(now); d.setDate(d.getDate()-days); return fmtD(d); };

  /* Subjects */
  const s1={id:1001,name:'Data Structures',sem:'2',prof:'Dr. A. Sharma',credits:'4',color:'a1'};
  const s2={id:1002,name:'Operating Systems',sem:'2',prof:'Dr. P. Menon',credits:'3',color:'a2'};
  const s3={id:1003,name:'DBMS',sem:'2',prof:'Dr. S. Iyer',credits:'4',color:'a4'};
  S.subjects = [s1, s2, s3];

  /* Timetable â€” a few slots across the week */
  S.timetable = [
    {id:2001,subId:1001,subName:'Data Structures',subColor:'a1',day:'Monday',   start:'09:00',end:'10:00',room:'LH-1'},
    {id:2002,subId:1002,subName:'Operating Systems',subColor:'a2',day:'Tuesday',start:'11:00',end:'12:00',room:'LH-2'},
    {id:2003,subId:1003,subName:'DBMS',subColor:'a4',day:'Wednesday',           start:'14:00',end:'15:00',room:'Lab-3'},
    {id:2004,subId:1001,subName:'Data Structures',subColor:'a1',day:'Thursday', start:'10:00',end:'11:00',room:'LH-1'},
    {id:2005,subId:1002,subName:'Operating Systems',subColor:'a2',day:'Friday',  start:'09:00',end:'10:00',room:'LH-4'},
  ];

  /* Exams */
  S.exams = [
    {id:3001,name:'Mid Semester Exam',subId:1001,subName:'Data Structures',subColor:'a1',
     date:future(12),time:'09:00',venue:'Hall A',notes:'Units 1-4, Trees & Graphs'},
    {id:3002,name:'Lab Exam',subId:1003,subName:'DBMS',subColor:'a4',
     date:future(5),time:'14:00',venue:'Lab Block',notes:'SQL queries, ER diagrams'},
  ];

  /* Attendance â€” give each subject some history */
  const attGen = (subId, presentDays, absentDays) => {
    const records = [];
    for(let i=presentDays; i>0; i--)
      records.push({date:past(i*2),   status:'present'});
    for(let i=absentDays; i>0; i--)
      records.push({date:past(i*2+1), status:'absent'});
    return records;
  };
  S.attendance = {
    '1001': attGen(1001, 8, 2),  /* 80% */
    '1002': attGen(1002, 6, 4),  /* 60% */
    '1003': attGen(1003, 9, 1),  /* 90% */
  };

  /* Reminder */
  const remDt = new Date(now);
  remDt.setDate(remDt.getDate() + 3);
  remDt.setHours(18, 0, 0, 0);
  S.reminders = [
    {id:4001,title:'Submit DSA Assignment 2',dt:remDt.toISOString().slice(0,16),cat:'assignment'}
  ];

  S.seeded = true;
  save();
}

/* ============================================================
   UTILITIES
   ============================================================ */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let _toastTimer = null;
function toast(title, msg='', dur=3500){
  document.getElementById('toast-t').textContent = title;
  document.getElementById('toast-b').textContent = msg;
  const el = document.getElementById('toast');
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=> el.classList.remove('show'), dur);
}

function loadingHTML(msg){
  return `<div class="loading-wrap">${msg}<div class="dots"><span></span><span></span><span></span></div></div>`;
}

/**
 * countUp â€” animates el.textContent from 0 â†’ target using rAF.
 * @param {HTMLElement} el       target element
 * @param {number}      target   final numeric value
 * @param {number}      dur      duration ms  (default 650)
 * @param {string}      suffix   appended after number e.g. '%'
 */
function countUp(el, target, dur=650, suffix=''){
  if(el._rafId) cancelAnimationFrame(el._rafId); /* cancel previous run */
  if(typeof target !== 'number' || isNaN(target)){
    el.textContent = target + suffix;
    return;
  }
  const t0 = performance.now();
  function step(now){
    const progress = Math.min((now - t0) / dur, 1);
    /* cubic ease-out: fast start, gentle finish */
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if(progress < 1){
      el._rafId = requestAnimationFrame(step);
    } else {
      el._rafId = null;
    }
  }
  el._rafId = requestAnimationFrame(step);
}

function animPBars(){
  document.querySelectorAll('.pfill[data-target]').forEach(el=>{
    const t = parseFloat(el.dataset.target) || 0;
    /* Double rAF: first frame paints scaleX(0), second frame triggers transition */
    requestAnimationFrame(()=> requestAnimationFrame(()=>{
      el.style.transform = `scaleX(${t / 100})`;
    }));
  });
}

function daysUntil(ds){
  const n = new Date(); n.setHours(0,0,0,0);
  const d = new Date(ds); d.setHours(0,0,0,0);
  return Math.ceil((d - n) / 86400000);
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const colMap = {a1:'#ffd700', a2:'#00d4ff', a3:'#e040a0', a4:'#00d48a'};

function showPage(id){
  /* Deactivate all pages + nav items */
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  /* Activate target nav item immediately */
  document.querySelector(`[data-page="${id}"]`)?.classList.add('active');

  /*
    Adding .active in the same frame as removing it can cause the browser to
    skip the animation (it sees no real state change). Use rAF to guarantee
    the removal paint has committed before we add .active.
  */
  requestAnimationFrame(()=>{
    const page = document.getElementById('page-' + id);
    if(page) page.classList.add('active');

    /* Scroll main area to top on every page switch */
    document.querySelector('.main')?.scrollTo({ top: 0, behavior: 'instant' });
  });

  /* Refresh data-driven content for the target page */
  refreshDrops();
  ({
    dashboard:   renderDash,
    subjects:    renderSubs,
    timetable:   renderTT,
    exams:       renderExams,
    attendance:  ()=>{ renderAtt(); loadThreshUI(); },
    notes:       ()=> renderSavedFiles('notes'),
    quiz:        ()=> renderSavedFiles('quiz'),
    reminders:   renderRems,
    focus:       renderFocus,
    gpa:         renderGPA,
    settings:    loadSettingsForm
  })[id]?.();
}

function refreshDrops(){
  ['tt-sub','es','att-sub','focus-sub-sel','gpa-sub-sel'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const v=el.value;
    const placeholder = id==='focus-sub-sel'
      ? '<option value="">Select subject (optional)</option>'
      : '<option value="">Select subject...</option>';
    el.innerHTML=placeholder+S.subjects.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    el.value=v;
  });
}

/* ============================================================
   PILLS & COLOR PICKER
   ============================================================ */
function selectPill(el,g){
  document.querySelectorAll(`#${g} .pill`).forEach(p=>p.classList.remove('sel'));
  el.classList.add('sel');
}
function getPill(g){return document.querySelector(`#${g} .pill.sel`)?.dataset.val||'';}
let selColor='a1';
function selectColor(el){
  document.querySelectorAll('.cp-dot').forEach(d=>d.classList.remove('sel'));
  el.classList.add('sel');selColor=el.dataset.color;
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDash(){
  const up = S.exams.filter(e => daysUntil(e.date) >= 0);
  countUp(document.getElementById('ds-sub'),  S.subjects.length);
  countUp(document.getElementById('ds-exam'), up.length);
  countUp(document.getElementById('ds-rem'),  S.reminders.length);

  /* Average attendance with % suffix */
  const pcts = S.subjects.map(s=>{
    const r = S.attendance[String(s.id)] || [];
    const p = r.filter(x => x.status==='present' || x.status==='late').length;
    return r.length ? p / r.length * 100 : null;
  }).filter(x => x !== null);
  const avg = pcts.length ? Math.round(pcts.reduce((a,b)=>a+b,0) / pcts.length) : null;
  const attEl = document.getElementById('ds-att');
  if(avg !== null){
    countUp(attEl, avg, 650, '%');
  } else {
    attEl.textContent = 'â€“';
  }

  /* ---- Daily Briefing ---- */
  const briefEl = document.getElementById('ds-briefing');
  if(briefEl){
    const thresh = S.attThresh || 75;
    const examsThisWeek = up.filter(e => daysUntil(e.date) <= 7);
    /* Find subject with lowest attendance */
    let lowestSub = null, lowestPct = 101;
    S.subjects.forEach(s=>{
      const r = S.attendance[String(s.id)] || [];
      if(!r.length) return;
      const p = r.filter(x=>x.status==='present'||x.status==='late').length;
      const pct = Math.round(p/r.length*100);
      if(pct < lowestPct){ lowestPct=pct; lowestSub=s; }
    });
    /* Compose briefing text */
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const name = S.settings.name ? `, ${S.settings.name.split(' ')[0]}` : '';
    let sentences = [];
    if(examsThisWeek.length)
      sentences.push(`You have <strong>${examsThisWeek.length} exam${examsThisWeek.length>1?'s':''}</strong> this week.`);
    if(lowestSub && lowestPct < thresh)
      sentences.push(`Your attendance in <strong>${lowestSub.name}</strong> is at <strong>${lowestPct}%</strong> â€” below your ${thresh}% threshold.`);
    else if(lowestSub && lowestPct < thresh + 10)
      sentences.push(`<strong>${lowestSub.name}</strong> attendance is ${lowestPct}% â€” keep it up.`);
    const chips = [
      ...examsThisWeek.map(e=>`<span class="briefing-chip chip-exam">ðŸ“ ${e.name} in ${daysUntil(e.date)}d</span>`),
      ...(lowestSub && lowestPct < thresh ? [`<span class="briefing-chip chip-warn">âš ï¸ ${lowestSub.name} ${lowestPct}%</span>`] : []),
      ...(avg !== null && avg >= thresh ? [`<span class="briefing-chip chip-ok">âœ“ Avg ${avg}% on track</span>`] : [])
    ];
    if(!sentences.length && !chips.length){
      sentences.push('All clear. Keep up the great work!');
    }
    briefEl.innerHTML = `<div class="briefing-card">
      <div class="briefing-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Daily Briefing
      </div>
      <div class="briefing-text">${greeting}${name}. ${sentences.join(' ')}</div>
      ${chips.length?`<div class="briefing-chips">${chips.join('')}</div>`:''}
    </div>`;
  }

  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const today=days[new Date().getDay()];
  const todayCls=S.timetable.filter(t=>t.day===today).sort((a,b)=>a.start.localeCompare(b.start));
  const todayEl=document.getElementById('ds-today');
  todayEl.innerHTML=todayCls.length
    ?todayCls.map(t=>`<div class="today-cls" style="border-left-color:${colMap[t.subColor]||'var(--gold)'}">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:var(--t1)">${t.subName}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">${t.start} â€“ ${t.end}${t.room?' Â· '+t.room:''}</div>
        </div></div>`).join('')
    :emptyState('calendar','No classes today');

  const nex=up.sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
  document.getElementById('ds-nexam').innerHTML=nex?buildExamCard(nex):emptyState('file-text','No upcoming exams');

  const thresh=S.attThresh||75;
  const attov=document.getElementById('ds-attov');
  if(S.subjects.length){
    attov.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:16px">`+S.subjects.map(s=>{
      const r=S.attendance[String(s.id)]||[];const p=r.filter(x=>x.status==='present'||x.status==='late').length;
      const pct=r.length?Math.round(p/r.length*100):0;
      const col=pct>=thresh?'var(--success)':pct>=(thresh-15)?'var(--warn)':'var(--danger)';
      return `<div style="flex:1;min-width:100px">
        <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:var(--t2)">${s.name}</div>
        <div class="pbar"><div class="pfill" data-target="${pct}" style="background:${col}"></div></div>
        <div style="font-size:10px;color:${col};margin-top:3px">${pct}% (${p}/${r.length})</div>
      </div>`;
    }).join('')+'</div>';
    setTimeout(animPBars,100);
  }else attov.innerHTML=emptyState('bar-chart','Add subjects to see attendance');
}

/* ============================================================
   EMPTY STATE HELPER
   ============================================================ */
const svgIcons={
  calendar:`<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>`,
  'file-text':`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  'bar-chart':`<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
  bell:`<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  book:`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  zap:`<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
  save:`<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>`
};
function emptyState(icon,text){
  const path=svgIcons[icon]||svgIcons.calendar;
  return `<div class="empty"><div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div><div class="empty-text">${text}</div></div>`;
}

/* ============================================================
   SUBJECTS
   ============================================================ */
function addSubject(){
  const name=document.getElementById('sn').value.trim(),sem=document.getElementById('ss').value;
  if(!name||!sem){toast('Missing fields','Enter subject name and semester');return;}
  S.subjects.push({id:Date.now(),name,sem,prof:document.getElementById('sp').value.trim(),credits:document.getElementById('sc').value,color:selColor});
  save();renderSubs();refreshDrops();['sn','ss','sp','sc'].forEach(id=>document.getElementById(id).value='');
  toast('Subject added',name);
}
function deleteSub(id){if(!confirm('Delete this subject?'))return;S.subjects=S.subjects.filter(s=>s.id!==id);save();renderSubs();refreshDrops();toast('Deleted','Subject removed');}
function renderSubs(){
  const el=document.getElementById('sub-list');
  if(!S.subjects.length){el.innerHTML=emptyState('book','No subjects yet');return;}
  const bySem={};S.subjects.forEach(s=>{if(!bySem[s.sem])bySem[s.sem]=[];bySem[s.sem].push(s);});
  el.innerHTML=Object.keys(bySem).sort((a,b)=>a-b).map(sem=>`
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px">Semester ${sem}</div>
      ${bySem[sem].map(s=>`<div class="sub-row">
        <div class="sub-dot" style="background:${colMap[s.color]||'var(--gold)'};box-shadow:0 0 6px ${colMap[s.color]||'var(--gold)'}60"></div>
        <div style="flex:1;min-width:0">
          <div class="sub-name">${s.name}</div>
          <div class="sub-meta">${[s.prof,s.credits?s.credits+' cr':''].filter(Boolean).join(' Â· ')}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="deleteSub(${s.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('')}
    </div>`).join('');
}

/* ============================================================
   TIMETABLE
   ============================================================ */
let ttFile=null;
function handleTTFile(inp){const f=inp.files[0];if(!f)return;ttFile=f;document.getElementById('tt-chip').innerHTML=fChip(f,'clearTTFile()');document.getElementById('tt-extract-btn').style.display='block';document.getElementById('tt-status').innerHTML='';}
function clearTTFile(){ttFile=null;document.getElementById('tt-chip').innerHTML='';document.getElementById('tt-extract-btn').style.display='none';document.getElementById('tt-file').value='';}

function fChip(file,clearFn){
  const icoPaths={pdf:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,img:`<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`,doc:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>`,ppt:`<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>`};
  const ext=file.name.split('.').pop().toLowerCase();
  const icoKey=['jpg','jpeg','png','gif','webp','bmp'].includes(ext)?'img':['pdf'].includes(ext)?'pdf':['doc','docx'].includes(ext)?'doc':'ppt';
  return `<div class="file-chip">
    <svg class="file-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">${icoPaths[icoKey]}</svg>
    <span class="file-chip-name">${file.name}</span>
    <button class="file-chip-del" onclick="${clearFn}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>`;
}

async function extractTimetable(){
  if(!ttFile){toast('No file','Upload a file first');return;}
  const st=document.getElementById('tt-status');st.innerHTML=loadingHTML('Reading your timetable...');
  try{
    const ex=await extractFile(ttFile);const subs=S.subjects.map(s=>s.name).join(', ')||'any';
    let msgs;
    const prompt=`Extract ALL classes from this timetable.\nKnown subjects: ${subs}.\nReturn ONLY valid JSON array, no markdown:\n[{"subName":"Subject","day":"Monday","start":"09:00","end":"10:00","room":""}]\nday must be one of: Monday,Tuesday,Wednesday,Thursday,Friday,Saturday. Times in 24h HH:MM.`;
    if(ex.type==='image')msgs=[{role:'user',content:[{type:'image',source:{type:'base64',media_type:ex.mime,data:ex.data}},{type:'text',text:prompt}]}];
    else msgs=[{role:'user',content:`Timetable text:\n${ex.data}\n\n${prompt}`}];
    const txt=await callClaude(msgs);
    const cls=JSON.parse(txt.replace(/```json|```/g,'').trim());
    let n=0;
    cls.forEach(c=>{const s=S.subjects.find(x=>x.name.toLowerCase().includes(c.subName.toLowerCase())||c.subName.toLowerCase().includes(x.name.toLowerCase()));S.timetable.push({id:Date.now()+Math.random(),subId:s?.id||null,subName:s?.name||c.subName,subColor:s?.color||'a1',day:c.day,start:c.start,end:c.end,room:c.room||''});n++;});
    save();renderTT();st.innerHTML=`<div class="status-ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>${n} classes extracted successfully</div>`;
    toast('Timetable extracted',`${n} classes added`);
  }catch(e){st.innerHTML=`<div class="status-err"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Could not read timetable. Try a clearer image or add manually.</div>`;}
}

function addTTClass(){
  const sid=document.getElementById('tt-sub').value,day=document.getElementById('tt-day').value,s=document.getElementById('tt-s').value,e=document.getElementById('tt-e').value,r=document.getElementById('tt-r').value;
  if(!sid||!s||!e){toast('Missing fields','Select subject and enter start/end times');return;}
  const sub=S.subjects.find(x=>String(x.id)===String(sid));
  S.timetable.push({id:Date.now(),subId:sub.id,subName:sub.name,subColor:sub.color,day,start:s,end:e,room:r});
  save();renderTT();toast('Class added',sub.name+' on '+day);
}
function delTT(id){S.timetable=S.timetable.filter(t=>String(t.id)!==String(id));save();renderTT();toast('Deleted','Class removed');}
const dayOrd=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function renderTT(){
  const tb=document.getElementById('tt-body');
  if(!S.timetable.length){tb.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:32px">No classes yet â€” upload your timetable above</td></tr>`;return;}
  const sorted=[...S.timetable].sort((a,b)=>dayOrd.indexOf(a.day)-dayOrd.indexOf(b.day)||a.start.localeCompare(b.start));
  tb.innerHTML=sorted.map(t=>`<tr>
    <td><span class="day-badge" style="background:${colMap[t.subColor]||'var(--gold)'}18;color:${colMap[t.subColor]||'var(--gold)'}">${t.day}</span></td>
    <td style="font-weight:500;color:var(--t1)">${t.subName}</td>
    <td><span class="time-chip"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${t.start} â€“ ${t.end}</span></td>
    <td style="color:var(--t2);font-size:12px">${t.room||'â€”'}</td>
    <td><button class="btn btn-ghost btn-sm" onclick="delTT('${t.id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  </tr>`).join('');
}

/* ============================================================
   EXAMS
   ============================================================ */
function buildExamCard(e,past=false){
  const d=daysUntil(e.date);
  const bg=past?'rgba(20,16,4,0.8)':d<=3?'linear-gradient(135deg,#2a0000,#6b1010)':d<=7?'linear-gradient(135deg,#1a1000,#4a2800)':d<=14?'linear-gradient(135deg,#130e00,#3d2c00)':'linear-gradient(135deg,#001a0a,#003018)';
  const numCol=past?'var(--t3)':d<=3?'var(--danger)':d<=7?'var(--warn)':d<=14?'var(--gold)':'var(--success)';
  return `<div class="exam-card" style="opacity:${past?.55:1}">
    <div class="exam-countdown" style="background:${bg}">
      <div class="exam-days" style="color:${numCol}">${past?'âœ“':d}</div>
      <div class="exam-days-label" style="color:${numCol}80">${past?'done':'days'}</div>
    </div>
    <div style="flex:1;min-width:0">
      <div class="exam-name">${e.name}</div>
      <div class="exam-meta">${e.subName}${e.date?' Â· '+e.date:''}${e.time?' '+e.time:''}${e.venue?' Â· '+e.venue:''}</div>
      ${e.notes?`<div class="exam-notes">${e.notes}</div>`:''}
    </div>
    <button class="btn btn-ghost btn-sm" onclick="delExam(${e.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
  </div>`;
}
function addExam(){
  const name=document.getElementById('en').value.trim(),date=document.getElementById('ed').value;
  if(!name||!date){toast('Missing fields','Enter exam name and date');return;}
  const sid=document.getElementById('es').value;const sub=S.subjects.find(s=>String(s.id)===String(sid));
  S.exams.push({id:Date.now(),name,subId:sub?.id||null,subName:sub?.name||'General',subColor:sub?.color||'a1',date,time:document.getElementById('et').value,venue:document.getElementById('ev').value,notes:document.getElementById('eno').value});
  save();renderExams();['en','ev','eno'].forEach(id=>document.getElementById(id).value='');toast('Exam added',name+' on '+date);
}
function delExam(id){S.exams=S.exams.filter(e=>e.id!==id);save();renderExams();toast('Deleted','Exam removed');}
function renderExams(){
  const el=document.getElementById('exam-list');
  if(!S.exams.length){el.innerHTML=emptyState('file-text','No exams added yet');return;}
  const up=S.exams.filter(e=>daysUntil(e.date)>=0).sort((a,b)=>new Date(a.date)-new Date(b.date));
  const past=S.exams.filter(e=>daysUntil(e.date)<0).sort((a,b)=>new Date(b.date)-new Date(a.date));
  el.innerHTML=(up.length?`<div class="sec-title" style="margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Upcoming</div>`+up.map(e=>buildExamCard(e)).join(''):'')
    +(past.length?`<div class="sec-title" style="margin-top:16px;margin-bottom:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Past</div>`+past.map(e=>buildExamCard(e,true)).join(''):'')
    +(!up.length&&!past.length?emptyState('file-text','No exams added yet'):'');
}

/* ============================================================
   ATTENDANCE
   ============================================================ */
function updateThreshDisplay(v){
  document.getElementById('att-thresh-num').textContent=v+'%';
  const pct=((v-50)/(90-50))*100;
  document.getElementById('att-thresh').style.background=`linear-gradient(to right,var(--gold) ${pct}%,rgba(10,8,2,0.8) ${pct}%)`;
}
function loadThreshUI(){const v=S.attThresh||75;document.getElementById('att-thresh').value=v;updateThreshDisplay(v);}
function saveThresh(){S.attThresh=parseInt(document.getElementById('att-thresh').value);save();renderAtt();toast('Threshold saved','Minimum set to '+S.attThresh+'%');}
function markAtt(){
  const sid=document.getElementById('att-sub').value,date=document.getElementById('att-date').value,status=getPill('att-status-pills')||'present';
  if(!sid||!date){toast('Missing fields','Select subject and date');return;}
  const k=String(sid);if(!S.attendance[k])S.attendance[k]=[];
  const idx=S.attendance[k].findIndex(r=>r.date===date);
  if(idx>=0)S.attendance[k][idx].status=status;else S.attendance[k].push({date,status});
  save();renderAtt();const sub=S.subjects.find(s=>String(s.id)===String(sid));toast('Marked',`${sub?.name}: ${status} on ${date}`);
}
function renderAtt(){
  const el=document.getElementById('att-grid');
  if(!S.subjects.length){el.innerHTML=`<div style="grid-column:1/-1">${emptyState('book','Add subjects first')}</div>`;return;}
  const thresh=S.attThresh||75;
  el.innerHTML=S.subjects.map(s=>{
    const k=String(s.id),recs=S.attendance[k]||[];
    const present=recs.filter(r=>r.status==='present'||r.status==='late').length;
    const absent=recs.filter(r=>r.status==='absent').length;
    const total=recs.length,pct=total?Math.round(present/total*100):0;
    const col=pct>=thresh?'var(--success)':pct>=(thresh-15)?'var(--warn)':'var(--danger)';
    const R=30,C=2*Math.PI*R,off=C-(pct/100*C);
    const need=total>0&&pct<thresh?Math.max(0,Math.ceil((thresh*total-100*present)/(100-thresh))):0;
    return `<div class="att-card">
      <div class="att-sub">${s.name}</div>
      <div class="att-ring">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="${R}" fill="none" stroke="rgba(20,15,2,0.9)" stroke-width="6"/>
          <circle cx="36" cy="36" r="${R}" fill="none" stroke="${col}" stroke-width="6"
            stroke-dasharray="${C}" stroke-dashoffset="${C}"
            stroke-linecap="round" transform="rotate(-90 36 36)"
            class="ring-arc" data-off="${off}"/>
        </svg>
        <div class="att-ring-pct" style="color:${col}">${pct}%</div>
      </div>
      <div class="att-stats">
        <div><span>${present}</span>Present</div>
        <div><span>${absent}</span>Absent</div>
        <div><span>${total}</span>Total</div>
      </div>
      <div class="att-warn" style="color:${col}">
        ${total===0
          ? '<span style="color:var(--t3)">No records yet</span>'
          : pct>=thresh
            ? (() => {
                /* Buffer: max classes they can miss before dropping below threshold */
                const canMiss = Math.floor((present - Math.ceil(thresh/100 * total)) / (1 - thresh/100));
                return canMiss > 0
                  ? `<span style="color:var(--success)">Safe Â· Can miss <strong>${canMiss}</strong> more</span>`
                  : 'Safe Â· No buffer left';
              })()
            : `Need <strong>${need}</strong> more to reach ${thresh}%`
        }
      </div>
    </div>`;
  }).join('');
  setTimeout(()=>document.querySelectorAll('.ring-arc').forEach(a=>{
    const f=parseFloat(a.dataset.off)||0;
    /* Medium-motion: 0.8s â€” compositor-friendly, stroke-dashoffset is SVG-composited */
    a.style.transition='stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)';
    a.style.strokeDashoffset=f;
  }),80);
}

/* ============================================================
   FILE EXTRACTION
   ============================================================ */
const aiFiles={notes:null,quiz:null,fc:null};
function handleAIFile(ctx,inp){const f=inp.files[0];if(!f)return;aiFiles[ctx]=f;document.getElementById(ctx+'-file-chip').innerHTML=fChip(f,`clearAI('${ctx}')`);}
function clearAI(ctx){aiFiles[ctx]=null;document.getElementById(ctx+'-file-chip').innerHTML='';document.getElementById(ctx+'-file').value='';}

async function extractFile(file){
  const ext=file.name.split('.').pop().toLowerCase();
  if(['jpg','jpeg','png','gif','webp','bmp'].includes(ext)){
    const b=await new Promise((r,j)=>{const rd=new FileReader();rd.onload=()=>r(rd.result.split(',')[1]);rd.onerror=j;rd.readAsDataURL(file);});
    return{type:'image',data:b,mime:file.type,name:file.name};
  }
  if(ext==='pdf'){
    try{const ab=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:ab}).promise;let t='';for(let i=1;i<=Math.min(pdf.numPages,20);i++){const p=await pdf.getPage(i);const c=await p.getTextContent();t+=c.items.map(x=>x.str).join(' ')+'\n';}return{type:'text',data:t.trim()||'(PDF has no extractable text)',name:file.name};}
    catch(e){return{type:'text',data:'Could not extract PDF',name:file.name};}
  }
  if(['doc','docx'].includes(ext)){
    try{const ab=await file.arrayBuffer();const r=await mammoth.extractRawText({arrayBuffer:ab});return{type:'text',data:r.value||'(Empty document)',name:file.name};}
    catch(e){return{type:'text',data:'Could not extract Word document',name:file.name};}
  }
  return{type:'text',data:`[File: "${file.name}"] â€” generate content based on the filename.`,name:file.name};
}

async function callClaude(msgs, maxTok=1000){
  /*
   * âš ï¸  PRODUCTION WARNING â€” API KEY SECURITY
   * This function calls the Anthropic API directly from the browser.
   * Your API key is exposed in network traffic. For production:
   *   1. Create a backend proxy (Node/Python/Edge function)
   *   2. Store the key server-side in an env variable
   *   3. Point this fetch() call to your proxy URL instead
   * Reference: https://docs.anthropic.com/en/api/getting-started
   */
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:maxTok, messages:msgs })
  });
  if(!r.ok) throw new Error('API ' + r.status);
  const d = await r.json();
  const b = d.content?.find(c => c.type === 'text');
  if(!b) throw new Error('No response');
  return b.text;
}

function switchAITab(ctx,tab,btn){
  btn.closest('.tabs').querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
  ['upload','topic','saved'].forEach(t=>{const el=document.getElementById(ctx+'-tab-'+t);if(el)el.style.display=t===tab?'block':'none';});
}

async function saveAIFile(ctx){
  const f=aiFiles[ctx];if(!f){toast('No file','Upload a file first');return;}
  toast('Saving...','Extracting file content');const ex=await extractFile(f);
  const entry={id:Date.now(),name:f.name,ctx,date:new Date().toLocaleDateString('en-IN'),size:(f.size/1024).toFixed(1)+' KB'};
  if(ex.type==='image'){entry.imageData=ex.data;entry.mime=f.type;}else entry.text=ex.data;
  S.savedFiles.push(entry);save();renderSavedFiles(ctx);toast('File saved',f.name);
}
function renderSavedFiles(ctx){
  ['notes','quiz'].forEach(c=>{
    const el=document.getElementById(c+'-saved-list');if(!el)return;
    const files=S.savedFiles.filter(f=>f.ctx===c||!f.ctx);
    if(!files.length){el.innerHTML=emptyState('save','No saved files yet');return;}
    el.innerHTML=files.map(f=>`<div class="saved-file" data-id="${f.id}" onclick="selSavedFile(this,'${c}')">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <span class="sf-name">${f.name}</span><span class="sf-date">${f.date}</span>
      <button class="sf-del" onclick="event.stopPropagation();delSavedFile(${f.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`).join('');
  });
}
function selSavedFile(el,ctx){document.querySelectorAll(`#${ctx}-saved-list .saved-file`).forEach(f=>f.classList.remove('sel'));el.classList.add('sel');}
function delSavedFile(id){S.savedFiles=S.savedFiles.filter(f=>f.id!==id);save();renderSavedFiles('notes');renderSavedFiles('quiz');toast('Deleted','Saved file removed');}
function getSavedFile(ctx){const el=document.querySelector(`#${ctx}-saved-list .saved-file.sel`);if(!el)return null;return S.savedFiles.find(f=>f.id==el.dataset.id)||null;}

/* ============================================================
   AI NOTES
   ============================================================ */
const stylePmts={
  detailed:'Generate comprehensive, well-structured study notes with ## headings, subheadings, explanations, and examples per concept.',
  bullet:'Generate concise bullet-point notes. Use â€¢ for main points. Cover all key concepts clearly.',
  exam:'Generate exam-focused notes: key definitions, formulas, critical facts only. Use â˜… for most important.',
  simple:'Generate simple, beginner-friendly notes. Short sentences, real-world analogies, no jargon.'
};
async function generateNotes(){
  const style=getPill('notes-style-pills')||'detailed';
  const out=document.getElementById('notes-output');out.innerHTML=loadingHTML('Generating your notes...');
  const lbl=document.querySelector('#notes-tabs .tab.active')?.textContent?.trim()||'';
  let msgs;
  try{
    if(lbl.includes('Type')){ const t=document.getElementById('notes-topic').value.trim();if(!t){out.innerHTML='';toast('Missing','Enter a topic');return;}msgs=[{role:'user',content:stylePmts[style]+'\n\nTopic: "'+t+'"'}];}
    else if(lbl.includes('Saved')){const sf=getSavedFile('notes');if(!sf){out.innerHTML='';toast('Select a file','Click a saved file first');return;}if(sf.imageData)msgs=[{role:'user',content:[{type:'image',source:{type:'base64',media_type:sf.mime,data:sf.imageData}},{type:'text',text:stylePmts[style]+'\n\nGenerate notes from this document.'}]}];else msgs=[{role:'user',content:stylePmts[style]+'\n\nContent:\n'+sf.text}];}
    else{const f=aiFiles['notes'];if(!f){out.innerHTML='';toast('No file','Upload a file first');return;}const ex=await extractFile(f);if(ex.type==='image')msgs=[{role:'user',content:[{type:'image',source:{type:'base64',media_type:ex.mime,data:ex.data}},{type:'text',text:stylePmts[style]+'\n\nGenerate notes from this document.'}]}];else msgs=[{role:'user',content:stylePmts[style]+'\n\nContent:\n'+ex.data}];}
    const text=await callClaude(msgs,1000);const enc=encodeURIComponent(text);
    out.innerHTML=`<div class="ai-output">${text}</div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText(decodeURIComponent('${enc}'));toast('Copied','Notes copied to clipboard')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy Notes
        </button>
      </div>`;
  }catch(e){out.innerHTML=`<div class="status-err"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Failed to generate notes. Please try again.</div>`;}
}

/* ============================================================
   AI QUIZ
   ============================================================ */
let qData=[],qIdx=0,qScore=0;
async function generateQuiz(){
  const count=getPill('quiz-count-pills')||'5',diff=getPill('quiz-diff-pills')||'medium';
  const st=document.getElementById('quiz-status');st.innerHTML=loadingHTML('Generating quiz...');
  const bp=`Create a ${count}-question multiple choice quiz at ${diff} difficulty.\nReturn ONLY valid JSON array, no markdown:\n[{"q":"Question?","options":["A","B","C","D"],"answer":0,"explanation":"Why correct"}]\nanswer = index (0-3) of correct option.`;
  const lbl=document.querySelector('#quiz-tabs .tab.active')?.textContent?.trim()||'';let msgs;
  try{
    if(lbl.includes('Type')){const t=document.getElementById('quiz-topic').value.trim();if(!t){st.innerHTML='';toast('Missing','Enter a topic');return;}msgs=[{role:'user',content:bp+'\n\nTopic: "'+t+'"'}];}
    else if(lbl.includes('Saved')){const sf=getSavedFile('quiz');if(!sf){st.innerHTML='';toast('Select a file','Click a saved file first');return;}if(sf.imageData)msgs=[{role:'user',content:[{type:'image',source:{type:'base64',media_type:sf.mime,data:sf.imageData}},{type:'text',text:bp+'\n\nBase questions on this document.'}]}];else msgs=[{role:'user',content:bp+'\n\nContent:\n'+sf.text}];}
    else{const f=aiFiles['quiz'];if(!f){st.innerHTML='';toast('No file','Upload a file first');return;}const ex=await extractFile(f);if(ex.type==='image')msgs=[{role:'user',content:[{type:'image',source:{type:'base64',media_type:ex.mime,data:ex.data}},{type:'text',text:bp+'\n\nBase questions on this document.'}]}];else msgs=[{role:'user',content:bp+'\n\nContent:\n'+ex.data}];}
    const txt=await callClaude(msgs,1000);qData=JSON.parse(txt.replace(/```json|```/g,'').trim());qIdx=0;qScore=0;st.innerHTML='';renderQQ();
  }catch(e){st.innerHTML=`<div class="status-err"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Could not generate quiz. Try again.</div>`;}
}
function renderQQ(){
  const area=document.getElementById('quiz-area');area.style.display='block';
  if(qIdx>=qData.length){
    const pct=qData.length?Math.round(qScore/qData.length*100):0;
    area.innerHTML=`<div class="card" style="text-align:center;padding:48px 32px">
      <div style="font-size:52px;margin-bottom:16px">${pct===100?'ðŸ†':pct>=80?'ðŸŽ‰':pct>=60?'ðŸ‘':'ðŸ’ª'}</div>
      <div style="font-size:20px;font-weight:600;margin-bottom:8px;color:var(--t1)">Quiz Complete</div>
      <div style="font-family:var(--font-display);font-size:44px;font-weight:700;background:linear-gradient(135deg,var(--gold),var(--gold3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:12px 0">${qScore}/${qData.length}</div>
      <div style="font-size:13px;color:var(--t2);margin-bottom:28px">${pct===100?'Perfect score!':pct>=80?'Excellent work!':pct>=60?'Good job! Keep going':'Keep studying â€” you got this!'}</div>
      <div style="display:flex;gap:12px;justify-content:center">
        <button class="btn btn-primary" onclick="qIdx=0;qScore=0;renderQQ()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" width="14" height="14"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.02"/></svg>Retake</button>
        <button class="btn btn-secondary" onclick="document.getElementById('quiz-area').style.display='none'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Close</button>
      </div>
    </div>`;return;
  }
  const q=qData[qIdx],prog=Math.round((qIdx/qData.length)*100);
  area.innerHTML=`<div class="card">
    <div class="quiz-meta">Question ${qIdx+1} of ${qData.length} Â· Score: ${qScore}</div>
    <div class="pbar"><div class="pfill" data-target="${prog}" style="background:var(--gold)"></div></div>
    <div class="quiz-question" style="margin-top:16px">${q.q}</div>
    ${q.options.map((o,i)=>`<div class="quiz-option" onclick="answerQ(${i})"><div class="quiz-letter">${String.fromCharCode(65+i)}</div><div>${o}</div></div>`).join('')}
  </div>`;
  setTimeout(animPBars,80);
}
function answerQ(i){
  const q=qData[qIdx];const opts=document.querySelectorAll('.quiz-option');
  opts.forEach((o,idx)=>{o.style.pointerEvents='none';if(idx===q.answer)o.classList.add('correct');else if(idx===i&&i!==q.answer)o.classList.add('wrong');});
  if(i===q.answer)qScore++;
  if(q.explanation){const d=document.createElement('div');d.style.cssText='margin-top:12px;padding:10px 14px;background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.12);border-radius:8px;font-size:12px;color:var(--t2);line-height:1.6';d.textContent='ðŸ’¡ '+q.explanation;document.querySelector('.card')?.appendChild(d);}
  setTimeout(()=>{qIdx++;renderQQ();},1400);
}

/* ============================================================
   FLASHCARDS
   ============================================================ */
let fcIdx=0;
function switchFCOuter(p,btn){
  document.querySelectorAll('#fc-outer-tabs .tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
  ['gen','manual','study'].forEach(x=>document.getElementById('fc-panel-'+x).style.display=x===p?'block':'none');
  if(p==='study')renderFCS();
}
async function generateFC(){
  const n=getPill('fc-count-pills')||'10',st=document.getElementById('fc-gen-status');st.innerHTML=loadingHTML('Generating flashcards...');
  const bp=`Create ${n} flashcards.\nReturn ONLY valid JSON array, no markdown:\n[{"front":"Term or question","back":"Detailed definition or answer"}]`;
  const lbl=document.querySelector('#fc-tabs .tab.active')?.textContent?.trim()||'';let msgs;
  try{
    if(lbl.includes('Type')){const t=document.getElementById('fc-topic').value.trim();if(!t){st.innerHTML='';toast('Missing','Enter a topic');return;}msgs=[{role:'user',content:bp+'\n\nTopic: "'+t+'"'}];}
    else{const f=aiFiles['fc'];if(!f){st.innerHTML='';toast('No file','Upload a file first');return;}const ex=await extractFile(f);if(ex.type==='image')msgs=[{role:'user',content:[{type:'image',source:{type:'base64',media_type:ex.mime,data:ex.data}},{type:'text',text:bp+'\n\nBase flashcards on this document.'}]}];else msgs=[{role:'user',content:bp+'\n\nContent:\n'+ex.data}];}
    const txt=await callClaude(msgs,1000);const cards=JSON.parse(txt.replace(/```json|```/g,'').trim());S.flashcards=[...S.flashcards,...cards];save();
    st.innerHTML=`<div class="status-ok"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>${cards.length} flashcards added â€” switch to Study tab</div>`;toast('Done',`${cards.length} flashcards generated`);
  }catch(e){st.innerHTML=`<div class="status-err"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Failed. Try again.</div>`;}
}
function addManualFC(){const f=document.getElementById('fc-front').value.trim(),b=document.getElementById('fc-back').value.trim();if(!f||!b){toast('Missing','Fill both sides');return;}S.flashcards.push({front:f,back:b});save();document.getElementById('fc-front').value='';document.getElementById('fc-back').value='';toast('Card added','Flashcard created');}
function renderFCS(){
  const a=document.getElementById('fc-study-area');
  if(!S.flashcards.length){a.innerHTML=emptyState('zap','No flashcards yet â€” generate or add some');return;}
  if(fcIdx>=S.flashcards.length)fcIdx=0;
  const card=S.flashcards[fcIdx];
  a.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:12px;color:var(--t2)">${S.flashcards.length} cards total</span>
      <button class="btn btn-danger btn-sm" onclick="if(confirm('Clear all flashcards?')){S.flashcards=[];save();renderFCS()}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Clear All</button>
    </div>
    <div class="fc-hint">Click the card to reveal the answer</div>
    <div class="fc-wrap"><div class="fc-card" id="fc-card" onclick="this.classList.toggle('flipped')">
      <div class="fc-face fc-front"><div class="fc-label">Question</div><div class="fc-content">${card.front}</div></div>
      <div class="fc-face fc-back"><div class="fc-label">Answer</div><div class="fc-content">${card.back}</div></div>
    </div></div>
    <div class="fc-nav">
      <button class="btn btn-secondary btn-sm" onclick="fcIdx=(fcIdx-1+S.flashcards.length)%S.flashcards.length;renderFCS()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>Prev</button>
      <div class="fc-counter">${fcIdx+1} / ${S.flashcards.length}</div>
      <button class="btn btn-secondary btn-sm" onclick="fcIdx=(fcIdx+1)%S.flashcards.length;renderFCS()">Next<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>`;
}

/* ============================================================
   REMINDERS
   ============================================================ */
const catIco={
  assignment:`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>`,
  study:`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>`,
  exam:`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
  other:`<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>`
};
function addReminder(){
  const title=document.getElementById('rem-title').value.trim(),dt=document.getElementById('rem-dt').value,cat=getPill('rem-cat-pills')||'other';
  if(!title||!dt){toast('Missing','Enter title and date/time');return;}
  S.reminders.push({id:Date.now(),title,dt,cat});save();renderRems();document.getElementById('rem-title').value='';toast('Reminder set',title);
}
function delRem(id){S.reminders=S.reminders.filter(r=>r.id!==id);save();renderRems();toast('Deleted','Reminder removed');}
function renderRems(){
  const el=document.getElementById('rem-list');
  if(!S.reminders.length){el.innerHTML=emptyState('bell','No reminders yet');return;}
  const now=new Date();
  el.innerHTML=[...S.reminders].sort((a,b)=>new Date(a.dt)-new Date(b.dt)).map(r=>{
    const dt=new Date(r.dt),ov=dt<now;
    const dot=ov?'var(--danger)':dt.toDateString()===now.toDateString()?'var(--warn)':'var(--success)';
    return `<div class="rem-item">
      <div class="rem-dot" style="background:${dot};box-shadow:0 0 5px ${dot}"></div>
      <div style="flex:1;min-width:0">
        <div class="rem-title">
          <svg style="display:inline;vertical-align:middle;margin-right:4px;opacity:0.6" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${catIco[r.cat]||catIco.other}</svg>
          ${r.title}
        </div>
        <div class="rem-time" style="color:${ov?'var(--danger)':'var(--t2)'}">${ov?'Overdue Â· ':''}${dt.toLocaleDateString('en-IN')} at ${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="delRem(${r.id})"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>`;
  }).join('');
}

/* ============================================================
   DEEP FOCUS â€” State-Machine Pomodoro
   States: IDLE â†’ WORK â†’ BREAK â†’ IDLE
   A completed WORK session awards 1 Focus Point to the chosen subject.
   ============================================================ */
const FOCUS = {
  WORK_SECS:  25 * 60,   /* 25-minute work session */
  BREAK_SECS: 5  * 60,   /* 5-minute break */
  state:    'IDLE',       /* IDLE | WORK | BREAK */
  secsLeft: 25 * 60,
  interval: null,
  sessionPts: 0,          /* points earned THIS session (resets on page reload) */
  todaySessions: []       /* log entries for today's UI */
};

function focusToggle(){
  if(FOCUS.state === 'IDLE' || FOCUS.state === 'BREAK_DONE'){
    /* Start / resume a work session */
    FOCUS.state    = 'WORK';
    FOCUS.secsLeft = FOCUS.WORK_SECS;
    focusStartTick();
  } else if(FOCUS.state === 'WORK'){
    /* Pause */
    clearInterval(FOCUS.interval);
    FOCUS.state = 'IDLE';
  } else if(FOCUS.state === 'BREAK'){
    /* Skip break */
    clearInterval(FOCUS.interval);
    FOCUS.state    = 'IDLE';
    FOCUS.secsLeft = FOCUS.WORK_SECS;
  }
  focusUpdateUI();
}

function focusReset(){
  clearInterval(FOCUS.interval);
  FOCUS.state    = 'IDLE';
  FOCUS.secsLeft = FOCUS.WORK_SECS;
  focusUpdateUI();
}

function focusStartTick(){
  clearInterval(FOCUS.interval);
  FOCUS.interval = setInterval(()=>{
    FOCUS.secsLeft--;
    focusUpdateRing();

    if(FOCUS.secsLeft <= 0){
      clearInterval(FOCUS.interval);

      if(FOCUS.state === 'WORK'){
        /* Session complete â€” award focus point */
        focusAwardPoint();
        FOCUS.state    = 'BREAK';
        FOCUS.secsLeft = FOCUS.BREAK_SECS;
        /* Flash the ring to signal completion */
        const ring = document.getElementById('focus-ring-el');
        ring?.classList.add('flash');
        setTimeout(()=> ring?.classList.remove('flash'), 2000);
        toast('ðŸŽ¯ Session Complete!', 'Focus point awarded. Take a break.', 5000);
        focusStartTick();
      } else if(FOCUS.state === 'BREAK'){
        /* Break done â€” return to idle */
        FOCUS.state    = 'IDLE';
        FOCUS.secsLeft = FOCUS.WORK_SECS;
        toast('â° Break Over', 'Ready for your next session.', 4000);
      }
      focusUpdateUI();
    }
  }, 1000);
}

function focusAwardPoint(){
  /* Credit 1 focus point to the selected subject (or a general pool) */
  const sid  = document.getElementById('focus-sub-sel')?.value || 'general';
  const key  = String(sid);
  if(!S.focusPoints[key]) S.focusPoints[key] = 0;
  S.focusPoints[key]++;
  FOCUS.sessionPts++;

  /* Log the session */
  const sub  = S.subjects.find(s => String(s.id) === key);
  const entry = {
    subId:   key,
    subName: sub?.name || 'General',
    date:    new Date().toISOString(),
    type:    'work'
  };
  S.focusSessions.push(entry);
  FOCUS.todaySessions.unshift(entry);  /* newest first */
  save();

  /* Update points displays */
  const ptsEl = document.getElementById('focus-pts-display');
  if(ptsEl) ptsEl.textContent = FOCUS.sessionPts;
  renderFocusPtsBoard();
  renderFocusSessions();
}

function focusUpdateRing(){
  /* Compute progress for ring fill (stroke-dasharray=565 for r=90) */
  const total = FOCUS.state === 'BREAK' ? FOCUS.BREAK_SECS : FOCUS.WORK_SECS;
  const pct   = FOCUS.secsLeft / total;
  const dash  = 565;
  const offset = dash * (1 - pct);

  const fill  = document.getElementById('focus-ring-fill');
  const timeEl = document.getElementById('focus-time-display');

  if(fill){
    fill.style.strokeDashoffset = offset;
    /* Colour: gold=work, green=break, dim=idle */
    fill.style.stroke = FOCUS.state === 'BREAK' ? 'var(--success)' : 'var(--gold)';
  }

  /* Format MM:SS */
  if(timeEl){
    const m = String(Math.floor(FOCUS.secsLeft / 60)).padStart(2,'0');
    const s = String(FOCUS.secsLeft % 60).padStart(2,'0');
    timeEl.textContent = `${m}:${s}`;
  }
}

function focusUpdateUI(){
  const btnLabel = document.getElementById('focus-btn-label');
  const btnIcon  = document.getElementById('focus-btn-icon');
  const phaseEl  = document.getElementById('focus-phase-label');

  const icons = {
    play:  '<polygon points="5 3 19 12 5 21 5 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    skip:  '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="4" x2="19" y2="20"/>'
  };

  if(FOCUS.state === 'WORK'){
    if(btnLabel) btnLabel.textContent = 'Pause';
    if(btnIcon)  btnIcon.innerHTML    = icons.pause;
    if(phaseEl)  phaseEl.textContent  = 'FOCUS';
  } else if(FOCUS.state === 'BREAK'){
    if(btnLabel) btnLabel.textContent = 'Skip Break';
    if(btnIcon)  btnIcon.innerHTML    = icons.skip;
    if(phaseEl)  phaseEl.textContent  = 'BREAK';
  } else {
    if(btnLabel) btnLabel.textContent = 'Start';
    if(btnIcon)  btnIcon.innerHTML    = icons.play;
    if(phaseEl)  phaseEl.textContent  = 'READY';
  }
  focusUpdateRing();
}

function renderFocus(){
  focusUpdateUI();
  renderFocusPtsBoard();
  renderFocusSessions();
  /* Sync sub dropdown */
  refreshDrops();
}

function renderFocusPtsBoard(){
  const el = document.getElementById('focus-pts-board');
  if(!el) return;
  const entries = Object.entries(S.focusPoints);
  if(!entries.length){
    el.innerHTML = `<div style="font-size:12px;color:var(--t3);padding:12px 0">Complete a session to earn points.</div>`;
    return;
  }
  /* Sort by points descending */
  entries.sort((a,b) => b[1]-a[1]);
  el.innerHTML = entries.map(([key, pts]) => {
    const sub = S.subjects.find(s => String(s.id) === key);
    const name = sub?.name || 'General';
    const col  = sub ? (colMap[sub.color] || 'var(--gold)') : 'var(--gold)';
    const max  = entries[0][1] || 1;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span style="color:var(--t1);font-weight:500">${name}</span>
        <span style="color:${col};font-weight:700;font-family:var(--font-display)">${pts} pt${pts!==1?'s':''}</span>
      </div>
      <div class="pbar"><div class="pfill" data-target="${Math.round(pts/max*100)}" style="background:${col}"></div></div>
    </div>`;
  }).join('');
  setTimeout(animPBars, 80);
}

function renderFocusSessions(){
  const el = document.getElementById('focus-sessions-log');
  if(!el) return;
  /* Show today's sessions from state */
  const today = new Date().toDateString();
  const todayRecs = S.focusSessions.filter(s => new Date(s.date).toDateString() === today);
  if(!todayRecs.length){
    el.innerHTML = `<div style="font-size:12px;color:var(--t3)">No sessions yet today.</div>`;
    return;
  }
  el.innerHTML = [...todayRecs].reverse().slice(0, 8).map(s => {
    const t = new Date(s.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--bdr)">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      <span style="font-size:12px;flex:1;color:var(--t1)">${s.subName}</span>
      <span style="font-size:11px;color:var(--t3)">${t}</span>
    </div>`;
  }).join('');
}

/* ============================================================
   ATMOSPHERES â€” Web Audio API generative ambient sound
   No external URLs. All synthesised in-browser.
   ============================================================ */
let ATM = { ctx: null, nodes: [], active: null, vol: 0.30 };

function initAudio(){
  if(ATM.ctx) return;
  ATM.ctx = new (window.AudioContext || window.webkitAudioContext)();
}

function stopAtm(){
  ATM.nodes.forEach(n=>{ try{ n.stop?.(); n.disconnect?.(); }catch(e){} });
  ATM.nodes = [];
  ATM.active = null;
  document.querySelectorAll('.atm-btn').forEach(b => b.classList.remove('active'));
}

function toggleAtm(type){
  initAudio();
  if(ATM.ctx.state === 'suspended') ATM.ctx.resume();
  if(ATM.active === type){ stopAtm(); return; }  /* toggle off */
  stopAtm();
  ATM.active = type;
  document.getElementById('atm-'+type)?.classList.add('active');

  const master = ATM.ctx.createGain();
  master.gain.setValueAtTime(ATM.vol, ATM.ctx.currentTime);
  master.connect(ATM.ctx.destination);
  ATM.nodes.push(master);

  if(type === 'noise'){
    /* White noise via ScriptProcessor â†’ avoid deprecated API with BufferSource loop */
    const bufLen = ATM.ctx.sampleRate * 2;
    const buf    = ATM.ctx.createBuffer(1, bufLen, ATM.ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for(let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ATM.ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;
    /* Low-pass filter to soften harshness */
    const lp = ATM.ctx.createBiquadFilter();
    lp.type            = 'lowpass';
    lp.frequency.value = 1200;
    src.connect(lp); lp.connect(master);
    src.start();
    ATM.nodes.push(src, lp);

  } else if(type === 'rain'){
    /* Rain = pink-ish noise (white noise filtered per-channel) + gentle resonance */
    for(let ch = 0; ch < 3; ch++){
      const bufLen = ATM.ctx.sampleRate * 3;
      const buf    = ATM.ctx.createBuffer(1, bufLen, ATM.ctx.sampleRate);
      const data   = buf.getChannelData(0);
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for(let i = 0; i < bufLen; i++){
        const w = Math.random() * 2 - 1;
        b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
        b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
        b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
        data[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
        b6=w*0.115926;
      }
      const src = ATM.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      /* Band-pass to add drizzle texture */
      const bp = ATM.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 600 + ch * 400;
      bp.Q.value = 0.5;
      const g = ATM.ctx.createGain();
      g.gain.value = 0.33;
      src.connect(bp); bp.connect(g); g.connect(master);
      src.start(ATM.ctx.currentTime + ch * 0.1);
      ATM.nodes.push(src, bp, g);
    }

  } else if(type === 'space'){
    /* Deep space = layered low drones with slow LFO modulation */
    const freqs = [55, 82.5, 110, 165];
    freqs.forEach((freq, i) => {
      const osc = ATM.ctx.createOscillator();
      osc.type      = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      /* Slow LFO */
      const lfo  = ATM.ctx.createOscillator();
      const lfoG = ATM.ctx.createGain();
      lfo.frequency.value = 0.05 + i * 0.02;
      lfoG.gain.value     = freq * 0.008;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      /* Gain envelope */
      const g = ATM.ctx.createGain();
      g.gain.value = 0.08 + (i === 0 ? 0.04 : 0);
      osc.connect(g); g.connect(master);
      osc.start(); lfo.start();
      ATM.nodes.push(osc, lfo, lfoG, g);
    });
  }
}

function setAtmVol(v){
  ATM.vol = v / 100;
  /* Update volume slider visual */
  const pct = v + '%';
  document.getElementById('atm-vol').style.background =
    `linear-gradient(to right,var(--gold) ${pct},rgba(10,8,2,0.8) ${pct})`;
  /* Apply to master gain */
  ATM.nodes.forEach(n=>{
    if(n instanceof GainNode && ATM.ctx && n !== ATM.nodes[ATM.nodes.length-1]){
      try{ n.gain.setTargetAtTime(ATM.vol, ATM.ctx.currentTime, 0.1); }catch(e){}
    }
  });
  /* Simpler: find master (first GainNode) */
  const master = ATM.nodes.find(n => n.constructor.name === 'GainNode');
  if(master) try{ master.gain.setTargetAtTime(ATM.vol, ATM.ctx.currentTime, 0.05); }catch(e){}
}

/* ============================================================
   GPA TRACKER
   Stores: { id, subId, subName, comp, scored, outof, weight }
   Calculates weighted percentage â†’ maps to 10-point GPA scale.
   ============================================================ */
function gradeToLetter(pct){
  if(pct >= 90) return { letter:'O',  gp:10, col:'var(--success)' };
  if(pct >= 80) return { letter:'A+', gp:9,  col:'var(--success)' };
  if(pct >= 70) return { letter:'A',  gp:8,  col:'var(--gold)'    };
  if(pct >= 60) return { letter:'B+', gp:7,  col:'var(--gold2)'   };
  if(pct >= 50) return { letter:'B',  gp:6,  col:'var(--warn)'    };
  if(pct >= 45) return { letter:'C',  gp:5,  col:'var(--warn)'    };
  if(pct >= 40) return { letter:'P',  gp:4,  col:'var(--danger)'  };
  return          { letter:'F',  gp:0,  col:'var(--danger)'  };
}

function addGradeEntry(){
  const sid     = document.getElementById('gpa-sub-sel').value;
  const comp    = document.getElementById('gpa-comp').value.trim();
  const scored  = parseFloat(document.getElementById('gpa-scored').value);
  const outof   = parseFloat(document.getElementById('gpa-outof').value);
  const weight  = parseFloat(document.getElementById('gpa-weight').value);

  if(!comp || isNaN(scored) || isNaN(outof) || isNaN(weight)){
    toast('Missing fields','Fill in all marks fields'); return;
  }
  if(scored > outof){ toast('Invalid','Marks scored cannot exceed marks out of'); return; }
  if(weight <= 0 || weight > 100){ toast('Invalid','Weightage must be 1â€“100'); return; }

  const sub = S.subjects.find(s => String(s.id) === String(sid));
  S.grades.push({
    id: Date.now(), subId: sid, subName: sub?.name || 'General',
    comp, scored, outof, weight
  });
  save();
  renderGPA();
  /* Clear inputs */
  ['gpa-comp','gpa-scored','gpa-outof','gpa-weight'].forEach(id =>
    document.getElementById(id).value = '');
  toast('Entry added', comp);
}

function delGradeEntry(id){
  S.grades = S.grades.filter(g => g.id !== id);
  save(); renderGPA();
}

function clearGrades(){
  if(!confirm('Clear all grade entries?')) return;
  S.grades = []; save(); renderGPA();
}

function calcGPA(){
  /* Compute weighted percentage per subject, then average the GPs */
  if(!S.grades.length) return null;

  /* Group by subject */
  const bySub = {};
  S.grades.forEach(g => {
    if(!bySub[g.subId]) bySub[g.subId] = { subName:g.subName, entries:[] };
    bySub[g.subId].entries.push(g);
  });

  let totalCredits = 0, weightedGP = 0;
  const subResults = [];
  Object.entries(bySub).forEach(([sid, { subName, entries }]) => {
    const totalWeight = entries.reduce((a,e) => a + e.weight, 0);
    const weightedPct = entries.reduce((a,e) => a + (e.scored/e.outof*100)*(e.weight/totalWeight), 0);
    const { letter, gp, col } = gradeToLetter(weightedPct);
    /* Use credit hours from subject if available (default 3) */
    const sub = S.subjects.find(s => String(s.id) === String(sid));
    const credits = parseFloat(sub?.credits) || 3;
    totalCredits += credits;
    weightedGP   += gp * credits;
    subResults.push({ subName, pct: Math.round(weightedPct), letter, gp, col, credits });
  });

  const overallGPA = totalCredits ? (weightedGP / totalCredits).toFixed(2) : null;
  return { overallGPA, subResults, totalCredits };
}

function renderGPA(){
  const result = calcGPA();
  const overallEl = document.getElementById('gpa-overall');
  const summaryEl = document.getElementById('gpa-summary');
  const listEl    = document.getElementById('gpa-entries-list');

  if(!result || !result.overallGPA){
    if(overallEl) overallEl.textContent = 'â€”';
    if(summaryEl) summaryEl.innerHTML   = '';
    if(listEl)    listEl.innerHTML      = emptyState('bar-chart','Add marks entries to see your projected GPA');
    return;
  }

  /* Overall GPA */
  if(overallEl) overallEl.textContent = result.overallGPA;

  /* Per-subject summary */
  if(summaryEl){
    summaryEl.innerHTML = result.subResults.map(r => `
      <div class="gpa-stat">
        <div class="gpa-stat-val" style="color:${r.col}">${r.letter}</div>
        <div style="font-size:11px;color:var(--t1);font-weight:500;margin:2px 0">${r.subName}</div>
        <div class="gpa-stat-lbl">${r.pct}% Â· ${r.gp} GP</div>
        <div class="grade-bar-wrap" style="margin-top:6px">
          <div class="grade-bar" style="width:${r.pct}%;background:${r.col}"></div>
        </div>
      </div>`).join('');
  }

  /* Full entries table */
  if(listEl){
    if(!S.grades.length){ listEl.innerHTML = emptyState('bar-chart','No entries yet'); return; }
    listEl.innerHTML = S.grades.map(g => {
      const pct = Math.round(g.scored/g.outof*100);
      const { letter, col } = gradeToLetter(pct);
      return `<div class="grade-row">
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--t1)">${g.comp}</div>
          <div style="font-size:11px;color:var(--t2)">${g.subName} Â· ${g.weight}% weight</div>
        </div>
        <div style="font-size:13px;text-align:center;color:var(--t1)">${g.scored}/${g.outof}</div>
        <div style="font-size:13px;text-align:center;color:var(--t2)">${pct}%</div>
        <div class="grade-letter" style="color:${col}">${letter}</div>
        <button class="btn btn-ghost btn-sm" onclick="delGradeEntry(${g.id})">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    }).join('');
  }
}

/* ============================================================
   EXPORT / IMPORT â€” Data Resilience Engine
   ============================================================ */
function exportData(){
  const blob = new Blob(
    [JSON.stringify(S, null, 2)],
    { type: 'application/json' }
  );
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `synora-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded', 'Your data has been exported as JSON');
}

function importData(){
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try{
        const parsed = JSON.parse(ev.target.result);
        /* Validate it looks like a SYNORA backup */
        if(!Array.isArray(parsed.subjects)) throw new Error('Invalid backup file');
        /* Merge: overwrite state, keep seeded flag */
        Object.assign(S, parsed);
        save();
        /* Full re-render */
        refreshDrops(); updateUserUI();
        renderDash(); renderSubs(); renderTT(); renderExams();
        renderAtt(); renderRems(); renderGPA();
        toast('Import successful', `${parsed.subjects.length} subjects, ${parsed.exams.length} exams restored`);
      } catch(err){
        toast('Import failed', 'File is not a valid SYNORA backup');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

/* ============================================================
   GLOBAL SEARCH
   Searches across: subjects, reminders, saved files
   ============================================================ */
function runSearch(query){
  const el = document.getElementById('search-results');
  if(!el) return;
  const q = query.trim().toLowerCase();
  if(!q){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display = 'block';

  const hl = str => str.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
    '<span class="sr-highlight">$1</span>');

  const sections = [];

  /* Subjects */
  const matchSubs = S.subjects.filter(s => s.name.toLowerCase().includes(q));
  if(matchSubs.length){
    sections.push(`<div class="sr-group-title">Subjects</div>` +
      matchSubs.map(s => `<div class="sr-item" onclick="showPage('subjects');document.getElementById('sidebar-search').value='';document.getElementById('search-results').style.display='none'">
        <svg class="sr-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        <span>${hl(s.name)}</span>
        <span style="font-size:11px;color:var(--t3);margin-left:auto">Sem ${s.sem}</span>
      </div>`).join(''));
  }

  /* Reminders */
  const matchRems = S.reminders.filter(r => r.title.toLowerCase().includes(q));
  if(matchRems.length){
    sections.push(`<div class="sr-group-title">Reminders</div>` +
      matchRems.map(r => `<div class="sr-item" onclick="showPage('reminders');document.getElementById('sidebar-search').value='';document.getElementById('search-results').style.display='none'">
        <svg class="sr-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span>${hl(r.title)}</span>
        <span style="font-size:11px;color:var(--t3);margin-left:auto">${r.cat}</span>
      </div>`).join(''));
  }

  /* Saved files */
  const matchFiles = S.savedFiles.filter(f => f.name.toLowerCase().includes(q));
  if(matchFiles.length){
    sections.push(`<div class="sr-group-title">Saved Files</div>` +
      matchFiles.map(f => `<div class="sr-item" onclick="showPage('notes');document.getElementById('sidebar-search').value='';document.getElementById('search-results').style.display='none'">
        <svg class="sr-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
        <span>${hl(f.name)}</span>
        <span style="font-size:11px;color:var(--t3);margin-left:auto">${f.date||''}</span>
      </div>`).join(''));
  }

  /* Exams */
  const matchExams = S.exams.filter(e => e.name.toLowerCase().includes(q) || e.subName.toLowerCase().includes(q));
  if(matchExams.length){
    sections.push(`<div class="sr-group-title">Exams</div>` +
      matchExams.map(e => `<div class="sr-item" onclick="showPage('exams');document.getElementById('sidebar-search').value='';document.getElementById('search-results').style.display='none'">
        <svg class="sr-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
        <span>${hl(e.name)}</span>
        <span style="font-size:11px;color:var(--t3);margin-left:auto">${e.date}</span>
      </div>`).join(''));
  }

  el.innerHTML = sections.length
    ? sections.join('')
    : `<div style="font-size:12px;color:var(--t3);padding:var(--sp-2)">No results for "<strong>${query}</strong>"</div>`;
}

/* ============================================================
   SETTINGS â€” extend with export/import and search UI
   ============================================================ */
function saveSettings(){
  S.settings={name:document.getElementById('set-name').value.trim(),college:document.getElementById('set-college').value.trim(),sem:document.getElementById('set-sem').value,dept:document.getElementById('set-dept').value.trim()};
  save();updateUserUI();toast('Profile saved','Settings updated');
}
function loadSettingsForm(){
  document.getElementById('set-name').value=S.settings.name||'';
  document.getElementById('set-college').value=S.settings.college||'';
  document.getElementById('set-sem').value=S.settings.sem||'';
  document.getElementById('set-dept').value=S.settings.dept||'';
}
function updateUserUI(){
  const n = S.settings.name || 'Student';
  const c = S.settings.college || 'SYNORA';
  document.getElementById('user-display-name').textContent = n;
  document.getElementById('user-display-role').textContent = c;
  document.getElementById('sb-greeting').textContent = S.settings.name ? `Hey, ${S.settings.name.split(' ')[0]}!` : 'Welcome!';
  const initials = n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2) || 'SY';
  document.getElementById('user-avatar-initials').textContent = initials;
}
function clearData(t){
  if(!confirm('Are you sure? This cannot be undone.'))return;
  if(t==='all'){localStorage.removeItem(STORAGE_KEY);location.reload();}
  else if(t==='timetable')S.timetable=[];else if(t==='exams')S.exams=[];
  else if(t==='attendance')S.attendance={};else if(t==='flashcards')S.flashcards=[];
  else if(t==='savedFiles')S.savedFiles=[];
  save();toast('Cleared',t+' data removed');
}

/* ============================================================
   EVENT HANDLERS â€” global listeners wired here, not inline
   ============================================================ */

/* Tab visibility â€” pause/resume paths (handled in paths IIFE above).
   Also re-render dashboard when tab regains focus so stats are fresh. */
window.addEventListener('focus', ()=>{
  S = loadState();
  renderDash();
  updateUserUI();
});

/* Reminder check â€” poll every 30 s, fire toast when within 1 min of due */
setInterval(()=>{
  const now = new Date();
  S.reminders.forEach(r=>{
    const dt  = new Date(r.dt);
    const diff = dt - now;
    if(diff > 0 && diff < 60000) toast('Reminder: '+r.title, 'Due now', 6000);
  });
}, 30000);

/* Drag-and-drop â€” visual feedback on upload zones */
document.querySelectorAll('.upload-zone').forEach(zone=>{
  zone.addEventListener('dragover', e=>{ e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', ()=> zone.classList.remove('drag'));
  zone.addEventListener('drop', e=>{ e.preventDefault(); zone.classList.remove('drag'); });
});

/* Mouse-tracking radial glow on cards */
document.addEventListener('mousemove', e=>{
  const card = e.target.closest('.card');
  if(!card) return;
  const r   = card.getBoundingClientRect();
  const mx  = ((e.clientX - r.left) / r.width  * 100).toFixed(1) + '%';
  const my  = ((e.clientY - r.top)  / r.height * 100).toFixed(1) + '%';
  card.style.setProperty('--mx', mx);
  card.style.setProperty('--my', my);
});

/* Close search results when clicking outside */
document.addEventListener('click', e=>{
  const sr = document.getElementById('search-results');
  const sb = document.getElementById('sidebar-search');
  if(sr && !sr.contains(e.target) && e.target !== sb){
    sr.style.display = 'none';
  }
});

/* ============================================================
   INITIALIZATION
   ============================================================ */
(function init(){
  seedDemoData();
  S = loadState();
  refreshDrops();
  updateUserUI();
  renderDash();
  renderSubs();
  renderTT();
  renderExams();
  renderAtt();
  loadThreshUI();
  renderRems();
  renderFocus();
  renderGPA();
  document.getElementById('att-date').value = new Date().toISOString().split('T')[0];
})();
