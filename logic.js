/* RoutePratique – kernlogica (geen DOM, testbaar met Node) */
(function (root) {
  'use strict';

  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  const LEVEL_PROFILE = {
    A1: {
      label: 'Beginner',
      speech: 'Max 2 very short sentences (max 10 words each). Very frequent words only. Speak about concrete, everyday things. Always end with one simple, closed or very easy open question.',
      grammar: 'présent of être, avoir, aller, faire and regular -er verbs; articles; ne...pas; simple questions (est-ce que, qu\'est-ce que); futur proche.'
    },
    A2: {
      label: 'Basis',
      speech: 'Max 2 short sentences (max 14 words each). Frequent everyday vocabulary. End with one open question.',
      grammar: 'passé composé with avoir and être; basic imparfait (c\'était, il y avait); direct object pronouns; comparatives; il faut + infinitive; futur proche.'
    },
    B1: {
      label: 'Drempel',
      speech: 'Max 3 sentences. Natural spoken French, some connectors (parce que, alors, mais, donc). End with one open question that invites the learner to tell or explain something.',
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

  function buildSystemPrompt(level, themeId) {
    const p = LEVEL_PROFILE[level] || LEVEL_PROFILE.A2;
    const t = themeById(themeId);
    return [
      'You are "Camille", a warm, patient French conversation partner for an adult Dutch-speaking (Flemish) learner who practises spoken French while driving a car.',
      'The learner speaks; their speech is transcribed automatically, so the text has no reliable punctuation or capitals and may contain recognition errors.',
      '',
      `CURRENT LEVEL: ${level} (CEFR).`,
      `How you speak at this level: ${p.speech}`,
      `Grammar to use and to elicit at this level: ${p.grammar}`,
      `THEME: ${t.fr}.`,
      '',
      'DIDACTIC RULES:',
      '- Speak French only in "antwoord". Never switch to Dutch or English in "antwoord".',
      '- Keep it a real conversation: react to what the learner said, show interest, then ask ONE question. Never ask two questions at once.',
      '- Correct implicitly: in "antwoord", naturally reuse the correct form of what the learner got wrong (recast). Do not lecture.',
      '- Regularly create situations that make the learner use the grammar of the current level.',
      '- The learner is driving: no lists, no spelling, no numbers to remember, nothing that requires looking at a screen.',
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
      '{"correctie": string|null, "uitleg": string|null, "antwoord": string, "score": number|null}',
      'When the user message is [START], greet the learner briefly and ask the first question about the theme; then correctie, uitleg and score are null.'
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
    return { correctie, uitleg, antwoord, score };
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

  /* Spraakcommando's: alleen bij korte uitingen, om valse treffers te vermijden. */
  function detectCommand(text) {
    const n = normalize(text);
    if (!n || n.split(' ').length > 6) return null;
    if (/^(stop|on arrete|arrete|arretons|c'est fini|fin de la session)\b/.test(n)) return 'stop';
    if (/^(pause|fais une pause|on fait une pause)\b/.test(n)) return 'pause';
    if (/(plus lentement|moins vite|parle lentement|trop vite)/.test(n)) return 'slower';
    if (/^(repete|repetez|tu peux repeter|vous pouvez repeter|herhaal|encore une fois)\b/.test(n)) return 'repeat';
    if (/^(pardon|comment|quoi)$/.test(n)) return 'repeat';
    return null;
  }

  const RP = {
    LEVELS, LEVEL_PROFILE, THEMES, themeById, buildSystemPrompt,
    parseModelReply, normalize, stripFences, newLevelState, adaptLevel, detectCommand, ADAPT
  };
  root.RP = RP;
  if (typeof module !== 'undefined' && module.exports) module.exports = RP;
})(typeof window !== 'undefined' ? window : globalThis);
