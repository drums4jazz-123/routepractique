/* RoutePratique – app-flow, spraak, Groq en interface */
(function () {
  'use strict';

  const VERSION = '2.1.1';
  const STORE = { settings: 'rp.settings', level: 'rp.levelState', sessions: 'rp.sessions', vocab: 'rp.vocab', mywords: 'rp.mywords', examples: 'rp.examples' };
  const DEFAULT_MODEL = 'openai/gpt-oss-120b';
  /* Modellen die Groq heeft stopgezet: automatisch vervangen door het standaardmodel. */
  const RETIRED_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b', 'qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
  const DEFAULTS = {
    apiKey: '',
    model: DEFAULT_MODEL,
    autoLevel: true,
    voiceURI: '',
    rate: 0.9,
    pause: 2.5,
    speakCorrection: 'zin',   // 'uit' | 'zin' | 'uitleg'
    conversationStyle: 'afwisselend', // 'afwisselend' | 'leerder' | 'camille'
    humor: 'afentoe',         // 'uit' | 'afentoe' | 'veel'
    context: 'algemeen',      // 'algemeen' | 'auto'
    showTranslation: true,    // Nederlandse vertaling onder Camilles antwoord
    mode: 'gesprek',          // 'gesprek' | 'woorden'
    vocabDir: 'fn',           // 'fn' (Frans → Nederlands) | 'nf' | 'mix'
    vocabCat: 0,              // 0 = alle thema's
    vocabCount: 20,
    vocabSynonyms: true,      // afgekeurd antwoord laten nakijken door het taalmodel
    vocabExamples: true,      // voorbeeldzin na elk woord
    collectWords: true,       // woorden uit gesprekken toevoegen aan de woordentraining
    sttEngine: 'whisper',     // 'whisper' (eigen opname, geen biepjes) | 'chrome'
    micOffWhileSpeaking: true, // microfoon dicht terwijl Camille spreekt (normaal volume)
    whisperModel: 'whisper-large-v3-turbo',
    voiceGenderDevice: 'f',   // hoe de Franse standaardstem van het toestel klinkt
    genderMain: 'f',          // stem voor vragen en antwoorden
    genderCorr: 'm',          // stem voor de verbetering
    theme: 'vrij'
  };
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
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
  function updateCorrHint() {
    const v = $('set-corr').value;
    const hints = {
      zin: 'Bij een fout zegt Camille eerst "On dit plutôt : …" met de juiste zin, en geeft ze daarna haar antwoord.',
      uitleg: nlVoices.length
        ? 'Na de verbeterde zin volgt de korte uitleg met een Nederlandse stem, daarna het antwoord.'
        : 'Geen Nederlandse stem gevonden op dit toestel: alleen de verbeterde zin wordt voorgelezen. Installeer een Nederlandse stem bij Tekst-naar-spraak-uitvoer.',
      uit: 'De verbeterde zin verschijnt alleen op het scherm en in het verslag.'
    };
    $('set-corr-hint').textContent = hints[v] || hints.zin;
  }
  function fmtPause(v) { return Number(v).toFixed(1).replace('.', ',') + ' s'; }

  function show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-' + name).classList.add('active');
    window.scrollTo(0, 0);
  }

  /* ---------- Stemmen (TTS) ---------- */

  let voices = [];
  let nlVoices = [];
  function loadVoices() {
    if (!hasTTS) return;
    const all = speechSynthesis.getVoices();
    const langOf = v => (v.lang || '').toLowerCase().replace('_', '-');
    voices = all.filter(v => langOf(v).startsWith('fr'));
    nlVoices = all.filter(v => langOf(v).startsWith('nl'));
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
  function pickNlVoice() {
    const l = v => v.lang.toLowerCase().replace('_', '-');
    return nlVoices.find(v => l(v) === 'nl-be') || nlVoices.find(v => l(v) === 'nl-nl') || nlVoices[0] || null;
  }

  /* Mannelijk of vrouwelijk via de toonhoogte. Chrome op Android geeft een webapp geen toegang tot
     de afzonderlijke mannelijke/vrouwelijke stemmen van Google, alleen tot de standaardstem van het toestel.
     deviceGender: hoe die standaardstem klinkt ('f' of 'm'). */
  function pitchFor(gender, deviceGender) {
    const dev = deviceGender || settings.voiceGenderDevice || 'f';
    if (gender === dev) return 1;
    return gender === 'm' ? 0.7 : 1.35;
  }

  /* Spreekt tekst uit; resolve wanneer klaar. Bewaking via polling omdat onend op Android soms uitblijft.
     lang 'nl' gebruikt een Nederlandse stem (voor de uitleg bij een correctie).
     role 'main' = vragen en antwoorden, 'corr' = verbetering. */
  /* Een open microfoon zet Android in "gespreksmodus": de stem gaat dan via het (zachtere) gesprekskanaal,
     en via Bluetooth via het telefoonprofiel. Daarom gaat de microfoon dicht zolang Camille spreekt;
     bij het luisteren gaat hij weer open (zonder nieuwe toestemming). */
  function speak(text, token, lang, role) {
    if (mic && settings.micOffWhileSpeaking !== false && hasTTS && text) {
      releaseMic();
      return sleep(300).then(() => (token !== undefined && token !== loopToken) ? undefined : speakNow(text, token, lang, role));
    }
    return speakNow(text, token, lang, role);
  }

  function speakNow(text, token, lang, role) {
    return new Promise(resolve => {
      if (!hasTTS || !text) return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const gender = role === 'corr' ? settings.genderCorr : settings.genderMain;
      if (lang === 'nl') {
        const nv = pickNlVoice();
        u.lang = nv ? nv.lang : 'nl-BE';
        if (nv) u.voice = nv;
        u.rate = Math.min(1.1, settings.rate + 0.1);
        u.pitch = pitchFor(gender, 'f');   // Nederlandse Google-standaardstem is vrouwelijk
      } else {
        u.lang = 'fr-FR';
        const v = pickVoice();
        if (v) u.voice = v;
        u.rate = settings.rate;
        u.pitch = pitchFor(gender);
      }

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

  /* tries: aantal pogingen (extra aanvragen zoals voorbeeldzin en synoniemcontrole: 1, zodat niets blijft hangen). */
  async function callGroq(messages, maxTokens, tries) {
    if (!settings.apiKey) throw Object.assign(new Error('Geen API-sleutel ingesteld.'), { fatal: true });
    tries = tries || 3;
    let lastErr = null;
    let useJsonMode = true;
    const isReasoning = /gpt-oss/i.test(settings.model);
    const wait = (attempt, ms) => (attempt < tries - 1 ? sleep(ms) : Promise.resolve());   // na de laatste poging niet meer wachten
    for (let attempt = 0; attempt < tries; attempt++) {
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
            if (attempt === tries - 1) tries++;     // deze poging telt niet mee
            continue;
          }
          throw Object.assign(new Error('Verzoek geweigerd (' + res.status + '): ' + text.slice(0, 160)), { fatal: true });
        }
        if (res.status === 429) {
          const ra = parseFloat(res.headers.get('retry-after'));
          lastErr = new Error('Limiet van Groq bereikt, even wachten.');
          await wait(attempt, isFinite(ra) ? Math.min(ra, 20) * 1000 : 3000 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = new Error('Serverfout ' + res.status);
          await wait(attempt, 1500 * (attempt + 1));
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
        await wait(attempt, 1500 * (attempt + 1));
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
    if (sess.mode === 'vocab') {
      const v = sess.vocab, n = v.list.length;
      const ok = v.results.filter(isOkResult).length;
      $('talk-meta').textContent = `Woordentraining · ${RPV.DIRS_SHORT[v.dir]} · ${Math.min(v.i + 1, n)}/${n} · ✓ ${ok}${sess.context === 'auto' ? ' · 🚗' : ''}`;
      $('talk-level').textContent = levelState.level;
      return;
    }
    const theme = RP.themeById(sess.theme).nl;
    $('talk-meta').textContent = `${theme} · ${RP.STYLE_LABELS[sess.style] || ''}${sess.context === 'auto' ? ' · 🚗' : ''} · ${minutes(Date.now() - sess.start)} min`;
    $('talk-level').textContent = levelState.level;
  }

  function startSession() {
    if (!SR && !canWhisper()) { alert('Spraakherkenning wordt niet ondersteund. Gebruik Chrome op Android.'); return; }
    if (!settings.apiKey) { alert('Vul eerst je Groq API-sleutel in bij Instellingen.'); show('settings'); return; }
    settings.theme = $('sel-theme').value;
    settings.conversationStyle = RP.STYLES.includes($('sel-style').value) ? $('sel-style').value : 'afwisselend';
    settings.context = $('sel-context').value === 'auto' ? 'auto' : 'algemeen';
    settings.mode = $('sel-mode').value === 'woorden' ? 'woorden' : 'gesprek';
    settings.vocabDir = ['fn', 'nf', 'mix'].includes($('sel-vdir').value) ? $('sel-vdir').value : 'fn';
    settings.vocabCat = parseInt($('sel-vcat').value, 10) || 0;
    settings.vocabCount = parseInt($('sel-vcount').value, 10) || 20;
    save(STORE.settings, settings);

    sess = {
      id: Date.now(),
      start: Date.now(),
      end: null,
      theme: settings.theme,
      style: settings.conversationStyle,
      context: settings.context,
      startLevel: levelState.level,
      endLevel: levelState.level,
      turns: [],
      history: [],
      lastReply: '',
      mode: 'gesprek'
    };
    if (settings.mode === 'woorden' && !startVocab()) { sess = null; return; }
    listenLang = 'fr';
    $('talk-log').innerHTML = '';
    $('talk-interim').textContent = '';
    show('talk');
    updateMeta();
    clearInterval(metaTimer);
    metaTimer = setInterval(updateMeta, 30000);
    requestWakeLock();
    // Eerste spraakuitvoer moet uit een tik komen: kort leeg fragment ontgrendelt TTS op Android.
    if (hasTTS) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    whisperBroken = false;                           // bij elke sessie de eigen opname opnieuw proberen
    if (useWhisper()) ensureMic().catch(() => {});   // microfoontoestemming meteen bij de start vragen
    loopToken++;
    if (sess.mode === 'vocab') vocabIntro(loopToken);
    else askModel('[START]', null, loopToken);
  }

  function stopRecognition() {
    vad = null;
    meter(0, 1);
    if (turnState) { clearTimeout(turnState.timer); turnState.done = true; }
    if (rec) {
      try { rec.onend = null; rec.onresult = null; rec.onerror = null; rec.abort(); } catch (e) { /* negeren */ }
      rec = null;
    }
  }

  function pauseSession(reason) {
    if (!sess) return;
    loopToken++;
    if (sess.vocab) clearTimeout(sess.vocab.timer);
    stopRecognition();
    releaseMic();
    if (hasTTS) speechSynthesis.cancel();
    $('talk-interim').textContent = '';
    setState('paused', reason || 'Gepauzeerd');
  }

  function resumeSession() {
    if (!sess) return;
    loopToken++;
    requestWakeLock();
    if (sess.mode === 'vocab') {
      const v = sess.vocab;
      if (v.phase === 'repeat' || v.phase === 'done') { v.phase = 'done'; vocabNext(loopToken); }
      else vocabAsk(loopToken, true);
      return;
    }
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
    releaseMic();
    if (hasTTS) speechSynthesis.cancel();
    releaseWakeLock();
    clearInterval(metaTimer);
    sess.end = Date.now();
    sess.endLevel = levelState.level;
    const finished = sess;
    sess = null;
    setState('idle');
    if (finished.mode === 'vocab') {
      clearTimeout(finished.vocab.timer);
      if (!finished.vocab.results.length) { renderHome(); show('home'); return; }
      const rec = {
        type: 'vocab', id: finished.id, start: finished.start, end: finished.end, dir: finished.vocab.dir,
        cat: finished.vocab.cat, startLevel: finished.startLevel, endLevel: finished.endLevel, turns: [], results: finished.vocab.results
      };
      sessions.push(rec);
      while (sessions.length > MAX_SESSIONS) sessions.shift();
      save(STORE.sessions, sessions);
      renderHome();
      openReport(rec.id);
      return;
    }
    if (finished.turns.length) {
      const record = {
        id: finished.id, start: finished.start, end: finished.end, theme: finished.theme,
        startLevel: finished.startLevel, endLevel: finished.endLevel, turns: finished.turns, style: finished.style
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

  /* Eén luisterbeurt kan uit meerdere herkenningsrondes bestaan: Chrome stopt soms zelf na een stilte.
     De beurt is pas klaar als de leerder langer zwijgt dan de ingestelde denkpauze. Hoelang de app
     wacht voordat de leerder begint te spreken, is onbeperkt. */
  let turnState = null;

  /* Denkpauze in ms. Bij de woordentraining (losse woorden) hoogstens 1,5 s, anders wordt het traag. */
  function pauseMsNow() {
    const ms = Math.round((settings.pause || DEFAULTS.pause) * 1000);
    return sess && sess.mode === 'vocab' ? Math.min(ms, 1500) : ms;
  }

  function listen(token) {
    if (!sess || token !== loopToken) return;
    stopRecognition();
    if (useWhisper()) return listenWhisper(token);
    listenChrome(token);
  }

  /* ---------- Eigen opname + Whisper (geen biepjes) ---------- */

  let mic = null;            // { ctx, stream, src, proc, sink, rate }
  let vad = null;            // { token, det }
  let micPromise = null;
  let whisperBroken = false; // eigen opname mislukt: rest van de sessie Google gebruiken

  function canWhisper() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
  }
  function useWhisper() {
    return settings.sttEngine !== 'chrome' && !whisperBroken && canWhisper();
  }

  function ensureMic() {
    if (mic) return Promise.resolve(mic);
    if (micPromise) return micPromise;
    micPromise = (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        /* Geen echo-onderdrukking: de app luistert nooit terwijl Camille spreekt, en echo-onderdrukking
           zet Android in gespreksmodus (zachter volume). */
        audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* negeren */ } }
      const src = ctx.createMediaStreamSource(stream);
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      const sink = ctx.createGain();
      sink.gain.value = 0;               // niets naar de luidspreker sturen
      src.connect(proc); proc.connect(sink); sink.connect(ctx.destination);
      proc.onaudioprocess = e => onAudioFrame(e.inputBuffer.getChannelData(0));
      mic = { ctx, stream, src, proc, sink, rate: ctx.sampleRate };
      return mic;
    })();
    return micPromise.finally(() => { micPromise = null; });
  }

  function releaseMic() {
    vad = null;
    if (!mic) return;
    const m = mic; mic = null;
    try { m.proc.onaudioprocess = null; m.src.disconnect(); m.proc.disconnect(); m.sink.disconnect(); } catch (e) { /* negeren */ }
    try { m.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* negeren */ }
    try { m.ctx.close(); } catch (e) { /* negeren */ }
  }

  function meter(rms, thr) {
    const bar = $('talk-meter');
    if (!bar) return;
    bar.style.width = Math.min(100, Math.round((rms / (thr * 2 || 1)) * 100)) + '%';
    bar.classList.toggle('voice', rms > thr);
  }

  function listenWhisper(token) {
    setState('listening');
    $('talk-meter-wrap').classList.remove('hidden');
    ensureMic().then(m => {
      if (!sess || token !== loopToken) return;
      vad = { token, rate: m.rate, det: RP.createVad({ sampleRate: m.rate, pauseMs: pauseMsNow() }) };
    }).catch(e => {
      if (!sess || token !== loopToken) return;
      whisperBroken = true;
      $('talk-meter-wrap').classList.add('hidden');
      addSys('Eigen opname niet mogelijk (' + (e.message || e.name || 'microfoon') + '). Overgeschakeld op de Google-spraakherkenning.');
      if (!SR) { pauseSession('Geen spraakherkenning beschikbaar.'); return; }
      listenChrome(token);
    });
  }

  function onAudioFrame(data) {
    if (!vad) return;
    const v = vad;
    const ev = v.det.push(data);
    meter(v.det.rms, v.det.threshold);
    if (!ev) return;
    if (ev.type === 'speechStart') {
      setState('listening', '🎙 Je spreekt…');
    } else if (ev.type === 'discard') {
      vad = null;
      listen(v.token);
    } else if (ev.type === 'end') {
      vad = null;
      meter(0, 1);
      processRecording(ev.samples, v.rate, v.token);
    }
  }

  async function processRecording(samples, rate, token) {
    if (!sess || token !== loopToken) return;
    setState('thinking', 'Verwerkt je zin…');
    let text = '';
    try {
      text = RP.cleanTranscript(await transcribe(RP.encodeWav(samples, rate, 16000)));
    } catch (e) {
      if (!sess || token !== loopToken) return;
      console.error(e);
      if (e.fatal) { addSys('Spraakherkenning: ' + e.message); pauseSession(e.message); return; }
      addSys('Spraakherkenning: ' + e.message);
      setState('speaking');
      await speak("Pardon, je n'ai pas bien entendu. Tu peux répéter ?", token);
    }
    if (!sess || token !== loopToken) return;
    if (!text) { listen(token); return; }
    handleUtterance(text, token);
  }

  async function transcribe(wavBytes) {
    if (!settings.apiKey) throw Object.assign(new Error('Geen API-sleutel ingesteld.'), { fatal: true });
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const fd = new FormData();
      fd.append('file', new Blob([wavBytes], { type: 'audio/wav' }), 'zin.wav');
      fd.append('model', settings.whisperModel || DEFAULTS.whisperModel);
      fd.append('language', listenLang);
      fd.append('response_format', 'json');
      fd.append('temperature', '0');
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(WHISPER_URL, { method: 'POST', headers: { 'Authorization': 'Bearer ' + settings.apiKey }, body: fd, signal: ctrl.signal });
        clearTimeout(timer);
        if (res.status === 401 || res.status === 403) throw Object.assign(new Error('API-sleutel ongeldig of geweigerd.'), { fatal: true });
        if (res.status === 400 || res.status === 404) {
          const t = await res.text();
          if (/model_not_found|does not exist|decommissioned/i.test(t)) {
            throw Object.assign(new Error(`Het spraakmodel "${settings.whisperModel}" bestaat niet (meer) bij Groq. Kies bij Instellingen "Google in Chrome" of meld het.`), { fatal: true });
          }
          throw Object.assign(new Error('Spraakherkenning geweigerd (' + res.status + '): ' + t.slice(0, 120)), { fatal: true });
        }
        if (res.status === 429) {
          const ra = parseFloat(res.headers.get('retry-after'));
          lastErr = new Error('Limiet van Groq bereikt, even wachten.');
          await sleep(isFinite(ra) ? Math.min(ra, 20) * 1000 : 3000 * (attempt + 1));
          continue;
        }
        if (!res.ok) { lastErr = new Error('Serverfout ' + res.status); if (attempt < 2) await sleep(1200 * (attempt + 1)); continue; }
        const data = await res.json();
        return (data && typeof data.text === 'string') ? data.text : '';
      } catch (e) {
        clearTimeout(timer);
        if (e.fatal) throw e;
        lastErr = e.name === 'AbortError' ? new Error('Geen antwoord binnen de tijd (verbinding?).') : e;
        if (!navigator.onLine) lastErr = new Error('Geen internetverbinding.');
        if (attempt < 2) await sleep(1200 * (attempt + 1));
      }
    }
    throw lastErr || new Error('Onbekende fout.');
  }

  /* ---------- Google-spraakherkenning in Chrome (reserve) ---------- */

  function listenChrome(token) {
    if (!sess || token !== loopToken) return;
    $('talk-meter-wrap').classList.add('hidden');
    setState('listening');
    turnState = { token, parts: [], current: '', interim: '', lastActivity: 0, done: false, timer: null };
    startRecognizer(turnState);
  }

  function turnText(t) {
    return RP.mergeTranscripts([...t.parts, t.current, t.interim]);
  }

  function finishTurn(t) {
    if (t.done || t.token !== loopToken || !sess) return;
    t.done = true;
    clearTimeout(t.timer);
    const text = turnText(t);
    stopRecognition();
    $('talk-interim').textContent = '';
    if (text) handleUtterance(text, t.token);
    else listen(t.token);
  }

  function startRecognizer(t) {
    if (t.done || !sess || t.token !== loopToken) return;
    const pauseMs = pauseMsNow();
    const r = new SR();
    rec = r;
    r.lang = listenLang === 'nl' ? 'nl-BE' : 'fr-FR';
    r.interimResults = true;
    r.continuous = true;
    r.maxAlternatives = 1;
    r.onstart = () => { if (state === 'error') setState('listening'); };
    let retryDelay = 250;
    let fatal = false;

    r.onresult = e => {
      /* Volledige lijst van deze ronde opnieuw opbouwen (vermijdt dubbele tekst bij continue herkenning op Android). */
      const finals = [];
      const interims = [];
      for (let i = 0; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript.trim();
        if (!txt) continue;
        (e.results[i].isFinal ? finals : interims).push(txt);
      }
      t.current = RP.mergeTranscripts(finals);
      t.interim = RP.mergeTranscripts(interims);
      t.lastActivity = Date.now();
      $('talk-interim').textContent = turnText(t);
      clearTimeout(t.timer);
      t.timer = setTimeout(() => finishTurn(t), pauseMs);
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        fatal = true;
        clearTimeout(t.timer);
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
      if (fatal || t.done || !sess || t.token !== loopToken) return;
      /* Wat deze ronde opleverde bewaren en verder luisteren tot de denkpauze om is. */
      const piece = RP.mergeTranscripts([t.current, t.interim]);
      if (piece) t.parts.push(piece);
      t.current = '';
      t.interim = '';
      if (!t.parts.length) {
        setTimeout(() => startRecognizer(t), retryDelay);   // nog niets gezegd: blijven wachten
      } else if (Date.now() - t.lastActivity >= pauseMs) {
        finishTurn(t);
      } else {
        if (state !== 'listening') setState('listening');
        startRecognizer(t);                                  // timer loopt verder
      }
    };
    try {
      r.start();
    } catch (e) {
      setTimeout(() => startRecognizer(t), 600);
    }
  }

  async function handleUtterance(text, token) {
    if (sess && sess.mode === 'vocab') return vocabAnswer(text, token);
    const cmd = RP.detectCommand(text);
    if (cmd === 'stop') return stopSession();
    if (cmd === 'pause') return pauseSession();
    if (cmd === 'roleLearner' || cmd === 'roleCamille') {
      const style = cmd === 'roleLearner' ? 'leerder' : 'camille';
      sess.style = style;
      settings.conversationStyle = style;
      save(STORE.settings, settings);
      $('sel-style').value = style;
      updateMeta();
      addSys('Gespreksvorm: ' + RP.STYLE_LABELS[style]);
      return askModel(style === 'leerder' ? '[MIJN_BEURT]' : '[JOUW_BEURT]', null, token);
    }
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
    const isMeta = /^\[[A-Z_]+\]$/.test(userContent);   // [START], [JOUW_BEURT], [MIJN_BEURT]: geen beurt van de leerder
    const messages = [{ role: 'system', content: RP.buildSystemPrompt(levelState.level, sess.theme, { correctionSpoken: settings.speakCorrection !== 'uit', persona: settings.genderMain, style: sess.style, humor: settings.humor, context: sess.context, translate: settings.showTranslation !== false }) }]
      .concat(sess.history.slice(-2 * MAX_HISTORY_TURNS))
      .concat([{ role: 'user', content: userContent }]);

    let parsed;
    try {
      const raw = await callGroq(messages);
      parsed = RP.parseModelReply(raw, isMeta ? null : userContent);
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
    sess.history.push({ role: 'assistant', content: JSON.stringify({ correctie: parsed.correctie, uitleg: parsed.uitleg, antwoord: parsed.antwoord, vertaling: parsed.vertaling, score: parsed.score, leerwoorden: parsed.leerwoorden }) });
    sess.lastReply = parsed.antwoord;

    const levelBefore = levelState.level;
    if (isMeta) {
      renderAppOnlyTurn(parsed.antwoord, parsed.vertaling);
    } else {
      const added = settings.collectWords !== false ? addMyWords(parsed.leerwoorden) : [];
      sess.turns.push({
        user: userContent, correctie: parsed.correctie, uitleg: parsed.uitleg,
        antwoord: parsed.antwoord, vertaling: parsed.vertaling, score: parsed.score, level: levelBefore, t: Date.now(),
        leerwoorden: added
      });
      fillTurn(turnEl, parsed);
      if (added.length) addSys('＋ In je woordentraining: ' + added.map(w => `${RPV.cleanFr(w.fr)} (${w.nl})`).join(', '));
    }

    let announce = '';
    if (!isMeta && parsed.score !== null) {
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
    /* Correctie hardop: eerst de verbeterde zin (Frans), eventueel de uitleg (Nederlands), dan het antwoord. */
    if (!isMeta && parsed.correctie && settings.speakCorrection !== 'uit') {
      await speak('On dit plutôt : ' + parsed.correctie, token, 'fr', 'corr');
      if (token !== loopToken) return;
      if (settings.speakCorrection === 'uitleg' && parsed.uitleg && pickNlVoice()) {
        await speak(parsed.uitleg, token, 'nl', 'corr');
        if (token !== loopToken) return;
      }
      await sleep(350);
    }
    if (token !== loopToken) return;
    await speak(parsed.antwoord, token);
    if (token === loopToken) listen(token);
  }

  /* ---------- Woordentraining ---------- */

  const W = window.RP_WOORDEN || { cats: [], items: [] };
  let vocabStore = load(STORE.vocab, {});
  if (!vocabStore || typeof vocabStore !== 'object') vocabStore = {};
  let myWords = load(STORE.mywords, []);
  if (!Array.isArray(myWords)) myWords = [];
  let exampleCache = load(STORE.examples, {});
  if (!exampleCache || typeof exampleCache !== 'object') exampleCache = {};
  const MY_CAT = window.RPV ? RPV.MY_CAT : 99;
  function allItems() { return W.items.concat(myWords); }
  const isOkResult = r => (window.RPV ? RPV.isOk(r) : r.kind === 'correct' || r.kind === 'almost');

  /* Woorden uit een gesprek toevoegen aan de woordentraining (richting Nederlands → Frans, meteen te herhalen).
     Staat het woord al in het brondocument of bij je eigen woorden, dan komt dat woord terug in de herhaling. */
  function addMyWords(list) {
    if (!window.RPV || !Array.isArray(list) || !list.length) return [];
    const now = Date.now();
    const added = [];
    list.forEach(w => {
      const key = RPV.norm(RPV.cleanFr(w.fr));
      if (!key || key.length < 2) return;
      let item = allItems().find(it => RPV.frVariants(it).some(v => RPV.norm(v.text) === key));
      if (!item) {
        item = { id: 'p-' + now.toString(36) + '-' + myWords.length, fr: w.fr, nl: w.nl, lvl: levelState.level, cat: MY_CAT,
          note: 'Uit je gesprek van ' + new Date(now).toLocaleDateString('nl-BE'), frAlt: [], nlAlt: [] };
        myWords.push(item);
      }
      const st = vocabStore[RPV.key(item, 'nf')];
      vocabStore[RPV.key(item, 'nf')] = { box: 1, due: now, ok: st ? st.ok : 0, ko: (st ? st.ko : 0) + 1, last: now };
      added.push({ fr: item.fr, nl: item.cat === MY_CAT ? item.nl : RPV.cleanNl(item.nl) });
    });
    while (myWords.length > 500) myWords.shift();
    save(STORE.mywords, myWords);
    save(STORE.vocab, vocabStore);
    return added;
  }
  let listenLang = 'fr';     // taal waarin geluisterd wordt: 'fr' of 'nl'
  const PRAISE = ['Exact !', 'Très bien !', 'Parfait !', 'Bravo !', "Oui, c'est ça !"];

  function catTitle(nr) {
    if (nr === MY_CAT) return 'Uit je gesprekken';
    const c = W.cats.find(x => x.nr === nr); return c ? c.titel : "Alle thema's";
  }
  /* Op het scherm: met verduidelijking tussen haakjes ("de neef (kind van oom of tante)"). Uitgesproken: zonder. */
  function askedText(cur) { return cur.dir === 'fn' ? RPV.cleanFr(cur.item.fr) : RPV.displayNl(cur.item.nl); }
  function expectedText(cur) { return cur.dir === 'fn' ? RPV.cleanNl(cur.item.nl) : RPV.cleanFr(cur.item.fr); }
  function expectedDisplay(cur) { return cur.dir === 'fn' ? RPV.displayNl(cur.item.nl) : RPV.cleanFr(cur.item.fr); }

  function fillVocabSelects() {
    const cat = $('sel-vcat');
    cat.innerHTML = '';
    [{ nr: 0, titel: "Alle thema's" }, { nr: MY_CAT, titel: `Uit je gesprekken (${myWords.length})` }].concat(W.cats).forEach(c => {
      const o = el('option', null, c.nr && c.nr !== MY_CAT ? `${c.nr}. ${c.titel}` : c.titel);
      o.value = String(c.nr);
      cat.appendChild(o);
    });
    cat.value = String(settings.vocabCat || 0);
    $('sel-vdir').value = settings.vocabDir || 'fn';
    $('sel-vcount').value = String(settings.vocabCount || 20);
    $('sel-mode').value = settings.mode === 'woorden' ? 'woorden' : 'gesprek';
    applyMode();
  }
  function applyMode() {
    const voc = $('sel-mode').value === 'woorden';
    $('conv-opts').classList.toggle('hidden', voc);
    $('vocab-opts').classList.toggle('hidden', !voc);
    $('btn-start').textContent = voc ? '▶ Start woordentraining' : '▶ Start gesprek';
    updateVocabInfo();
  }
  function updateVocabInfo() {
    const info = $('vocab-info');
    if (!info || !window.RPV) return;
    const myOpt = $('sel-vcat').querySelector(`option[value="${MY_CAT}"]`);
    if (myOpt) myOpt.textContent = `Uit je gesprekken (${myWords.length})`;
    const sm = RPV.summary(allItems(), vocabStore, { cat: parseInt($('sel-vcat').value, 10) || 0, dir: $('sel-vdir').value, level: levelState.level });
    info.textContent = `Niveau ${levelState.level}: ${sm.total} woorden · ${sm.due} te herhalen · ${sm.fresh} nieuw · ${sm.known} goed gekend`;
  }

  function startVocab() {
    let dir = settings.vocabDir;
    const hasNl = !!pickNlVoice();
    let forced = false;
    if (!hasNl && dir !== 'fn' && settings.context === 'auto') {
      if (dir === 'nf') {
        alert('Voor Nederlands → Frans in de auto is een Nederlandse stem nodig: Camille moet het woord kunnen uitspreken. Installeer een Nederlandse stem (Tekst-naar-spraak-uitvoer) of kies Frans → Nederlands.');
        return false;
      }
      dir = 'fn'; forced = true;
    }
    const list = RPV.select(allItems(), vocabStore, { count: settings.vocabCount, cat: settings.vocabCat, dir, level: levelState.level });
    if (!list.length) { alert(settings.vocabCat === MY_CAT ? 'Nog geen woorden uit je gesprekken. Ze komen erbij wanneer je in een gesprek een woord niet kent of fout gebruikt.' : 'Geen woorden gevonden voor deze keuze.'); return false; }
    sess.mode = 'vocab';
    sess.vocab = { list, i: 0, results: [], dir, cat: settings.vocabCat, attempt: 1, hintGiven: false, phase: 'ask', el: null, timer: null, forced, hasNl };
    return true;
  }

  async function vocabIntro(token) {
    const v = sess.vocab;
    if (v.forced) addSys('Geen Nederlandse stem gevonden: in de auto alleen Frans → Nederlands.');
    if (!v.hasNl && v.dir !== 'fn') addSys('Geen Nederlandse stem gevonden: het Nederlandse woord staat alleen op het scherm.');
    const intro = {
      fn: 'On commence ! Je dis un mot en français, tu le traduis en néerlandais.',
      nf: "On commence ! Je dis un mot en néerlandais, tu le traduis en français, avec l'article.",
      mix: "On commence ! Je dis un mot en français ou en néerlandais, tu le traduis. En français, avec l'article."
    }[v.dir];
    setState('speaking');
    await speak(intro, token, 'fr', 'main');
    if (token !== loopToken) return;
    vocabAsk(token);
  }

  function renderVocabCard(cur) {
    const t = makeTurnShell();
    const label = cur.dir === 'fn' ? '🇫🇷 Vertaal naar het Nederlands' : '🇳🇱 Vertaal naar het Frans (met lidwoord)';
    const b = block('blk-ask', label, askedText(cur));
    b.appendChild(el('div', 'why', `${catTitle(cur.item.cat)} · ${cur.item.lvl}`));
    t.appendChild(b);
    scrollLog();
    return t;
  }
  function addCardBlock(card, b) { card.appendChild(b); scrollLog(); }

  function speakWord(cur, token) {
    if (cur.dir === 'fn') return speak(RPV.spokenFr(cur.item), token, 'fr', 'main');
    if (pickNlVoice()) return speak(RPV.cleanNl(cur.item.nl).replace(/ \/ /g, ', '), token, 'nl', 'main');
    return Promise.resolve();                       // geen Nederlandse stem: alleen op het scherm
  }

  function listenFor(cur, token) {
    listenLang = cur.dir === 'fn' ? 'nl' : 'fr';
    listen(token);
  }

  async function vocabAsk(token, again) {
    const v = sess && sess.vocab;
    if (!v || token !== loopToken) return;
    clearTimeout(v.timer);
    if (v.i >= v.list.length) return vocabFinish(token);
    const cur = v.list[v.i];
    if (!again) { v.attempt = 1; v.hintGiven = false; v.el = renderVocabCard(cur); prefetchExample(cur); }
    v.phase = 'ask';
    updateMeta();
    setState('speaking');
    await speakWord(cur, token);
    if (token !== loopToken) return;
    listenFor(cur, token);
  }

  async function vocabHint(cur, token) {
    const v = sess.vocab;
    const h = RPV.hint(cur.item, cur.dir);
    if (!v.hintGiven) { v.hintGiven = true; addCardBlock(v.el, block('blk-hint', '💡 Hint', h.nl)); }
    setState('speaking');
    await speak(h.fr, token, 'fr', 'corr');
    if (token !== loopToken) return;
    listenFor(cur, token);
  }

  async function vocabAnswer(text, token) {
    const v = sess.vocab;
    const cur = v.list[v.i];
    if (!cur) return;
    if (v.phase === 'repeat') return vocabRepeatHeard(text, token);
    const res = RPV.check(cur.item, cur.dir, text);
    if (res.result === 'correct' || res.result === 'almost') return vocabResolve(token, res.result, text, res);
    const cmd = RPV.detectCommand(text);
    if (cmd === 'stop') return vocabFinish(token, true);
    if (cmd === 'pause') return pauseSession();
    if (cmd === 'repeat' || cmd === 'slower') {
      if (cmd === 'slower') { settings.rate = Math.max(0.6, Math.round((settings.rate - 0.1) * 100) / 100); save(STORE.settings, settings); }
      return vocabAsk(token, true);
    }
    if (cmd === 'hint') return vocabHint(cur, token);
    if (cmd === 'skip') return vocabResolve(token, 'skip', '', res);
    if (res.result === 'article_missing' || res.result === 'article_wrong') return vocabResolve(token, 'article', text, res);
    if (settings.vocabSynonyms !== false) {
      setState('thinking', 'Even nakijken…');
      const j = await judgeAnswer(cur, text);
      if (!sess || token !== loopToken) return;
      if (j && j.ok) return vocabResolve(token, 'synonym', text, Object.assign({}, res, { note: j.note }));
    }
    if (v.attempt === 1) {
      v.attempt = 2;
      addCardBlock(v.el, block('blk-user', '🎙 Jouw antwoord', text));
      const h = RPV.hint(cur.item, cur.dir);
      v.hintGiven = true;
      addCardBlock(v.el, block('blk-corr', '✗ Niet juist – nog één kans', h.nl));
      setState('speaking');
      await speak('Non. ' + h.fr, token, 'fr', 'corr');
      if (token !== loopToken) return;
      return listenFor(cur, token);
    }
    return vocabResolve(token, 'wrong', text, res);
  }

  async function vocabResolve(token, kind, heard, res) {
    const v = sess.vocab;
    const cur = v.list[v.i];
    const correct = kind === 'correct' || kind === 'almost' || kind === 'synonym';
    RPV.update(vocabStore, cur.item, cur.dir, correct, Date.now());
    save(STORE.vocab, vocabStore);
    const expected = expectedText(cur);
    v.results.push({
      id: cur.item.id, fr: RPV.cleanFr(cur.item.fr), nl: RPV.cleanNl(cur.item.nl), dir: cur.dir, kind,
      detail: kind === 'article' ? res.result : null, form: res.expected || expected, heard, attempts: v.attempt, hint: v.hintGiven, note: cur.item.note || '',
      judge: kind === 'synonym' ? (res.note || '') : undefined
    });
    if (heard) addCardBlock(v.el, block('blk-user', '🎙 Jouw antwoord', heard));
    if (kind === 'synonym') {
      const c = el('div', 'blk blk-ok', `✓ Ook goed. In de lijst staat: ${expected}`);
      if (res.note) c.appendChild(el('div', 'why', res.note));
      addCardBlock(v.el, c);
    } else if (correct) {
      addCardBlock(v.el, el('div', 'blk blk-ok', kind === 'almost' ? `✓ Bijna juist: ${res.expected}` : '✓ Juist'));
    } else if (kind === 'article') {
      const c = block('blk-corr', '✎ Let op het lidwoord', res.expected);
      c.appendChild(el('div', 'why', res.result === 'article_missing' ? 'Juist woord, maar zonder lidwoord.' : 'Juist woord, maar verkeerd lidwoord.'));
      addCardBlock(v.el, c);
    } else {
      const c = block('blk-corr', kind === 'skip' ? '✎ Antwoord' : '✎ Juiste antwoord', expectedDisplay(cur));
      if (cur.item.note) c.appendChild(el('div', 'why', cur.item.note));
      addCardBlock(v.el, c);
    }
    updateMeta();
    setState('speaking');
    if (correct) {
      const praise = kind === 'almost' ? 'Presque parfait, mais oui !' : kind === 'synonym' ? 'Oui, ça marche aussi !' : PRAISE[v.results.length % PRAISE.length];
      await speak(praise, token, 'fr', 'main');
      if (token !== loopToken) return;
      return vocabAfterWord(token);
    }
    if (kind === 'article') await speak("Attention à l'article : " + res.expected + '.', token, 'fr', 'corr');
    else if (cur.dir === 'nf') await speak('La bonne réponse : ' + RPV.spokenFr(cur.item) + '.', token, 'fr', 'corr');
    else {
      await speak('La bonne réponse :', token, 'fr', 'corr');
      if (token !== loopToken) return;
      if (pickNlVoice()) await speak(expected, token, 'nl', 'corr');
    }
    if (token !== loopToken) return;
    /* Nazeggen (telt niet mee): alleen bij Franse antwoorden, voor de uitspraak */
    if (cur.dir === 'nf') {
      v.phase = 'repeat';
      addCardBlock(v.el, el('p', 'sys', 'Zeg het juiste antwoord na (telt niet mee)…'));
      listenFor(cur, token);
      startRepeatWindow(token);
    } else {
      vocabAfterWord(token);
    }
  }

  function speechStarted() {
    return !!((vad && vad.det.phase === 'speech') || (turnState && !turnState.done && (turnState.parts.length || turnState.current || turnState.interim)));
  }
  /* Wie niets nazegt, gaat na 6 seconden vanzelf naar het volgende woord. */
  function startRepeatWindow(token) {
    const v = sess.vocab;
    clearTimeout(v.timer);
    const check = () => {
      if (!sess || sess.vocab !== v || token !== loopToken || v.phase !== 'repeat') return;
      if (state === 'listening' && !speechStarted()) { stopRecognition(); v.phase = 'done'; vocabAfterWord(token); }
      else v.timer = setTimeout(check, 1500);       // spreekt nog of wordt verwerkt
    };
    v.timer = setTimeout(check, 6000);
  }

  async function vocabRepeatHeard(text, token) {
    const v = sess.vocab;
    const cur = v.list[v.i];
    clearTimeout(v.timer);
    v.phase = 'done';
    const cmd = RPV.detectCommand(text);
    const r = RPV.check(cur.item, 'nf', text);
    if (r.result !== 'correct' && r.result !== 'almost') {
      if (cmd === 'stop') return vocabFinish(token, true);
      if (cmd === 'pause') return pauseSession();
    }
    addCardBlock(v.el, block('blk-user', '🔁 Nagezegd', text));
    if (r.result === 'correct' || r.result === 'almost') {
      setState('speaking');
      await speak('Très bien !', token, 'fr', 'main');
      if (token !== loopToken) return;
    }
    vocabAfterWord(token);
  }

  /* ---------- Fase 2: voorbeeldzin en synoniemcontrole (taalmodel) ---------- */

  const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => null)]);

  function parseJsonObj(raw) {
    try { const o = JSON.parse(RP.stripFences(raw)); return o && typeof o === 'object' ? o : null; } catch (e) { return null; }
  }

  /* Voorbeeldzin: één keer per woord gemaakt en bewaard; wordt al opgehaald terwijl de leerder antwoordt. */
  function prefetchExample(cur) {
    if (settings.vocabExamples === false || !settings.apiKey) return;
    const id = cur.item.id;
    if (exampleCache[id]) { cur.examplePromise = Promise.resolve(exampleCache[id]); return; }
    const lvl = RP.LEVELS.includes(cur.item.lvl) ? cur.item.lvl : levelState.level;
    const maxWords = lvl === 'A1' || lvl === 'A2' ? 8 : lvl === 'B1' ? 12 : 15;
    cur.examplePromise = callGroq([
      { role: 'system', content: 'You write example sentences for a French vocabulary trainer for adult Dutch-speaking (Flemish) learners. Reply with one JSON object only.' },
      { role: 'user', content: `French: "${RPV.spokenFr(cur.item)}" (Dutch: "${RPV.cleanNl(cur.item.nl)}"). CEFR level: ${lvl}. Write ONE short, natural sentence in contemporary spoken French about everyday adult life that uses this word or expression with exactly this meaning (at most ${maxWords} words). Return {"fr": "the sentence", "nl": "a natural Flemish Dutch translation"}.` }
    ], 300, 1).then(raw => {
      const o = parseJsonObj(raw);
      if (!o || typeof o.fr !== 'string' || !o.fr.trim() || o.fr.length > 220) return null;
      const ex = { fr: o.fr.trim(), nl: typeof o.nl === 'string' ? o.nl.trim() : '' };
      exampleCache[id] = ex;
      const ids = Object.keys(exampleCache);
      if (ids.length > 1500) delete exampleCache[ids[0]];
      save(STORE.examples, exampleCache);
      return ex;
    }).catch(() => null);
  }

  /* Synoniemcontrole: is een door de app afgekeurd antwoord toch een juiste vertaling? */
  async function judgeAnswer(cur, text) {
    if (!settings.apiKey) return null;
    const nf = cur.dir === 'nf';
    const prompt = nf
      ? `The learner had to translate the Dutch "${RPV.displayNl(cur.item.nl)}" into French. Expected answer: "${RPV.spokenFr(cur.item)}". The learner said (automatic speech transcription; ignore punctuation, capitals and accents): "${text}". Is this a correct French translation with the same meaning in this context? A synonym or equivalent expression is fine. For nouns, an article (le, la, l', les, un, une) with the correct gender is REQUIRED; a missing or wrong article makes it incorrect.`
      : `The learner had to translate the French "${RPV.spokenFr(cur.item)}" into Dutch. Expected answer: "${RPV.displayNl(cur.item.nl)}". The learner said (automatic speech transcription; ignore punctuation and capitals): "${text}". Is this a correct Dutch translation with the same meaning in this context? A synonym or equivalent expression (also Flemish usage) is fine. The Dutch article (de/het) does not matter.`;
    const raw = await withTimeout(callGroq([
      { role: 'system', content: 'You check answers in a French–Dutch vocabulary trainer. Be fair but strict: only accept answers that a teacher would accept. Reply with one JSON object only.' },
      { role: 'user', content: prompt + ' Return {"ok": true or false, "note": "very short explanation in Dutch, max 12 words"}.' }
    ], 200, 1).catch(() => null), 6000);
    const o = raw && parseJsonObj(raw);
    if (!o || typeof o.ok !== 'boolean') return null;
    return { ok: o.ok, note: typeof o.note === 'string' ? o.note.trim().slice(0, 140) : '' };
  }

  /* Na elk woord: eventueel de voorbeeldzin (hoogstens 3 s wachten als ze nog niet klaar is), dan het volgende woord. */
  async function vocabAfterWord(token) {
    const v = sess && sess.vocab;
    if (!v || token !== loopToken) return;
    const cur = v.list[v.i];
    if (settings.vocabExamples !== false && cur && cur.examplePromise) {
      setState('thinking', 'Voorbeeldzin…');
      const ex = await withTimeout(cur.examplePromise, 3000);
      if (!sess || token !== loopToken) return;
      if (ex) {
        const b = block('blk-app', '💬 Voorbeeld', ex.fr);
        addTranslation(b, ex.nl);
        addCardBlock(v.el, b);
        const last = v.results[v.results.length - 1];
        if (last && last.id === cur.item.id) last.example = ex;
        setState('speaking');
        await speak(ex.fr, token, 'fr', 'main');
        if (token !== loopToken) return;
      }
    }
    vocabNext(token);
  }

  function vocabNext(token) {
    const v = sess && sess.vocab;
    if (!v || token !== loopToken) return;
    clearTimeout(v.timer);
    v.i++;
    vocabAsk(token);
  }

  async function vocabFinish(token, early) {
    const v = sess && sess.vocab;
    if (!v) return;
    clearTimeout(v.timer);
    const n = v.results.length;
    if (!early && n) {
      const ok = v.results.filter(isOkResult).length;
      const mood = ok / n >= 0.8 ? 'Bravo !' : ok / n >= 0.5 ? 'Pas mal du tout !' : 'Courage, ça viendra !';
      setState('speaking');
      await speak(`C'est fini ! Tu as ${ok} sur ${n}. ${mood}`, token, 'fr', 'main');
    }
    if (sess && sess.vocab === v) stopSession();
  }

  /* ---------- Verslag van een woordentraining ---------- */

  function renderVocabReport(s, body) {
    const ok = s.results.filter(isOkResult).length;
    const n = s.results.length;
    const sum = el('div', 'card report-summary');
    sum.appendChild(el('b', null, fmtDate(s.start)));
    sum.appendChild(el('span', null, `Woordentraining · ${RPV.DIRS[s.dir]} · ${catTitle(s.cat)}`));
    sum.appendChild(el('span', null, `Score: ${ok}/${n} (${n ? Math.round(100 * ok / n) : 0}%) · ${minutes(s.end - s.start)} min · niveau ${s.startLevel}`));
    const sm = RPV.summary(allItems(), vocabStore, { cat: s.cat, dir: s.dir, level: s.startLevel });
    sum.appendChild(el('span', 'muted small', `Voortgang: ${sm.known} van ${sm.total} woorden goed gekend`));
    body.appendChild(sum);

    const asked = r => (r.dir === 'fn' ? r.fr : r.nl);
    const answer = r => (r.dir === 'fn' ? r.nl : r.form || r.fr);
    const section = (title, rows, fn) => {
      if (!rows.length) return;
      body.appendChild(el('p', 'report-section-title', title));
      const ul = el('ul', 'corr-list');
      rows.forEach(r => { const li = el('li'); fn(li, r); ul.appendChild(li); });
      body.appendChild(ul);
    };
    section('Om te herhalen', s.results.filter(r => r.kind === 'wrong' || r.kind === 'skip'), (li, r) => {
      li.appendChild(el('div', null, `${asked(r)} → ${answer(r)}`));
      if (r.heard) li.appendChild(el('div', 'old', r.heard));
      if (r.note) li.appendChild(el('div', 'muted small', r.note));
      if (r.example) li.appendChild(el('div', 'muted small', `💬 ${r.example.fr}` + (r.example.nl ? ` – ${r.example.nl}` : '')));
    });
    section('Ook goed gerekend (synoniem)', s.results.filter(r => r.kind === 'synonym'), (li, r) => {
      li.appendChild(el('div', null, `${asked(r)} → jij: ${r.heard}`));
      li.appendChild(el('div', 'muted small', `In de lijst: ${answer(r)}` + (r.judge ? ` · ${r.judge}` : '')));
    });
    section('Let op het lidwoord', s.results.filter(r => r.kind === 'article'), (li, r) => {
      li.appendChild(el('div', null, `${r.nl} → ${r.form}`));
      if (r.heard) li.appendChild(el('div', 'old', r.heard));
    });
    section('Alle woorden', s.results, (li, r) => {
      const mark = r.kind === 'correct' ? '✓' : (r.kind === 'almost' || r.kind === 'synonym') ? '≈' : '✗';
      li.appendChild(el('div', null, `${mark}  ${asked(r)} → ${answer(r)}`));
    });
  }

  function vocabReportText(s) {
    const ok = s.results.filter(isOkResult).length;
    const lines = [`RoutePratique – woordentraining ${fmtDate(s.start)}`, `${RPV.DIRS[s.dir]} · ${catTitle(s.cat)} · score ${ok}/${s.results.length}`, ''];
    s.results.forEach((r, i) => {
      const q = r.dir === 'fn' ? r.fr : r.nl, a = r.dir === 'fn' ? r.nl : (r.form || r.fr);
      const mark = { correct: '✓', almost: '≈', synonym: '≈ synoniem', article: '✗ lidwoord', wrong: '✗', skip: '–' }[r.kind] || '';
      lines.push(`${i + 1}. ${q} → ${a}  ${mark}${r.heard && r.kind !== 'correct' ? '  (jij: ' + r.heard + ')' : ''}`);
    });
    return lines.join('\n');
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
  /* Antwoordblok van Camille, met de Nederlandse vertaling eronder (als die aanstaat). */
  function addTranslation(b, nl) {
    if (nl && settings.showTranslation !== false) b.appendChild(el('div', 'nl', nl));
  }
  function appBlock(text, nl) {
    const b = block('blk-app', '🔊 Antwoord', text);
    addTranslation(b, nl);
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
  function fillAppBlock(turnEl, text, nl) {
    const p = turnEl.querySelector('[data-pending]');
    if (!p) return;
    if (text === null) { p.remove(); return; }
    p.querySelector('.txt').textContent = text;
    addTranslation(p, nl);
    delete p.dataset.pending;
  }
  function fillTurn(turnEl, parsed) {
    const pending = turnEl.querySelector('[data-pending]');
    correctionBlocks(parsed).forEach(b => turnEl.insertBefore(b, pending));
    fillAppBlock(turnEl, parsed.antwoord, parsed.vertaling);
    scrollLog();
  }
  function renderAppOnlyTurn(text, nl) {
    const t = makeTurnShell();
    t.appendChild(appBlock(text, nl));
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
    if (!SR && !canWhisper()) warn.push('Spraakherkenning is niet beschikbaar in deze browser. Gebruik Chrome op Android.');
    if (!settings.apiKey) warn.push('Vul eerst je Groq API-sleutel in bij Instellingen (⚙).');
    if (hasTTS && voices.length === 0) warn.push('Nog geen Franse stem gevonden. Controleer de spraakuitvoer van Android (Google Spraakservices, Frans).');
    const w = $('home-warning');
    w.textContent = warn.join(' ');
    w.classList.toggle('hidden', warn.length === 0);

    const totalMin = sessions.reduce((a, s) => a + minutes(s.end - s.start), 0);
    const totalTurns = sessions.reduce((a, s) => a + s.turns.length + (s.results ? s.results.length : 0), 0);
    updateVocabInfo();
    const stats = $('home-stats');
    stats.innerHTML = '';
    [[sessions.length, 'sessies'], [totalMin, 'minuten'], [totalTurns, 'beurten']].forEach(([n, l]) => {
      const d = el('div', 'stat');
      d.appendChild(el('b', null, String(n)));
      d.appendChild(el('span', null, l));
      stats.appendChild(d);
    });
  }

  function fillStyleSelect() {
    const sel = $('sel-style');
    sel.innerHTML = '';
    RP.STYLES.forEach(st => {
      const o = el('option', null, RP.STYLE_LABELS[st]);
      o.value = st;
      if (st === settings.conversationStyle) o.selected = true;
      sel.appendChild(o);
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
      list.appendChild(el('p', 'muted', 'Nog geen sessies. Na een gesprek of woordentraining verschijnt hier het verslag.'));
      return;
    }
    sessions.slice().reverse().forEach(s => {
      const c = el('div', 'card hist-item');
      if (s.type === 'vocab') {
        const ok = s.results.filter(isOkResult).length;
        c.appendChild(el('b', null, fmtDate(s.start)));
        c.appendChild(el('span', 'muted small', `Woordentraining · ${RPV.DIRS[s.dir]} · ${catTitle(s.cat)}`));
        c.appendChild(el('span', 'muted small', `${ok}/${s.results.length} juist · ${minutes(s.end - s.start)} min`));
        c.addEventListener('click', () => openReport(s.id));
        list.appendChild(c);
        return;
      }
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
    if (s.type === 'vocab') { renderVocabReport(s, body); show('report'); return; }

    const sum = el('div', 'card report-summary');
    const nCorr = s.turns.filter(t => t.correctie).length;
    const scored = s.turns.filter(t => typeof t.score === 'number');
    const avg = scored.length ? Math.round(100 * scored.reduce((a, t) => a + t.score, 0) / scored.length) : null;
    sum.appendChild(el('b', null, fmtDate(s.start)));
    sum.appendChild(el('span', null, `Thema: ${RP.themeById(s.theme).nl}` + (s.style ? ` · ${RP.STYLE_LABELS[s.style]}` : '')));
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

    const newWords = s.turns.flatMap(t => t.leerwoorden || []);
    if (newWords.length) {
      body.appendChild(el('p', 'report-section-title', 'Nieuw in je woordentraining'));
      const ul = el('ul', 'corr-list');
      newWords.forEach(w => { const li = el('li'); li.appendChild(el('div', null, `${RPV.cleanFr(w.fr)} – ${w.nl}`)); ul.appendChild(li); });
      body.appendChild(ul);
    }

    body.appendChild(el('p', 'report-section-title', 'Volledig gesprek'));
    s.turns.forEach(t => {
      const wrap = el('div', 'turn report-turn');
      wrap.appendChild(block('blk-user', '🎙 Jouw zin', t.user));
      correctionBlocks(t).forEach(b => wrap.appendChild(b));
      wrap.appendChild(appBlock(t.antwoord, t.vertaling));
      body.appendChild(wrap);
    });
    show('report');
  }

  function reportAsText(s) {
    if (s.type === 'vocab') return vocabReportText(s);
    const lines = [
      `RoutePratique – ${fmtDate(s.start)}`,
      `Thema: ${RP.themeById(s.theme).nl} · ${minutes(s.end - s.start)} min · niveau ${s.startLevel} → ${s.endLevel}`,
      ''
    ];
    s.turns.forEach((t, i) => {
      lines.push(`${i + 1}. Jij: ${t.user}`);
      if (t.correctie) lines.push(`   Verbeterd: ${t.correctie}${t.uitleg ? ' (' + t.uitleg + ')' : ''}`);
      lines.push(`   Camille: ${t.antwoord}`);
      if (t.vertaling) lines.push(`   (NL: ${t.vertaling})`);
      if (t.leerwoorden && t.leerwoorden.length) lines.push(`   + woordentraining: ${t.leerwoorden.map(w => RPV.cleanFr(w.fr) + ' – ' + w.nl).join(', ')}`);
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
    $('set-gender-device').value = settings.voiceGenderDevice === 'm' ? 'm' : 'f';
    $('set-gender-main').value = settings.genderMain === 'm' ? 'm' : 'f';
    $('set-gender-corr').value = settings.genderCorr === 'f' ? 'f' : 'm';
    $('set-stt').value = settings.sttEngine === 'chrome' ? 'chrome' : 'whisper';
    $('set-micoff').checked = settings.micOffWhileSpeaking !== false;
    $('set-humor').value = RP.HUMOR_LEVELS.includes(settings.humor) ? settings.humor : 'afentoe';
    $('set-translate').checked = settings.showTranslation !== false;
    $('set-vsyn').checked = settings.vocabSynonyms !== false;
    $('set-vex').checked = settings.vocabExamples !== false;
    $('set-collect').checked = settings.collectWords !== false;
    $('set-corr').value = ['uit', 'zin', 'uitleg'].includes(settings.speakCorrection) ? settings.speakCorrection : 'zin';
    updateCorrHint();
    $('set-pause').value = settings.pause;
    $('set-pause-out').textContent = fmtPause(settings.pause);
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
    const g = id => ($(id).value === 'm' ? 'm' : 'f');
    settings.voiceGenderDevice = g('set-gender-device');
    settings.genderMain = g('set-gender-main');
    settings.genderCorr = g('set-gender-corr');
    settings.sttEngine = $('set-stt').value === 'chrome' ? 'chrome' : 'whisper';
    settings.micOffWhileSpeaking = $('set-micoff').checked;
    settings.humor = RP.HUMOR_LEVELS.includes($('set-humor').value) ? $('set-humor').value : 'afentoe';
    settings.showTranslation = $('set-translate').checked;
    settings.vocabSynonyms = $('set-vsyn').checked;
    settings.vocabExamples = $('set-vex').checked;
    settings.collectWords = $('set-collect').checked;
    whisperBroken = false;
    const c = $('set-corr').value;
    settings.speakCorrection = ['uit', 'zin', 'uitleg'].includes(c) ? c : 'zin';
    const p = parseFloat($('set-pause').value);
    settings.pause = isFinite(p) ? Math.min(8, Math.max(1, p)) : DEFAULTS.pause;
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
    $('sel-mode').addEventListener('change', () => { settings.mode = $('sel-mode').value; save(STORE.settings, settings); applyMode(); });
    ['sel-vdir', 'sel-vcat'].forEach(id => $(id).addEventListener('change', updateVocabInfo));
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
    $('set-pause').addEventListener('input', e => { $('set-pause-out').textContent = fmtPause(e.target.value); });
    $('set-corr').addEventListener('change', updateCorrHint);

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
      const intro = settings.genderMain === 'm' ? 'Bonjour ! Je suis Camille, ton partenaire de conversation.' : 'Bonjour ! Je suis Camille, ta partenaire de conversation.';
      speak(intro + ' On fait un petit tour en français ?', undefined, 'fr', 'main')
        .then(() => speak('On dit plutôt : je suis allé au marché.', undefined, 'fr', 'corr'));
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
        if (settings.sttEngine !== 'chrome') {
          await transcribe(RP.encodeWav(new Float32Array(8000), 16000, 16000));   // 0,5 s stilte
          settingsMsg('Verbinding werkt: taalmodel en spraakherkenning (Whisper).', 'ok');
        } else {
          settingsMsg('Verbinding met Groq werkt.', 'ok');
        }
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
      if (!confirm(`Opnieuw beginnen op niveau ${lvl}?\n\nAlle verslagen, statistieken, de niveaugeschiedenis en je voortgang in de woordentraining (ook de woorden uit je gesprekken) worden definitief gewist. Je instellingen blijven behouden.`)) return;
      readSettingsForm();
      save(STORE.settings, settings);
      sessions = [];
      save(STORE.sessions, sessions);
      levelState = RP.newLevelState(lvl);
      save(STORE.level, levelState);
      vocabStore = {};
      save(STORE.vocab, vocabStore);
      myWords = [];
      save(STORE.mywords, myWords);
      fillVocabSelects();
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
    fillStyleSelect();
    fillVocabSelects();
    $('sel-context').value = settings.context === 'auto' ? 'auto' : 'algemeen';
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
