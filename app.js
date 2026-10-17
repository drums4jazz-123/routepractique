/* RoutePratique – app-flow, spraak, Groq en interface */
(function () {
  'use strict';

  const VERSION = '1.2.1';
  const STORE = { settings: 'rp.settings', level: 'rp.levelState', sessions: 'rp.sessions' };
  const DEFAULT_MODEL = 'openai/gpt-oss-120b';
  /* Modellen die Groq heeft stopgezet: automatisch vervangen door het standaardmodel. */
  const RETIRED_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b', 'qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
  const DEFAULTS = {
    apiKey: '',
    model: DEFAULT_MODEL,
    autoLevel: true,
    voiceURI: '',
    rate: 0.9,
    theme: 'vrij'
  };
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const MAX_HISTORY_TURNS = 10;
  const MAX_SESSIONS = 30;
  const REQUEST_TIMEOUT_MS = 25000;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasTTS = 'speechSynthesis' in window;

  const $ = id => document.getElementById(id);

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('Opslaan mislukt', e); }
  }

  let settings = Object.assign({}, DEFAULTS, load(STORE.settings, {}));
  if (!settings.model || RETIRED_MODELS.includes(settings.model)) {
    settings.model = DEFAULT_MODEL;
    save(STORE.settings, settings);
  }
  let levelState = load(STORE.level, null);
  if (!levelState || !RP.LEVELS.includes(levelState.level)) levelState = RP.newLevelState('A2');
  let sessions = load(STORE.sessions, []);
  if (!Array.isArray(sessions)) sessions = [];

  /* ---------- Hulpfuncties ---------- */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function fmtDate(ts) {
    return new Date(ts).toLocaleString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  function minutes(ms) { return Math.max(0, Math.round(ms / 60000)); }

  function show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name).classList.add('active');
    window.scrollTo(0, 0);
  }

  /* ---------- Stemmen (TTS) ---------- */

  let voices = [];
  function loadVoices() {
    if (!hasTTS) return;
    voices = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('fr'));
    const sel = $('set-voice');
    sel.innerHTML = '';
    if (!voices.length) {
      sel.appendChild(el('option', null, 'Geen Franse stem gevonden'));
      return;
    }
    voices.forEach(v => {
      const o = el('option', null, `${v.name} (${v.lang})`);
      o.value = v.voiceURI;
      if (v.voiceURI === settings.voiceURI) o.selected = true;
      sel.appendChild(o);
    });
  }
  function pickVoice() {
    return voices.find(v => v.voiceURI === settings.voiceURI)
      || voices.find(v => v.lang.replace('_', '-') === 'fr-FR')
      || voices[0] || null;
  }

  /* Spreekt tekst uit; resolve wanneer klaar. Bewaking via polling omdat onend op Android soms uitblijft. */
  function speak(text, token) {
    return new Promise(resolve => {
      if (!hasTTS || !text) return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      const v = pickVoice();
      if (v) u.voice = v;
      u.rate = settings.rate;

      let done = false;
      let started = false;
      let idleCount = 0;
      const maxMs = (text.split(/\s+/).length * 900) / settings.rate + 8000;
      const t0 = Date.now();
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(poll);
        resolve();
      };
      u.onstart = () => { started = true; };
      u.onend = finish;
      u.onerror = finish;
      const poll = setInterval(() => {
        if (token !== undefined && token !== loopToken) { speechSynthesis.cancel(); return finish(); }
        if (speechSynthesis.speaking || speechSynthesis.pending) { started = true; idleCount = 0; }
        else if (started || Date.now() - t0 > 3000) { idleCount++; }
        if (idleCount >= 2 || Date.now() - t0 > maxMs) finish();
      }, 400);
      speechSynthesis.speak(u);
    });
  }

  /* ---------- Groq ---------- */

  async function callGroq(messages, maxTokens) {
    if (!settings.apiKey) throw Object.assign(new Error('Geen API-sleutel ingesteld.'), { fatal: true });
    let lastErr = null;
    let useJsonMode = true;
    const isReasoning = /gpt-oss/i.test(settings.model);
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const body = { model: settings.model, messages, temperature: 0.7 };
      if (isReasoning) {
        /* Redeneermodel: weinig redeneren (snel antwoord), redenering niet terugsturen,
           en ruimte laten omdat redeneertokens ook meetellen. */
        body.reasoning_effort = 'low';
        body.include_reasoning = false;
        body.max_completion_tokens = Math.max(maxTokens || 0, 1500);
      } else {
        body.max_completion_tokens = maxTokens || 400;
      }
      if (useJsonMode) body.response_format = { type: 'json_object' };
      try {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.apiKey },
          body: JSON.stringify(body),
          signal: ctrl.signal
        });
        clearTimeout(timer);
        if (res.status === 401 || res.status === 403) {
          throw Object.assign(new Error('API-sleutel ongeldig of geweigerd.'), { fatal: true });
        }
        if (res.status === 404 || res.status === 400) {
          const text = await res.text();
          if (/model_not_found|does not exist|decommissioned/i.test(text)) {
            throw Object.assign(new Error(`Het model "${settings.model}" bestaat niet (meer) bij Groq. Kies bij Instellingen een ander taalmodel, bijvoorbeeld ${DEFAULT_MODEL}.`), { fatal: true });
          }
          /* JSON-modus niet ondersteund of JSON-validatie mislukt: opnieuw proberen zonder JSON-modus. */
          if (useJsonMode && /response_format|json/i.test(text)) {
            useJsonMode = false;
            continue;
          }
          throw Object.assign(new Error('Verzoek geweigerd (' + res.status + '): ' + text.slice(0, 160)), { fatal: true });
        }
        if (res.status === 429) {
          const ra = parseFloat(res.headers.get('retry-after'));
          lastErr = new Error('Limiet van Groq bereikt, even wachten.');
          await sleep(isFinite(ra) ? Math.min(ra, 20) * 1000 : 3000 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = new Error('Serverfout ' + res.status);
          await sleep(1500 * (attempt + 1));
          continue;
        }
        const data = await res.json();
        const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) {
          lastErr = new Error('Leeg antwoord van Groq.');
          continue;
        }
        return content;
      } catch (e) {
        clearTimeout(timer);
        if (e.fatal) throw e;
        lastErr = e.name === 'AbortError' ? new Error('Geen antwoord binnen de tijd (verbinding?).') : e;
        if (!navigator.onLine) lastErr = new Error('Geen internetverbinding.');
        await sleep(1500 * (attempt + 1));
      }
    }
    throw lastErr || new Error('Onbekende fout.');
  }

  /* ---------- Sessie ---------- */

  let sess = null;          // actieve sessie
  let state = 'idle';       // idle | listening | thinking | speaking | paused
  let loopToken = 0;        // ongeldig maken van lopende lussen bij pauze/stop
  let rec = null;
  let wakeLock = null;
  let metaTimer = null;
  let pendingReload = false; // nieuwe versie klaar, herladen na het gesprek

  function setState(s, msg) {
    state = s;
    const st = $('talk-status');
    st.className = 'status ' + s;
    const labels = {
      idle: 'Klaar', listening: '● Luistert…', thinking: 'Denkt na…',
      speaking: 'Spreekt…', paused: 'Gepauzeerd', error: 'Fout'
    };
    st.textContent = msg || labels[s] || s;
    $('btn-pause').textContent = s === 'paused' ? '▶ Hervat' : '⏸ Pauze';
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
        const lock = await navigator.wakeLock.request('screen');
        wakeLock = lock;
        lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
      }
    } catch (e) { console.warn('Wake Lock niet beschikbaar', e); }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  function updateMeta() {
    if (!sess) return;
    const theme = RP.themeById(sess.theme).nl;
    $('talk-meta').textContent = `${theme} · ${minutes(Date.now() - sess.start)} min`;
    $('talk-level').textContent = levelState.level;
  }

  function startSession() {
    if (!SR) { alert('Spraakherkenning wordt niet ondersteund. Gebruik Chrome op Android.'); return; }
    if (!settings.apiKey) { alert('Vul eerst je Groq API-sleutel in bij Instellingen.'); show('settings'); return; }
    settings.theme = $('sel-theme').value;
    save(STORE.settings, settings);

    sess = {
      id: Date.now(),
      start: Date.now(),
      end: null,
      theme: settings.theme,
      startLevel: levelState.level,
      endLevel: levelState.level,
      turns: [],
      history: [],
      lastReply: ''
    };
    $('talk-log').innerHTML = '';
    $('talk-interim').textContent = '';
    show('talk');
    updateMeta();
    clearInterval(metaTimer);
    metaTimer = setInterval(updateMeta, 30000);
    requestWakeLock();
    // Eerste spraakuitvoer moet uit een tik komen: kort leeg fragment ontgrendelt TTS op Android.
    if (hasTTS) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    loopToken++;
    askModel('[START]', null, loopToken);
  }

  function stopRecognition() {
    if (rec) {
      try { rec.onend = null; rec.onresult = null; rec.onerror = null; rec.abort(); } catch (e) { /* negeren */ }
      rec = null;
    }
  }

  function pauseSession(reason) {
    if (!sess) return;
    loopToken++;
    stopRecognition();
    if (hasTTS) speechSynthesis.cancel();
    $('talk-interim').textContent = '';
    setState('paused', reason || 'Gepauzeerd');
  }

  function resumeSession() {
    if (!sess) return;
    loopToken++;
    requestWakeLock();
    if (sess.lastReply) {
      const token = loopToken;
      setState('speaking');
      speak(sess.lastReply, token).then(() => { if (token === loopToken) listen(token); });
    } else {
      askModel('[START]', null, loopToken);
    }
  }

  function stopSession() {
    if (!sess) return;
    loopToken++;
    stopRecognition();
    if (hasTTS) speechSynthesis.cancel();
    releaseWakeLock();
    clearInterval(metaTimer);
    sess.end = Date.now();
    sess.endLevel = levelState.level;
    const finished = sess;
    sess = null;
    setState('idle');
    if (finished.turns.length) {
      const record = {
        id: finished.id, start: finished.start, end: finished.end, theme: finished.theme,
        startLevel: finished.startLevel, endLevel: finished.endLevel, turns: finished.turns
      };
      sessions.push(record);
      while (sessions.length > MAX_SESSIONS) sessions.shift();
      save(STORE.sessions, sessions);
      renderHome();
      openReport(record.id);
    } else {
      renderHome();
      show('home');
    }
  }

  /* ---------- Luisteren ---------- */

  function listen(token) {
    if (!sess || token !== loopToken) return;
    stopRecognition();
    setState('listening');
    const r = new SR();
    rec = r;
    r.lang = 'fr-FR';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;

    let finalText = '';
    let retryDelay = 250;
    let fatal = false;

    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += txt;
        else interim += txt;
      }
      $('talk-interim').textContent = (finalText + ' ' + interim).trim();
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        fatal = true;
        pauseSession('Geen toegang tot de microfoon. Sta dit toe in Chrome.');
      } else if (e.error === 'network') {
        retryDelay = 3000;
        setState('error', 'Spraakherkenning: geen verbinding. Opnieuw…');
      } else if (e.error === 'audio-capture') {
        retryDelay = 2000;
        setState('error', 'Geen microfoon gevonden. Opnieuw…');
      }
    };
    r.onend = () => {
      if (rec === r) rec = null;
      if (fatal || !sess || token !== loopToken) return;
      const text = finalText.trim();
      $('talk-interim').textContent = '';
      if (text) handleUtterance(text, token);
      else setTimeout(() => listen(token), retryDelay);
    };
    try {
      r.start();
    } catch (e) {
      setTimeout(() => listen(token), 600);
    }
  }

  async function handleUtterance(text, token) {
    const cmd = RP.detectCommand(text);
    if (cmd === 'stop') return stopSession();
    if (cmd === 'pause') return pauseSession();
    if (cmd === 'repeat' || cmd === 'slower') {
      if (cmd === 'slower') {
        settings.rate = Math.max(0.6, Math.round((settings.rate - 0.1) * 100) / 100);
        save(STORE.settings, settings);
        addSys('Spreeksnelheid verlaagd naar ' + settings.rate.toFixed(2));
      }
      if (sess.lastReply) {
        setState('speaking');
        await speak(sess.lastReply, token);
      }
      if (token === loopToken) listen(token);
      return;
    }
    const turnEl = renderLiveTurn(text);
    askModel(text, turnEl, token);
  }

  /* ---------- Taalmodel ---------- */

  async function askModel(userContent, turnEl, token) {
    if (!sess || token !== loopToken) return;
    setState('thinking');
    const isStart = userContent === '[START]';
    const messages = [{ role: 'system', content: RP.buildSystemPrompt(levelState.level, sess.theme) }]
      .concat(sess.history.slice(-2 * MAX_HISTORY_TURNS))
      .concat([{ role: 'user', content: userContent }]);

    let parsed;
    try {
      const raw = await callGroq(messages);
      parsed = RP.parseModelReply(raw, isStart ? null : userContent);
    } catch (e) {
      if (!sess || token !== loopToken) return;
      console.error(e);
      if (turnEl) fillAppBlock(turnEl, null);
      addSys('Fout: ' + e.message);
      if (e.fatal) { pauseSession(e.message); return; }
      setState('error', 'Fout: ' + e.message);
      await speak('Pardon, j\'ai un petit problème de connexion. Tu peux répéter ?', token);
      if (token !== loopToken) return;
      if (isStart) { pauseSession('Kon het gesprek niet starten. Tik op Hervat.'); return; }
      listen(token);
      return;
    }
    if (!sess || token !== loopToken) return;

    sess.history.push({ role: 'user', content: userContent });
    sess.history.push({ role: 'assistant', content: JSON.stringify({ correctie: parsed.correctie, uitleg: parsed.uitleg, antwoord: parsed.antwoord, score: parsed.score }) });
    sess.lastReply = parsed.antwoord;

    const levelBefore = levelState.level;
    if (isStart) {
      renderAppOnlyTurn(parsed.antwoord);
    } else {
      sess.turns.push({
        user: userContent, correctie: parsed.correctie, uitleg: parsed.uitleg,
        antwoord: parsed.antwoord, score: parsed.score, level: levelBefore, t: Date.now()
      });
      fillTurn(turnEl, parsed);
    }

    let announce = '';
    if (!isStart && parsed.score !== null) {
      const res = RP.adaptLevel(levelState, parsed.score, settings.autoLevel);
      levelState = res.state;
      save(STORE.level, levelState);
      if (res.change === 'up') {
        addSys(`Niveau verhoogd: ${levelBefore} → ${levelState.level}`);
        announce = `Bravo ! On passe au niveau ${levelState.level.split('').join(' ')}.`;
      } else if (res.change === 'down') {
        addSys(`Niveau aangepast: ${levelBefore} → ${levelState.level}`);
      }
      updateMeta();
    }

    setState('speaking');
    if (announce) await speak(announce, token);
    if (token !== loopToken) return;
    await speak(parsed.antwoord, token);
    if (token === loopToken) listen(token);
  }

  /* ---------- Weergave gesprek ---------- */

  function compactOlder() {
    const turns = $('talk-log').querySelectorAll('.turn');
    turns.forEach((t, i) => { if (i < turns.length - 1) t.classList.add('compact'); });
  }
  function scrollLog() {
    const log = $('talk-log');
    log.scrollTop = log.scrollHeight;
  }
  function makeTurnShell() {
    compactOlder();
    const t = el('div', 'turn');
    t.addEventListener('click', () => { if (t !== $('talk-log').lastElementChild) t.classList.toggle('compact'); });
    $('talk-log').appendChild(t);
    return t;
  }
  function block(cls, label, text) {
    const b = el('div', 'blk ' + cls);
    if (label) b.appendChild(el('span', 'lbl', label));
    b.appendChild(el('div', 'txt', text));
    return b;
  }
  function renderLiveTurn(userText) {
    const t = makeTurnShell();
    t.appendChild(block('blk-user', '🎙 Jouw zin', userText));
    const pending = block('blk-app', '🔊 Antwoord', '…');
    pending.dataset.pending = '1';
    t.appendChild(pending);
    scrollLog();
    return t;
  }
  function correctionBlocks(turn) {
    const out = [];
    if (turn.correctie) {
      const c = block('blk-corr', '✎ Verbeterde versie', turn.correctie);
      if (turn.uitleg) c.appendChild(el('div', 'why', turn.uitleg));
      out.push(c);
    } else if (turn.score !== null && turn.score !== undefined) {
      out.push(el('div', 'blk blk-ok', '✓ Correct'));
    }
    return out;
  }
  function fillAppBlock(turnEl, text) {
    const p = turnEl.querySelector('[data-pending]');
    if (!p) return;
    if (text === null) { p.remove(); return; }
    p.querySelector('.txt').textContent = text;
    delete p.dataset.pending;
  }
  function fillTurn(turnEl, parsed) {
    const pending = turnEl.querySelector('[data-pending]');
    correctionBlocks(parsed).forEach(b => turnEl.insertBefore(b, pending));
    fillAppBlock(turnEl, parsed.antwoord);
    scrollLog();
  }
  function renderAppOnlyTurn(text) {
    const t = makeTurnShell();
    t.appendChild(block('blk-app', '🔊 Antwoord', text));
    scrollLog();
  }
  function addSys(text) {
    $('talk-log').appendChild(el('p', 'sys', text));
    scrollLog();
  }

  /* ---------- Startscherm ---------- */

  function renderHome() {
    $('home-level').textContent = levelState.level;
    $('home-level-label').textContent = RP.LEVEL_PROFILE[levelState.level].label + (settings.autoLevel ? ' · past zich aan' : ' · vast niveau');

    const warn = [];
    if (!SR) warn.push('Spraakherkenning is niet beschikbaar in deze browser. Gebruik Chrome op Android.');
    if (!settings.apiKey) warn.push('Vul eerst je Groq API-sleutel in bij Instellingen (⚙).');
    if (hasTTS && voices.length === 0) warn.push('Nog geen Franse stem gevonden. Controleer de spraakuitvoer van Android (Google Spraakservices, Frans).');
    const w = $('home-warning');
    w.textContent = warn.join(' ');
    w.classList.toggle('hidden', warn.length === 0);

    const totalMin = sessions.reduce((a, s) => a + minutes(s.end - s.start), 0);
    const totalTurns = sessions.reduce((a, s) => a + s.turns.length, 0);
    const stats = $('home-stats');
    stats.innerHTML = '';
    [[sessions.length, 'sessies'], [totalMin, 'minuten'], [totalTurns, 'beurten']].forEach(([n, l]) => {
      const d = el('div', 'stat');
      d.appendChild(el('b', null, String(n)));
      d.appendChild(el('span', null, l));
      stats.appendChild(d);
    });
  }

  function fillThemeSelect() {
    const sel = $('sel-theme');
    sel.innerHTML = '';
    RP.THEMES.forEach(t => {
      const o = el('option', null, t.nl);
      o.value = t.id;
      if (t.id === settings.theme) o.selected = true;
      sel.appendChild(o);
    });
  }

  /* ---------- Verslagen ---------- */

  function renderHistory() {
    const list = $('history-list');
    list.innerHTML = '';
    if (!sessions.length) {
      list.appendChild(el('p', 'muted', 'Nog geen sessies. Na een gesprek verschijnt hier het verslag.'));
      return;
    }
    sessions.slice().reverse().forEach(s => {
      const c = el('div', 'card hist-item');
      const nCorr = s.turns.filter(t => t.correctie).length;
      c.appendChild(el('b', null, fmtDate(s.start)));
      c.appendChild(el('span', 'muted small', `${RP.themeById(s.theme).nl} · ${minutes(s.end - s.start)} min · ${s.startLevel}→${s.endLevel}`));
      c.appendChild(el('span', 'muted small', `${s.turns.length} beurten · ${nCorr} correcties`));
      c.addEventListener('click', () => openReport(s.id));
      list.appendChild(c);
    });
  }

  let currentReportId = null;
  function openReport(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    currentReportId = id;
    const body = $('report-body');
    body.innerHTML = '';

    const sum = el('div', 'card report-summary');
    const nCorr = s.turns.filter(t => t.correctie).length;
    const scored = s.turns.filter(t => typeof t.score === 'number');
    const avg = scored.length ? Math.round(100 * scored.reduce((a, t) => a + t.score, 0) / scored.length) : null;
    sum.appendChild(el('b', null, fmtDate(s.start)));
    sum.appendChild(el('span', null, `Thema: ${RP.themeById(s.theme).nl}`));
    sum.appendChild(el('span', null, `Duur: ${minutes(s.end - s.start)} min · ${s.turns.length} beurten`));
    sum.appendChild(el('span', null, `Niveau: ${s.startLevel} → ${s.endLevel}` + (avg !== null ? ` · gemiddelde score ${avg}%` : '')));
    sum.appendChild(el('span', null, `Correcties: ${nCorr}`));
    body.appendChild(sum);

    const corr = s.turns.filter(t => t.correctie);
    if (corr.length) {
      body.appendChild(el('p', 'report-section-title', 'Om te herhalen'));
      const ul = el('ul', 'corr-list');
      corr.forEach(t => {
        const li = el('li');
        li.appendChild(el('div', 'old', t.user));
        li.appendChild(el('div', null, t.correctie));
        if (t.uitleg) li.appendChild(el('div', 'muted small', t.uitleg));
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    body.appendChild(el('p', 'report-section-title', 'Volledig gesprek'));
    s.turns.forEach(t => {
      const wrap = el('div', 'turn report-turn');
      wrap.appendChild(block('blk-user', '🎙 Jouw zin', t.user));
      correctionBlocks(t).forEach(b => wrap.appendChild(b));
      wrap.appendChild(block('blk-app', '🔊 Antwoord', t.antwoord));
      body.appendChild(wrap);
    });
    show('report');
  }

  function reportAsText(s) {
    const lines = [
      `RoutePratique – ${fmtDate(s.start)}`,
      `Thema: ${RP.themeById(s.theme).nl} · ${minutes(s.end - s.start)} min · niveau ${s.startLevel} → ${s.endLevel}`,
      ''
    ];
    s.turns.forEach((t, i) => {
      lines.push(`${i + 1}. Jij: ${t.user}`);
      if (t.correctie) lines.push(`   Verbeterd: ${t.correctie}${t.uitleg ? ' (' + t.uitleg + ')' : ''}`);
      lines.push(`   Camille: ${t.antwoord}`);
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ---------- Instellingen ---------- */

  function fillSettings() {
    $('set-key').value = settings.apiKey;
    $('set-model').value = settings.model;
    $('set-auto').checked = settings.autoLevel;
    $('set-rate').value = settings.rate;
    $('set-rate-out').textContent = Number(settings.rate).toFixed(2);
    const sel = $('set-level');
    sel.innerHTML = '';
    RP.LEVELS.forEach(l => {
      const o = el('option', null, `${l} – ${RP.LEVEL_PROFILE[l].label}`);
      o.value = l;
      if (l === levelState.level) o.selected = true;
      sel.appendChild(o);
    });
    loadVoices();
    $('settings-msg').classList.add('hidden');
    $('app-version').textContent = 'Versie ' + VERSION;
  }

  function readSettingsForm() {
    settings.apiKey = $('set-key').value.trim();
    settings.model = $('set-model').value.trim() || DEFAULTS.model;
    settings.autoLevel = $('set-auto').checked;
    settings.rate = parseFloat($('set-rate').value) || DEFAULTS.rate;
    const v = $('set-voice').value;
    if (voices.some(x => x.voiceURI === v)) settings.voiceURI = v;
  }

  function settingsMsg(text, kind) {
    const m = $('settings-msg');
    m.textContent = text;
    m.className = 'notice ' + (kind || '');
  }

  /* ---------- Gebeurtenissen ---------- */

  function bind() {
    $('btn-open-settings').addEventListener('click', () => { fillSettings(); show('settings'); });
    $('btn-open-history').addEventListener('click', () => { renderHistory(); show('history'); });
    document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => {
      const target = b.dataset.back;
      if (target === 'home' && pendingReload && !sess) { location.reload(); return; }
      if (target === 'history') renderHistory();
      if (target === 'home') renderHome();
      show(target);
    }));

    $('btn-start').addEventListener('click', startSession);
    $('btn-pause').addEventListener('click', () => { if (state === 'paused') resumeSession(); else pauseSession(); });
    $('btn-stop').addEventListener('click', stopSession);

    $('btn-copy-report').addEventListener('click', async () => {
      const s = sessions.find(x => x.id === currentReportId);
      if (!s) return;
      try {
        await navigator.clipboard.writeText(reportAsText(s));
        alert('Verslag gekopieerd.');
      } catch (e) {
        alert('Kopiëren is niet gelukt.');
      }
    });

    $('set-rate').addEventListener('input', e => { $('set-rate-out').textContent = Number(e.target.value).toFixed(2); });

    $('btn-save-settings').addEventListener('click', () => {
      readSettingsForm();
      const lvl = $('set-level').value;
      if (lvl !== levelState.level) {
        levelState = RP.newLevelState(lvl);
        save(STORE.level, levelState);
      }
      save(STORE.settings, settings);
      renderHome();
      show('home');
    });

    $('btn-test-voice').addEventListener('click', () => {
      readSettingsForm();
      if (!voices.length) { settingsMsg('Geen Franse stem gevonden op dit toestel.', 'warn'); return; }
      speak('Bonjour ! Je m\'appelle Camille. On fait un petit tour en français ?');
    });

    $('btn-test-api').addEventListener('click', async () => {
      readSettingsForm();
      settingsMsg('Verbinding testen…');
      try {
        const raw = await callGroq([
          { role: 'system', content: 'Reply with a JSON object only.' },
          { role: 'user', content: 'Return {"ok": true} as JSON.' }
        ], 50);
        JSON.parse(RP.stripFences(raw));
        settingsMsg('Verbinding met Groq werkt.', 'ok');
      } catch (e) {
        settingsMsg('Mislukt: ' + e.message, 'warn');
      }
    });

    $('btn-clear-history').addEventListener('click', () => {
      if (!confirm('Alle verslagen definitief wissen?')) return;
      sessions = [];
      save(STORE.sessions, sessions);
      renderHome();
      settingsMsg('Verslagen gewist.', 'ok');
    });

    $('btn-reset-all').addEventListener('click', () => {
      const lvl = $('set-level').value;
      if (!confirm(`Opnieuw beginnen op niveau ${lvl}?\n\nAlle verslagen, statistieken en de niveaugeschiedenis worden definitief gewist. Je instellingen blijven behouden.`)) return;
      readSettingsForm();
      save(STORE.settings, settings);
      sessions = [];
      save(STORE.sessions, sessions);
      levelState = RP.newLevelState(lvl);
      save(STORE.level, levelState);
      renderHome();
      settingsMsg(`Alles gewist. Je begint opnieuw op niveau ${levelState.level}.`, 'ok');
    });

    document.addEventListener('visibilitychange', () => {
      if (!sess) return;
      if (document.visibilityState === 'hidden') {
        if (state !== 'paused') pauseSession('Gepauzeerd: de app verliet het scherm. Tik op Hervat.');
      } else {
        requestWakeLock();
      }
    });
  }

  /* ---------- Start ---------- */

  function init() {
    if (hasTTS) {
      loadVoices();
      speechSynthesis.onvoiceschanged = () => { loadVoices(); renderHome(); };
    }
    fillThemeSelect();
    bind();
    renderHome();
    if ('serviceWorker' in navigator) {
      /* Controleer bij elke start op een nieuwe versie en herlaad automatisch zodra die klaarstaat
         (niet tijdens een lopend gesprek). */
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return;
        if (sess) { pendingReload = true; return; }
        reloading = true;
        location.reload();
      });
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(reg => reg.update())
        .catch(e => console.warn('Service worker niet geregistreerd', e));
    }
  }

  init();
})();
