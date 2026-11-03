/* ============================================================
   Everyday Voice Assistant — static edition (runs fully in the browser)
   Requests are understood locally (see the answer engine below and
   questions.js), so no server is needed. The interaction layer
   that differs between the two conditions:
     - standard : faster speech, small captions, actions run at once,
                  voice-only Repeat/Help
     - adapted  : slower speech, large-text transcript, "I heard" feedback,
                  Yes/No confirmation before timers and reminders,
                  on-screen Repeat and Help, graded error recovery
   ============================================================ */

const App = {
  mode: 'standard',
  lastAssistant: '',
  pending: null,          // actions awaiting Yes/No (adapted mode)
  misses: 0,              // consecutive not-understood turns
  history: [],            // [{role, content}] conversation so far
  timers: [],             // [{id, label, remaining, interval}]
  reminders: [],          // [{task, when}]
  busy: false,
  awaiting: null,         // follow-up slot after a clarification: 'timer' | 'reminder'
  weather: null,          // last simulated forecast shown
  ageGroup: 'not asked',  // from the age entered: '55+', 'under 55', 'not stated'
  recog: null,
  listening: false,
};
let timerSeq = 0;

const $ = id => document.getElementById(id);
const body = document.body;

/* ---------- Mode switching ---------- */
function setMode(m){
  App.mode = m;
  body.classList.toggle('adapted', m==='adapted');
  body.classList.toggle('standard', m==='standard');
  $('btnStandard').classList.toggle('active', m==='standard');
  $('btnAdapted').classList.toggle('active', m==='adapted');
  $('btnStandard').setAttribute('aria-selected', m==='standard');
  $('btnAdapted').setAttribute('aria-selected', m==='adapted');
  $('modeBadge').textContent = m==='adapted' ? 'Age-Adapted mode' : 'Standard mode';
  if(body.classList.contains('in-session')) $('sbVersion').textContent = `${m==='adapted'?'Age-Adapted':'Standard'} version`;
  $('hint').textContent = m==='adapted'
    ? 'Ask a question from the list, or your own.'
    : 'Ask a question from the list, or your own.';
  App.pending = null; App.misses = 0; App.awaiting = null;
  $('heard').classList.remove('show','live');
  renderPanels();
  logEvent('mode', m);
}
$('btnStandard').onclick = ()=>setMode('standard');
$('btnAdapted').onclick  = ()=>setMode('adapted');

/* ---------- Transcript ---------- */
function addBubble(text, who){
  const em = $('emptyMsg'); if(em) em.remove();
  const b = document.createElement('div');
  b.className = 'bubble ' + (who==='user'?'user':'asst');
  const w = document.createElement('span'); w.className='who';
  w.textContent = who==='user' ? 'You' : 'Assistant';
  b.appendChild(w);
  b.appendChild(document.createTextNode(text));
  const t = $('transcript'); t.appendChild(b); t.scrollTop = t.scrollHeight;
}
function remember(role, content){ App.history.push({role, content}); if(App.history.length>40) App.history.splice(0, App.history.length-40); }

/* ---------- "I heard" feedback (adapted) ---------- */
function showHeard(text, label, live){
  $('heardLbl').textContent = label;
  $('heardTxt').textContent = `“${text}”`;
  $('heard').classList.add('show');
  $('heard').classList.toggle('live', !!live);
}

/* ---------- Speech output ---------- */
// remember=false is used by Repeat so the repeated text does not nest its own prefix
function speak(text, rememberIt=true){
  if(rememberIt) App.lastAssistant = text;
  addBubble(text, 'asst');
  logEvent('assistant', text);
  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate  = App.mode==='adapted' ? 0.82 : 1.05;   // slower in adapted mode
    u.pitch = 1.0;
    u.onstart = ()=>{ $('orb').classList.add('speaking'); setStatus('Speaking…'); };
    u.onend   = ()=>{ $('orb').classList.remove('speaking'); setStatus('Ready'); };
    window.speechSynthesis.speak(u);
  }catch(e){ /* TTS unsupported: transcript still shows text */ }
}
function setStatus(s, err){ const el=$('status'); el.textContent=s; el.classList.toggle('err', !!err); }

/* ---------- Repeat / Help ---------- */
function repeatLast(){
  countStudy('repeats'); logEvent('repeat');
  if(!App.lastAssistant){ speak(App.mode==='adapted'
      ? "There is nothing to repeat yet. Please ask me something first."
      : "Nothing to repeat yet."); return; }
  const prefix = App.mode==='adapted' ? "Of course. I said: " : "";
  speak(prefix + App.lastAssistant, false);
}
function help(){
  countStudy('help'); logEvent('help');
  speak(App.mode==='adapted'
    ? "I can help with five things. The weather. A timer. A reminder. The date. And common questions, like how to boil an egg. What would you like?"
    : "I can check the weather, set timers and reminders, tell you the date and time, and answer common questions about health, cooking, technology and more. What would you like?");
}
$('repeatBtn').onclick = ()=>{ addBubble('Repeat that', 'user'); repeatLast(); };
$('helpBtn').onclick   = ()=>{ addBubble('Help', 'user'); App.pending ? helpDuringConfirm() : help(); };

const RE_REPEAT = /^\s*(repeat( that)?|say that again|again|what did you say|pardon)\s*[.?!]*\s*$/i;
const RE_HELP   = /^\s*(help|what can you do|what can i say)\s*[.?!]*\s*$/i;

/* ============================================================
   Request handling
   ============================================================ */
function handle(raw, source){
  let text = (raw||'').trim();
  if(!text || App.busy) return;

  if(text==='__garble__'){ text = "set a … rindaa for … (unclear)"; source = 'simulated'; }

  addBubble(text, 'user');
  logEvent('user', text, source||'text');
  countStudy('turns');
  if(App.mode==='adapted') showHeard(text, source==='voice' ? 'I heard' : 'You asked');

  // A Yes/No question is open (adapted mode): answer it on the device, no model call needed
  if(App.pending) return resolveConfirmation(text);

  // Repeat and Help are handled on the device so they are instant and always work
  if(RE_REPEAT.test(text)) return repeatLast();
  if(RE_HELP.test(text)) return help();

  askServer(text);
}

/* ============================================================
   Local answer engine (runs in the browser)
   Understands the study tasks (timer, reminder, weather, date/time),
   answers questions from questions.js, and returns
   { reply, actions, unclear } for the page to speak and act on.
   ============================================================ */
const WORDNUM = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  fifteen:15,twenty:20,thirty:30,forty:40,'forty-five':45,sixty:60,a:1,an:1};
function parseDuration(t){
  t = t.replace(/\bhalf an hour\b/,'30 minutes').replace(/\ban hour\b/,'1 hour')
       .replace(/\b(forty-five|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|sixty)\b/g, w=>WORDNUM[w]);
  const m = t.match(/(\d+)\s*(seconds?|minutes?|hours?|mins?|secs?|hrs?)\b/);
  if(!m) return null;
  const n = parseInt(m[1],10), u = m[2];
  if(!n) return null;
  const secs = u.startsWith('h') ? n*3600 : u.startsWith('s') ? n : n*60;
  const word = u.startsWith('h') ? 'hour' : u.startsWith('s') ? 'second' : 'minute';
  return {secs, label:`${n} ${word}${n>1?'s':''}`};
}
function parseReminder(t){
  const clean = s => (s||'').replace(/[?!]+$/,'').replace(/\.$/,'').trim();
  let what, when, m = t.match(/remind me (?:at|by|on) (.+?) to (.+)$/);
  if(m){ when = m[1]; what = m[2]; }
  else{
    m = t.match(/remind me to (.+?)(?:\s+(?:at|by|on)\s+(.+))?$/);
    if(!m) return null;
    what = m[1]; when = m[2] || '';
  }
  what = clean(what).replace(/\bmy\b/g,'your').replace(/\bmyself\b/g,'yourself'); when = clean(when);
  const day = what.match(/\s+(today|tonight|tomorrow)$/);
  if(day){ what = what.slice(0, day.index); when = day[1] + (when ? ` at ${when}` : ''); }
  return what ? {task:what, when} : null;
}
const isAdapted = ()=>App.mode==='adapted';
const pick = (standard, adapted)=> isAdapted() ? adapted : standard;
function act(type, fields){ return {type, ...fields, status: (isAdapted() && (type==='set_timer'||type==='create_reminder')) ? 'pending' : 'done'}; }

function understand(raw){
  let t = raw.toLowerCase().replace(/[’‘]/g,"'").replace(/[^\w\s':.-]/g,' ').replace(/\s+/g,' ').trim();

  // a follow-up answer to "How long should the timer be?" / "What should I remind you about?"
  if(App.awaiting){
    const slot = App.awaiting; App.awaiting = null;
    if(slot==='timer' && parseDuration(t) && !/\btimer\b/.test(t)) t = 'timer ' + t;
    if(slot==='reminder' && !/\bremind/.test(t)) t = 'remind me to ' + t.replace(/^to\s+/,'');
  }

  // ---- timers ----
  if(/\btimer\b/.test(t)){
    if(/\b(cancel|stop|turn off|delete)\b/.test(t)){
      if(!App.timers.some(x=>x.interval)) return {reply: pick("You don't have any timers running.", "There is no timer running right now.")};
      return {reply: pick("Okay, timer cancelled.", "Okay. I have stopped your timer."), actions:[act('cancel_timer',{label:''})]};
    }
    const d = parseDuration(t);
    if(d){
      const a = act('set_timer',{seconds:d.secs, label:d.label});
      return {reply: a.status==='pending'
        ? `I heard a timer for ${d.label}. Should I start it? Please say yes or no.`
        : `Timer set for ${d.label}, starting now.`, actions:[a]};
    }
    return clarify('timer');
  }

  // ---- reminders ----
  if(/\b(what|which|list|show)\b.*\breminders?\b|\bmy reminders\b/.test(t)) return listReminders();
  if(/\b(delete|remove|cancel)\b.*\breminder/.test(t)){
    if(!App.reminders.length) return {reply: pick("You don't have any reminders saved.", "You have no reminders saved.")};
    const r = App.reminders[App.reminders.length-1];
    return {reply: pick(`Done, I deleted your reminder to ${r.task}.`, `Okay. I deleted the reminder to ${r.task}.`), actions:[act('delete_reminder',{task:r.task})]};
  }
  if(/\bremind/.test(t)){
    const r = parseReminder(t);
    if(r){
      const a = act('create_reminder', r);
      const when = r.when ? (/^(today|tonight|tomorrow)/.test(r.when) ? ` ${r.when}` : ` at ${r.when}`) : '';
      return {reply: a.status==='pending'
        ? `I heard: remind you to ${r.task}${when}. Is that right? Please say yes or no.`
        : `Okay, I'll remind you to ${r.task}${when}.`, actions:[a]};
    }
    return clarify('reminder');
  }

  // ---- weather (simulated) ----
  if(/\b(weather|forecast|rain|raining|temperature|umbrella|sunny|cold outside|hot outside)\b/.test(t)){
    const when = /\btomorrow\b/.test(t) ? 'tomorrow' : 'today';
    const w = window.SIMULATED_WEATHER[when];
    App.weather = {when, ...w};
    renderPanels();
    const Day = when==='tomorrow' ? 'Tomorrow' : 'Today';
    return {reply: pick(
      `${Day} will be ${w.desc} with a high of ${w.high} degrees and a low of ${w.low}, so you might want a light jacket in the evening.`,
      `${Day} will be ${w.desc}. The high is ${w.high} degrees.`)};
  }

  // ---- date and time ----
  if(/\b(what day|day is it|what('s| is) (the |today's )?date|today's date|what date)\b/.test(t)){
    const s = new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
    return {reply: pick(`It's ${s}. Is there anything else I can help you with?`, `Today is ${s}.`)};
  }
  if(/\b(what time|current time|time is it)\b/.test(t)){
    const s = new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    return {reply: pick(`It's ${s}.`, `The time is ${s}.`)};
  }

  // ---- small talk ----
  if(/^(hello|hi|hey|good (morning|afternoon|evening))\b/.test(t))
    return {reply: pick("Hi there! How can I help?", "Hello. What would you like to do?")};
  if(/\b(thank you|thanks)\b/.test(t))
    return {reply: pick("You're welcome! Anything else?", "You are welcome.")};
  if(/\b(what can (i|you) ask|what (questions|can you answer)|what do you know)\b/.test(t)) return topics();

  // ---- question bank ----
  for(const q of window.QUESTION_BANK){
    if(q.match.some(re=>re.test(t))) return {reply: pick(q.standard, q.adapted), topic:q.id};
  }

  // ---- not understood ----
  return notUnderstood();
}

function clarify(kind){
  if(isAdapted()){
    App.awaiting = kind;
    return {reply: kind==='timer'
      ? "How long should the timer be? For example, say “5 minutes.”"
      : "What should I remind you about, and when? For example, say “call my doctor at 3 PM.”"};
  }
  return {reply: kind==='timer'
    ? "Okay — try, for example, “set a timer for 5 minutes.”"
    : "Okay — try, for example, “remind me to call my doctor at 3 PM.”"};
}
function listReminders(){
  if(!App.reminders.length) return {reply: pick("You don't have any reminders yet.", "You have no reminders saved.")};
  const list = App.reminders.map(r=>`${r.task}${r.when && r.when!=='—' ? ' at '+r.when : ''}`).join(', and ');
  return {reply: pick(`You have ${App.reminders.length} reminder${App.reminders.length>1?'s':''}: ${list}.`, `Your reminders are: ${list}.`)};
}
const TOPIC_NAMES = {'Everyday knowledge':'everyday knowledge', 'Health':'health', 'Cooking':'cooking', 'Technology':'technology', 'Fun':'fun facts'};
function topics(){
  const t = [...new Set(window.QUESTION_BANK.map(q=>q.topic).filter(x=>x!=='About the assistant'))].map(x=>TOPIC_NAMES[x]||x.toLowerCase());
  const names = t.length>1 ? t.slice(0,-1).join(', ')+' and '+t[t.length-1] : t.join('');
  return {reply: pick(
    `Besides timers, reminders, the weather and the date, I can answer common questions about ${names}. For example, try asking how to boil an egg, or why the sky is blue.`,
    `I can answer common questions about ${names}. For example, ask: how do I boil an egg?`)};
}
function notUnderstood(){
  if(!isAdapted()) return {reply:"Sorry, I didn't understand that.", unclear:true};
  if(App.misses+1 >= 2) return {reply:"I am still having trouble understanding. I can tell you the weather, set a timer, make a reminder, tell you the date, or answer common questions. You can also type your request, or tap Help.", unclear:true};
  return {reply:"Sorry, I didn't catch that. You can say, for example, “set a timer for 5 minutes.” Or say “help” to hear what I can do.", unclear:true};
}

async function askServer(text){
  App.busy = true;
  $('orb').classList.add('thinking'); setStatus('Thinking…');
  await new Promise(r=>setTimeout(r, 350));   // brief pause so the reply doesn't feel abrupt
  try{
    const data = understand(text);
    remember('user', text);
    if(data.unclear){ App.misses++; countStudy('errors'); logEvent('error','not understood'); }
    else App.misses = 0;
    const pending = [];
    for(const a of data.actions||[]){
      if(a.status==='pending') pending.push(a); else applyAction(a);
    }
    if(pending.length){ App.pending = pending; renderPanels(); }
    remember('assistant', data.reply);
    if(data.unclear) setStatus(App.mode==='adapted' ? "I didn't catch that" : "Didn't understand", true);
    speak(data.reply);
  }finally{
    App.busy = false;
    $('orb').classList.remove('thinking');
  }
}

/* ---------- Device actions ---------- */
function describe(a){
  if(a.type==='set_timer') return `a timer for ${a.label}`;
  if(a.type==='create_reminder') return `a reminder to ${a.task}${a.when?` ${/^(today|tonight|tomorrow)/i.test(a.when)?'':'at '}${a.when}`:''}`;
  return 'that';
}
function applyAction(a){
  logEvent('action', JSON.stringify(a));
  if(a.type==='set_timer') startTimer(a.seconds, a.label);
  else if(a.type==='create_reminder'){ App.reminders.push({task:a.task, when:a.when||'—'}); renderPanels(); }
  else if(a.type==='cancel_timer'){
    const i = a.label ? App.timers.findIndex(t=>t.label.toLowerCase().includes(a.label.toLowerCase())) : -1;
    const t = App.timers.splice(i>=0 ? i : App.timers.length-1, 1)[0];
    if(t) clearInterval(t.interval);
    renderPanels();
  }else if(a.type==='delete_reminder'){
    const q = (a.task||'').toLowerCase();
    const i = App.reminders.findIndex(r=>r.task.toLowerCase().includes(q) || q.includes(r.task.toLowerCase()));
    if(i>=0) App.reminders.splice(i,1);
    renderPanels();
  }
}

/* ---------- Confirmation (adapted) ---------- */
function confirmQuestion(){ return `Should I set ${App.pending.map(describe).join(' and ')}? Please say yes or no.`; }
function resolveConfirmation(text){
  const t = text.toLowerCase();
  if(RE_REPEAT.test(t)) return repeatLast();
  if(RE_HELP.test(t)) return helpDuringConfirm();
  const yes = /\b(yes|yeah|yep|sure|correct|right|okay|ok|please do|go ahead|do it)\b/.test(t);
  const no  = /\b(no|nope|cancel|stop|don'?t|wrong|not)\b/.test(t);
  const p = App.pending;
  if(yes && !no){
    App.pending = null; logEvent('confirm','yes');
    p.forEach(applyAction);
    const msg = `Done. I set ${p.map(describe).join(' and ')}.`;
    remember('user', text); remember('assistant', msg);
    speak(msg);
  }else if(no && !yes){
    App.pending = null; renderPanels(); logEvent('confirm','no');
    const msg = "Okay, I cancelled that. What would you like to do instead?";
    remember('user', text); remember('assistant', msg);
    speak(msg);
  }else{
    countStudy('errors'); logEvent('error','confirmation unclear');
    setStatus("I need a yes or a no", true);
    speak("Sorry, I need a yes or a no. " + confirmQuestion());
  }
}
function helpDuringConfirm(){
  countStudy('help'); logEvent('help','during confirmation');
  speak(`I am waiting for your answer. Say yes, or tap Yes, to set ${App.pending.map(describe).join(' and ')}. Say no, or tap No, to cancel.`);
}

/* ---------- Timers ---------- */
function startTimer(secs, label){
  const t = {id:++timerSeq, label, remaining:secs, interval:null};
  t.interval = setInterval(()=>{
    t.remaining--;
    if(t.remaining<=0){
      clearInterval(t.interval); t.interval=null;
      updateTimerDisplay(t);
      speak(App.mode==='adapted' ? `Your timer for ${label} is finished.` : `Time's up — your ${label} timer is done.`);
      beep();
      setTimeout(()=>{ App.timers = App.timers.filter(x=>x!==t); renderPanels(); }, 60000);
    } else updateTimerDisplay(t);
  },1000);
  App.timers.push(t);
  renderPanels();
}
// Stop a running timer, or dismiss one that has finished
function closeTimer(t){
  const running = !!t.interval;
  clearInterval(t.interval);
  App.timers = App.timers.filter(x=>x!==t);
  logEvent('timer_closed', `${t.label}${running?' (stopped early)':''}`);
  renderPanels();
  setStatus(running ? 'Timer stopped' : 'Ready');
}
function fmt(r){ r=Math.max(0,r); const h=Math.floor(r/3600), m=Math.floor(r%3600/60), s=r%60;
  return (h?`${h}:`:'')+`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function updateTimerDisplay(t){
  const el = document.getElementById('timerVal'+t.id); if(!el) return;
  el.textContent = t.interval ? fmt(t.remaining) : 'Done ✓';
  el.classList.toggle('done', !t.interval);
  const btn = document.getElementById('timerBtn'+t.id);
  if(btn && !t.interval){ btn.textContent = 'Close'; btn.setAttribute('aria-label', `Close the ${t.label} timer`); }
}
function beep(){
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=880;
    g.gain.setValueAtTime(.001,ctx.currentTime); g.gain.exponentialRampToValueAtTime(.3,ctx.currentTime+.05);
    o.start();
    g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.8); o.stop(ctx.currentTime+.85);
  }catch(e){}
}

/* ============================================================
   Result panels
   ============================================================ */
function renderPanels(){
  const stack = $('panelStack'); stack.innerHTML='';
  if(App.pending){
    const c=document.createElement('div'); c.className='result confirm';
    const txt = App.pending.map(describe).join(' and ');
    c.innerHTML = `<div class="rh">⚠️ Please confirm</div><div>Set ${escapeHtml(txt)}?</div>
      <div class="cbtns"><button class="yes">Yes</button><button class="no">No</button></div>`;
    c.querySelector('.yes').onclick=()=>{ addBubble('Yes','user'); countStudy('turns'); resolveConfirmation('yes'); };
    c.querySelector('.no').onclick =()=>{ addBubble('No','user');  countStudy('turns'); resolveConfirmation('no');  };
    stack.appendChild(c);
  }
  if(App.weather){
    const w = App.weather, d=document.createElement('div'); d.className='result';
    d.innerHTML = `<div class="rh">🌡️ Weather · ${w.when}</div>
      <div class="weather"><div class="ic">${w.when==='tomorrow'?'🌤️':'☁️'}</div>
      <div><div class="temp">${w.high}°F</div><div>${escapeHtml(w.desc)} · low ${w.low}°F</div></div></div>`;
    stack.appendChild(d);
  }
  for(const t of App.timers){
    const d=document.createElement('div'); d.className='result';
    d.innerHTML=`<div class="rh">⏲️ Timer · ${escapeHtml(t.label)}</div>
      <div class="timerrow"><div class="timerbig${t.interval?'':' done'}" id="timerVal${t.id}">${t.interval?fmt(t.remaining):'Done ✓'}</div>
      <button class="timerclose" id="timerBtn${t.id}" aria-label="${t.interval?'Stop':'Close'} the ${escapeHtml(t.label)} timer">${t.interval?'Stop':'Close'}</button></div>`;
    d.querySelector('.timerclose').onclick = ()=>closeTimer(t);
    stack.appendChild(d);
  }
  if(App.reminders.length){
    const d=document.createElement('div'); d.className='result';
    d.innerHTML=`<div class="rh">⏰ Reminders</div><ul class="remlist">`+
      App.reminders.map(x=>`<li><span>${escapeHtml(x.task)}</span><span class="time">${escapeHtml(x.when)}</span></li>`).join('')+
      `</ul>`;
    stack.appendChild(d);
  }
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

/* ============================================================
   Experimenter panel: trial timing and interaction counts
   ============================================================ */
const Study = { trial:null, trials:[], events:[], tick:null };

function logEvent(type, detail, source){
  Study.events.push({time:new Date().toISOString(), participant:$('pid')?$('pid').value.trim():'',
    condition:App.mode, task:Study.trial?Study.trial.task:'', type, detail:detail||'', source:source||''});
}
function countStudy(key){ if(Study.trial) Study.trial[key]++; }

function startTrial(){
  Study.trial = {participant:$('pid').value.trim()||'—', age_group:App.ageGroup, condition:App.mode, task:$('taskSel').value,
    start:performance.now(), turns:0, errors:0, repeats:0, help:0};
  logEvent('task_start');
  $('taskStart').disabled=true; $('taskOk').disabled=false; $('taskFail').disabled=false;
  Study.tick = setInterval(updateLive, 250); updateLive();
}
function endTrial(success){
  const tr = Study.trial; if(!tr) return;
  clearInterval(Study.tick);
  tr.seconds = ((performance.now()-tr.start)/1000).toFixed(1);
  tr.result = success ? 'success' : 'fail';
  logEvent('task_end', tr.result);
  Study.trials.push(tr); Study.trial = null;
  $('taskStart').disabled=false; $('taskOk').disabled=true; $('taskFail').disabled=true;
  $('taskLive').textContent = 'No task running';
  renderTrials();
}
function updateLive(){
  const tr = Study.trial; if(!tr) return;
  $('taskLive').textContent = `${tr.task} · ${tr.condition} · ${((performance.now()-tr.start)/1000).toFixed(1)} s · `+
    `turns ${tr.turns} · errors ${tr.errors} · repeats ${tr.repeats} · help ${tr.help}`;
}
const TRIAL_COLS = ['participant','age_group','condition','task','result','seconds','turns','errors','repeats','help'];
function renderTrials(){
  $('trialRows').innerHTML = Study.trials.map(r=>'<tr>'+TRIAL_COLS.map(k=>`<td>${escapeHtml(r[k])}</td>`).join('')+'</tr>').join('');
}
function downloadCsv(name, cols, rows){
  const q = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const csv = [cols.join(',')].concat(rows.map(r=>cols.map(k=>q(r[k])).join(','))).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}
$('taskStart').onclick = startTrial;
$('taskOk').onclick    = ()=>endTrial(true);
$('taskFail').onclick  = ()=>endTrial(false);
$('exportTrials').onclick = ()=>downloadCsv(`trials_${$('pid').value.trim()||'session'}.csv`, TRIAL_COLS, Study.trials);
$('exportEvents').onclick = ()=>downloadCsv(`events_${$('pid').value.trim()||'session'}.csv`,
  ['time','participant','condition','task','type','detail','source'], Study.events);
$('clearTrials').onclick  = ()=>{ if(confirm('Clear all logged trials and events?')){ Study.trials=[]; Study.events=[]; renderTrials(); } };
if(new URLSearchParams(location.search).get('study')==='1') body.classList.add('study');

/* ============================================================
   Input wiring: buttons, text, speech
   ============================================================ */
$('sendBtn').onclick = ()=>{ const v=$('textIn').value; $('textIn').value=''; handle(v, 'text'); };
$('textIn').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const v=e.target.value; e.target.value=''; handle(v, 'text'); }});
// "You can ask" list, always shown next to the assistant
const SUGGESTIONS = [
  "What's the weather tomorrow?", "Set a timer for 5 minutes", "Remind me to take my medication at 8 PM",
  "What day is it today?", "How do I boil an egg?", "Why is the sky blue?",
  "How much water should I drink?", "Tell me a joke",
];
$('askList').innerHTML = SUGGESTIONS.map(s=>`<button class="ask-item" data-cmd="${escapeHtml(s)}">“${escapeHtml(s)}”</button>`).join('');
$('askList').addEventListener('click',e=>{
  const b=e.target.closest('.ask-item'); if(!b) return;
  handle(b.dataset.cmd, 'suggestion');
});

/* ---------- Speech recognition (best effort, Chrome) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function initRecog(){
  if(!SR) return null;
  const r=new SR(); r.lang='en-US'; r.interimResults=true; r.maxAlternatives=1;
  r.onstart = ()=>{ App.listening=true; $('orb').classList.add('listening'); setStatus('Listening…');
                    $('micLabel').textContent='Listening — tap to stop'; $('micBtn').classList.add('stop'); };
  r.onerror = (e)=>{ stopListeningUI();
     if(e.error==='not-allowed'||e.error==='service-not-allowed')
        setStatus('Microphone blocked — type or use shortcuts', true);
     else if(e.error==='no-speech' && App.mode==='adapted')
        setStatus("I didn't hear anything — tap to try again", true);
     else setStatus('Ready'); };
  r.onend   = ()=> stopListeningUI();
  r.onresult= (e)=>{
    let interim='', final='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const s=e.results[i][0].transcript;
      if(e.results[i].isFinal) final+=s; else interim+=s;
    }
    if(interim && App.mode==='adapted') showHeard(interim+' …', 'Hearing', true);
    if(final) handle(final, 'voice');
  };
  return r;
}
function stopListeningUI(){ App.listening=false; $('orb').classList.remove('listening');
  $('micLabel').textContent='Tap to speak'; $('micBtn').classList.remove('stop');
  $('heard').classList.remove('live');
  if($('status').textContent==='Listening…') setStatus('Ready'); }

$('micBtn').onclick = ()=>{
  if(!App.recog) App.recog = initRecog();
  if(!App.recog){
    setStatus('Speech input not available here', true);
    speak(App.mode==='adapted'
      ? "Speech input is not available in this browser. You can type your question, or tap one of the buttons below."
      : "Speech input isn't available here — type a question or use the buttons.");
    return;
  }
  if(App.listening){ App.recog.stop(); return; }
  try{ window.speechSynthesis.cancel(); }catch(e){}
  try{ App.recog.start(); }catch(e){ /* already started */ }
};

window.speechSynthesis && window.speechSynthesis.getVoices();
setMode('standard');

/* ============================================================
   Study flow (short)
   consent → age → how it works → first version → 3 questions →
   second version → 3 questions → which did you prefer → thank you
   ============================================================ */
// Six statements per version, each tied to a hypothesis (H1 task success, H2 workload, H3 usability).
// Two are negatively worded so that answering every item the same way stands out.
const QUESTIONS = [
  {key:'easy',        q:'It was easy to use.',                          lo:'Disagree', hi:'Agree'},  // H3
  {key:'understood',  q:'I understood what it said.',                   lo:'Disagree', hi:'Agree'},  // H3
  {key:'effort',      q:'It took a lot of effort.',                     lo:'Disagree', hi:'Agree'},  // H2
  {key:'success',     q:'I was able to do what I wanted to do.',        lo:'Disagree', hi:'Agree'},  // H1
  {key:'frustrating', q:'It was frustrating to use.',                   lo:'Disagree', hi:'Agree'},  // H2
  {key:'would_use',   q:'I would use this assistant in my daily life.', lo:'Disagree', hi:'Agree'},  // H3
];
const AGE_CUTOFF = 55;   // participants this age or older start with the age-adapted version
const FLOW_STEPS = ['consent','age','intro','part0','survey0','part1','survey1','final'];
const MODE_NAME = m => m==='adapted' ? 'Age-Adapted' : 'Standard';
const VERSION = i => `${MODE_NAME(Session.order[i])} version`;

const Session = {
  step:'consent', pid:'', name:'', age:null, ageGroup:'', order:[], active:-1,
  parts:[0,1].map(()=>({mode:'', started_at:'', ended_at:'', answers:{}})),
  final:{choice:'', comments:''}, saved:null, payload:null,
};

const choice = (act,val,on,t)=>`<button class="choice" role="radio" aria-checked="${on}" data-act="${act}" data-v="${val}"><span class="radio"></span><span><b>${t}</b></span></button>`;

const SCREENS = {
  consent: ()=>`
    <p class="eyebrow">UTD · CS 6326</p>
    <h1>This is a UTD CS-6326 HCI survey</h1>
    <p class="lead">You will try two versions of a voice assistant and answer a few quick questions. It takes about 5 minutes, and you can stop at any time. Giving your name and age is optional.${window.SURVEY_ENDPOINT
      ? ' Your answers are sent to the research team.' : ''}</p>
    <p class="ask">Are you sure you want to proceed?</p>
    <div class="actions">
      <button class="btn primary" data-act="consent-yes">Yes, continue</button>
      <button class="btn ghost" data-act="consent-no">No, exit</button>
    </div>`,

  exit: ()=>`
    <h1>Thank you</h1>
    <p class="lead">No problem. You can close this window.</p>
    <div class="actions"><button class="btn ghost" data-act="goto" data-v="consent">Go back</button></div>`,

  age: ()=>`
    <p class="eyebrow">About you</p>
    <h1>A little about you</h1>
    <p class="lead">Both are optional. Leave them blank to take part anonymously.</p>
    <label class="field" for="nameIn">Your name <span class="opt">(optional)</span></label>
    <input id="nameIn" class="textin" type="text" maxlength="80" autocomplete="off" placeholder="Leave blank to stay anonymous" value="${escapeHtml(Session.name)}">
    <label class="field" for="ageIn">Your age <span class="opt">(optional)</span></label>
    <input id="ageIn" class="textin" type="number" inputmode="numeric" min="18" max="110" placeholder="For example, 62" value="${Session.age??''}">
    <p class="formerr" id="ageErr" hidden>Please enter an age between 18 and 110, or leave it blank.</p>
    <div class="actions"><button class="btn primary" data-act="about">Continue</button></div>`,

  intro: ()=>`
    <h1>How it works</h1>
    <div class="timeline">
      <div class="tl"><div class="n">1</div><div><b>Talk or type</b><span>Tap “Tap to speak” and ask a question, or type it.</span></div></div>
      <div class="tl"><div class="n">2</div><div><b>Not sure what to ask?</b><span>Pick from the list of questions next to the assistant.</span></div></div>
      <div class="tl"><div class="n">3</div><div><b>Try both versions</b><span>Ask a few questions in each version, then tell us what you thought. The switch at the top shows which version you are using.</span></div></div>
    </div>
    <div class="actions"><button class="btn primary" data-act="begin" data-v="0">Start the ${VERSION(0)}</button></div>`,

  part1: ()=>`
    <h1>Now try the ${VERSION(1)}</h1>
    <p class="lead">Ask a few questions again. This version works a little differently.</p>
    <div class="actions"><button class="btn primary" data-act="begin" data-v="1">Start the ${VERSION(1)}</button></div>`,

  survey0: ()=>survey(0),
  survey1: ()=>survey(1),

  final: ()=>`
    <h1>Which version did you prefer?</h1>
    <div class="choices" role="radiogroup" aria-label="Preferred version">
      ${choice('pref','A',Session.final.choice==='A',VERSION(0))}
      ${choice('pref','B',Session.final.choice==='B',VERSION(1))}
      ${choice('pref','none',Session.final.choice==='none','No preference')}
    </div>
    <label class="field" for="commentsIn">Anything else? <span style="font-weight:400;color:#64748b">(optional)</span></label>
    <textarea id="commentsIn" data-final="comments">${escapeHtml(Session.final.comments)}</textarea>
    <div class="actions"><button class="btn primary" data-act="submit" ${Session.final.choice?'':'disabled'}>Submit</button></div>`,

  done: ()=>`
    <div class="bigcheck">✓</div>
    <h1>Thank you!</h1>
    <p class="lead">${Session.sent ? 'Your answers have been sent to the research team.'
      : Session.saved ? (window.SURVEY_ENDPOINT ? 'Your answers are saved and will be sent when the app is next opened with internet.' : 'Your answers are saved.')
      : 'Please ask the researcher to download your answers.'}</p>
    <div class="actions">
      <button class="btn ghost" data-act="download">Download results</button>
      <button class="btn ghost" data-act="restart">New session</button>
    </div>`,
};

function survey(n){
  const a = Session.parts[n].answers;
  return `
    <p class="eyebrow">${VERSION(n)}</p>
    <h1>What did you think?</h1>
    ${QUESTIONS.map(x=>`<div class="q"><p>${x.q}</p>
      <div class="likert" role="radiogroup" aria-label="${x.q}">
        ${[1,2,3,4,5].map(v=>`<button role="radio" aria-checked="${a[x.key]===v}" aria-label="${v} of 5" data-act="ans" data-k="${x.key}" data-v="${v}">${v}</button>`).join('')}
      </div>
      <div class="scale-labels"><span>${x.lo}</span><span>${x.hi}</span></div></div>`).join('')}
    <div class="actions"><button class="btn primary" data-act="snext" ${surveyDone(n)?'':'disabled'}>Next</button></div>`;
}
const surveyDone = n => QUESTIONS.every(x=>Session.parts[n].answers[x.key]!=null);

function progressDots(){
  const at = FLOW_STEPS.indexOf(Session.step==='done' ? 'final' : Session.step==='exit' ? 'consent' : Session.step);
  return FLOW_STEPS.map((s,k)=>`<i class="${Session.step==='done'||k<at?'done':k===at?'on':''}"></i>`).join('');
}
function show(step){
  Session.step = step;
  body.classList.remove('in-session');
  const f = $('flow');
  f.hidden = false;
  f.innerHTML = `<div class="flow-inner"><div class="flow-top"><div class="brandmini"><span class="dot">◉</span>Everyday Voice Assistant</div>
    <div class="steps" aria-hidden="true">${progressDots()}</div></div><section class="fcard">${SCREENS[step]()}</section></div>`;
  f.scrollTop = 0;
  const h = f.querySelector('h1'); if(h){ h.tabIndex = -1; h.focus({preventScroll:true}); }
}

/* ---------- Using one version ---------- */
function resetConversation(){
  App.history = []; App.pending = null; App.misses = 0; App.lastAssistant = ''; App.awaiting = null; App.weather = null;
  App.timers.forEach(t=>clearInterval(t.interval)); App.timers = []; App.reminders = [];
  $('transcript').innerHTML = '<div class="empty" id="emptyMsg">Your conversation will appear here.</div>';
  $('heard').classList.remove('show','live');
  try{ window.speechSynthesis.cancel(); }catch(e){}
  renderPanels(); setStatus('Ready');
}
function beginPart(n){
  const p = Session.parts[n];
  Session.active = n;
  setMode(Session.order[n]);
  resetConversation();
  p.mode = Session.order[n]; p.started_at = new Date().toISOString();
  logEvent('part_start', `${VERSION(n)} (${p.mode})`);
  $('sbVersion').textContent = VERSION(n);
  $('sbFinish').textContent = 'Done with this version →';
  $('flow').hidden = true;
  body.classList.add('in-session');
  window.scrollTo(0,0);
}
$('sbFinish').onclick = ()=>{
  const n = Session.active;
  Session.parts[n].ended_at = new Date().toISOString();
  logEvent('part_end', VERSION(n));
  try{ window.speechSynthesis.cancel(); }catch(e){}
  if(App.listening && App.recog) App.recog.stop();
  show(n===0 ? 'survey0' : 'survey1');
};

/* ---------- Flow interactions ---------- */
$('flow').addEventListener('click', e=>{
  const b = e.target.closest('[data-act]'); if(!b || b.disabled) return;
  const act = b.dataset.act, v = b.dataset.v;
  if(act==='consent-yes'){
    Session.pid = 'P-' + Math.random().toString(36).slice(2,6).toUpperCase();
    $('pid').value = Session.pid;
    logEvent('consent','yes'); show('age');
  }
  else if(act==='consent-no') show('exit');           // declining records nothing
  else if(act==='goto') show(v);
  else if(act==='about'){
    const raw = $('ageIn').value.trim(), age = raw==='' ? null : Number(raw);
    if(age!==null && !(Number.isInteger(age) && age>=18 && age<=110)){ $('ageErr').hidden = false; $('ageIn').focus(); return; }
    Session.name = $('nameIn').value.trim().slice(0,80);
    Session.age = age;
    Session.ageGroup = age===null ? 'not stated' : age>=AGE_CUTOFF ? `${AGE_CUTOFF}+` : `under ${AGE_CUTOFF}`;
    App.ageGroup = Session.ageGroup; logEvent('age_group', Session.ageGroup);
    // the age group picks which version comes first; everyone tries both
    Session.order = Session.ageGroup===`${AGE_CUTOFF}+` ? ['adapted','standard'] : ['standard','adapted'];
    show('intro');
  }
  else if(act==='begin') beginPart(+v);
  else if(act==='ans'){
    const n = Session.active;
    Session.parts[n].answers[b.dataset.k] = +v;
    b.parentElement.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked', String(x===b)));
    $('flow').querySelector('[data-act="snext"]').disabled = !surveyDone(n);
  }
  else if(act==='snext'){ logEvent('survey_done', VERSION(Session.active)); show(Session.active===0 ? 'part1' : 'final'); }
  else if(act==='pref'){
    Session.final.choice = v;
    $('flow').querySelectorAll('[data-act="pref"]').forEach(x=>x.setAttribute('aria-checked', String(x===b)));
    $('flow').querySelector('[data-act="submit"]').disabled = false;
  }
  else if(act==='submit') submitSession();
  else if(act==='download') downloadJson();
  else if(act==='restart') location.reload();
});
$('flow').addEventListener('input', e=>{
  const f = e.target.dataset.final; if(f) Session.final[f] = e.target.value;
});

/* ---------- Saving ---------- */
function buildPayload(){
  return {
    participant_id: Session.pid,
    name: Session.name,
    age: Session.age,
    age_group: Session.ageGroup,
    order: Session.order,
    parts: Session.parts.map((p,i)=>({version: VERSION(i), mode: p.mode, started_at: p.started_at, ended_at: p.ended_at, answers: p.answers})),
    preference: {
      choice: Session.final.choice,
      mode: Session.final.choice==='A' ? Session.order[0] : Session.final.choice==='B' ? Session.order[1] : 'none',
    },
    comments: Session.final.comments.trim(),
    events: Study.events,
    submitted_at: new Date().toISOString(),
  };
}
const STORE_KEY = 'eva-study-sessions';
function savedSessions(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }catch(e){ return []; } }
$('exportSessions').onclick = ()=>{
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(savedSessions(), null, 2)], {type:'application/json'}));
  a.download = `all-sessions-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
};
// Send one survey to the research team's Google Sheet (link set in config.js).
// Apps Script does not allow reading the reply from another site, so a send counts as
// done when the request leaves without a network error; the device keeps a copy either way.
function sendToSheet(payload){
  if(!window.SURVEY_ENDPOINT) return Promise.resolve(false);
  return fetch(window.SURVEY_ENDPOINT, {
    method:'POST', mode:'no-cors',
    headers:{'Content-Type':'text/plain;charset=utf-8'},   // plain text avoids a CORS preflight
    body: JSON.stringify(payload),
  }).then(()=>true, ()=>false);
}
function markSent(submittedAt){
  try{
    const all = savedSessions();
    all.forEach(s=>{ if(s.submitted_at===submittedAt) s._sent = true; });
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  }catch(e){}
}
// Surveys that could not be sent (no internet) are retried the next time the app opens
async function resendUnsent(){
  if(!window.SURVEY_ENDPOINT) return;
  for(const s of savedSessions().filter(s=>s._sent===false)){
    const {_sent, ...payload} = s;
    if(await sendToSheet(payload)) markSent(s.submitted_at);
  }
}
async function submitSession(){
  const btn = $('flow').querySelector('[data-act="submit"]');
  btn.disabled = true; btn.textContent = 'Sending…';
  Session.payload = buildPayload();
  try{
    const all = savedSessions(); all.push({...Session.payload, _sent:false});
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
    Session.saved = true;
  }catch(e){ Session.saved = false; }
  Session.sent = await sendToSheet(Session.payload);
  if(Session.sent) markSent(Session.payload.submitted_at);
  show('done');
}
function downloadJson(){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(Session.payload || buildPayload(), null, 2)], {type:'application/json'}));
  a.download = `${Session.pid||'session'}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

// ?free=1 skips the study flow and opens the assistant directly
resendUnsent();
if(new URLSearchParams(location.search).get('free')==='1') $('flow').hidden = true;
else show('consent');
