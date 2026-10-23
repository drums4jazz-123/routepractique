/* RoutePratique – woordentraining: beoordeling, lidwoorden, hints, commando's en gespreide herhaling (Leitner).
   Geen DOM, testbaar met Node. */
(function (root) {
  'use strict';

  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const DIRS = { fn: 'Frans → Nederlands', nf: 'Nederlands → Frans', mix: 'Gemengd' };
  const DIRS_SHORT = { fn: 'FR → NL', nf: 'NL → FR', mix: 'gemengd' };
  const MY_CAT = 99;          // eigen woorden uit gesprekken
  const OK_KINDS = ['correct', 'almost', 'synonym'];
  const isOk = r => OK_KINDS.includes(r.kind);

  /* ---------- Tekst ---------- */

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’`´]/g, '\'')
      .replace(/[.,!?;:«»"“”¡¿()\[\]]/g, ' ')
      .replace(/\s*'\s*/g, '\'')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sim(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  }

  /* Tekst om uit te spreken of te tonen: zonder (m.)/(f.)-aanduidingen. */
  function cleanFr(fr) { return String(fr).replace(/\s*\((m|f)\.\)/g, '').trim(); }
  function displayNl(nl) { return String(nl).replace(/\s+/g, ' ').trim(); }
  function cleanNl(nl) { return String(nl).replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim(); }

  /* Uitspreekbare Franse vorm: "un(e) ami(e)" → "un ami, une amie", "le / la prof" → "le prof, la prof",
     "le feu (rouge)" → "le feu rouge". */
  function spokenFr(item) {
    const fr = cleanFr(item.fr);
    if (/\(e\)| \/ /.test(fr)) {
      const alt = item.frAlt || [];
      return frVariants(item).map(v => v.text).filter(t => !alt.includes(t) && !/\(/.test(t)).slice(0, 2).join(', ');
    }
    return fr.replace(/[()]/g, '');
  }

  /* ---------- Franse varianten en lidwoorden ---------- */

  const BARE_ART = ['le', 'la', 'un', 'une'];

  /* Alle aanvaardbare Franse vormen van een item, met geslacht. */
  function frVariants(item) {
    let s = String(item.fr);
    let gender = null;
    const g = s.match(/\((m|f)\.\)/);
    if (g) gender = g[1];
    s = s.replace(/\s*\((m|f)\.\)/g, '').trim();

    let alts = s.split(' / ').map(x => x.trim()).filter(Boolean);
    /* "le / la partenaire": los lidwoord combineren met het zelfstandig naamwoord van het laatste deel */
    const last = alts[alts.length - 1];
    const lastNoun = last.replace(/^(le|la|les|un|une)\s+/, '').replace(/^l'/, '');
    alts = alts.map(a => (BARE_ART.includes(a) ? a + ' ' + lastNoun : a));

    const out = [];
    const push = t => { t = t.replace(/\s+/g, ' ').trim(); if (t && !out.some(o => o.text === t)) out.push({ text: t }); };
    alts.forEach(a => {
      /* (e): mannelijk en vrouwelijk, overal tegelijk ("un(e) ami(e)") */
      const forms = a.includes('(e)') ? [a.replace(/\(e\)/g, ''), a.replace(/\(e\)/g, 'e')] : [a];
      forms.forEach(f => {
        /* andere haakjes zijn optioneel: "le feu (rouge)" */
        if (/\([^)]*\)/.test(f)) { push(f.replace(/\(([^)]*)\)/g, '$1')); push(f.replace(/\s*\([^)]*\)/g, '')); }
        else push(f);
      });
    });
    (item.frAlt || []).forEach(a => push(a));
    return out.map(v => Object.assign(v, articleInfo(v.text, gender)));
  }

  /* Lidwoord van een (genormaliseerde) Franse vorm. */
  const ART_PATTERNS = [
    ['de la ', 'f'], ['de l\'', 'e'], ['les ', 'pl'], ['des ', 'pl'], ['le ', 'm'], ['la ', 'f'],
    ['l\'', 'e'], ['une ', 'f'], ['un ', 'm'], ['du ', 'm']
  ];
  function splitArticle(t) {
    const n = norm(t);
    for (const [a, g] of ART_PATTERNS) if (n.startsWith(a)) return { art: a.trim(), g, rest: n.slice(a.length).trim() };
    return { art: null, g: null, rest: n };
  }
  function articleInfo(text, annotated) {
    const n = norm(text);
    const isNoun = /^(le |la |les |l'|un |une )/.test(n);
    if (!isNoun) return { noun: false };
    const sa = splitArticle(n);
    let gender = sa.g === 'e' ? (annotated || null) : sa.g;
    return { noun: true, gender, rest: sa.rest, vowel: /^[aeiouyh]/.test(sa.rest) };
  }

  /* Past het lidwoord van het antwoord bij het verwachte geslacht? */
  function articleOk(ans, v) {
    const elided = ans.g === 'e';
    if (v.gender === 'pl') return ans.g === 'pl';
    if (ans.g === 'pl') return false;
    if (elided) return v.vowel;                                       // l' / de l' voor klinker: geslacht hoor je niet
    if (v.gender === null) return true;                               // l' zonder aanduiding: un/une/le/la allemaal goed
    if (v.vowel && (ans.art === 'le' || ans.art === 'la')) return false; // "le avion": moet l' zijn
    return ans.g === v.gender;
  }

  /* ---------- Beoordeling ---------- */

  const RANK = { correct: 5, almost: 4, article_wrong: 3, article_missing: 2, wrong: 1 };
  const THRESHOLD = 0.82;

  /* Spreektaal laat "ne" weg: "je sais pas" en "je ne sais pas" zijn allebei goed. */
  function stripNe(n) {
    if (!/\bne |\bn'/.test(n)) return n;                         // alleen als er een "ne" is om weg te laten
    return n.replace(/\bne /g, '').replace(/\bn'/g, '').replace(/\s+/g, ' ').trim()
      .replace(/\b(c|j|m|t|s|d|l|qu)e ([aeiouyh])/g, "$1'$2");     // "ce est" → "c'est", "je ai" → "j'ai"
  }

  /* Nederlands → Frans: het antwoord is Frans, lidwoord telt mee bij zelfstandige naamwoorden. */
  function checkFrench(item, answer) {
    const na = norm(answer);
    let best = { result: 'wrong', expected: cleanFr(item.fr) };
    if (!na) return best;
    const take = r => { if (RANK[r.result] > RANK[best.result]) best = r; };
    frVariants(item).forEach(v => {
      const nv = norm(v.text);
      if (na === nv || stripNe(na) === stripNe(nv)) return take({ result: 'correct', expected: v.text });
      if (!v.noun) {
        const s = sim(stripNe(na), stripNe(nv));
        if (s >= THRESHOLD) take({ result: 'almost', expected: v.text });
        return;
      }
      const sa = splitArticle(na);
      const s = sim(sa.rest, v.rest);
      if (s < THRESHOLD) return;
      if (!sa.art) return take({ result: 'article_missing', expected: v.text });
      if (!articleOk(sa, v)) return take({ result: 'article_wrong', expected: v.text });
      take({ result: s === 1 ? 'correct' : 'almost', expected: v.text });
    });
    return best;
  }

  /* Frans → Nederlands: het antwoord is Nederlands, de/het/een telt niet mee. */
  function nlVariants(item) {
    const full = String(item.nl);
    const parts = new Set();
    const add = t => { t = norm(t).replace(/^(de|het|een|'t) /, '').trim(); if (t) parts.add(t); };
    [full, cleanNl(full)].forEach(t => {
      add(t);
      t.split(/[;,]| \/ /).forEach(add);
      t.replace(/\s*\([^)]*\)/g, '').split(/[;,]| \/ /).forEach(add);
    });
    add(full.replace(/[()]/g, ''));
    (item.nlAlt || []).forEach(add);
    return [...parts];
  }
  function checkDutch(item, answer) {
    const na = norm(answer).replace(/^(de|het|een|'t) /, '').trim();
    const expected = cleanNl(item.nl);
    if (!na) return { result: 'wrong', expected };
    let bestS = 0;
    for (const v of nlVariants(item)) {
      if (v === na) return { result: 'correct', expected };
      bestS = Math.max(bestS, sim(na, v));
    }
    return { result: bestS >= THRESHOLD ? 'almost' : 'wrong', expected };
  }

  function check(item, dir, answer) {
    return dir === 'nf' ? checkFrench(item, answer) : checkDutch(item, answer);
  }

  /* ---------- Hints ---------- */

  function hint(item, dir) {
    let word;
    if (dir === 'nf') {
      const v = frVariants(item)[0];
      word = v.noun ? v.rest : norm(v.text);
    } else {
      word = nlVariants(item).sort((a, b) => a.length - b.length)[0] || norm(item.nl);
    }
    const letters = word.replace(/[^a-z]/g, '');
    const first = (letters[0] || '?').toUpperCase();
    const words = word.split(' ').length;
    return {
      first, letters: letters.length, words,
      nl: `Begint met ${first} · ${letters.length} letters` + (words > 1 ? ` · ${words} woorden` : ''),
      fr: `Indice : ça commence par ${first}, ${letters.length} lettres` + (words > 1 ? `, ${words} mots.` : '.')
    };
  }

  /* ---------- Gesproken commando's tijdens de training ---------- */

  function detectCommand(text) {
    const n = norm(text);
    if (!n || n.split(' ').length > 6) return null;
    if (/^(stop|on arrete|arrete|c'est fini|stoppen|we stoppen)\b/.test(n)) return 'stop';
    if (/^(pause|pauze)\b/.test(n)) return 'pause';
    if (/^(je ne sais pas|je sais pas|aucune idee|passe|je passe|ik weet het niet|weet ik niet|geen idee|volgende|suivant)\b/.test(n)) return 'skip';
    if (/^(indice|un indice|hint|tip|een tip|aide|help)\b/.test(n)) return 'hint';
    if (/(plus lentement|moins vite|trager|langzamer)/.test(n)) return 'slower';
    if (/^(repete|repetez|tu peux repeter|encore une fois|herhaal|nog eens|nog een keer|opnieuw)\b/.test(n)) return 'repeat';
    return null;
  }

  /* ---------- Gespreide herhaling (Leitner, 5 vakjes) ---------- */

  const DAY = 86400000;
  const INTERVAL_DAYS = [0, 0, 1, 3, 7, 21];    // index = vakje 1..5; vakje 1 = volgende training

  function key(item, dir) { return item.id + '|' + dir; }

  function update(store, item, dir, correct, now) {
    const k = key(item, dir);
    const s = Object.assign({ box: 0, ok: 0, ko: 0 }, store[k]);
    if (correct) { s.box = Math.min(5, Math.max(s.box, 1) + 1); s.ok++; }
    else { s.box = 1; s.ko++; }
    s.due = now + INTERVAL_DAYS[s.box] * DAY;
    s.last = now;
    store[k] = s;
    return s;
  }

  function levelOk(itemLvl, level) {
    const li = LEVELS.indexOf(level);
    return li < 0 || li >= 3 || LEVELS.indexOf(itemLvl) <= li;   // C1/C2: alles
  }

  /* Kiest de woorden voor een training: eerst wat aan herhaling toe is, dan nieuwe woorden
     (laagste niveau eerst), en als alles gekend is: extra oefening met wat het eerst terugkomt. */
  function select(items, store, opt) {
    const o = Object.assign({ count: 20, cat: 0, dir: 'fn', level: 'A2', now: Date.now(), rand: Math.random, dirs: null }, opt);
    const dirs = o.dirs || (o.dir === 'mix' ? ['fn', 'nf'] : [o.dir]);
    const pool = items.filter(it => (it.cat === MY_CAT || levelOk(it.lvl, o.level)) && (!o.cat || it.cat === o.cat));
    const due = [], fresh = [], later = [];
    pool.forEach(it => {
      const order = dirs.slice().sort(() => o.rand() - 0.5);
      let placed = false;
      for (const d of order) {
        const st = store[key(it, d)];
        if (st && st.due <= o.now) { due.push({ item: it, dir: d, st }); placed = true; break; }
      }
      if (placed) return;
      const freshDir = order.find(d => !store[key(it, d)]);
      if (freshDir) fresh.push({ item: it, dir: freshDir, r: o.rand() });
      else later.push({ item: it, dir: order[0], st: store[key(it, order[0])] });
    });
    due.sort((a, b) => a.st.box - b.st.box || a.st.due - b.st.due);
    fresh.sort((a, b) => LEVELS.indexOf(a.item.lvl) - LEVELS.indexOf(b.item.lvl) || a.r - b.r);
    later.sort((a, b) => a.st.due - b.st.due);
    const pick = due.concat(fresh, later).slice(0, o.count).map(x => ({ item: x.item, dir: x.dir }));
    for (let i = pick.length - 1; i > 0; i--) { const j = Math.floor(o.rand() * (i + 1)); [pick[i], pick[j]] = [pick[j], pick[i]]; }
    return pick;
  }

  /* Overzicht voor het startscherm. */
  function summary(items, store, opt) {
    const o = Object.assign({ cat: 0, dir: 'fn', level: 'A2', now: Date.now() }, opt);
    const dirs = o.dir === 'mix' ? ['fn', 'nf'] : [o.dir];
    let total = 0, due = 0, known = 0, fresh = 0;
    items.forEach(it => {
      if (!(it.cat === MY_CAT || levelOk(it.lvl, o.level)) || (o.cat && it.cat !== o.cat)) return;
      total++;
      const sts = dirs.map(d => store[key(it, d)]).filter(Boolean);
      if (!sts.length) { fresh++; return; }
      if (sts.some(s => s.due <= o.now)) due++;
      if (sts.every(s => s.box >= 4) && sts.length === dirs.length) known++;
    });
    return { total, due, known, fresh };
  }

  const RPV = { DIRS, DIRS_SHORT, MY_CAT, OK_KINDS, isOk, norm, sim, cleanFr, cleanNl, displayNl, spokenFr, frVariants, splitArticle, check, checkFrench, checkDutch, nlVariants,
    hint, detectCommand, update, select, summary, key, INTERVAL_DAYS };
  root.RPV = RPV;
  if (typeof module !== 'undefined' && module.exports) module.exports = RPV;
})(typeof window !== 'undefined' ? window : globalThis);
