/* RoutePratique – kernlogica (geen DOM, testbaar met Node) */
(function (root) {
  'use strict';

  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  const LEVEL_PROFILE = {
    A1: {
      label: 'Beginner',
      speech: 'Max 2 very short sentences (max 10 words each). Very frequent words only. Speak about concrete, everyday things. When you ask a question, keep it simple (closed or very easy open).',
      grammar: 'présent of être, avoir, aller, faire and regular -er verbs; articles; ne...pas; simple questions (est-ce que, qu\'est-ce que); futur proche.'
    },
    A2: {
      label: 'Basis',
      speech: 'Max 2 short sentences (max 14 words each). Frequent everyday vocabulary. Your questions are short and open.',
      grammar: 'passé composé with avoir and être; basic imparfait (c\'était, il y avait); direct object pronouns; comparatives; il faut + infinitive; futur proche.'
    },
    B1: {
      label: 'Drempel',
      speech: 'Max 3 sentences. Natural spoken French, some connectors (parce que, alors, mais, donc). Your questions invite the learner to tell or explain something.',
      grammar: 'contrast imparfait / passé composé; futur simple; conditionnel présent; pronouns y and en; relative pronouns qui, que, où; il faut que + subjonctif (introduction).'
    },
    B2: {
      label: 'Gevorderd',
      speech: 'Max 3 sentences. Natural, varied spoken French with some idiomatic expressions. Ask for opinions, comparisons and hypotheses.',
      grammar: 'subjonctif after expressions of opinion, emotion, necessity; plus-que-parfait; conditionnel passé; si-clauses (all three types); indirect speech; logical connectors (pourtant, alors que, en revanche).'
    },
    C1: {
      label: 'Vaardig',
      speech: 'Max 4 sentences. Rich, nuanced spoken French, idioms, varied register. Challenge the learner to argue, nuance and defend a position.',
      grammar: 'nuanced use of all tenses and moods; gérondif; passive voice; register shifts (familier / courant / soutenu); idiomatic expressions; complex argumentation.'
    },
    C2: {
      label: 'Meesterschap',
      speech: 'Max 4 sentences. Speak as with a native speaker: idioms, humour, implicit meaning, fast topic shifts.',
      grammar: 'near-native precision; idioms and proverbs; subtle register and style; implicit meaning and irony.'
    }
  };

  const THEMES = [
    { id: 'vrij', nl: 'Vrij gesprek', fr: 'conversation libre, le sujet peut évoluer naturellement' },
    { id: 'reizen', nl: 'Onderweg en reizen', fr: 'la route, les trajets, les voyages, les vacances' },
    { id: 'boodschappen', nl: 'Boodschappen en winkels', fr: 'les courses, le marché, les magasins, les prix' },
    { id: 'restaurant', nl: 'Eten en restaurant', fr: 'la cuisine, les repas, commander au restaurant' },
    { id: 'werk', nl: 'Werk en beroep', fr: 'le travail, les collègues, le métier, l\'enseignement' },
    { id: 'techniek', nl: 'Techniek', fr: 'la technique, les machines, l\'électricité, les réparations' },
    { id: 'familie', nl: 'Familie en vrienden', fr: 'la famille, les amis, les relations' },
    { id: 'vrijetijd', nl: 'Vrije tijd en hobby\'s', fr: 'les loisirs, la musique, le sport, les sorties' },
    { id: 'wonen', nl: 'Wonen en het huis', fr: 'la maison, le quartier, les travaux' },
    { id: 'weer', nl: 'Weer en seizoenen', fr: 'la météo, les saisons, la nature' },
    { id: 'gezondheid', nl: 'Gezondheid en welzijn', fr: 'la santé, le médecin, la forme, le sommeil' },
    { id: 'actualiteit', nl: 'Actualiteit en maatschappij', fr: 'l\'actualité, la société, les opinions' },
    { id: 'diensten', nl: 'Diensten en afspraken', fr: 'prendre rendez-vous, téléphoner, la banque, la poste, le garage' }
  ];

  function themeById(id) {
    return THEMES.find(t => t.id === id) || THEMES[0];
  }

  /* Gespreksvorm: wie stelt de vragen? */
  const STYLES = ['afwisselend', 'leerder', 'camille'];
  const STYLE_LABELS = {
    afwisselend: 'Afwisselend',
    leerder: 'Ik stel de vragen',
    camille: 'Camille stelt de vragen'
  };
  const STYLE_RULES = {
    afwisselend: [
      'CONVERSATION STYLE: balanced. Both of you ask questions.',
      '- React to what the learner said and show interest.',
      '- Do NOT end every turn with a question. About every second turn, end WITHOUT a question: share your own experience or opinion and leave the floor to the learner.',
      '- Regularly (about every four turns) invite the learner to ask YOU something, e.g. "Et toi, tu veux me demander quelque chose ?" or "Pose-moi une question !".'
    ],
    leerder: [
      'CONVERSATION STYLE: the learner leads and practises ASKING questions.',
      '- Answer the learner\'s questions fully and naturally, with a concrete personal detail.',
      '- Normally do NOT ask a question back. At most a short invitation such as "Autre chose ?" or "Vas-y, pose-moi une autre question !".',
      '- If the learner falls silent, says they do not know what to ask, or answers instead of asking, suggest one topic they could ask you about (e.g. "Tu peux me demander où je suis parti en vacances.").'
    ],
    camille: [
      'CONVERSATION STYLE: you lead the conversation.',
      '- React to what the learner said, show interest, then ask ONE question.'
    ]
  };
  /* Humor: hoeveel en welke soort */
  const HUMOR_LEVELS = ['uit', 'afentoe', 'veel'];
  const HUMOR_LABELS = { uit: 'Uit', afentoe: 'Af en toe', veel: 'Veel' };
  const HUMOR_COMMON = [
    '- Humor must be light, warm and kind: playful exaggeration, gentle self-mockery, a wink at traffic jams, the weather, French or Belgian everyday quirks (fries, rain, bureaucracy, coffee), or everyday situations.',
    '- Adapt the humor to the level. A1-A2: very simple, obvious humor with frequent words (exaggeration, a funny comparison). B1 and higher: also wordplay, idioms and expressions, which are a learning opportunity in themselves.',
    '- The humor must be understandable without looking at a screen. If a joke relies on an expression, it may be followed by a very short French paraphrase.',
    '- Never joke about the learner\'s mistakes, accent or abilities. Never put humor in "correctie" or "uitleg". No sarcasm, no irony that could be misunderstood, nothing about politics, religion or appearance.',
    '- If the learner makes a joke, react to it like a real person ("Ha ha, très drôle !", play along with it).',
    '- Humor never replaces the conversation: keep the turn short and still react to the content.'
  ];
  const HUMOR_RULES = {
    uit: ['HUMOR: keep a friendly but neutral tone; no deliberate jokes.'],
    afentoe: ['HUMOR: occasionally, about one turn in four, add a short touch of humor (one sentence at most).'].concat(HUMOR_COMMON),
    veel: ['HUMOR: you have a playful personality; add a short touch of humor in about every second turn (one sentence at most).'].concat(HUMOR_COMMON)
  };

  const START_RULES = {
    afwisselend: 'When the user message is [START], greet the learner briefly and start the conversation about the theme with one question; correctie, uitleg and score are null.',
    leerder: 'When the user message is [START], greet the learner briefly, say in one sentence something about yourself related to the theme, and invite the learner to ask you questions about it (do not ask a question yourself); correctie, uitleg and score are null.',
    camille: 'When the user message is [START], greet the learner briefly and ask the first question about the theme; correctie, uitleg and score are null.'
  };

  function buildSystemPrompt(level, themeId, opts) {
    const spoken = !!(opts && opts.correctionSpoken);
    const male = !!(opts && opts.persona === 'm');
    const style = STYLES.includes(opts && opts.style) ? opts.style : 'afwisselend';
    const humor = HUMOR_LEVELS.includes(opts && opts.humor) ? opts.humor : 'afentoe';
    const inCar = !!(opts && opts.context === 'auto');
    const translate = !(opts && opts.translate === false);
    const p = LEVEL_PROFILE[level] || LEVEL_PROFILE.A2;
    const t = themeById(themeId);
    return [
      inCar
        ? 'You are "Camille", a warm, patient French conversation partner for an adult Dutch-speaking (Flemish) learner who practises spoken French while driving a car.'
        : 'You are "Camille", a warm, patient French conversation partner for an adult Dutch-speaking (Flemish) learner who practises spoken French. Do not assume where the learner is or what they are doing (do not assume they are driving); only refer to their situation if they mention it.',
      male
        ? 'Camille is a man here (Camille is a unisex name in French). When you talk about yourself, use masculine forms (je suis content, je suis allé, un partenaire).'
        : 'Camille is a woman here. When you talk about yourself, use feminine forms (je suis contente, je suis allée, une partenaire).',
      'The learner speaks; their speech is transcribed automatically, so the text has no reliable punctuation or capitals and may contain recognition errors.',
      '',
      `CURRENT LEVEL: ${level} (CEFR).`,
      `How you speak at this level: ${p.speech}`,
      `Grammar to use and to elicit at this level: ${p.grammar}`,
      `THEME: ${t.fr}.`,
      '',
      'DIDACTIC RULES:',
      '- Speak French only in "antwoord". Never switch to Dutch or English in "antwoord".',
      ...STYLE_RULES[style],
      '- Never ask two questions at once.',
      '',
      ...HUMOR_RULES[humor],
      '',
      'QUESTIONS FROM THE LEARNER (always, in every conversation style):',
      '- If the learner asks you something (about you, your life, your opinion, the theme, or the French language), answer it properly FIRST, in French at the current level. Never skip it or answer in a few words just to ask your own question.',
      '- You have a plausible everyday adult life in France (work, family, home, hobbies, travel). When asked, invent concrete details and stay consistent with what you said earlier in this conversation.',
      '- Language questions ("comment on dit … ?", "qu\'est-ce que ça veut dire ?", or the same asked in Dutch): give the French word or a short, simple explanation in French, with an example, then continue.',
      '- Asking a correct, relevant question is a valuable skill: score it like any other good utterance.',
      '',
      spoken
        ? '- The app reads "correctie" aloud just before "antwoord". So in "antwoord" do NOT repeat or announce the correction; simply react to the content and continue the conversation. Do not lecture.'
        : '- Correct implicitly: in "antwoord", naturally reuse the correct form of what the learner got wrong (recast). Do not lecture.',
      '- Regularly create situations that make the learner use the grammar of the current level.',
      inCar
        ? '- The learner is driving: no lists, no spelling, no numbers to remember, nothing that requires looking at a screen.'
        : '- This is a spoken conversation: keep turns short and natural, no long lists.',
      '- If the learner seems lost, simplify, rephrase, or offer two options to choose from.',
      '- If the learner answers in Dutch, gently give the French way to say it and invite them to repeat it.',
      '',
      'CORRECTION RULES:',
      '- Judge only grammar, vocabulary and word choice. Ignore missing punctuation, capitals and accents in the transcription.',
      '- If a "mistake" is most likely a speech-recognition error (homophone, e.g. "et/est", "a/à", "ces/ses"), do not count it as a mistake.',
      '- "correctie": the learner\'s full utterance rewritten in correct, natural French. Set to null if the utterance was already correct and natural.',
      '- "uitleg": if there is a correction, a very short explanation IN DUTCH (max 12 words) of the main mistake. Otherwise null.',
      '',
      'SCORE ("score", number between 0 and 1) for the learner\'s last utterance, relative to the CURRENT LEVEL:',
      '- 1.0: correct, fluent, rich enough or above this level.',
      '- 0.7: understandable, minor mistakes, fits this level.',
      '- 0.4: understandable but with clear mistakes or very short / minimal answer.',
      '- 0.1: hardly understandable, wrong language, or no real answer.',
      '',
      'OUTPUT: reply with ONE JSON object only, no other text:',
      '{"correctie": string|null, "uitleg": string|null, "antwoord": string, "vertaling": string|null, "score": number|null, "leerwoorden": [{"fr": string, "nl": string}]}',
      '"leerwoorden": at most 2 French words or short expressions the learner needs to learn from their LAST utterance: a word they did not know (said it in Dutch or English, talked around it, or asked how to say it) or a word they used wrongly (wrong word, false friend, wrong gender of a noun). NOT for grammar or conjugation mistakes. "fr": dictionary form (infinitive for verbs; nouns with definite article, and add (m.) or (f.) after a noun with l\'). "nl": Dutch translation (with de/het for nouns). Use [] when there is nothing to add, and always [] for bracketed messages.',
      translate
        ? '"vertaling": a natural, faithful Dutch (Flemish, nl-BE) translation of "antwoord", in the same register (tu → je/jij). Always fill it, also for [START] and other bracketed messages.'
        : '"vertaling": always null.',
      START_RULES[style],
      'When the user message is [JOUW_BEURT], the learner wants you to ask the questions again: ask one question about the theme or about what was said; correctie, uitleg and score are null.',
      'When the user message is [MIJN_BEURT], the learner wants to ask the questions: say briefly and warmly that you are listening (for example "Vas-y, je t\'écoute !"), without asking a question; correctie, uitleg and score are null.'
    ].join('\n');
  }

  function stripFences(text) {
    let t = String(text || '').trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first !== -1 && last > first) t = t.slice(first, last + 1);
    return t;
  }

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, '\'')
      .replace(/[^a-z0-9' ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Zet het modelantwoord om naar een gecontroleerd object. Gooit een fout bij onbruikbare inhoud. */
  function parseModelReply(text, userText) {
    let obj;
    try {
      obj = JSON.parse(stripFences(text));
    } catch (e) {
      throw new Error('Ongeldig antwoord van het taalmodel (geen JSON).');
    }
    if (!obj || typeof obj !== 'object') throw new Error('Ongeldig antwoord van het taalmodel.');
    const antwoord = typeof obj.antwoord === 'string' ? obj.antwoord.trim() : '';
    if (!antwoord) throw new Error('Het taalmodel gaf geen antwoord.');

    let correctie = typeof obj.correctie === 'string' ? obj.correctie.trim() : null;
    let uitleg = typeof obj.uitleg === 'string' ? obj.uitleg.trim() : null;
    if (correctie === '' || (correctie && userText && normalize(correctie) === normalize(userText))) {
      correctie = null;
      uitleg = null;
    }
    if (!correctie) uitleg = null;

    let score = null;
    if (typeof obj.score === 'number' && isFinite(obj.score)) {
      score = Math.min(1, Math.max(0, obj.score));
    } else if (typeof obj.score === 'string' && obj.score.trim() !== '' && isFinite(Number(obj.score))) {
      score = Math.min(1, Math.max(0, Number(obj.score)));
    }
    const vertaling = typeof obj.vertaling === 'string' && obj.vertaling.trim() ? obj.vertaling.trim() : null;
    const leerwoorden = (Array.isArray(obj.leerwoorden) ? obj.leerwoorden : [])
      .filter(w => w && typeof w.fr === 'string' && typeof w.nl === 'string' && w.fr.trim() && w.nl.trim() && w.fr.length <= 60 && w.nl.length <= 80)
      .slice(0, 3)
      .map(w => ({ fr: w.fr.trim(), nl: w.nl.trim() }));
    return { correctie, uitleg, antwoord, vertaling, score, leerwoorden };
  }

  const ADAPT = { upWindow: 6, upThreshold: 0.8, downWindow: 4, downThreshold: 0.35 };

  function newLevelState(level) {
    return { level: LEVELS.includes(level) ? level : 'A2', scores: [] };
  }

  /* Verwerkt één score. Geeft { state, change } terug; change is 'up', 'down' of null. */
  function adaptLevel(state, score, enabled) {
    const s = { level: state.level, scores: state.scores.slice() };
    if (score === null || score === undefined || !isFinite(score)) return { state: s, change: null };
    s.scores.push(score);
    if (s.scores.length > ADAPT.upWindow) s.scores.shift();
    if (enabled === false) return { state: s, change: null };

    const idx = LEVELS.indexOf(s.level);
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    if (s.scores.length >= ADAPT.upWindow && avg(s.scores) >= ADAPT.upThreshold && idx < LEVELS.length - 1) {
      return { state: { level: LEVELS[idx + 1], scores: [] }, change: 'up' };
    }
    const recent = s.scores.slice(-ADAPT.downWindow);
    if (recent.length >= ADAPT.downWindow && avg(recent) <= ADAPT.downThreshold && idx > 0) {
      return { state: { level: LEVELS[idx - 1], scores: [] }, change: 'down' };
    }
    return { state: s, change: null };
  }

  /* Voegt stukken spraakherkenning samen zonder herhalingen.
     Chrome op Android geeft bij continue herkenning vaak cumulatieve resultaten terug
     ("je suis", "je suis allé", "je suis allé au marché") of stukken die overlappen. */
  function mergeTranscripts(segments) {
    let out = [];      // originele woorden
    let outN = [];     // genormaliseerde woorden
    const startsWith = (a, b) => b.length <= a.length && b.every((w, i) => a[i] === w);
    const endsWith = (a, b) => b.length <= a.length && b.every((w, i) => a[a.length - b.length + i] === w);
    for (const seg of segments) {
      const words = String(seg || '').trim().split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      const wordsN = words.map(w => normalize(w));
      if (!out.length) { out = words; outN = wordsN; continue; }
      if (startsWith(wordsN, outN)) { out = words; outN = wordsN; continue; }   // cumulatief: nieuw stuk bevat het vorige
      if (endsWith(outN, wordsN)) continue;                                     // nieuw stuk zit al aan het einde
      /* Herziening: Chrome verbetert de laatste woorden ("rentré plus" → "rentré à plus tard").
         Het nieuwe stuk begint met (bijna) alles wat er al stond: vervangen in plaats van toevoegen. */
      let cp = 0;
      while (cp < outN.length && cp < wordsN.length && outN[cp] === wordsN[cp]) cp++;
      if (cp >= 2 && cp >= outN.length - 3 && wordsN.length >= cp + 1) { out = words; outN = wordsN; continue; }
      let k = Math.min(outN.length, wordsN.length - 1);
      for (; k >= 2; k--) {                                                     // overlap van minstens twee woorden
        if (endsWith(outN, wordsN.slice(0, k))) break;
      }
      if (k >= 2) {
        out = out.concat(words.slice(k)); outN = outN.concat(wordsN.slice(k));
      } else {
        out = out.concat(words); outN = outN.concat(wordsN);
      }
    }
    return out.join(' ');
  }

  /* ---------- Eigen opname (Whisper): stilte-detectie, WAV, opschonen ---------- */

  /* Stemdetectie op basis van het geluidsniveau (RMS) per audioblok.
     - settle: eerste ms na het begin negeren (naklank van Camille, klik van de microfoon)
     - calib: achtergrondgeluid meten (30e percentiel, robuust als de leerder meteen begint)
     - wait: wachten tot de leerder begint (onbeperkt), met een korte voorloop in het geheugen
     - speech: opnemen tot de stilte langer duurt dan de denkpauze */
  function createVad(opt) {
    const o = Object.assign({ pauseMs: 2500, minThr: 0.012, factor: 3, settleMs: 400, calibMs: 300, preRollMs: 500,
      startMs: 120, minVoicedMs: 250, maxMs: 60000, tailMs: 300, maxCalibFloor: 0.04 }, opt);
    const rate = o.sampleRate || 48000;
    const dur = n => (n / rate) * 1000;
    let phase = 'settle', elapsed = 0, calib = [], floor = 0, pre = [], preT = 0, run = 0;
    let frames = [], t = 0, lastVoice = 0, voiced = 0, lastRms = 0;
    const thr = () => Math.max(o.minThr, floor * o.factor);
    const rmsOf = f => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i]; return Math.sqrt(s / (f.length || 1)); };
    const pushPre = (f, d) => { pre.push([f, d]); preT += d; while (pre.length > 1 && preT - pre[0][1] >= o.preRollMs) preT -= pre.shift()[1]; };
    function concat(list, maxMs) {
      let n = 0, acc = 0; const keep = [];
      for (const [f, d] of list) { if (maxMs !== undefined && acc >= maxMs) break; keep.push(f); n += f.length; acc += d; }
      const out = new Float32Array(n); let p = 0;
      keep.forEach(f => { out.set(f, p); p += f.length; });
      return out;
    }
    return {
      get phase() { return phase; },
      get rms() { return lastRms; },
      get threshold() { return thr(); },
      push(frame) {
        if (phase === 'done') return null;
        const f = new Float32Array(frame);
        const d = dur(f.length);
        const r = rmsOf(f); lastRms = r;
        if (phase === 'settle') {
          elapsed += d;
          if (elapsed >= o.settleMs) phase = 'calib';
          return null;
        }
        if (phase === 'calib') {
          calib.push(r); pushPre(f, d); elapsed += d;
          if (elapsed >= o.settleMs + o.calibMs) {
            const sorted = calib.slice().sort((a, b) => a - b);
            /* begrensd: begint de leerder meteen te spreken, dan wordt zijn stem geen 'achtergrond' */
            floor = Math.min(sorted[Math.floor(sorted.length * 0.3)] || 0, o.maxCalibFloor);
            phase = 'wait';
          }
          return null;
        }
        if (phase === 'wait') {
          pushPre(f, d);
          if (r > thr()) run += d;
          else { run = 0; floor = r < floor ? floor * 0.8 + r * 0.2 : floor * 0.97 + r * 0.03; }   // snel omlaag, traag omhoog
          if (run >= o.startMs) {
            phase = 'speech';
            frames = pre.slice(); t = preT; lastVoice = t; voiced = run; pre = []; preT = 0;
            return { type: 'speechStart' };
          }
          return null;
        }
        /* speech */
        frames.push([f, d]); t += d;
        if (r > thr() * 0.7) { lastVoice = t; voiced += d; }
        if (t - lastVoice >= o.pauseMs || t >= o.maxMs) {
          phase = 'done';
          if (voiced < o.minVoicedMs) return { type: 'discard' };
          const samples = concat(frames, lastVoice + o.tailMs);
          return { type: 'end', samples, durationMs: dur(samples.length) };
        }
        return null;
      }
    };
  }

  /* Float32-audio → WAV (mono, 16-bit), herbemonsterd naar 16 kHz (genoeg voor spraak, kleine bestanden). */
  function encodeWav(samples, inRate, outRate) {
    outRate = outRate || 16000;
    const ratio = inRate / outRate;
    const n = Math.max(0, Math.floor(samples.length / ratio));
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
      let s = 0; for (let j = a; j < b && j < samples.length; j++) s += samples[j];
      const x = Math.max(-1, Math.min(1, s / (b - a)));
      v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
    }
    return new Uint8Array(buf);
  }

  /* Whisper verzint bij stilte of ruis soms ondertitelzinnen. Die worden weggefilterd. */
  const HALLUCINATIONS = ['sous-titres', 'sous titres', 'sous-titrage', 'amara', "merci d'avoir regarde", 'abonnez-vous', 'abonnez vous',
    'radio-canada', 'www.', '.com', 'merci de nous avoir suivis',
    'ondertitel', 'bedankt voor het kijken', 'bedankt voor het luisteren', 'abonneer'];
  function cleanTranscript(text) {
    let t = String(text || '').trim().replace(/^["'«»\s]+|["'«»\s]+$/g, '');
    if (!/[a-z0-9À-ſ]/i.test(t)) return '';
    const low = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (HALLUCINATIONS.some(h => low.includes(h))) return '';
    return t;
  }

  /* Spraakcommando's: alleen bij korte uitingen, om valse treffers te vermijden. */
  function detectCommand(text) {
    const n = normalize(text);
    if (!n || n.split(' ').length > 6) return null;
    if (/^(stop|on arrete|arrete|arretons|c'est fini|fin de la session)\b/.test(n)) return 'stop';
    if (/^(pause|fais une pause|on fait une pause)\b/.test(n)) return 'pause';
    if (/^(a moi de poser|c'est moi qui pose|je pose les questions|moi je pose les questions)\b/.test(n)) return 'roleLearner';
    if (/^(a toi de poser|c'est toi qui poses?|toi tu poses les questions|pose moi des questions)\b/.test(n)) return 'roleCamille';
    if (/(plus lentement|moins vite|parle lentement|trop vite)/.test(n)) return 'slower';
    if (/^(repete|repetez|tu peux repeter|vous pouvez repeter|herhaal|encore une fois)\b/.test(n)) return 'repeat';
    if (/^(pardon|comment|quoi)$/.test(n)) return 'repeat';
    return null;
  }

  const RP = {
    LEVELS, LEVEL_PROFILE, THEMES, themeById, buildSystemPrompt,
    parseModelReply, normalize, stripFences, newLevelState, adaptLevel, detectCommand, mergeTranscripts, ADAPT,
    STYLES, STYLE_LABELS, HUMOR_LEVELS, HUMOR_LABELS, createVad, encodeWav, cleanTranscript
  };
  root.RP = RP;
  if (typeof module !== 'undefined' && module.exports) module.exports = RP;
})(typeof window !== 'undefined' ? window : globalThis);
