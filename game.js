/* ============================================================
   HULPFUNCTIES VOOR DE VRAGENBANK
   Alle massa's komen uit het periodiek systeem (PT_RAW in dit bestand),
   dus pas je daar een waarde aan, dan volgen alle berekeningen.
   ============================================================ */
const rnd = a => a[Math.floor(Math.random() * a.length)];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const rf = (a, b, d = 2) => +(a + Math.random() * (b - a)).toFixed(d);
const SUBD = '₀₁₂₃₄₅₆₇₈₉', SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sb = n => String(n).replace(/\d/g, d => SUBD[d]);
const sp = n => String(n).replace(/\d/g, d => SUPD[d]).replace('-', '⁻');
const nl = (x, d) => x.toFixed(d).replace('.', ',');
const sci = (x, n = 2) => {
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x))), m = +(x / Math.pow(10, e)).toFixed(n - 1);
  if (Math.abs(m) >= 10) { m /= 10; e++; }
  return nl(m, n - 1) + '·10' + sp(e);
};
const sig = (x, n = 3) => {
  if (x === 0) return '0';
  const a = Math.abs(x);
  if (a >= 1e5 || a < 1e-3) return sci(x, n);
  return String(Number(x.toPrecision(n))).replace('.', ',');
};
const chg = c => (Math.abs(c) > 1 ? sp(Math.abs(c)) : '') + (c > 0 ? '⁺' : '⁻');
const ionS = (f, c) => f + chg(c);
const lcm = (a, b) => { let x = a, y = b; while (y) [x, y] = [y, x % y]; return a / x * b; };
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const uniq = a => [...new Set(a)];
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let LV = 2;                                // niveau: 1 makkelijk, 2 medium, 3 moeilijk (wordt door het spel gezet)
const RUN = { used: new Set() };           // voorkomt dubbele keuzes binnen één set vragen
function pickU(list, key) {
  const free = list.filter((_, i) => !RUN.used.has(key + i));
  const item = rnd(free.length ? free : list);
  RUN.used.add(key + list.indexOf(item));
  return item;
}

/* ---------- formules ontleden en molaire massa's ---------- */
function parseF(f) {
  let s = String(f).replace(/[₀-₉]/g, c => SUBD.indexOf(c)), charge = 0, pos = 0;
  const m = s.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/);
  if (m) {
    const mag = m[1] ? +[...m[1]].map(c => SUPD.indexOf(c)).join('') : 1;
    charge = (m[2] === '⁺' ? 1 : -1) * mag; s = s.slice(0, s.length - m[0].length);
  }
  const num = () => { let k = ''; while (/\d/.test(s[pos] || '')) k += s[pos++]; return k ? +k : 1; };
  function group() {
    const cnt = {};
    while (pos < s.length) {
      const c = s[pos];
      if (c === '(') {
        pos++; const inner = group(); if (s[pos] !== ')') throw new Error('haakje sluit niet: ' + f); pos++;
        const k = num(); for (const e in inner) cnt[e] = (cnt[e] || 0) + inner[e] * k;
      } else if (c === ')') return cnt;
      else if (/[A-Z]/.test(c)) {
        let e = c; pos++; while (/[a-z]/.test(s[pos] || '')) e += s[pos++];
        cnt[e] = (cnt[e] || 0) + num();
      } else throw new Error('onbekend teken "' + c + '" in ' + f);
    }
    return cnt;
  }
  return { el: group(), charge };
}
const EMASS = sym => {
  if (!EMASS.t) EMASS.t = Object.fromEntries(PT.map(e => [e.sym, e.mass]));
  if (EMASS.t[sym] == null) throw new Error('element ' + sym);
  return EMASS.t[sym];
};
const molM = f => { const { el } = parseF(f); let m = 0; for (const e in el) m += el[e] * EMASS(e); return m; };
// zelfde samenstelling (bijv. BaS en Ba₂S₂)? Dan is het geen echt ander antwoord.
const eqRatio = (a, b) => {
  try {
    const A = parseF(a), B = parseF(b), ka = Object.keys(A.el), kb = Object.keys(B.el);
    if (ka.length !== kb.length || !ka.every(k => k in B.el)) return false;
    const k = ka[0];
    return ka.every(e => A.el[e] * B.el[k] === B.el[e] * A.el[k]) && A.charge * B.el[k] === B.charge * A.el[k];
  } catch (e) { return false; }
};
// laat alleen formules over die onderling en t.o.v. 'good' een andere samenstelling hebben
const uniqRatio = (list, good) => { const out = []; for (const w of list) if (!eqRatio(w, good) && !out.some(o => eqRatio(o, w))) out.push(w); return out; };
const countAtoms = (f, e) => parseF(f).el[e] || 0;

/* ---------- vraagbouwers ---------- */
const Q = {
  mc(text, good, wrong, hint, explain) {
    // geen twee opties die er hetzelfde uitzien (ook niet na weglaten van opmaak of spaties)
    const key = s => /^\s*<svg/.test(s) ? s : String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    const seen = new Set([key(good)]), opts = [good];
    for (const w of shuf(wrong)) { const k = key(w); if (!seen.has(k) && opts.length < 4) { seen.add(k); opts.push(w); } }
    return { type: 'mc', text, options: opts, correct: 0, hint, explain };
  },
  num(text, unit, answer, o = {}) {
    return { type: 'num', text, unit, answer, tol: o.tol ?? 0.02, tolAbs: o.abs, hint: o.hint, explain: o.explain };
  },
  bal(text, reactants, products, coef, hint, explain) {
    return { type: 'balance', text, reactants, products, coef, hint, explain };
  }
};

/* ---------- reacties (kloppend, met omschrijving) ----------
   r = beginstoffen, p = producten, w = index van het gewenste product (voor atoomeconomie) */
const RX = [
  { r: [[2, 'Cu'], [1, 'O₂']], p: [[2, 'CuO']], d: 'Koper reageert met zuurstof tot koper(II)oxide.' },
  { r: [[4, 'Al'], [3, 'O₂']], p: [[2, 'Al₂O₃']], d: 'Aluminium reageert met zuurstof tot aluminiumoxide.' },
  { r: [[4, 'Fe'], [3, 'O₂']], p: [[2, 'Fe₂O₃']], d: 'IJzer roest: ijzer reageert met zuurstof tot ijzer(III)oxide.' },
  { r: [[2, 'Mg'], [1, 'O₂']], p: [[2, 'MgO']], d: 'Magnesium verbrandt tot magnesiumoxide.' },
  { r: [[2, 'Na'], [1, 'Cl₂']], p: [[2, 'NaCl']], d: 'Natrium reageert met chloor tot natriumchloride.' },
  { r: [[2, 'H₂'], [1, 'O₂']], p: [[2, 'H₂O']], d: 'Waterstof verbrandt tot water.' },
  { r: [[1, 'N₂'], [3, 'H₂']], p: [[2, 'NH₃']], d: 'Ammoniak wordt gemaakt uit stikstof en waterstof (Haber-Bosch).' },
  { r: [[1, 'CH₄'], [2, 'O₂']], p: [[1, 'CO₂'], [2, 'H₂O']], d: 'Methaan verbrandt volledig.', w: 0 },
  { r: [[1, 'C₃H₈'], [5, 'O₂']], p: [[3, 'CO₂'], [4, 'H₂O']], d: 'Propaan verbrandt volledig.', w: 0 },
  { r: [[1, 'C₂H₅OH'], [3, 'O₂']], p: [[2, 'CO₂'], [3, 'H₂O']], d: 'Ethanol verbrandt volledig.', w: 0 },
  { r: [[2, 'C₄H₁₀'], [13, 'O₂']], p: [[8, 'CO₂'], [10, 'H₂O']], d: 'Butaan verbrandt volledig.', w: 0 },
  { r: [[2, 'Al'], [6, 'HCl']], p: [[2, 'AlCl₃'], [3, 'H₂']], d: 'Aluminium lost op in zoutzuur.', w: 0 },
  { r: [[1, 'Zn'], [2, 'HCl']], p: [[1, 'ZnCl₂'], [1, 'H₂']], d: 'Zink lost op in zoutzuur.', w: 0 },
  { r: [[2, 'Fe₂O₃'], [3, 'C']], p: [[4, 'Fe'], [3, 'CO₂']], d: 'IJzererts wordt met koolstof omgezet in ijzer.', w: 0 },
  { r: [[1, 'CaCO₃'], [2, 'HCl']], p: [[1, 'CaCl₂'], [1, 'CO₂'], [1, 'H₂O']], d: 'Kalksteen reageert met zoutzuur.', w: 0 },
  { r: [[2, 'NaOH'], [1, 'H₂SO₄']], p: [[1, 'Na₂SO₄'], [2, 'H₂O']], d: 'Natronloog reageert met zwavelzuur.', w: 0 },
  { r: [[1, 'Ca(OH)₂'], [2, 'HNO₃']], p: [[1, 'Ca(NO₃)₂'], [2, 'H₂O']], d: 'Kalkwater reageert met salpeterzuur.', w: 0 },
  { r: [[2, 'AgNO₃'], [1, 'CaCl₂']], p: [[2, 'AgCl'], [1, 'Ca(NO₃)₂']], d: 'Zilvernitraat reageert met calciumchloride tot een neerslag.', w: 0 },
  { r: [[1, 'Pb(NO₃)₂'], [2, 'KI']], p: [[1, 'PbI₂'], [2, 'KNO₃']], d: 'Looddinitraat en kaliumjodide vormen een geel neerslag.', w: 0 },
  { r: [[2, 'Fe'], [3, 'Cl₂']], p: [[2, 'FeCl₃']], d: 'IJzer reageert met chloor tot ijzer(III)chloride.' },
  { r: [[1, 'C₆H₁₂O₆']], p: [[2, 'C₂H₅OH'], [2, 'CO₂']], d: 'Gist zet glucose om in ethanol en koolstofdioxide (gisting).', w: 0 },
  { r: [[1, 'CaCO₃']], p: [[1, 'CaO'], [1, 'CO₂']], d: 'Kalksteen wordt sterk verhit.', w: 0 },
  { r: [[2, 'H₂O₂']], p: [[2, 'H₂O'], [1, 'O₂']], d: 'Waterstofperoxide ontleedt in water en zuurstof.', w: 1 },
  { r: [[2, 'KClO₃']], p: [[2, 'KCl'], [3, 'O₂']], d: 'Kaliumchloraat ontleedt bij verhitten.', w: 1 },
  { r: [[1, 'CuO'], [1, 'H₂SO₄']], p: [[1, 'CuSO₄'], [1, 'H₂O']], d: 'Koper(II)oxide lost op in zwavelzuur.', w: 0 },
  { r: [[1, 'CH₄'], [1, 'H₂O']], p: [[1, 'CO'], [3, 'H₂']], d: 'Methaan en waterdamp geven synthesegas (voor waterstof).', w: 1 },
  { r: [[1, 'C₂H₄'], [1, 'H₂O']], p: [[1, 'C₂H₅OH']], d: 'Ethanol uit etheen en water (additie).', w: 0 },
  { r: [[1, 'C₂H₄'], [1, 'Br₂']], p: [[1, 'C₂H₄Br₂']], d: 'Etheen reageert met broom (additie).', w: 0 },
  { r: [[2, 'NaCl'], [2, 'H₂O']], p: [[2, 'NaOH'], [1, 'Cl₂'], [1, 'H₂']], d: 'Elektrolyse van keukenzout-oplossing (chloor-alkaliproces).', w: 0 },
  { r: [[1, 'Na₂CO₃'], [2, 'HCl']], p: [[2, 'NaCl'], [1, 'CO₂'], [1, 'H₂O']], d: 'Soda reageert met zoutzuur.', w: 0 }
];
const rxSide = side => side.map(([c, f]) => (c > 1 ? c + ' ' : '') + f).join(' + ');
const rxText = r => rxSide(r.r) + ' → ' + rxSide(r.p);
const rxCoefs = r => [...r.r, ...r.p].map(x => x[0]);
// massa product uit massa beginstof (reactie r, beginstof a, product b)
const stoichMass = (r, a, b, m) => m / molM(r.r[a][1]) * r.p[b][0] / r.r[a][0] * molM(r.p[b][1]);
const nameOf = f => ({
  'H₂O': 'water', 'CO₂': 'koolstofdioxide', 'CO': 'koolstofmonoxide', 'O₂': 'zuurstof', 'H₂': 'waterstof', 'N₂': 'stikstof', 'NH₃': 'ammoniak',
  'CH₄': 'methaan', 'C₃H₈': 'propaan', 'C₂H₅OH': 'ethanol', 'C₄H₁₀': 'butaan', 'Cu': 'koper', 'CuO': 'koper(II)oxide', 'Al': 'aluminium',
  'Al₂O₃': 'aluminiumoxide', 'Fe': 'ijzer', 'Fe₂O₃': 'ijzer(III)oxide', 'Mg': 'magnesium', 'MgO': 'magnesiumoxide', 'Na': 'natrium', 'Cl₂': 'chloor',
  'NaCl': 'natriumchloride', 'Zn': 'zink', 'HCl': 'zoutzuur', 'CaCO₃': 'calciumcarbonaat', 'CaO': 'calciumoxide', 'C₆H₁₂O₆': 'glucose',
  'H₂O₂': 'waterstofperoxide', 'KClO₃': 'kaliumchloraat', 'KCl': 'kaliumchloride', 'C₂H₄': 'etheen', 'Br₂': 'broom', 'NaOH': 'natriumhydroxide',
  'AgCl': 'zilverchloride', 'CuSO₄': 'koper(II)sulfaat', 'H₂SO₄': 'zwavelzuur', 'C': 'koolstof', 'AlCl₃': 'aluminiumchloride', 'ZnCl₂': 'zinkchloride',
  'CaCl₂': 'calciumchloride', 'Na₂SO₄': 'natriumsulfaat', 'PbI₂': 'loodjodide', 'FeCl₃': 'ijzer(III)chloride', 'C₂H₄Br₂': '1,2-dibroometaan'
}[f] || f);

/* ---------- zouten: ionen, formules en namen ---------- */
const CAT = [
  { f: 'Na', c: 1, n: 'natrium' }, { f: 'K', c: 1, n: 'kalium' }, { f: 'Ag', c: 1, n: 'zilver' }, { f: 'NH₄', c: 1, n: 'ammonium', poly: 1 },
  { f: 'Ca', c: 2, n: 'calcium' }, { f: 'Mg', c: 2, n: 'magnesium' }, { f: 'Ba', c: 2, n: 'barium' }, { f: 'Zn', c: 2, n: 'zink' },
  { f: 'Cu', c: 2, n: 'koper(II)' }, { f: 'Fe', c: 2, n: 'ijzer(II)' }, { f: 'Pb', c: 2, n: 'lood(II)' }, { f: 'Al', c: 3, n: 'aluminium' }, { f: 'Fe', c: 3, n: 'ijzer(III)' }
];
const ANI = [
  { f: 'F', c: 1, n: 'fluoride' }, { f: 'Cl', c: 1, n: 'chloride' }, { f: 'Br', c: 1, n: 'bromide' }, { f: 'I', c: 1, n: 'jodide' },
  { f: 'OH', c: 1, n: 'hydroxide', poly: 1 }, { f: 'NO₃', c: 1, n: 'nitraat', poly: 1 }, { f: 'NO₂', c: 1, n: 'nitriet', poly: 1 }, { f: 'HCO₃', c: 1, n: 'waterstofcarbonaat', poly: 1 },
  { f: 'O', c: 2, n: 'oxide' }, { f: 'S', c: 2, n: 'sulfide' }, { f: 'SO₄', c: 2, n: 'sulfaat', poly: 1 }, { f: 'SO₃', c: 2, n: 'sulfiet', poly: 1 },
  { f: 'CO₃', c: 2, n: 'carbonaat', poly: 1 }, { f: 'PO₄', c: 3, n: 'fosfaat', poly: 1 }
];
const validSalt = (c, a) => {
  if (c.f === 'NH₄' && ['O', 'S', 'OH', 'HCO₃'].includes(a.f)) return false;
  if ((c.f === 'Al' || (c.f === 'Fe' && c.c === 3)) && ['CO₃', 'HCO₃', 'S', 'SO₃', 'I', 'NO₂'].includes(a.f)) return false;
  if (c.f === 'Ag' && ['OH', 'SO₃', 'NO₂', 'HCO₃'].includes(a.f)) return false;
  if (['Cu', 'Zn', 'Pb', 'Fe'].includes(c.f) && ['HCO₃', 'NO₂', 'SO₃'].includes(a.f)) return false;
  return true;
};
const ionPart = (ion, k) => (k > 1 && (ion.poly || /[A-Z].*[A-Z]/.test(ion.f)) ? '(' + ion.f + ')' : ion.f) + (k > 1 ? sb(k) : '');
const saltCounts = (c, a) => { const g = gcd(c.c, a.c); return [a.c / g, c.c / g]; };       // [aantal kationen, aantal anionen]
const saltFormula = (c, a, kx, ky) => { const [x, y] = kx ? [kx, ky] : saltCounts(c, a); return ionPart(c, x) + ionPart(a, y); };
const saltName = (c, a) => c.n + a.n;
const randSalt = () => { let c, a; do { c = rnd(CAT); a = rnd(ANI); } while (!validSalt(c, a)); return { c, a, f: saltFormula(c, a), n: saltName(c, a), x: saltCounts(c, a)[0], y: saltCounts(c, a)[1] }; };
const ionSide = (ion, k, ch) => (k > 1 ? k + ' ' : '') + ionS(ion.f, ch);

/* ---------- koolstofverbindingen: namen en structuurformules ---------- */
const PRE = ['meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct'];
const FAM = { alkaan: 'alkaan', alkeen: 'alkeen', alkyn: 'alkyn', alkanol: 'alkanol', zuur: 'alkaanzuur', halogeen: 'halogeenalkaan' };
function maxP(t, n) {
  if (t === 'alkaan' || t === 'zuur') return 1;
  if (t === 'alkeen' || t === 'alkyn') return n < 4 ? 1 : Math.floor(n / 2);
  return n < 3 ? 1 : Math.ceil(n / 2);
}
const validSpec = s => s.n >= 1 && s.n <= 8 && s.p >= 1 && s.p <= maxP(s.t, s.n) && !((s.t === 'alkeen' || s.t === 'alkyn') && s.n < 2) && !(s.t === 'zuur' && s.n > 6);
function orgName(s) {
  const pre = PRE[s.n - 1];
  switch (s.t) {
    case 'alkaan': return pre + 'aan';
    case 'alkeen': return s.n <= 3 ? pre + 'een' : pre + '-' + s.p + '-een';
    case 'alkyn': return s.n <= 3 ? pre + 'yn' : pre + '-' + s.p + '-yn';
    case 'alkanol': return s.n <= 2 ? pre + 'anol' : pre + 'an-' + s.p + '-ol';
    case 'zuur': return pre + 'aanzuur';
    case 'halogeen': return (s.n <= 2 ? '' : s.p + '-') + 'chloor' + pre + 'aan';
  }
}
function orgStruct(s) {
  const n = s.n, bond = i => (s.t === 'alkeen' && i === s.p ? 2 : s.t === 'alkyn' && i === s.p ? 3 : 1);   // binding tussen C(i) en C(i+1)
  const grp = h => h <= 0 ? 'C' : 'CH' + (h > 1 ? sb(h) : '');
  const parts = [];
  for (let i = 1; i <= n; i++) {
    if (s.t === 'zuur' && i === n) { parts.push(n === 1 ? 'HCOOH' : 'COOH'); continue; }
    let h = 4 - (i > 1 ? bond(i - 1) : 0) - (i < n ? bond(i) : 0);
    const sub = (s.t === 'alkanol' || s.t === 'halogeen') && i === s.p;
    if (sub) h -= 1;
    const g = grp(h), x = s.t === 'alkanol' ? 'OH' : 'Cl';
    if (!sub) parts.push(g);
    else if (n === 1) parts.push(g + '–' + x);
    else if (i === 1) parts.push((s.t === 'alkanol' ? 'HO' : 'Cl') + '–' + g);
    else parts.push(g + '(' + x + ')');
  }
  let out = parts[0];
  for (let i = 1; i < n; i++) out += ['–', '=', '≡'][bond(i) - 1] + parts[i];
  return out;
}
function orgFormula(s) {
  const n = s.n, c = 'C' + (n > 1 ? sb(n) : ''), h = k => 'H' + (k > 1 ? sb(k) : '');
  switch (s.t) {
    case 'alkaan': return c + h(2 * n + 2);
    case 'alkeen': return c + h(2 * n);
    case 'alkyn': return c + h(2 * n - 2);
    case 'alkanol': return n === 1 ? 'CH₃OH' : c + h(2 * n + 1) + 'OH';
    case 'zuur': return n === 1 ? 'HCOOH' : 'C' + (n - 1 > 1 ? sb(n - 1) : '') + h(2 * n - 1) + 'COOH';
    case 'halogeen': return c + h(2 * n + 1) + 'Cl';
  }
}
function randSpec(types) {
  let s;
  const [nLo, nHi] = LV === 1 ? [1, 4] : LV === 3 ? [4, 8] : [2, 6];
  do { s = { t: rnd(types), n: ri(nLo, nHi), p: 1 }; s.p = ri(1, Math.max(1, maxP(s.t, s.n))); } while (!validSpec(s));
  return s;
}
function specVariants(s) {
  const out = [];
  [-1, 1].forEach(d => { const v = { ...s, n: s.n + d }; v.p = Math.min(v.p, maxP(v.t, v.n)); if (validSpec(v)) out.push(v); });
  for (let p = 1; p <= maxP(s.t, s.n); p++) if (p !== s.p) out.push({ ...s, p });
  Object.keys(FAM).forEach(t => { if (t !== s.t) { const v = { ...s, t }; v.p = Math.min(v.p, maxP(t, s.n)); if (validSpec(v)) out.push(v); } });
  return out;
}
/* ============================================================
   VRAGENBANK PER STAD. Elke stad heeft een pool van sjablonen.
   Bij elke poging worden 5 sjablonen gekozen en met nieuwe getallen
   ingevuld. Wil je een sjabloon toevoegen? Zet een functie in de pool
   die Q.mc(...), Q.num(...) of Q.bal(...) teruggeeft.
   ============================================================ */
const STOF = [['water', 'H₂O'], ['natriumchloride', 'NaCl'], ['glucose', 'C₆H₁₂O₆'], ['calciumcarbonaat', 'CaCO₃'], ['natriumhydroxide', 'NaOH'], ['koolstofdioxide', 'CO₂'],
  ['ammoniak', 'NH₃'], ['azijnzuur', 'CH₃COOH'], ['ethanol', 'C₂H₅OH'], ['zwavelzuur', 'H₂SO₄'], ['magnesiumoxide', 'MgO'], ['kaliumnitraat', 'KNO₃'],
  ['sacharose', 'C₁₂H₂₂O₁₁'], ['calciumchloride', 'CaCl₂'], ['aluminiumoxide', 'Al₂O₃'], ['natriumcarbonaat', 'Na₂CO₃'], ['koper(II)sulfaat', 'CuSO₄']];
const OPLOSBAAR = STOF.filter(s => ['NaCl', 'NaOH', 'KNO₃', 'C₁₂H₂₂O₁₁', 'CaCl₂', 'Na₂CO₃', 'CuSO₄', 'C₆H₁₂O₆'].includes(s[1]));
const MOLEC = STOF.filter(s => ['H₂O', 'C₆H₁₂O₆', 'CO₂', 'NH₃', 'C₂H₅OH', 'C₁₂H₂₂O₁₁', 'CH₃COOH'].includes(s[1]));
const GASSEN = [['koolstofdioxide', 'CO₂'], ['ammoniak', 'NH₃'], ['zuurstof', 'O₂'], ['waterstof', 'H₂'], ['stikstof', 'N₂'], ['methaan', 'CH₄']];

/* ---------- Amsterdam: molrekenen ---------- */
const POOL_AMS = [
  () => { const [n, f] = rnd(STOF), M = molM(f), m = rf(2, 250, 1);
    return Q.num(`Hoeveel mol ${n} (${f}) zit er in ${nl(m, 1)} g?`, 'mol', m / M, { hint: 'Gebruik n = m / M. De molaire massa M vind je met het periodiek systeem.', explain: `M(${f}) = ${nl(M, 2)} g/mol, dus n = m / M = ${nl(m, 1)} / ${nl(M, 2)} = ${sig(m / M)} mol.` }); },
  () => { const [n, f] = rnd(STOF), M = molM(f), x = rf(0.05, 4, 2);
    return Q.num(`Wat is de massa van ${nl(x, 2)} mol ${n} (${f})?`, 'g', x * M, { hint: 'Gebruik m = n × M.', explain: `M(${f}) = ${nl(M, 2)} g/mol, dus m = n × M = ${nl(x, 2)} × ${nl(M, 2)} = ${sig(x * M)} g.` }); },
  () => { const [n, f] = rnd(OPLOSBAAR), M = molM(f), m = rf(1, 30, 1), V = ri(50, 500), c = m / M / (V / 1000);
    return Q.num(`Je lost ${nl(m, 1)} g ${n} (${f}) op in water en vult aan tot ${V} mL oplossing. Wat is de molariteit?`, 'mol/L', c, { hint: 'Eerst n = m / M, daarna c = n / V met V in liter.', explain: `n = ${nl(m, 1)} / ${nl(M, 2)} = ${sig(m / M)} mol. V = ${nl(V / 1000, 3)} L. c = n / V = ${sig(c)} mol/L.` }); },
  () => { const [n, f] = rnd(OPLOSBAAR), M = molM(f), c = rf(0.05, 1.5, 2), V = ri(50, 500), m = c * V / 1000 * M;
    return Q.num(`Hoeveel gram ${n} (${f}) heb je nodig voor ${V} mL oplossing van ${nl(c, 2)} mol/L?`, 'g', m, { hint: 'Eerst n = c × V (V in liter), dan m = n × M.', explain: `n = c × V = ${nl(c, 2)} × ${nl(V / 1000, 3)} = ${sig(c * V / 1000)} mol. m = n × M = ${sig(c * V / 1000)} × ${nl(M, 2)} = ${sig(m)} g.` }); },
  () => { const [n, f] = rnd(MOLEC), M = molM(f), m = rf(1, 50, 1), N = m / M * 6.022e23;
    return Q.num(`Hoeveel moleculen ${n} (${f}) zitten er in ${nl(m, 1)} g? Gebruik 6,022·10²³ per mol. Schrijf je antwoord bijvoorbeeld als 3,0e23.`, '', N, { hint: 'Eerst n = m / M, daarna N = n × 6,022·10²³.', explain: `n = ${nl(m, 1)} / ${nl(M, 2)} = ${sig(m / M)} mol. N = ${sig(m / M)} × 6,022·10²³ = ${sci(N, 3)} moleculen.` }); },
  () => { const [n, f] = rnd(GASSEN), M = molM(f), m = rf(1, 60, 1), [T, Vm] = rnd([[273, 22.4], [298, 24.5]]), V = m / M * Vm;
    return Q.num(`Hoeveel dm³ ${n} (${f}) is ${nl(m, 1)} g bij ${T} K? Het molair volume is dan ${nl(Vm, 1)} dm³/mol.`, 'dm³', V, { hint: 'Eerst n = m / M, dan V = n × Vm.', explain: `n = ${nl(m, 1)} / ${nl(M, 2)} = ${sig(m / M)} mol. V = n × Vm = ${sig(m / M)} × ${nl(Vm, 1)} = ${sig(V)} dm³.` }); },
  () => { const c1 = rnd([1.0, 2.0, 2.5, 4.0, 5.0, 6.0, 12.0]), f = rnd([2, 4, 5, 10, 20, 25]), V2 = rnd([100, 200, 250, 500, 1000]), c2 = c1 / f, V1 = V2 / f;
    return Q.num(`Je wilt ${V2} mL oplossing van ${sig(c2)} mol/L maken door een oplossing van ${sig(c1)} mol/L te verdunnen. Hoeveel mL van de sterke oplossing heb je nodig?`, 'mL', V1, { hint: 'Het aantal mol verandert niet bij verdunnen: c₁ × V₁ = c₂ × V₂.', explain: `V₁ = c₂ × V₂ / c₁ = ${sig(c2)} × ${V2} / ${sig(c1)} = ${sig(V1)} mL.` }); },
  () => { const [f, ion, k] = rnd([['CaCl₂', 'Cl⁻', 2], ['Na₂SO₄', 'Na⁺', 2], ['Al₂(SO₄)₃', 'SO₄²⁻', 3], ['Al(NO₃)₃', 'NO₃⁻', 3], ['MgCl₂', 'Cl⁻', 2], ['K₃PO₄', 'K⁺', 3], ['Fe₂(SO₄)₃', 'Fe³⁺', 2], ['Ca(NO₃)₂', 'NO₃⁻', 2], ['(NH₄)₂SO₄', 'NH₄⁺', 2], ['Al₂(SO₄)₃', 'Al³⁺', 2]]), c = rf(0.05, 0.6, 2);
    return Q.num(`Een oplossing bevat ${nl(c, 2)} mol/L ${f}, volledig opgelost. Wat is [${ion}]?`, 'mol/L', k * c, { hint: 'Kijk hoeveel ionen er per formule-eenheid ontstaan.', explain: `Per ${f} ontstaan ${k} ${ion}-ionen, dus [${ion}] = ${k} × ${nl(c, 2)} = ${sig(k * c)} mol/L.` }); },
  () => { const [n, rho] = rnd([['ethanol', 0.79], ['water', 1.00], ['glycerol', 1.26], ['hexaan', 0.66], ['kwik', 13.5], ['azijnzuur', 1.05]]), V = rf(5, 250, 1), m = V * rho;
    return Q.num(`De dichtheid van ${n} is ${nl(rho, 2)} g/cm³. Wat is de massa van ${nl(V, 1)} cm³ ${n}?`, 'g', m, { hint: 'm = ρ × V.', explain: `m = ρ × V = ${nl(rho, 2)} × ${nl(V, 1)} = ${sig(m)} g.` }); },
  () => { const [n, f] = rnd(STOF.filter(s => s[1].length > 3)), els = Object.keys(parseF(f).el), e = rnd(els), x = rf(0.1, 3, 2), k = countAtoms(f, e);
    return Q.num(`Hoeveel mol ${e}-atomen zitten er in ${nl(x, 2)} mol ${n} (${f})?`, 'mol', x * k, { hint: 'Kijk hoeveel atomen van dit element in één formule-eenheid zitten.', explain: `Eén ${f} bevat ${k} ${e}-atoom/atomen, dus ${nl(x, 2)} × ${k} = ${sig(x * k)} mol.` }); },
  () => { const [n, f] = rnd(STOF.filter(s => s[1].length > 3)), els = Object.keys(parseF(f).el), e = rnd(els), M = molM(f), k = countAtoms(f, e), pct = k * EMASS(e) / M * 100;
    return Q.num(`Wat is het massapercentage ${e} in ${n} (${f})?`, '%', pct, { hint: 'Massa% = (aantal atomen × atoommassa) / molaire massa × 100.', explain: `${k} × ${nl(EMASS(e), 2)} / ${nl(M, 2)} × 100 = ${sig(pct)}%.` }); },
  () => { const [n, f] = rnd(OPLOSBAAR), M = molM(f), c1 = rf(0.1, 1.0, 2), c2 = rf(0.1, 1.0, 2), V1 = ri(50, 300), V2 = ri(50, 300), c = (c1 * V1 + c2 * V2) / (V1 + V2);
    return Q.num(`Je mengt ${V1} mL ${nl(c1, 2)} mol/L ${n} (${f}) met ${V2} mL ${nl(c2, 2)} mol/L ${n}. Wat is de concentratie van het mengsel? (Neem aan dat de volumes bij elkaar op te tellen zijn.)`, 'mol/L', c, { hint: 'Tel eerst de mol van beide oplossingen op (n = c × V), deel dan door het totale volume.', explain: `n₁ = ${nl(c1, 2)} × ${nl(V1 / 1000, 3)} = ${sig(c1 * V1 / 1000)} mol en n₂ = ${nl(c2, 2)} × ${nl(V2 / 1000, 3)} = ${sig(c2 * V2 / 1000)} mol. c = (n₁ + n₂) / V = ${sig((c1 * V1 + c2 * V2) / 1000)} / ${nl((V1 + V2) / 1000, 3)} = ${sig(c)} mol/L.` }); },
  () => { const [f, ion, k] = rnd([['CaCl₂', 'Cl⁻', 2], ['Na₂SO₄', 'Na⁺', 2], ['AlCl₃', 'Cl⁻', 3], ['K₃PO₄', 'K⁺', 3], ['MgCl₂', 'Cl⁻', 2], ['Fe₂(SO₄)₃', 'SO₄²⁻', 3]]), c = rf(0.05, 1.0, 2), V = ri(50, 500), n = k * c * V / 1000;
    return Q.num(`Je hebt ${V} mL oplossing van ${nl(c, 2)} mol/L ${f}. Hoeveel mol ${ion}-ionen zitten er in deze oplossing?`, 'mol', n, { hint: 'Eerst n(stof) = c × V (V in liter), dan het aantal ionen per formule-eenheid.', explain: `n(${f}) = ${nl(c, 2)} × ${nl(V / 1000, 3)} = ${sig(c * V / 1000)} mol. Per ${f} ontstaan ${k} ${ion}-ionen, dus n(${ion}) = ${k} × ${sig(c * V / 1000)} = ${sig(n)} mol.` }); },
  () => Q.mc('Welke formule gebruik je om het aantal mol van een stof uit de massa te berekenen?', 'n = m / M', ['n = m × M', 'n = M / m', 'n = m × V'], 'Kijk naar de eenheden: mol = gram / (gram per mol).', 'M heeft de eenheid g/mol, dus n (mol) = m (g) / M (g/mol).')
];

/* ---------- New York: zouten en reactievergelijkingen ---------- */
const balQ = () => {
  const lim = c => LV === 1 ? Math.max(...c) <= 3 : LV === 2 ? Math.max(...c) <= 8 : Math.max(...c) >= 4 && Math.max(...c) <= 30;
  const r = pickU(RX.filter(x => lim(rxCoefs(x))), 'bal');
  return Q.bal(`${r.d} Maak de reactievergelijking kloppend.`, r.r.map(x => x[1]), r.p.map(x => x[1]), rxCoefs(r), 'Tel de atomen links en rechts. Begin met het element dat in de minste stoffen voorkomt.', `Kloppend: ${rxText(r)}.`);
};
const stoichQ = filter => () => {
  const r = pickU(RX.filter(filter || (() => true)), 'st'), a = ri(0, r.r.length - 1), b = r.w ?? ri(0, r.p.length - 1), m = rf(2, 100, 1), ans = stoichMass(r, a, b, m);
  const fa = r.r[a][1], fb = r.p[b][1];
  return Q.num(`${r.d} De kloppende vergelijking is ${rxText(r)}. Je laat ${nl(m, 1)} g ${nameOf(fa)} (${fa}) volledig reageren, de andere beginstoffen zijn in overmaat. Hoeveel gram ${nameOf(fb)} (${fb}) ontstaat er?`, 'g', ans,
    { hint: 'Reken om: gram → mol (÷ M), molverhouding uit de vergelijking, mol → gram (× M).', explain: `n(${fa}) = ${nl(m, 1)} / ${nl(molM(fa), 2)} = ${sig(m / molM(fa))} mol. Molverhouding ${fa} : ${fb} = ${r.r[a][0]} : ${r.p[b][0]}, dus n(${fb}) = ${sig(m / molM(fa) * r.p[b][0] / r.r[a][0])} mol. m = n × M = ${sig(ans)} g.` });
};
const PRECIP = [['AgNO₃', 'NaCl', 'AgCl', ['NaNO₃', 'AgNa', 'NaCl']], ['BaCl₂', 'Na₂SO₄', 'BaSO₄', ['NaCl', 'BaNa₂', 'Na₂SO₄']], ['Pb(NO₃)₂', 'KI', 'PbI₂', ['KNO₃', 'PbK', 'K₂I']],
  ['CaCl₂', 'Na₂CO₃', 'CaCO₃', ['NaCl', 'CaNa₂', 'Na₂CO₃']], ['FeCl₃', 'NaOH', 'Fe(OH)₃', ['NaCl', 'FeNa', 'Na₃OH']], ['CuSO₄', 'NaOH', 'Cu(OH)₂', ['Na₂SO₄', 'CuNa₂', 'Na₂OH']]];
const POOL_NY = [
  balQ, balQ,
  stoichQ(r => r.r.length >= 1),
  () => { const s = randSalt(), ca = s.c, an = s.a, x = s.x, y = s.y;
    const good = `${s.f} (s) → ${ionSide(ca, x, ca.c)} (aq) + ${ionSide(an, y, -an.c)} (aq)`;
    const cand = [`${s.f} (s) → ${ionSide(ca, y, ca.c)} (aq) + ${ionSide(an, x, -an.c)} (aq)`, `${s.f} (s) → ${ionSide(ca, 1, ca.c)} (aq) + ${ionSide(an, 1, -an.c)} (aq)`,
      `${s.f} (s) → ${x > 1 ? x + ' ' : ''}${ca.f} (aq) + ${y > 1 ? y + ' ' : ''}${an.f} (aq)`, `${s.f} (s) → ${ionSide(ca, x, ca.c + 1)} (aq) + ${ionSide(an, y, -an.c - 1)} (aq)`, `${s.f} (s) → ${ionSide(ca, x, -ca.c)} (aq) + ${ionSide(an, y, an.c)} (aq)`];
    return Q.mc(`Welke vergelijking beschrijft het oplossen van ${s.n} (${s.f}) in water?`, good, cand, 'Het zout valt uiteen in ionen. De totale lading links en rechts moet gelijk zijn.', `${s.n} bestaat uit ${ionS(ca.f, ca.c)} en ${ionS(an.f, -an.c)}. Per ${s.f} ontstaan ${x} kation(en) en ${y} anion(en); de lading klopt (${x}·${ca.c} = ${y}·${an.c}).`); },
  () => { const s = randSalt(), n = rf(0.1, 2, 2), k = s.x + s.y;
    return Q.num(`Hoeveel mol ionen ontstaan er als ${nl(n, 2)} mol ${s.n} (${s.f}) volledig oplost?`, 'mol', n * k, { hint: 'Tel eerst hoeveel ionen er per formule-eenheid ontstaan.', explain: `Per ${s.f} ontstaan ${s.x} + ${s.y} = ${k} ionen, dus ${nl(n, 2)} × ${k} = ${sig(n * k)} mol.` }); },
  () => { const [A, B, P, odd] = rnd(PRECIP);
    return Q.mc(`Je mengt een oplossing van ${A} met een oplossing van ${B}. Welke stof slaat neer?`, P, odd, 'Wissel de ionen om en kijk welke combinatie slecht oplost (zoek in Binas de tabel met de oplosbaarheid van zouten).', `De ionen van ${A} en ${B} vormen samen ${P}, dat slecht oplost in water. De andere ionen blijven opgelost.`); },
  () => { const [A, B, P] = rnd(PRECIP), c = rf(0.05, 0.5, 2), V = ri(20, 200), M = molM(P), m = c * V / 1000 * M;
    return Q.num(`Je voegt een overmaat ${B}-oplossing toe aan ${V} mL ${nl(c, 2)} mol/L ${A}. Er ontstaat ${P} als neerslag, 1 mol ${P} per mol ${A}. Hoeveel gram ${P} slaat neer?`, 'g', m,
      { hint: 'n(neerslag) = n(A) = c × V, daarna m = n × M.', explain: `n = ${nl(c, 2)} × ${nl(V / 1000, 3)} = ${sig(c * V / 1000)} mol. m = n × M(${P}) = ${sig(c * V / 1000)} × ${nl(M, 2)} = ${sig(m)} g.` }); },
  () => { const s = randSalt(), ca = s.c, an = s.a, alt = [[ca.c === an.c ? 2 : an.c, ca.c], [1, 1], [ca.c, 1], [1, an.c]];
    const bad = alt.map(([x, y]) => saltFormula(ca, an, x, y));
    return Q.mc(`Wat is de formule van het zout dat bestaat uit ${ionS(ca.f, ca.c)}-ionen en ${ionS(an.f, -an.c)}-ionen?`, s.f, uniqRatio([...bad, ...[[2, 2], [3, 2], [2, 3], [1, 2], [2, 1], [1, 3], [3, 1]].map(([x, y]) => saltFormula(ca, an, x, y))], s.f), 'Het zout is neutraal: de positieve en negatieve lading moeten elkaar opheffen.', `${s.x} × ${ca.c}+ en ${s.y} × ${an.c}− heffen elkaar op, dus ${s.f}.`); }
];

/* ---------- Rio de Janeiro: organische chemie ---------- */
const FUELS = () => {
  const alk = rnd([true, false]), [lo, hi] = LV === 1 ? [1, 3] : LV === 3 ? [4, 8] : [2, 6], n = alk ? ri(lo, hi) : ri(lo, Math.min(hi, 6));
  const f = alk ? orgFormula({ t: 'alkaan', n }) : orgFormula({ t: 'alkanol', n });
  const el = parseF(f).el, a = 0, C = el.C, H = el.H, O = el.O || 0;
  // zoek kleinste gehele coëfficiënten: a f + b O₂ → c CO₂ + d H₂O
  for (const k of [1, 2, 4]) { const c = C * k, d = H * k / 2, b2 = 2 * c + d - O * k; if (b2 % 2 === 0 && Number.isInteger(d)) return { f, n, alk, a: k, b: b2 / 2, c, d, name: alk ? orgName({ t: 'alkaan', n }) : orgName({ t: 'alkanol', n, p: 1 }) }; }
};
const POOL_RIO = [
  () => { const s = randSpec(['alkaan', 'alkeen', 'alkyn', 'alkanol', 'zuur', 'halogeen']), f = orgFormula(s), h = countAtoms(f, 'H');
    return Q.num(`Hoeveel waterstofatomen zitten er in één molecuul ${orgName(s)}? Structuurformule: ${orgStruct(s)}.`, '', h, { hint: 'Tel alle H-atomen in de structuurformule, ook die in –OH en –COOH.', explain: `De molecuulformule is ${f}, dus ${h} waterstofatomen.` }); },
  () => { const F = FUELS(), prod = [[F.c, 'CO₂'], [F.d, 'H₂O']], co = [F.a, F.b, F.c, F.d];
    return Q.bal(`${F.name[0].toUpperCase() + F.name.slice(1)} (${F.f}) verbrandt volledig. Maak de reactievergelijking kloppend.`, [F.f, 'O₂'], ['CO₂', 'H₂O'], co, 'Begin met C, dan H. Tel O als laatste, en let op de O in de brandstof zelf.', `Kloppend: ${F.a > 1 ? F.a + ' ' : ''}${F.f} + ${F.b} O₂ → ${F.c} CO₂ + ${F.d} H₂O.`); },
  () => { const F = FUELS(), m = rf(5, 100, 1), M = molM(F.f), ans = m / M / F.a * F.c * molM('CO₂');
    return Q.num(`Je verbrandt ${nl(m, 1)} g ${F.name} (${F.f}) volledig. Hoeveel gram CO₂ ontstaat er?`, 'g', ans, { hint: 'Stel de kloppende vergelijking op, reken gram om naar mol, gebruik de molverhouding en reken terug naar gram.', explain: `Vergelijking: ${F.a > 1 ? F.a + ' ' : ''}${F.f} + ${F.b} O₂ → ${F.c} CO₂ + ${F.d} H₂O. n(${F.f}) = ${nl(m, 1)} / ${nl(M, 2)} = ${sig(m / M)} mol. n(CO₂) = ${sig(m / M / F.a * F.c)} mol. m = ${sig(ans)} g.` }); },
  () => { const F = FUELS(), m = rf(5, 100, 1), M = molM(F.f), ans = m / M / F.a * F.b * molM('O₂');
    return Q.num(`Hoeveel gram zuurstof is nodig om ${nl(m, 1)} g ${F.name} (${F.f}) volledig te verbranden?`, 'g', ans, { hint: 'Gebruik de molverhouding brandstof : O₂ uit de kloppende vergelijking.', explain: `Vergelijking: ${F.a > 1 ? F.a + ' ' : ''}${F.f} + ${F.b} O₂ → ${F.c} CO₂ + ${F.d} H₂O. n(${F.f}) = ${sig(m / M)} mol, n(O₂) = ${sig(m / M / F.a * F.b)} mol, m = ${sig(ans)} g.` }); },
  () => { const n = ri(3, 6), s = { t: 'alkanol', n, p: ri(1, maxP('alkanol', n)) }, others = [];
    const good = []; for (let p = 1; p <= maxP('alkanol', n); p++) if (p !== s.p) good.push(orgName({ t: 'alkanol', n, p }));
    const bad = [orgName({ t: 'alkanol', n: n + 1, p: 1 }), orgName({ t: 'alkanol', n: n - 1, p: 1 }), orgName({ t: 'zuur', n }), orgName({ t: 'alkaan', n })];
    return Q.mc(`Welke stof is een structuurisomeer van ${orgName(s)}?`, rnd(good), bad, 'Isomeren hebben dezelfde molecuulformule, maar een andere structuur.', `${orgName(s)} heeft molecuulformule ${orgFormula(s)}. Een isomeer heeft dezelfde formule; hier zit de OH-groep op een andere plaats.`); },
  () => { const s = randSpec(['alkaan', 'alkeen', 'alkyn', 'alkanol', 'zuur', 'halogeen']), good = FAM[s.t], bad = uniq(Object.values(FAM).filter(x => x !== good));
    return Q.mc(`Tot welke soort stoffen hoort ${orgStruct(s)}?`, good, bad.slice(0, 3), 'Kijk naar de binding of de groep die opvalt: C=C, C≡C, –OH, –COOH of –Cl.', `${orgStruct(s)} heet ${orgName(s)}: een ${good}.`); },
  () => { const [eq, good] = rnd([['C₂H₄ + Br₂ → C₂H₄Br₂', 'additie'], ['CH₄ + Cl₂ → CH₃Cl + HCl', 'substitutie'], ['C₂H₄ + H₂O → C₂H₅OH', 'additie'], ['CH₄ + 2 O₂ → CO₂ + 2 H₂O', 'verbranding'], ['C₂H₆ + Cl₂ → C₂H₅Cl + HCl', 'substitutie'], ['C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O', 'verbranding'], ['C₃H₆ + H₂ → C₃H₈', 'additie']]);
    return Q.mc(`Welk soort reactie is ${eq}?`, good, ['additie', 'substitutie', 'verbranding', 'neutralisatie'].filter(x => x !== good), 'Bij additie wordt een dubbele binding verbroken, bij substitutie wordt een atoom vervangen.', `Dit is een ${good}reactie.`); },
  stoichQ(r => r.r[0][1] === 'C₆H₁₂O₆'),
  () => { const [f, k] = rnd([['C₃H₈', 1], ['C₄H₁₀', 2], ['C₅H₁₂', 3], ['C₆H₁₄', 5], ['C₇H₁₆', 9]].slice(LV === 1 ? 0 : LV === 2 ? 1 : 2, LV === 1 ? 2 : LV === 2 ? 4 : 5));
    return Q.num(`Hoeveel structuurisomeren heeft ${f}?`, '', k, { hint: 'Teken de koolstofskeletten: een rechte keten en ketens met zijketens.', explain: `${f} heeft ${k} structuurisomeer${k > 1 ? 'en' : ''}.` }); }
];
/* ---------- Caïro: zuren en basen ---------- */
const CONJ = [['H₃O⁺', 'H₂O'], ['H₂O', 'OH⁻'], ['NH₄⁺', 'NH₃'], ['CH₃COOH', 'CH₃COO⁻'], ['H₂CO₃', 'HCO₃⁻'], ['HCO₃⁻', 'CO₃²⁻'], ['H₃PO₄', 'H₂PO₄⁻'], ['H₂PO₄⁻', 'HPO₄²⁻'],
  ['HSO₄⁻', 'SO₄²⁻'], ['HF', 'F⁻'], ['HNO₂', 'NO₂⁻'], ['HCl', 'Cl⁻'], ['HCN', 'CN⁻'], ['H₂S', 'HS⁻']];
const CONC = (m, k) => { const c = m * Math.pow(10, -k); return Math.random() < .5 || k < 3 ? nl(c, k + (String(m).includes('.') ? 1 : 0)) : sci(c, 2); };
const concVal = (m, k) => m * Math.pow(10, -k);
const POOL_CAI = [
  () => { const [a, b] = rnd(CONJ), all = uniq(CONJ.flat()), asAcid = Math.random() < .5, x = asAcid ? b : a, good = asAcid ? a : b;
    return Q.mc(`Wat is het geconjugeerde ${asAcid ? 'zuur' : 'base'} van ${x}?`, good, all.filter(s => s !== good && s !== x), asAcid ? 'Een base neemt een H⁺ op en wordt het geconjugeerde zuur.' : 'Een zuur staat een H⁺ af en wordt de geconjugeerde base.', `${a} en ${b} vormen een zuur-basepaar: ${a} → ${b} + H⁺.`); },
  () => { const m = rnd([1.0, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.5, 8.0]), k = ri(1, 4), c = concVal(m, k), zuur = rnd(['HCl', 'HNO₃', 'HClO₄']), pH = -Math.log10(c);
    return Q.num(`Wat is de pH van een ${CONC(m, k)} mol/L oplossing van ${zuur}? Geef je antwoord met twee decimalen.`, '', pH, { abs: 0.05, hint: `${zuur} is een sterk zuur: [H₃O⁺] = c. Gebruik pH = −log[H₃O⁺].`, explain: `[H₃O⁺] = ${sci(c, 2)} mol/L. pH = −log(${sci(c, 2)}) = ${nl(pH, 2)}.` }); },
  () => { const [b, kOH] = rnd([['NaOH', 1], ['KOH', 1], ['Ba(OH)₂', 2]]), m = rnd([1.0, 2.0, 2.5, 4.0, 5.0, 8.0]), k = ri(1, 4), c = concVal(m, k), OH = kOH * c, pH = 14 + Math.log10(OH);
    return Q.num(`Wat is de pH van een ${CONC(m, k)} mol/L oplossing van ${b} bij 298 K? Geef je antwoord met twee decimalen.`, '', pH, { abs: 0.05, hint: 'Bereken [OH⁻], dan pOH = −log[OH⁻] en pH = 14,00 − pOH.', explain: `${b} geeft ${kOH} OH⁻ per formule-eenheid: [OH⁻] = ${sci(OH, 2)} mol/L. pOH = ${nl(-Math.log10(OH), 2)}, pH = 14,00 − ${nl(-Math.log10(OH), 2)} = ${nl(pH, 2)}.` }); },
  () => { const pH = rf(1.0, 6.0, 2), H = Math.pow(10, -pH);
    return Q.num(`Een oplossing heeft pH = ${nl(pH, 2)}. Wat is [H₃O⁺]? Schrijf bijvoorbeeld 2,5e-3.`, 'mol/L', H, { tol: 0.03, hint: '[H₃O⁺] = 10^(−pH).', explain: `[H₃O⁺] = 10^(−${nl(pH, 2)}) = ${sci(H, 2)} mol/L.` }); },
  () => { const pH = rf(8.0, 12.5, 2), OH = Math.pow(10, -(14 - pH));
    return Q.num(`Een oplossing heeft pH = ${nl(pH, 2)} bij 298 K. Wat is [OH⁻]? Schrijf bijvoorbeeld 2,5e-3.`, 'mol/L', OH, { tol: 0.03, hint: 'pOH = 14,00 − pH, daarna [OH⁻] = 10^(−pOH).', explain: `pOH = 14,00 − ${nl(pH, 2)} = ${nl(14 - pH, 2)}. [OH⁻] = 10^(−${nl(14 - pH, 2)}) = ${sci(OH, 2)} mol/L.` }); },
  () => { const m = rnd([1.0, 2.0, 5.0]), k = ri(1, 3), c = concVal(m, k), x = ri(1, 2), pH0 = -Math.log10(c);
    return Q.num(`Je verdunt een oplossing van ${nl(c, k + 1)} mol/L HCl met water tot het volume ${Math.pow(10, x)} keer zo groot is. Wat is de pH daarna?`, '', pH0 + x, { abs: 0.05, hint: 'Bij een factor 10 verdunnen wordt [H₃O⁺] tien keer kleiner: de pH stijgt met 1.', explain: `Begin-pH = ${nl(pH0, 2)}. Verdunnen met factor ${Math.pow(10, x)}: pH + ${x} = ${nl(pH0 + x, 2)}.` }); },
  () => { const [za, ka] = rnd([['H₂SO₄', 2], ['HCl', 1], ['HNO₃', 1]]), ca = rnd([0.050, 0.10, 0.20, 0.25]), Va = ri(10, 50), cb = rnd([0.050, 0.10, 0.20]), Vb = ka * ca * Va / cb;
    return Q.num(`Je titreert ${Va},0 mL ${nl(ca, 3)} mol/L ${za} met ${nl(cb, 3)} mol/L natronloog (NaOH). Beschouw het zuur als sterk met ${ka} H⁺ per molecuul. Hoeveel mL natronloog heb je nodig tot het equivalentiepunt?`, 'mL', Vb, { hint: 'Op het equivalentiepunt geldt n(H₃O⁺) = n(OH⁻).', explain: `n(H₃O⁺) = ${ka} × ${nl(ca, 3)} × ${Va},0 = ${sig(ka * ca * Va)} mmol. n(OH⁻) = n(H₃O⁺), dus V = n / c = ${sig(ka * ca * Va)} / ${nl(cb, 3)} = ${sig(Vb)} mL.` }); },
  () => { const a = rnd([0.10, 0.20, 0.30, 0.50]), b = rnd([0.05, 0.10, 0.25, 0.40]); if (a === b) return POOL_CAI[7]();
    const V = ri(20, 100), exc = (a - b) / 2, pH = exc > 0 ? -Math.log10(exc) : 14 + Math.log10(-exc);
    return Q.num(`Je mengt ${V} mL ${nl(a, 2)} mol/L HCl met ${V} mL ${nl(b, 2)} mol/L NaOH bij 298 K. Wat is de pH van het mengsel? Geef je antwoord met twee decimalen.`, '', pH, { abs: 0.05, hint: 'Bereken welke stof in overmaat is, en deel de overmaat door het totale volume.', explain: `n(H₃O⁺) = ${sig(a * V)} mmol, n(OH⁻) = ${sig(b * V)} mmol. Overmaat: ${sig(Math.abs(a - b) * V)} mmol ${exc > 0 ? 'H₃O⁺' : 'OH⁻'} in ${2 * V} mL, dus ${exc > 0 ? '[H₃O⁺]' : '[OH⁻]'} = ${sci(Math.abs(exc), 2)} mol/L. pH = ${nl(pH, 2)}.` }); },
  () => { const [z, Ka] = rnd([['azijnzuur', 1.8e-5], ['mierenzuur', 1.8e-4], ['waterstoffluoride', 6.3e-4], ['waterstofcyanide', 4.9e-10]].slice(0, 3)), c = rf(0.05, 0.5, 2), H = Math.sqrt(Ka * c), pH = -Math.log10(H);
    return Q.num(`${z[0].toUpperCase() + z.slice(1)} is een zwak zuur met Ka = ${sci(Ka, 2)}. Wat is de pH van een oplossing van ${nl(c, 2)} mol/L? Verwaarloos de afname van de zuurconcentratie.`, '', pH, { abs: 0.05, hint: 'Voor een zwak zuur geldt [H₃O⁺] = √(Ka × c).', explain: `[H₃O⁺] = √(${sci(Ka, 2)} × ${nl(c, 2)}) = ${sci(H, 2)} mol/L. pH = ${nl(pH, 2)}.` }); },
  () => { const sterk = rnd(['HCl', 'HNO₃', 'HClO₄', 'H₂SO₄']);
    return Q.mc('Welk van deze zuren is een sterk zuur?', sterk, ['CH₃COOH', 'HF', 'H₂CO₃', 'HCN', 'NH₄⁺'], 'Een sterk zuur reageert volledig met water. Zoek in Binas in de tabel met zuursterkte welke zuren een zeer grote Ka hebben.', `${sterk} reageert volledig met water: het is een sterk zuur. De andere zuren zijn zwak.`); },
  () => { const [A, B, good, bad] = rnd([['ammoniak (NH₃)', 'zoutzuur (HCl)', 'NH₃ (aq) + H₃O⁺ (aq) → NH₄⁺ (aq) + H₂O (l)', ['NH₃ (aq) + Cl⁻ (aq) → NH₃Cl⁻ (aq)', 'NH₃ (aq) + OH⁻ (aq) → NH₂⁻ (aq) + H₂O (l)', 'NH₄⁺ (aq) + H₂O (l) → NH₃ (aq) + H₃O⁺ (aq)']], ['azijnzuur (CH₃COOH)', 'natronloog (NaOH)', 'CH₃COOH (aq) + OH⁻ (aq) → CH₃COO⁻ (aq) + H₂O (l)', ['CH₃COOH (aq) + Na⁺ (aq) → CH₃COONa (s) + H⁺ (aq)', 'CH₃COO⁻ (aq) + H₃O⁺ (aq) → CH₃COOH (aq) + H₂O (l)', 'CH₃COOH (aq) + H₃O⁺ (aq) → CH₃COOH₂⁺ (aq) + H₂O (l)']], ['zoutzuur (HCl)', 'natronloog (NaOH)', 'H₃O⁺ (aq) + OH⁻ (aq) → 2 H₂O (l)', ['Na⁺ (aq) + Cl⁻ (aq) → NaCl (s)', 'H⁺ (aq) + Cl⁻ (aq) → HCl (g)', 'Na⁺ (aq) + OH⁻ (aq) → NaOH (s)']]]);
    return Q.mc(`Welke reactie vindt plaats als je ${A} en ${B} mengt?`, good, bad, 'Teken wie H⁺ afstaat (zuur) en wie H⁺ opneemt (base).', 'Een zuur-basereactie is een overdracht van H⁺ van het zuur naar de base.'); }
];

/* ---------- Mumbai: chemisch evenwicht ---------- */
const EQ = [
  { l: [[1, 'N₂', 'g'], [3, 'H₂', 'g']], r: [[2, 'NH₃', 'g']], exo: true },
  { l: [[2, 'SO₂', 'g'], [1, 'O₂', 'g']], r: [[2, 'SO₃', 'g']], exo: true },
  { l: [[1, 'H₂', 'g'], [1, 'I₂', 'g']], r: [[2, 'HI', 'g']], exo: true },
  { l: [[1, 'N₂O₄', 'g']], r: [[2, 'NO₂', 'g']], exo: false },
  { l: [[2, 'NO', 'g'], [1, 'O₂', 'g']], r: [[2, 'NO₂', 'g']], exo: true },
  { l: [[1, 'CO', 'g'], [2, 'H₂', 'g']], r: [[1, 'CH₃OH', 'g']], exo: true },
  { l: [[1, 'PCl₅', 'g']], r: [[1, 'PCl₃', 'g'], [1, 'Cl₂', 'g']], exo: false },
  { l: [[1, 'CaCO₃', 's']], r: [[1, 'CaO', 's'], [1, 'CO₂', 'g']], exo: false },
  { l: [[1, 'C', 's'], [1, 'CO₂', 'g']], r: [[2, 'CO', 'g']], exo: false },
  { l: [[1, 'Fe³⁺', 'aq'], [1, 'SCN⁻', 'aq']], r: [[1, 'FeSCN²⁺', 'aq']], exo: true }
];
const HOMO = EQ.filter(e => [...e.l, ...e.r].every(x => x[2] !== 's'));
const eqS = e => [e.l, e.r].map(side => side.map(([c, f, ph]) => (c > 1 ? c + ' ' : '') + f + '(' + ph + ')').join(' + ')).join(' ⇌ ');
const sp1 = ([c, f]) => '[' + f + ']' + (c > 1 ? sp(c) : '');
const kStr = (num, den, o = {}) => {
  const t = list => list.map(x => (o.coef && x[0] > 1 ? x[0] : '') + '[' + x[1] + ']' + (!o.noexp && !o.coef && x[0] > 1 ? sp(x[0]) : '')).join(o.add ? ' + ' : ' · ');
  const n = num.length ? t(num) : '1', d = den.length ? (den.length > 1 ? '(' + t(den) + ')' : t(den)) : '';
  return 'K = ' + (d ? (num.length > 1 && !o.flat ? '(' + n + ')' : n) + ' / ' + d : n);
};
const eqLevel = (e, kind) => {   // richting van het evenwicht
  const gl = e.l.filter(x => x[2] === 'g').reduce((a, x) => a + x[0], 0), gr = e.r.filter(x => x[2] === 'g').reduce((a, x) => a + x[0], 0);
  return { gl, gr };
};
const RL = (right) => right ? 'naar rechts' : 'naar links';
const POOL_BOM = [
  () => { const e = rnd(EQ), L = e.l.filter(x => x[2] !== 's'), R = e.r.filter(x => x[2] !== 's'), good = kStr(R, L);
    const cand = [kStr(L, R), kStr(R, L, { noexp: 1 }), kStr(R, L, { coef: 1 }), kStr([...e.r], [...e.l]), kStr(R, L, { add: 1 }), kStr([...R, ...L], [], {}), kStr(R, [...e.l]), kStr([...e.r], L)];
    return Q.mc(`Wat is de evenwichtsvoorwaarde van ${eqS(e)}?`, good, cand, 'Producten in de teller, beginstoffen in de noemer. Zuivere vaste stoffen komen er niet in voor. Coëfficiënten worden exponenten.', `Alleen stoffen in oplossing of gasvorm tellen mee; de coëfficiënten worden exponenten. ${good}.`); },
  () => { const e = rnd(HOMO), c = x => rf(0.05, 0.8, 2), vals = {}; [...e.l, ...e.r].forEach(x => vals[x[1]] = c()); let K = 1;
    e.r.forEach(x => K *= Math.pow(vals[x[1]], x[0])); e.l.forEach(x => K /= Math.pow(vals[x[1]], x[0]));
    const list = [...e.l, ...e.r].map(x => `[${x[1]}] = ${nl(vals[x[1]], 2)} mol/L`).join(', ');
    return Q.num(`Voor het evenwicht ${eqS(e)} geldt bij een bepaalde temperatuur: ${list}. Bereken K.`, '', K, { tol: 0.03, hint: 'Stel eerst de evenwichtsvoorwaarde op en vul de concentraties in.', explain: `${kStr(e.r, e.l)} = ${sig(K)}.` }); },
  () => { const e = rnd(HOMO), K = rnd([0.5, 2.0, 5.0, 20, 0.10, 50]); let Q_, vals;
    for (let t = 0; t < 50; t++) { vals = {}; [...e.l, ...e.r].forEach(x => vals[x[1]] = rf(0.05, 1.0, 2)); Q_ = 1; e.r.forEach(x => Q_ *= Math.pow(vals[x[1]], x[0])); e.l.forEach(x => Q_ /= Math.pow(vals[x[1]], x[0])); if (Math.abs(Q_ / K - 1) > .2) break; }
    const list = [...e.l, ...e.r].map(x => `[${x[1]}] = ${nl(vals[x[1]], 2)}`).join(', ');
    const right = Q_ < K, good = right ? 'Naar rechts (er ontstaan meer producten)' : 'Naar links (er ontstaan meer beginstoffen)';
    return Q.mc(`Voor ${eqS(e)} is K = ${sig(K)}. Op een bepaald moment geldt (in mol/L): ${list}. In welke richting verloopt de reactie netto?`, good, [right ? 'Naar links (er ontstaan meer beginstoffen)' : 'Naar rechts (er ontstaan meer producten)', 'Het systeem is al in evenwicht', 'Dat is niet te bepalen zonder de temperatuur'], 'Bereken het concentratiebreuk Q met dezelfde formule als K en vergelijk Q met K.', `Q = ${sig(Q_)}. ${right ? 'Q < K: er moeten meer producten ontstaan.' : 'Q > K: er moeten meer beginstoffen ontstaan.'}`); },
  () => { const t = rnd([0, 1, 2]);
    if (t === 0) { const c0 = rf(0.2, 1.0, 2), y = rf(0.2 * c0, 1.5 * c0, 2), K = y * y / (c0 - y / 2);
      return Q.num(`In een vat zit alleen N₂O₄(g) met een beginconcentratie van ${nl(c0, 2)} mol/L. In evenwicht, N₂O₄ ⇌ 2 NO₂, is [NO₂] = ${nl(y, 2)} mol/L. Bereken K.`, '', K, { tol: 0.03, hint: 'Per 2 mol NO₂ die ontstaat verdwijnt 1 mol N₂O₄: [N₂O₄] = begin − [NO₂]/2.', explain: `[N₂O₄] = ${nl(c0, 2)} − ${nl(y, 2)}/2 = ${nl(c0 - y / 2, 3)} mol/L. K = [NO₂]² / [N₂O₄] = ${nl(y, 2)}² / ${nl(c0 - y / 2, 3)} = ${sig(K)}.` }); }
    if (t === 1) { const c0 = rf(0.2, 1.0, 2), x = rf(0.1 * c0, 0.4 * c0, 3), K = x / Math.pow(c0 - 2 * x, 2);
      return Q.num(`In een vat zit alleen NO₂(g) met een beginconcentratie van ${nl(c0, 2)} mol/L. In evenwicht, 2 NO₂ ⇌ N₂O₄, is [N₂O₄] = ${nl(x, 3)} mol/L. Bereken K.`, '', K, { tol: 0.03, hint: 'Per mol N₂O₄ dat ontstaat verdwijnt 2 mol NO₂.', explain: `[NO₂] = ${nl(c0, 2)} − 2 × ${nl(x, 3)} = ${nl(c0 - 2 * x, 3)} mol/L. K = [N₂O₄] / [NO₂]² = ${nl(x, 3)} / ${nl(c0 - 2 * x, 3)}² = ${sig(K)}.` }); }
    const c0 = rf(0.2, 1.0, 2), y = rf(0.5 * c0, 1.6 * c0, 2), K = y * y / Math.pow(c0 - y / 2, 2);
    return Q.num(`Je begint met ${nl(c0, 2)} mol/L H₂ en ${nl(c0, 2)} mol/L I₂. In evenwicht, H₂ + I₂ ⇌ 2 HI, is [HI] = ${nl(y, 2)} mol/L. Bereken K.`, '', K, { tol: 0.03, hint: 'Per 2 mol HI verdwijnt 1 mol H₂ en 1 mol I₂.', explain: `[H₂] = [I₂] = ${nl(c0, 2)} − ${nl(y, 2)}/2 = ${nl(c0 - y / 2, 3)} mol/L. K = [HI]² / ([H₂][I₂]) = ${sig(K)}.` }); },
  () => { const e = rnd(EQ.filter(x => x.l.concat(x.r).some(y => y[2] === 'g'))), up = Math.random() < .5, toRight = (up ? !e.exo : e.exo) ? true : false;
    const right = up ? !e.exo : e.exo;
    const wk = r => `Naar ${r ? 'rechts' : 'links'} en K wordt ${r ? 'groter' : 'kleiner'}`;
    return Q.mc(`${eqS(e)} is ${e.exo ? 'exotherm' : 'endotherm'}. Je ${up ? 'verhoogt' : 'verlaagt'} de temperatuur. Wat gebeurt er?`, wk(right), [wk(!right), `Naar ${right ? 'rechts' : 'links'} en K blijft gelijk`, 'Geen verschuiving en K blijft gelijk'], 'Een temperatuurverhoging bevordert de endotherme reactie. Een temperatuurverandering verandert K.', `Bij ${up ? 'verhogen' : 'verlagen'} verschuift het evenwicht in de ${up ? 'endotherme' : 'exotherme'} richting, hier ${RL(right)}. Een temperatuurverandering is de enige ingreep die K verandert.`); },
  () => { const e = rnd(EQ.filter(x => x.l.concat(x.r).some(y => y[2] === 'g'))), up = Math.random() < .5, { gl, gr } = eqLevel(e);
    let right = null; if (gl !== gr) right = up ? gr < gl : gl < gr;
    const word = r => r === null ? 'Geen verschuiving' : 'Naar ' + (r ? 'rechts' : 'links');
    const good = word(right) + ', K blijft gelijk', bad = uniq([word(true), word(false), word(null)].map(w => w + ', K blijft gelijk')).filter(w => w !== good);
    return Q.mc(`Je ${up ? 'verkleint het volume van het reactievat (de druk neemt toe)' : 'vergroot het volume van het reactievat (de druk neemt af)'} bij ${eqS(e)}. Wat gebeurt er?`, good, [...bad, `${word(right === null ? true : right)}, K wordt groter`], 'Tel de mol gasdeeltjes links en rechts. Hogere druk bevordert de kant met minder gasdeeltjes.', `Links ${gl} mol gas, rechts ${gr} mol gas. ${right === null ? 'Gelijk, dus geen verschuiving.' : 'Het evenwicht verschuift ' + RL(right) + '.'} K verandert alleen met de temperatuur.`); },
  () => { const e = rnd(HOMO), all = [...e.l.map(x => [x, 'l']), ...e.r.map(x => [x, 'r'])], [x, side] = rnd(all), add = Math.random() < .5;
    const right = side === 'l' ? add : !add;
    return Q.mc(`Bij ${eqS(e)} in evenwicht ${add ? 'voeg je extra' : 'verwijder je een deel van'} ${x[1]} ${add ? 'toe' : ''}. Wat gebeurt er?`, 'Naar ' + (right ? 'rechts' : 'links'), ['Naar ' + (right ? 'links' : 'rechts'), 'Geen verschuiving', 'K verandert en er is geen verschuiving'], 'Het evenwicht werkt de verstoring tegen.', `${x[1]} staat aan de ${side === 'l' ? 'beginstofkant' : 'productkant'}. ${add ? 'Toevoegen' : 'Verwijderen'} verschuift het evenwicht ${RL(right)}.`); },
  () => Q.mc('Welke ingreep verandert de waarde van K?', 'Een temperatuurverandering', ['Een drukverandering', 'Een katalysator toevoegen', 'Een stof toevoegen'], 'K is alleen afhankelijk van de temperatuur.', 'K verandert alleen als de temperatuur verandert. Druk, concentraties en katalysator verschuiven de ligging of de snelheid, niet K.'),
  () => { const K = rnd([0.25, 0.5, 1.5, 2.0, 3.0, 4.0]), c0 = rf(0.2, 2.0, 2), B = K * c0 / (1 + K);
    return Q.num(`Voor A ⇌ B is K = ${nl(K, 2)}. Je begint met ${nl(c0, 2)} mol/L A en geen B. Wat is [B] in evenwicht?`, 'mol/L', B, { tol: 0.03, hint: 'Noem [B] = x, dan is [A] = begin − x. Los K = x / (begin − x) op.', explain: `K = x / (${nl(c0, 2)} − x) = ${nl(K, 2)} → x = K × ${nl(c0, 2)} / (1 + K) = ${sig(B)} mol/L.` }); }
];

/* ---------- Tokyo: redox en batterijen ---------- */
const MET = [['Mg', 'Mg²⁺', 2, -2.37], ['Al', 'Al³⁺', 3, -1.66], ['Zn', 'Zn²⁺', 2, -0.76], ['Fe', 'Fe²⁺', 2, -0.44], ['Ni', 'Ni²⁺', 2, -0.26], ['Sn', 'Sn²⁺', 2, -0.14], ['Pb', 'Pb²⁺', 2, -0.13], ['Cu', 'Cu²⁺', 2, 0.34], ['Ag', 'Ag⁺', 1, 0.80]];
const eStr = z => (z > 1 ? z + ' ' : '') + 'e⁻';
const halfOx = m => `${m[0]} → ${m[1]} + ${eStr(m[2])}`, halfRed = m => `${m[1]} + ${eStr(m[2])} → ${m[0]}`;
const twoMet = () => { let a, b; do { a = rnd(MET); b = rnd(MET); } while (a[3] >= b[3]); return [a, b]; };
const redoxEq = (a, b) => { const k = lcm(a[2], b[2]), ca = k / a[2], cb = k / b[2]; return { ca, cb, txt: `${ca > 1 ? ca + ' ' : ''}${a[0]} + ${cb > 1 ? cb + ' ' : ''}${b[1]} → ${ca > 1 ? ca + ' ' : ''}${a[1]} + ${cb > 1 ? cb + ' ' : ''}${b[0]}`, r: [a[0], b[1]], p: [a[1], b[0]], co: [ca, cb, ca, cb] }; };
const REDOXBAL = [
  [['Zn', 'Cu²⁺'], ['Zn²⁺', 'Cu'], [1, 1, 1, 1]], [['Al', 'Cu²⁺'], ['Al³⁺', 'Cu'], [2, 3, 2, 3]], [['Mg', 'Ag⁺'], ['Mg²⁺', 'Ag'], [1, 2, 1, 2]], [['Zn', 'Ag⁺'], ['Zn²⁺', 'Ag'], [1, 2, 1, 2]],
  [['Fe', 'Cu²⁺'], ['Fe²⁺', 'Cu'], [1, 1, 1, 1]], [['Al', 'Ag⁺'], ['Al³⁺', 'Ag'], [1, 3, 1, 3]], [['Fe²⁺', 'MnO₄⁻', 'H⁺'], ['Fe³⁺', 'Mn²⁺', 'H₂O'], [5, 1, 8, 5, 1, 4]], [['Cu', 'Ag⁺'], ['Cu²⁺', 'Ag'], [1, 2, 1, 2]]
];
const F_ = 96485;
const POOL_HND = [
  () => { const ox = Math.random() < .5, pick = shuf(MET).slice(0, 4), tgt = pick[0];
    return Q.mc(`Welke halfreactie is een ${ox ? 'oxidatie' : 'reductie'}?`, ox ? halfOx(tgt) : halfRed(tgt), pick.slice(1).map(m => ox ? halfRed(m) : halfOx(m)), 'Bij een oxidatie staat een deeltje elektronen af: de e⁻ staan rechts van de pijl.', `Bij ${ox ? 'oxidatie' : 'reductie'} staan de elektronen ${ox ? 'rechts' : 'links'} van de pijl.`); },
  () => { const [a, b] = twoMet(), eq = redoxEq(a, b), asRed = Math.random() < .5;
    return Q.mc(`Welke stof is de ${asRed ? 'reductor' : 'oxidator'} in ${eq.txt}?`, asRed ? a[0] : b[1], [asRed ? b[1] : a[0], a[1], b[0]], asRed ? 'De reductor staat elektronen af en wordt zelf geoxideerd.' : 'De oxidator neemt elektronen op en wordt zelf gereduceerd.', `${a[0]} staat elektronen af (${halfOx(a)}), dus ${a[0]} is de reductor. ${b[1]} neemt ze op (${halfRed(b)}), dus ${b[1]} is de oxidator.`); },
  () => { const [a, b] = twoMet(), flip = Math.random() < .5, [m, ion] = flip ? [b, a] : [a, b], reacts = !flip;
    return Q.mc(`Gegeven: E⁰(${a[1]}/${a[0]}) = ${(a[3] >= 0 ? '+' : '−') + nl(Math.abs(a[3]), 2)} V en E⁰(${b[1]}/${b[0]}) = ${(b[3] >= 0 ? '+' : '−') + nl(Math.abs(b[3]), 2)} V. Je doet een staafje ${m[0]} in een oplossing met ${ion[1]}-ionen. Treedt er een reactie op?`, reacts ? 'Ja, de metaalstaaf lost op' : 'Nee, er treedt geen reactie op', [reacts ? 'Nee, er treedt geen reactie op' : 'Ja, de metaalstaaf lost op', 'Ja, maar alleen bij verhitten', 'Dat is niet te zeggen'], 'Een metaal reageert met ionen van een metaal met een hogere (meer positieve) E⁰.', `${m[0]} heeft E⁰ = ${nl(m[3], 2)} V en ${ion[0]} heeft E⁰ = ${nl(ion[3], 2)} V. ${reacts ? 'De oxidator (' + ion[1] + ') is sterker dan ' + m[1] + ', dus ' + m[0] + ' reageert.' : 'Het metaal is edeler dan ' + ion[0] + ', dus er gebeurt niets.'}`); },
  () => { const [a, b] = twoMet(), E = b[3] - a[3];
    return Q.num(`Een galvanische cel bestaat uit ${a[0]} in ${a[1]}-oplossing en ${b[0]} in ${b[1]}-oplossing. Gegeven: E⁰(${a[1]}/${a[0]}) = ${nl(a[3], 2)} V en E⁰(${b[1]}/${b[0]}) = ${nl(b[3], 2)} V. Wat is de standaard-celspanning?`, 'V', E, { abs: 0.03, hint: 'E⁰(cel) = E⁰(oxidator) − E⁰(reductor).', explain: `De oxidator is ${b[1]} (${nl(b[3], 2)} V), de reductor is ${a[0]} (${nl(a[3], 2)} V). E⁰ = ${nl(b[3], 2)} − (${nl(a[3], 2)}) = ${nl(E, 2)} V.` }); },
  () => { const m = rnd(MET.filter(x => ['Zn', 'Mg', 'Al', 'Fe', 'Cu'].includes(x[0]))), ne = rf(0.05, 1.5, 2), n = ne / m[2], mass = n * EMASS(m[0]);
    return Q.num(`In een batterij stromen ${nl(ne, 2)} mol elektronen door de draad. Bij de negatieve elektrode verloopt ${halfOx(m)}. Hoeveel gram ${m[0]} lost op?`, 'g', mass, { hint: 'Uit de halfreactie: 1 mol metaal levert z mol e⁻.', explain: `n(${m[0]}) = ${nl(ne, 2)} / ${m[2]} = ${sig(n)} mol. m = n × M = ${sig(n)} × ${nl(EMASS(m[0]), 2)} = ${sig(mass)} g.` }); },
  () => { const m = rnd(MET.filter(x => ['Cu', 'Ag', 'Ni'].includes(x[0]))), I = rf(0.5, 5, 1), t = ri(10, 120), mass = I * t * 60 / (m[2] * F_) * EMASS(m[0]);
    return Q.num(`Bij elektrolyse slaat ${m[0]} neer volgens ${halfRed(m)}. De stroomsterkte is ${nl(I, 1)} A en de duur ${t} minuten. Hoeveel gram ${m[0]} slaat neer? Gebruik F = 9,65·10⁴ C/mol e⁻.`, 'g', mass, { hint: 'Q = I × t (in seconden), n(e⁻) = Q / F, dan n(metaal) = n(e⁻) / z.', explain: `Q = ${nl(I, 1)} × ${t * 60} = ${sig(I * t * 60)} C. n(e⁻) = Q / F = ${sig(I * t * 60 / F_)} mol. n(${m[0]}) = ${sig(I * t * 60 / F_ / m[2])} mol. m = ${sig(mass)} g.` }); },
  () => { const [rea, pro, co] = rnd(LV === 3 ? REDOXBAL : REDOXBAL.slice(0, 6));
    return Q.bal('Maak deze redoxvergelijking kloppend. Let op: ook de lading moet links en rechts gelijk zijn.', rea, pro, co, 'Eerst de lading, dan de atomen. Bij de laatste vergelijking komt H₂O voor.', `Kloppend: ${co.slice(0, rea.length).map((c, i) => (c > 1 ? c + ' ' : '') + rea[i]).join(' + ')} → ${co.slice(rea.length).map((c, i) => (c > 1 ? c + ' ' : '') + pro[i]).join(' + ')}.`); },
  () => { const gal = Math.random() < .5, el = rnd(gal ? ['negatieve elektrode', 'positieve elektrode'] : ['anode', 'kathode', 'positieve elektrode', 'negatieve elektrode']);
    const oxid = gal ? el === 'negatieve elektrode' : (el === 'anode' || el === 'positieve elektrode');
    return Q.mc(`Welke halfreactie vindt plaats bij de ${el} van een ${gal ? 'galvanische cel (batterij die stroom levert)' : 'elektrolyse-opstelling'}?`, oxid ? 'Oxidatie' : 'Reductie', [oxid ? 'Reductie' : 'Oxidatie', 'Neutralisatie', 'Neerslagvorming zonder elektronenoverdracht'], gal ? 'In een galvanische cel is de negatieve pool de reductor-kant.' : 'Bij elektrolyse is de anode de positieve elektrode.', gal ? 'In een galvanische cel vindt oxidatie plaats bij de negatieve elektrode en reductie bij de positieve.' : 'Bij elektrolyse vindt oxidatie plaats bij de anode (positief) en reductie bij de kathode (negatief).'); },
  () => { const I = rf(0.2, 5, 1), t = ri(5, 90), n = I * t * 60 / F_;
    return Q.num(`Door een draad loopt ${nl(I, 1)} A gedurende ${t} minuten. Hoeveel mol elektronen is dat? Gebruik F = 9,65·10⁴ C/mol. Schrijf bijvoorbeeld 2,5e-3.`, 'mol', n, { tol: 0.03, hint: 'Q = I × t, n(e⁻) = Q / F.', explain: `Q = ${nl(I, 1)} × ${t * 60} = ${sig(I * t * 60)} C. n = Q / F = ${sig(I * t * 60)} / 96500 = ${sci(n, 3)} mol.` }); }
];
/* ---------- Sydney: Lewisstructuren ---------- */
const VAL = { H: 1, C: 4, N: 5, O: 6, F: 7, Cl: 7, Br: 7, S: 6, P: 5, I: 7, B: 3 };
const ELNAAM = { H: 'waterstof', C: 'koolstof', N: 'stikstof', O: 'zuurstof', F: 'fluor', Cl: 'chloor', S: 'zwavel' };
const LEW = {
  'H₂O': { atoms: [{ s: 'O', x: 80, y: 30, lp: [135, 45] }, { s: 'H', x: 36, y: 62, lp: [] }, { s: 'H', x: 124, y: 62, lp: [] }], bonds: [[0, 1, 1], [0, 2, 1]] },
  'H₂S': { atoms: [{ s: 'S', x: 80, y: 30, lp: [135, 45] }, { s: 'H', x: 36, y: 62, lp: [] }, { s: 'H', x: 124, y: 62, lp: [] }], bonds: [[0, 1, 1], [0, 2, 1]] },
  'NH₃': { atoms: [{ s: 'N', x: 80, y: 30, lp: [90] }, { s: 'H', x: 32, y: 62, lp: [] }, { s: 'H', x: 80, y: 70, lp: [] }, { s: 'H', x: 128, y: 62, lp: [] }], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  'CO₂': { atoms: [{ s: 'C', x: 80, y: 40, lp: [] }, { s: 'O', x: 26, y: 40, lp: [90, 270] }, { s: 'O', x: 134, y: 40, lp: [90, 270] }], bonds: [[0, 1, 2], [0, 2, 2]] },
  'N₂': { atoms: [{ s: 'N', x: 48, y: 40, lp: [180] }, { s: 'N', x: 112, y: 40, lp: [0] }], bonds: [[0, 1, 3]] },
  'O₂': { atoms: [{ s: 'O', x: 50, y: 40, lp: [135, 225] }, { s: 'O', x: 110, y: 40, lp: [45, 315] }], bonds: [[0, 1, 2]] },
  'Cl₂': { atoms: [{ s: 'Cl', x: 44, y: 40, lp: [90, 270, 180] }, { s: 'Cl', x: 116, y: 40, lp: [90, 270, 0] }], bonds: [[0, 1, 1]] },
  'HCl': { atoms: [{ s: 'Cl', x: 108, y: 40, lp: [90, 270, 0] }, { s: 'H', x: 48, y: 40, lp: [] }], bonds: [[0, 1, 1]] },
  'HF': { atoms: [{ s: 'F', x: 108, y: 40, lp: [90, 270, 0] }, { s: 'H', x: 48, y: 40, lp: [] }], bonds: [[0, 1, 1]] },
  'CH₄': { atoms: [{ s: 'C', x: 80, y: 40, lp: [] }, { s: 'H', x: 80, y: 11, lp: [] }, { s: 'H', x: 80, y: 69, lp: [] }, { s: 'H', x: 34, y: 40, lp: [] }, { s: 'H', x: 126, y: 40, lp: [] }], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
  'HCN': { atoms: [{ s: 'C', x: 80, y: 40, lp: [] }, { s: 'H', x: 30, y: 40, lp: [] }, { s: 'N', x: 132, y: 40, lp: [0] }], bonds: [[0, 1, 1], [0, 2, 3]] },
  'C₂H₄': { atoms: [{ s: 'C', x: 62, y: 40, lp: [] }, { s: 'C', x: 98, y: 40, lp: [] }, { s: 'H', x: 36, y: 14, lp: [] }, { s: 'H', x: 36, y: 66, lp: [] }, { s: 'H', x: 124, y: 14, lp: [] }, { s: 'H', x: 124, y: 66, lp: [] }], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]] }
};
function lewisSVG(spec) {
  const r = 11; let s = '';
  spec.bonds.forEach(([i, j, o]) => {
    const a = spec.atoms[i], b = spec.atoms[j], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    for (let k = 0; k < o; k++) { const off = (k - (o - 1) / 2) * 4.6; s += `<line x1="${(a.x + ux * r + px * off).toFixed(1)}" y1="${(a.y + uy * r + py * off).toFixed(1)}" x2="${(b.x - ux * r + px * off).toFixed(1)}" y2="${(b.y - uy * r + py * off).toFixed(1)}"/>`; }
  });
  let t = '', d = '';
  spec.atoms.forEach(a => {
    t += `<text x="${a.x}" y="${a.y + 7}" text-anchor="middle">${a.s}</text>`;
    a.lp.forEach(g => { const rad = g * Math.PI / 180, cx = a.x + 18 * Math.cos(rad), cy = a.y - 18 * Math.sin(rad), px = Math.sin(rad) * 3.4, py = Math.cos(rad) * 3.4; d += `<circle cx="${(cx + px).toFixed(1)}" cy="${(cy + py).toFixed(1)}" r="1.9"/><circle cx="${(cx - px).toFixed(1)}" cy="${(cy - py).toFixed(1)}" r="1.9"/>`; });
  });
  return `<svg class="lew" viewBox="0 0 160 80" width="160" height="80" role="img" aria-label="Lewisstructuur"><g stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none">${s}</g><g fill="currentColor" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-size="22" font-weight="700">${t}</g><g fill="currentColor">${d}</g></svg>`;
}
function lewMutate(spec, kind) {
  const c = JSON.parse(JSON.stringify(spec));
  if (kind === 'dropLP') { const a = c.atoms.find(x => x.lp.length); if (!a) return null; a.lp.pop(); return c; }
  if (kind === 'addLP') { const a = c.atoms.find(x => x.lp.length) || c.atoms[0], g = [0, 45, 90, 135, 180, 225, 270, 315].find(v => !a.lp.includes(v)); a.lp.push(g); return c; }
  if (kind === 'bondUp') { const b = c.bonds.find(x => x[2] < 3); if (!b) return null; b[2]++; return c; }
  if (kind === 'bondDown') { const b = c.bonds.find(x => x[2] > 1); if (!b) return null; b[2]--; return c; }
  if (kind === 'lpLast') { const a = c.atoms[c.atoms.length - 1]; a.lp.push(a.lp.includes(270) ? 90 : 270); return c; }
}
const lewCount = (spec, sym) => spec.atoms.filter(a => a.s === sym);
const lewElec = f => { const { el, charge } = parseF(f); let n = 0; for (const e in el) n += el[e] * VAL[e]; return n - charge; };
const POOL_SYD = [
  () => { const f = rnd(['H₂O', 'CO₂', 'NH₃', 'CH₄', 'N₂', 'O₂', 'HCl', 'SO₂', 'NO₃⁻', 'SO₄²⁻', 'NH₄⁺', 'OH⁻', 'CO₃²⁻', 'PO₄³⁻', 'H₃O⁺', 'Cl₂', 'HCN', 'C₂H₄', 'CN⁻', 'H₂S', 'HF', 'NO₂⁻', 'ClO₃⁻'].filter(x => LV === 1 ? !/[⁺⁻]/.test(x) : LV === 3 ? /[⁺⁻]/.test(x) || Math.random() < .3 : true)), n = lewElec(f), { el, charge } = parseF(f);
    const parts = Object.keys(el).map(e => `${el[e]} × ${VAL[e]}`).join(' + ');
    return Q.num(`Hoeveel valentie-elektronen zijn er in totaal beschikbaar voor de Lewisstructuur van ${f}?`, '', n, { hint: 'Tel de valentie-elektronen van alle atomen op. Bij een negatief ion komen er elektronen bij, bij een positief ion gaan er af.', explain: `${parts}${charge ? (charge < 0 ? ' + ' + (-charge) : ' − ' + charge) : ''} = ${n} elektronen.` }); },
  () => { const f = rnd(['H₂O', 'NH₃', 'CO₂', 'N₂', 'O₂', 'HCl', 'HF', 'H₂S', 'Cl₂', 'HCN', 'CH₄']), sp = LEW[f], syms = uniq(sp.atoms.filter(a => a.s !== 'H').map(a => a.s)), sym = rnd(syms), at = lewCount(sp, sym), k = at[0].lp.length;
    if (!at.every(a => a.lp.length === k)) return POOL_SYD[1]();
    return Q.num(`Hoeveel vrije (niet-bindende) elektronenparen heeft ${at.length > 1 ? 'elk' : 'het'} ${ELNAAM[sym]}atoom in ${f}?`, '', k, { hint: 'Elk atoom heeft een octet (waterstof een duet): bindende en vrije elektronenparen samen geven 8 elektronen.', explain: `Rond ${sym} staan ${k} vrije paren en ${sp.bonds.filter(b => sp.atoms[b[0]] === at[0] || sp.atoms[b[1]] === at[0]).reduce((s, b) => s + b[2], 0)} bindende paren: ${2 * k} + ${2 * sp.bonds.filter(b => sp.atoms[b[0]] === at[0] || sp.atoms[b[1]] === at[0]).reduce((s, b) => s + b[2], 0)} = 8 elektronen.` }); },
  () => { const f = rnd(Object.keys(LEW)), sp = LEW[f], k = sp.bonds.reduce((s, b) => s + b[2], 0);
    return Q.num(`Hoeveel bindende elektronenparen heeft een molecuul ${f}? Een dubbele binding telt als 2 paren.`, '', k, { hint: 'Tel de streepjes in de structuurformule. Een dubbele binding is 2 streepjes, een drievoudige 3.', explain: `In de Lewisstructuur van ${f} zitten ${k} bindende elektronenparen.` }); },
  () => { const f = rnd(Object.keys(LEW)), sp = LEW[f], kinds = shuf(['dropLP', 'addLP', 'bondUp', 'bondDown', 'lpLast']), good = lewisSVG(sp), bad = [];
    for (const k of kinds) { const m = lewMutate(sp, k); if (m) { const sv = lewisSVG(m); if (sv !== good && !bad.includes(sv)) bad.push(sv); } if (bad.length === 3) break; }
    return Q.mc(`Welke Lewisstructuur hoort bij ${f}?`, good, bad, 'Tel eerst het totaal aantal valentie-elektronen. Elk atoom wil een octet (waterstof een duet).', `Alleen deze structuur gebruikt precies ${lewElec(f)} elektronen en geeft elk atoom een octet (waterstof een duet).`); },
  () => { const f = rnd(['N₂', 'O₂', 'CO₂', 'Cl₂', 'HCl', 'HCN', 'C₂H₄']), sp = LEW[f], b = rnd(sp.bonds), a1 = sp.atoms[b[0]].s, a2 = sp.atoms[b[1]].s, name = ['enkele', 'dubbele', 'drievoudige'][b[2] - 1];
    const same = a1 === a2;
    return Q.mc(`Wat voor binding zit er tussen ${same ? 'de twee ' + ELNAAM[a1] + 'atomen' : 'het ' + ELNAAM[a1] + 'atoom en het ' + ELNAAM[a2] + 'atoom'} in ${f}?`, 'Een ' + name + ' binding', ['enkele', 'dubbele', 'drievoudige', 'ion'].filter(x => x !== name).map(x => x === 'ion' ? 'Een ionbinding' : 'Een ' + x + ' binding'), 'Kijk naar het aantal gedeelde elektronenparen tussen deze twee atomen.', `In ${f} delen deze atomen ${b[2]} elektronenpaar${b[2] > 1 ? 'en' : ''}: een ${name} binding.`); },
  () => { const h = Math.random() < .35, f = rnd(['H₂O', 'NH₃', 'CH₄', 'HCl', 'H₂S', 'HF']);
    return h ? Q.mc(`Hoeveel elektronen heeft elk waterstofatoom in ${f} om zich heen in de Lewisstructuur (bindende en vrije elektronen samen)?`, '2', ['4', '6', '8'], 'Waterstof streeft naar een duet.', 'Waterstof heeft een duet: 2 elektronen, dus één bindend elektronenpaar.')
      : Q.mc(`Hoeveel elektronen heeft het ${f === 'HCl' ? 'chlooratoom' : f === 'HF' ? 'fluoratoom' : f === 'H₂S' ? 'zwavelatoom' : f === 'NH₃' ? 'stikstofatoom' : f === 'CH₄' ? 'koolstofatoom' : 'zuurstofatoom'} in ${f} om zich heen in de Lewisstructuur (bindende en vrije elektronen samen)?`, '8', ['2', '4', '6', '10'], 'Atomen uit de tweede en derde periode streven naar een octet.', 'Het centrale atoom heeft een octet: 8 elektronen, bindende en vrije samen.'); },
  () => { const dub = Object.keys(LEW).filter(f => LEW[f].bonds.some(b => b[2] === 2)), geen = Object.keys(LEW).filter(f => LEW[f].bonds.every(b => b[2] !== 2)), good = rnd(dub);
    return Q.mc('Welke stof heeft in zijn Lewisstructuur een dubbele binding?', good, shuf(geen).slice(0, 3), 'Teken de Lewisstructuur en let op twee gedeelde paren tussen dezelfde atomen.', `Alleen ${good} heeft een dubbele binding; de andere stoffen hebben enkele of drievoudige bindingen.`); },
  () => { const [f, good] = rnd([['H₂O', 'gebogen'], ['NH₃', 'trigonaal piramidaal'], ['CH₄', 'tetraëder'], ['CO₂', 'lineair']]);
    return Q.mc(`Wat is de ruimtelijke bouw van een molecuul ${f}?`, good, ['gebogen', 'trigonaal piramidaal', 'tetraëder', 'lineair', 'trigonaal vlak'].filter(x => x !== good), 'Tel de bindende en vrije elektronenparen rond het centrale atoom: ze stoten elkaar af.', `${f} heeft rond het centrale atoom een structuur die als ${good} wordt beschreven.`); },
  () => { const e = rnd(PT.filter(x => ['H', 'C', 'N', 'O', 'F', 'S', 'Cl', 'P', 'Na', 'Mg', 'Al', 'Ar', 'Li', 'Si'].includes(x.sym)));
    return Q.num(`Hoeveel valentie-elektronen heeft een atoom ${e.naam} (${e.sym})?`, '', e.val, { hint: 'Kijk naar het groepsnummer in het periodiek systeem.', explain: `${e.naam} staat in groep ${e.col}, dus ${e.val} valentie-elektronen.` }); }
];

/* ---------- Jakarta: atoomeconomie ---------- */
const AEL = RX.filter(r => r.w !== undefined || r.p.length === 1);
const wIdx = r => r.w ?? 0;
const aeOf = r => { const w = r.p[wIdx(r)], tot = r.p.reduce((s, x) => s + x[0] * molM(x[1]), 0); return w[0] * molM(w[1]) / tot * 100; };
const POOL_JKT = [
  () => { const r = pickU(AEL, 'ae'), w = r.p[wIdx(r)], ae = aeOf(r), tot = r.p.reduce((s, x) => s + x[0] * molM(x[1]), 0);
    return Q.num(`${r.d} Vergelijking: ${rxText(r)}. Het gewenste product is ${nameOf(w[1])} (${w[1]}). Bereken de atoomeconomie.`, '%', ae, { tol: 0.015, hint: 'Atoomeconomie = massa van het gewenste product / totale massa van alle producten × 100%, volgens de reactievergelijking.', explain: `Gewenst: ${w[0]} × ${nl(molM(w[1]), 2)} = ${sig(w[0] * molM(w[1]))} g/mol-eq. Alle producten samen: ${sig(tot)}. Atoomeconomie = ${sig(w[0] * molM(w[1]))} / ${sig(tot)} × 100% = ${sig(ae)}%.` }); },
  () => { let a, b; do { a = pickU(AEL, 'ae2'); b = rnd(AEL); } while (a === b || Math.abs(aeOf(a) - aeOf(b)) < 5);
    const hi = aeOf(a) > aeOf(b) ? a : b, lo = hi === a ? b : a, wn = r => nameOf(r.p[wIdx(r)][1]);
    return Q.mc(`Welke reactie heeft de hoogste atoomeconomie?\n(A) ${rxText(a)}, gewenst: ${wn(a)}\n(B) ${rxText(b)}, gewenst: ${wn(b)}`, hi === a ? 'Reactie A' : 'Reactie B', [hi === a ? 'Reactie B' : 'Reactie A', 'Ze hebben dezelfde atoomeconomie', 'Dat kun je niet berekenen'], 'Bereken van beide reacties de atoomeconomie.', `A: ${sig(aeOf(a))}%, B: ${sig(aeOf(b))}%.`); },
  () => { const r = pickU(AEL.filter(x => x.p.length === 2), 'afval'), wi = wIdx(r), o = 1 - wi, w = r.p[wi], x = r.p[o], m = rf(5, 100, 1), waste = m / (w[0] * molM(w[1])) * x[0] * molM(x[1]);
    return Q.num(`${r.d} Vergelijking: ${rxText(r)}. Je wilt ${nl(m, 1)} g ${nameOf(w[1])} (${w[1]}) maken. De andere stof (${x[1]}) is afval. Hoeveel gram ${x[1]} ontstaat er tegelijk?`, 'g', waste, { hint: 'Reken het gewenste product om naar mol en gebruik de molverhouding met het afval.', explain: `n(${w[1]}) = ${nl(m, 1)} / ${nl(molM(w[1]), 2)} = ${sig(m / molM(w[1]))} mol. n(${x[1]}) = n(${w[1]}) × ${x[0]}/${w[0]} = ${sig(m / molM(w[1]) * x[0] / w[0])} mol. m = ${sig(waste)} g.` }); },
  () => Q.mc('Wat betekent een atoomeconomie van 100%?', 'Alle atomen van de beginstoffen zitten in het gewenste product', ['Het rendement van de reactie is 100%', 'Er ontstaat geen warmte', 'De reactie verloopt zonder katalysator'], 'Atoomeconomie gaat over de massa van het gewenste product ten opzichte van alle producten.', 'Bij 100% atoomeconomie is er geen bijproduct: alle atomen van de beginstoffen eindigen in het gewenste product. Het rendement zegt iets anders, namelijk hoeveel je werkelijk maakt ten opzichte van de theorie.'),
  () => { const r = pickU(RX.filter(x => x.r.length >= 1), 'feed'), a = ri(0, r.r.length - 1), wi = wIdx(r), m = rf(5, 200, 1), need = m / (r.p[wi][0] * molM(r.p[wi][1])) * r.r[a][0] * molM(r.r[a][1]);
    return Q.num(`${r.d} Vergelijking: ${rxText(r)}. Hoeveel gram ${nameOf(r.r[a][1])} (${r.r[a][1]}) is minstens nodig om ${nl(m, 1)} g ${nameOf(r.p[wi][1])} (${r.p[wi][1]}) te maken? Neem aan dat de reactie volledig verloopt.`, 'g', need, { hint: 'Reken van product naar beginstof: gram → mol, molverhouding, mol → gram.', explain: `n(${r.p[wi][1]}) = ${nl(m, 1)} / ${nl(molM(r.p[wi][1]), 2)} = ${sig(m / molM(r.p[wi][1]))} mol. n(${r.r[a][1]}) = ${sig(m / molM(r.p[wi][1]) * r.r[a][0] / r.p[wi][0])} mol. m = ${sig(need)} g.` }); },
  () => { const r = pickU(RX.filter(x => x.r.length >= 1), 'rend'), a = ri(0, r.r.length - 1), wi = wIdx(r), m = rf(5, 100, 1), th = stoichMass(r, a, wi, m), act = +(th * rf(0.5, 0.95, 2)).toFixed(1), rend = act / th * 100;
    return Q.num(`${r.d} Vergelijking: ${rxText(r)}. Uit ${nl(m, 1)} g ${nameOf(r.r[a][1])} (${r.r[a][1]}) maak je in de praktijk ${nl(act, 1)} g ${nameOf(r.p[wi][1])} (${r.p[wi][1]}). Wat is het rendement?`, '%', rend, { tol: 0.02, hint: 'Rendement = werkelijke opbrengst / theoretische opbrengst × 100%.', explain: `Theoretisch: ${sig(th)} g. Rendement = ${nl(act, 1)} / ${sig(th)} × 100% = ${sig(rend)}%.` }); },
  () => { const r = pickU(AEL.filter(x => x.p.length > 1), 'afv%'), ae = aeOf(r);
    return Q.num(`Bij ${rxText(r)} is het gewenste product ${nameOf(r.p[wIdx(r)][1])}. Hoeveel procent van de totale productmassa is bijproduct (afval)? Reken met de kloppende vergelijking.`, '%', 100 - ae, { abs: 1.2, hint: 'Afval = 100% − atoomeconomie.', explain: `Atoomeconomie = ${sig(ae)}%, dus afval = 100% − ${sig(ae)}% = ${sig(100 - ae)}%.` }); },
  () => Q.mc('Welke maatregel verhoogt de atoomeconomie van een productieproces?', 'Een andere reactieroute kiezen waarbij minder bijproducten ontstaan', ['Meer katalysator toevoegen', 'De temperatuur verhogen', 'De reactie langer laten verlopen'], 'Atoomeconomie hangt alleen af van de reactievergelijking.', 'De atoomeconomie volgt uit de reactievergelijking en verandert niet door katalysator, temperatuur of reactietijd. Alleen een andere route met minder bijproducten helpt.'),
  () => { const r = RX.filter(x => x.p.length === 1)[ri(0, RX.filter(x => x.p.length === 1).length - 1)];
    return Q.mc(`Wat is de atoomeconomie van ${rxText(r)}?`, '100%', ['50%', '75%', 'Dat hangt af van de hoeveelheid beginstof'], 'Hoeveel producten ontstaan er?', 'Er ontstaat maar één product, dus alle atomen van de beginstoffen zitten erin: 100%.'); }
];

/* ---------- İstanbul: naamgeving ---------- */
const ANGRP = [['sulfaat', 'sulfiet', 'sulfide'], ['nitraat', 'nitriet'], ['carbonaat', 'waterstofcarbonaat'], ['oxide', 'hydroxide'], ['fluoride', 'chloride', 'bromide', 'jodide']];
const ACIDS = [['zoutzuur', 'HCl'], ['salpeterzuur', 'HNO₃'], ['zwavelzuur', 'H₂SO₄'], ['fosforzuur', 'H₃PO₄'], ['koolzuur', 'H₂CO₃'], ['azijnzuur', 'CH₃COOH'], ['salpeterigzuur', 'HNO₂'], ['waterstoffluoride', 'HF']];
const COVAL = [['CO', 'koolstofmono-oxide'], ['CO₂', 'koolstofdioxide'], ['SO₂', 'zwaveldioxide'], ['SO₃', 'zwaveltrioxide'], ['N₂O', 'distikstofmono-oxide'], ['NO₂', 'stikstofdioxide'], ['N₂O₄', 'distikstoftetra-oxide'], ['N₂O₅', 'distikstofpenta-oxide'], ['PCl₃', 'fosfortrichloride'], ['PCl₅', 'fosforpentachloride'], ['SF₆', 'zwavelhexafluoride'], ['P₄O₁₀', 'tetrafosfordeca-oxide']];
const POOL_IST = [
  () => { const s = randSalt(), grp = ANGRP.find(g => g.includes(s.a.n)) || [], sim = ANI.filter(a => a !== s.a && grp.includes(a.n)), other = shuf(ANI.filter(a => a !== s.a && !grp.includes(a.n)));
    const bad = [...sim, ...other].slice(0, 3).map(a => saltName(s.c, a));
    return Q.mc(`Hoe heet ${s.f}?`, s.n, bad, 'Het kation krijgt de naam van het metaal (met een Romeins cijfer als de lading wisselt), het anion de naam van het negatieve ion.', `${s.f} bestaat uit ${s.c.n}-ionen en ${s.a.n}-ionen: ${s.n}.`); },
  () => { const s = randSalt(), pairs = [[1, 1], [2, 1], [1, 2], [2, 3], [3, 2], [1, 3], [3, 1]].filter(([x, y]) => !(x === s.x && y === s.y)), bad = uniqRatio(shuf(pairs).map(([x, y]) => saltFormula(s.c, s.a, x, y)), s.f).slice(0, 3);
    return Q.mc(`Wat is de formule van ${s.n}?`, s.f, bad, 'Zoek de ionformules op in Binas en maak de totale lading nul.', `${s.c.n}: ${ionS(s.c.f, s.c.c)}; ${s.a.n}: ${ionS(s.a.f, -s.a.c)}. Verhouding ${s.x} : ${s.y}, dus ${s.f}.`); },
  () => { const s = randSalt(), opts = ['1+', '2+', '3+', '4+'];
    return Q.mc(`Wat is de lading van het metaalion (of ammonium) in ${s.n}?`, s.c.c + '+', opts.filter(o => o !== s.c.c + '+'), 'Het zout is neutraal. Gebruik de lading van het negatieve ion en de formule.', `In ${s.f} is de lading van het kation ${s.c.c}+ (het Romeinse cijfer of de bekende ionlading geeft dit aan).`); },
  () => { const s = randSpec(['alkaan', 'alkeen', 'alkyn', 'alkanol', 'zuur', 'halogeen']), good = orgName(s), bad = shuf(uniq(specVariants(s).map(orgName).filter(x => x !== good))).slice(0, 3);
    return Q.mc(`Hoe heet ${orgStruct(s)}?`, good, bad, 'Zoek de langste keten, de functionele groep en het nummer van de koolstof waaraan die zit (laagste nummer).', `${orgStruct(s)} heeft ${s.n} koolstofatom${s.n > 1 ? 'en' : ''} en is een ${FAM[s.t]}: ${good}.`); },
  () => { const s = randSpec(['alkaan', 'alkeen', 'alkyn', 'alkanol', 'zuur', 'halogeen']), good = orgStruct(s), bad = shuf(uniq(specVariants(s).map(orgStruct).filter(x => x !== good))).slice(0, 3);
    return Q.mc(`Welke structuurformule hoort bij ${orgName(s)}?`, good, bad, 'Splits de naam: de stam geeft het aantal C-atomen, het achtervoegsel de groep.', `${orgName(s)}: ${good}.`); },
  () => { const [n, f] = rnd(ACIDS), toName = Math.random() < .5;
    return toName ? Q.mc(`Hoe heet het zuur ${f}?`, n, shuf(ACIDS.filter(x => x[0] !== n)).slice(0, 3).map(x => x[0]), 'Leer de namen van de gewone zuren uit Binas.', `${f} heet ${n}.`)
      : Q.mc(`Wat is de formule van ${n}?`, f, shuf(ACIDS.filter(x => x[1] !== f)).slice(0, 3).map(x => x[1]), 'Leer de formules van de gewone zuren uit Binas.', `${n} heeft formule ${f}.`); },
  () => { const [f, n] = rnd(COVAL), toName = Math.random() < .5;
    return toName ? Q.mc(`Hoe heet ${f}?`, n, shuf(COVAL.filter(x => x[0] !== f)).slice(0, 3).map(x => x[1]), 'Gebruik Griekse telwoorden: mono, di, tri, tetra, penta, hexa.', `${f} heet ${n}.`)
      : Q.mc(`Wat is de formule van ${n}?`, f, shuf(COVAL.filter(x => x[0] !== f)).slice(0, 3).map(x => x[0]), 'De telwoorden geven het aantal atomen aan.', `${n} heeft formule ${f}.`); },
  () => { const all = [...CAT.filter(c => c.c > 0).map(c => ({ n: c.n + '-ion', f: ionS(c.f, c.c) })), ...ANI.map(a => ({ n: a.n + '-ion', f: ionS(a.f, -a.c) }))], x = rnd(all);
    return Q.mc(`Wat is de formule van het ${x.n}?`, x.f, shuf(all.filter(y => y.f !== x.f)).slice(0, 3).map(y => y.f), 'Let op de lading van het ion.', `Het ${x.n} is ${x.f}.`); },
  () => { const s = randSpec(['alkaan', 'alkeen', 'alkyn', 'alkanol', 'zuur', 'halogeen']), good = orgFormula(s), bad = uniq(specVariants(s).map(orgFormula).filter(x => x !== good));
    if (bad.length < 3) return POOL_IST[0]();
    return Q.mc(`Wat is de molecuulformule van ${orgName(s)}?`, good, shuf(bad).slice(0, 3), 'Teken de structuurformule en tel de C-, H- en overige atomen.', `${orgName(s)} (${orgStruct(s)}) heeft molecuulformule ${good}.`); }
];
/* ============================================================
   STEDEN (afleveringen). Voeg hier een stad toe met een eigen pool.
   lon/lat bepalen de plek op de kaart; art verwijst naar SCENES.
   ============================================================ */
const EP = [
  { code: 'AMS', lv: { 1: [0, 1, 8, 9, 13, 10], 2: [2, 3, 4, 5, 6, 9, 12], 3: [2, 3, 5, 6, 7, 10, 11, 12, 4] }, city: 'Amsterdam', land: 'Nederland', lon: 4.9, lat: 52.4, color: '#FF8A3D', label: { dx: 0, dy: -14, a: 'middle' }, art: 'ams', title: 'Molrekenen',
    blurb: 'Je reis begint in Amsterdam. Aan boord komt alleen wie kan rekenen met mol, massa en concentratie.', pool: POOL_AMS },
  { code: 'JFK', lv: { 1: [0, 1, 3, 4, 5, 7], 2: [0, 1, 2, 3, 5, 6, 7], 3: [0, 1, 2, 3, 4, 6] }, city: 'New York', land: 'Verenigde Staten', lon: -74.0, lat: 40.7, color: '#5EA8FF', label: { dx: -12, dy: 5, a: 'end' }, art: 'ny', title: 'Zouten en reactievergelijkingen',
    blurb: 'Het Vrijheidsbeeld is van koper en kreeg een groene laag door reacties met de lucht. Kun jij de vergelijkingen kloppend maken?', pool: POOL_NY },
  { code: 'GIG', lv: { 1: [0, 1, 4, 5, 6, 8], 2: [1, 2, 3, 4, 5, 7, 8], 3: [1, 2, 3, 4, 7, 8] }, city: 'Rio de Janeiro', land: 'Brazilië', lon: -43.2, lat: -22.9, color: '#3DDC97', label: { dx: 12, dy: 5, a: 'start' }, art: 'rio', title: 'Organische chemie',
    blurb: `Braziliaanse auto's rijden op ethanol uit suikerriet. Tijd voor namen, isomeren en verbranding.`, pool: POOL_RIO },
  { code: 'CAI', lv: { 1: [0, 1, 2, 3, 9, 10], 2: [1, 2, 3, 4, 5, 6, 10], 3: [4, 5, 6, 7, 8, 2] }, city: 'Caïro', land: 'Egypte', lon: 31.2, lat: 30.0, color: '#FFC857', label: { dx: 0, dy: 24, a: 'middle' }, art: 'cairo', title: 'Zuren en basen',
    blurb: 'De Egyptenaren gebruikten natron, een basisch zout, bij het balsemen. Jij rekent aan pH en titraties.', pool: POOL_CAI },
  { code: 'IST', lv: { 1: [0, 1, 2, 5, 7, 6], 2: [0, 1, 3, 4, 5, 6, 8], 3: [0, 1, 3, 4, 6, 8] }, city: 'Istanbul', land: 'Turkije', lon: 28.98, lat: 41.0, color: '#FF5D5D', label: { dx: 11, dy: 4, a: 'start' }, art: 'ist', title: 'Naamgeving',
    blurb: 'Turkije heeft de grootste voorraden boor ter wereld, bijvoorbeeld in het zout boraks. Maar hoe heet zo’n stof eigenlijk? Oefen namen en formules van zouten en koolstofverbindingen.', pool: POOL_IST },
  { code: 'BOM', lv: { 1: [0, 4, 5, 6, 7, 1], 2: [0, 1, 2, 4, 5, 6, 8], 3: [1, 2, 3, 8, 0, 5] }, city: 'Mumbai', land: 'India', lon: 72.9, lat: 19.1, color: '#FF7A9C', label: { dx: 0, dy: 24, a: 'middle' }, art: 'mumbai', title: 'Chemisch evenwicht',
    blurb: 'India gebruikt enorme hoeveelheden kunstmest. Die begint met ammoniak uit het Haber-Bosch-proces, een evenwichtsreactie.', pool: POOL_BOM },
  { code: 'CGK', lv: { 1: [0, 3, 7, 8, 6, 2], 2: [0, 1, 2, 4, 5, 6], 3: [1, 2, 4, 5, 6, 0] }, city: 'Jakarta', land: 'Indonesië', lon: 106.8, lat: -6.2, color: '#D9E24F', label: { dx: 12, dy: 5, a: 'start' }, art: 'cgk', title: 'Atoomeconomie',
    blurb: 'Indonesië maakt biodiesel van palmolie. Hoeveel van de beginstoffen eindigt in het product en hoeveel wordt afval? Dat meet je met de atoomeconomie.', pool: POOL_JKT },
  { code: 'SYD', lv: { 1: [8, 0, 2, 4, 6, 5], 2: [0, 1, 2, 3, 4, 6, 7], 3: [0, 1, 3, 5, 7, 2] }, city: 'Sydney', land: 'Australië', lon: 151.2, lat: -33.9, color: '#2DD4BF', label: { dx: -12, dy: 5, a: 'end' }, art: 'syd', title: 'Lewisstructuren',
    blurb: 'Het koraal van het Great Barrier Reef bestaat uit calciumcarbonaat en lost op in een zuurder wordende oceaan door opgelost CO₂. Teken en tel elektronen om te snappen hoe zulke moleculen in elkaar zitten.', pool: POOL_SYD },
  { code: 'HND', lv: { 1: [0, 1, 7, 2, 3, 4], 2: [1, 2, 3, 4, 6, 7, 8], 3: [2, 3, 5, 6, 8, 4] }, city: 'Tokyo', land: 'Japan', lon: 139.7, lat: 35.7, color: '#B79BFF', label: { dx: 12, dy: 5, a: 'start' }, art: 'tokyo', title: 'Redox en batterijen',
    blurb: 'In Japan is de lithium-ionaccu mede ontwikkeld, de batterij in je telefoon. Oxidatie, reductie en elektronen.', pool: POOL_HND }
];
/* ============ KAARTDATA (vlakke polygonen, lon/lat-paren) ============ */
const LAND = [
  // Noord-Amerika
  [-168,66,-162,70,-156,71,-141,70,-128,70,-115,68,-100,68,-95,68,-85,69,-82,66,-88,64,-93,61,-94,58,-90,57,-82,55,-80,52,-79,57,-77,62,-72,62,-65,60,-62,57,-56,52,-60,50,-65,49,-65,45,-70,43,-70,41,-74,40,-76,37,-76,35,-81,31,-80,26,-82,26,-83,29,-85,30,-89,30,-94,29,-97,27,-97,22,-95,19,-91,19,-90,21,-87,21,-88,16,-84,15,-83,10,-79,9,-77,8,-80,7,-83,8,-86,11,-88,13,-92,14,-96,16,-100,17,-105,20,-109,26,-113,31,-117,32,-121,35,-124,40,-124,47,-128,51,-133,55,-140,60,-148,60,-152,58,-158,57,-164,55,-162,59,-166,62,-165,64],
  [-80,73,-68,70,-62,66,-70,62,-78,65,-85,70],
  [-118,72,-105,73,-101,69,-115,69],
  [-90,81,-65,82,-62,80,-75,77,-90,76],
  [-73,78,-60,82,-30,83,-20,80,-20,72,-24,69,-40,65,-44,60,-50,62,-54,67,-58,75],
  [-24,65,-14,66,-14,64,-22,63.5],
  [-85,22,-80,23,-74,20,-77,20],
  [-74,19,-69,19,-69,18,-74,18],
  // Zuid-Amerika
  [-77,8,-72,12,-64,10,-60,8,-52,5,-50,0,-44,-2,-35,-5,-35,-9,-39,-15,-41,-22,-48,-26,-49,-30,-53,-34,-58,-35,-57,-38,-62,-39,-65,-42,-66,-47,-69,-52,-68,-55,-72,-53,-75,-48,-73,-40,-72,-30,-70,-18,-76,-14,-81,-6,-80,-1,-78,2],
  // Eurazie
  [-9,37,-9,43,-2,43.5,-1,46,-4,48,2,51,4,52,8,54,8.5,57,10.5,57.7,10,55,12,54,18,54.5,21,57,24,59.5,30,60,23,60,21,63,25,65.5,22,66,17,62,19,60,16,56,12,56,11,59,6,58,5,62,14,67,20,70,28,71,33,69,41,67,44,68,56,68,68,69,73,72,80,73,90,75,105,77,113,74,130,71,140,72,160,70,170,69,180,68,180,65,176,64,170,60,164,60,163,57,160,54,156,51,155,56,157,59,153,59,142,59,137,54,141,53,140,48,135,43,131,43,129,40,129,35,126,35,126,38,125,40,121,40,122,37,119,37,122,31,121,28,117,23,110,21,108,22,106,18,109,12,105,9,103,10,100,13,100,8,103,2,101,3,98,8,98,16,94,17,92,22,88,22,86,20,80,15,80,10,77,8,73,17,72,21,67,24,62,25,57,26,56,27,51,28,48,30,50,26,51,24,56,25,59,22,55,17,44,13,43,16,39,22,35,28,34,31,36,36,30,36,27,37,26,40,24,40.5,23,38,22,36.5,21,38,19.5,40,19,42,13.5,45.5,12.3,44.5,14,42,16,41.5,18.5,40,16.5,39,16,38,15.6,40,12,42,10,44,8,44,6,43,3,43.2,3,42,0,39,-1,37,-5,36],
  [-5,50,1,51,2,53,-2,56,-3,58.5,-6,58,-5,55,-3,54,-5,52],
  [-10,52,-6,52,-6,55,-10,54],
  [130,31,132,33,135,33.5,137,34.5,140,35,141,38,142,40,141,41,139.5,39,137,37,135,35.7,133,35.5,131,34.5,130,33.5],
  [140,42,141,45.5,145,44,143,42],
  [142,46,143,54,142,54,141,49],
  [120,14,120,18,122,18,122,14],
  [122,7,126,8,126,6,123,6],
  [95,5,98,4,104,-2,106,-6,101,-3,97,1],
  [105,-6,114,-8,114,-7,106,-6],
  [109,1,117,7,119,1,116,-4,110,-3],
  [131,-1,141,-3,150,-10,141,-9,134,-4],
  [80,6,82,8,80,9.5],
  // Afrika
  [32,31,33,27,37,22,39,16,43,12,51,12,48,5,41,-2,39,-6,40,-11,41,-15,35,-20,35,-24,32,-26,33,-28,30,-31,27,-34,20,-35,18,-32,15,-27,12,-18,13,-12,12,-5,9,3,9,4,5,6,-2,5,-8,4,-13,8,-17,14,-17,21,-13,28,-9,32,-6,36,10,37,11,33,20,31,25,32],
  [44,-25,47,-25,50,-15,49,-12,44,-17],
  // Oceanie
  [114,-22,122,-18,129,-15,131,-12,137,-12,136,-15,140,-17,142,-11,146,-19,153,-26,151,-34,147,-39,141,-38,138,-35,135,-35,131,-31,124,-34,115,-34],
  [144,-41,148,-41,147,-43.5],
  [173,-35,178,-38,175,-41.5,174,-39],
  [172,-41,174,-42,170,-46,167,-46,171,-43]
];
const WATER = [
  [47,45,53,47,54,41,53,37,49,37,50,40],
  [28,41.5,28,44,30,46,34,46,37,45,41,42,36,41.5,31,41]
];
/* ============================================================
   STADSACHTERGRONDEN (SVG, 1000 x 340). Landmarks staan rechts, want op een
   smal scherm wordt de linkerkant afgesneden. Elke scene is een functie
   die SVG-markup teruggeeft; de kleur is de themakleur van de stad.
   ============================================================ */
const rngf = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
const lingrad = (id, stops, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const starfield = (n, seed, ymax) => {
  const r = rngf(seed); let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${(r() * 1000).toFixed(0)}" cy="${(r() * ymax).toFixed(0)}" r="${(.5 + r() * 1.1).toFixed(1)}" opacity="${(.3 + r() * .6).toFixed(2)}"/>`;
  return `<g fill="#fff">${s}</g>`;
};
const litgrid = (x, y, w, h, o = {}) => {
  const r = rngf(o.seed || 11), sx = o.sx || 8, sy = o.sy || 10; let s = '';
  for (let yy = y + 6; yy < y + h - 4; yy += sy) for (let xx = x + 4; xx < x + w - 5; xx += sx) if (r() < (o.p ?? .5)) s += `<rect x="${xx.toFixed(1)}" y="${yy}" width="${o.w || 3}" height="${o.h || 4}"/>`;
  return `<g fill="${o.c || '#FFD27A'}" fill-opacity="${o.o ?? .85}">${s}</g>`;
};
const SCENES = {};

/* ---------- Amsterdam: grachtenpanden bij zonsondergang ---------- */
SCENES.ams = () => {
  const r = rngf(5);
  const house = (x, w, h, c, t) => {
    const y = 270 - h; let g;
    if (t === 'step') g = `M${x} ${y}V${y - 6}H${x + w * .14}V${y - 12}H${x + w * .28}V${y - 18}H${x + w * .4}V${y - 24}H${x + w * .6}V${y - 18}H${x + w * .72}V${y - 12}H${x + w * .86}V${y - 6}H${x + w}V${y}Z`;
    else if (t === 'bell') g = `M${x} ${y}V${y - 8}Q${x + w * .1} ${y - 8} ${x + w * .2} ${y - 18}Q${x + w * .3} ${y - 30} ${x + w * .5} ${y - 30}Q${x + w * .7} ${y - 30} ${x + w * .8} ${y - 18}Q${x + w * .9} ${y - 8} ${x + w} ${y - 8}V${y}Z`;
    else if (t === 'tri') g = `M${x} ${y}L${x + w * .5} ${y - 26}L${x + w} ${y}Z`;
    else g = `M${x} ${y}V${y - 5}H${x + w}V${y}Z`;
    const cols = w > 50 ? 3 : 2, ww = 6, gap = (w - cols * ww) / (cols + 1); let win = '';
    for (let row = 0; row < Math.floor((h - 18) / 30); row++) for (let k = 0; k < cols; k++) {
      const lit = r() < .6;
      win += `<rect x="${(x + gap + k * (ww + gap)).toFixed(1)}" y="${y + 10 + row * 30}" width="${ww}" height="15" rx="1" fill="${lit ? '#FFD27A' : '#141B30'}" fill-opacity="${lit ? .9 : .7}"/>`;
    }
    return `<path d="${g}" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>${win}`;
  };
  const pal = ['#4A2A33', '#2F2F4F', '#5A3430', '#35294A', '#4B2D3A', '#2D3550', '#563036', '#33284A'], ty = ['step', 'bell', 'tri', 'flat'];
  let far = '', x = -10;
  while (x < 410) { const w = 42 + Math.floor(r() * 20), h = 80 + Math.floor(r() * 60); far += house(x, w, h, pal[Math.floor(r() * pal.length)], ty[Math.floor(r() * 4)]); x += w + 2; }
  let near = '', ox = 414;
  [[52, 120, 0, 'step'], [44, 150, 1, 'bell'], [56, 132, 2, 'tri'], [46, 170, 3, 'step'], [58, 126, 4, 'bell'], [44, 158, 5, 'tri'], [54, 138, 6, 'step'], [48, 178, 7, 'bell'], [42, 130, 0, 'flat']].forEach(([w, h, c, t]) => { near += house(ox, w, h, pal[c], t); ox += w + 2; });
  // Westertoren-achtige kerktoren
  const tower = `<rect x="930" y="92" width="34" height="178" fill="#4E2C33"/><rect x="926" y="86" width="42" height="8" fill="#5E3639"/><rect x="934" y="62" width="26" height="26" fill="#4A2A30"/><rect x="938" y="66" width="5" height="14" fill="#FFD27A" fill-opacity=".8"/><rect x="951" y="66" width="5" height="14" fill="#FFD27A" fill-opacity=".8"/><circle cx="947" cy="116" r="8" fill="#FFE29A"/><path d="M947 116V110M947 116L952 118" stroke="#4E2C33" stroke-width="1.5"/><path d="M936 62H958L956 52H938Z" fill="#6A3E3B"/><path d="M941 52V40H953V52Z" fill="#5E3639"/><path d="M947 40L947 14" stroke="#6A3E3B" stroke-width="2"/><circle cx="947" cy="12" r="3" fill="#FFD27A"/>`;
  let ripples = ''; for (let i = 0; i < 26; i++) { const rx = r() * 1000, ry = 276 + r() * 58; ripples += `M${rx.toFixed(0)} ${ry.toFixed(0)}h${(14 + r() * 36).toFixed(0)}`; }
  return `<defs>${lingrad('amsSky', [[0, '#10263B'], [.5, '#4A3A66'], [.82, '#E8744A'], [1, '#FFB36B']])}${lingrad('amsWater', [[0, '#5B3A55'], [.3, '#1B2A44'], [1, '#0A1420']])}<clipPath id="amsClip"><rect x="0" y="270" width="1000" height="70"/></clipPath></defs>
  <rect width="1000" height="340" fill="url(#amsSky)"/>${starfield(36, 3, 110)}
  <circle cx="700" cy="262" r="52" fill="#FFD27A" fill-opacity=".92"/><circle cx="700" cy="262" r="86" fill="#FFB36B" fill-opacity=".18"/>
  <g fill="#FF9A8A" fill-opacity=".35"><ellipse cx="300" cy="190" rx="120" ry="9"/><ellipse cx="560" cy="150" rx="100" ry="7"/><ellipse cx="860" cy="205" rx="90" ry="8"/></g>
  <g id="amsRow"><g opacity=".78">${far}</g>${near}${tower}</g>
  <rect y="270" width="1000" height="70" fill="url(#amsWater)"/>
  <g clip-path="url(#amsClip)"><use href="#amsRow" transform="translate(0 540) scale(1 -1)" opacity=".26"/></g>
  <path d="${ripples}" stroke="#FFD27A" stroke-opacity=".16" stroke-width="1.5" fill="none"/>
  <rect y="268" width="1000" height="4" fill="#0E1626"/>`;
};

/* ---------- New York: skyline, Empire State, One WTC en Vrijheidsbeeld ---------- */
SCENES.ny = () => {
  const r = rngf(9);
  let far = '', x = -10;
  while (x < 1000) { const w = 26 + Math.floor(r() * 30), h = 60 + Math.floor(r() * 120); far += `<rect x="${x}" y="${285 - h}" width="${w}" height="${h}" fill="#1B3358"/>${litgrid(x, 285 - h, w, h, { seed: x + 3, p: .28, c: '#9CC3F2', o: .55, sy: 12 })}`; x += w + 3; }
  let near = ''; x = -6;
  while (x < 1000) { if (x > 640 && x < 880) { x += 14; continue; } const w = 30 + Math.floor(r() * 38), h = 70 + Math.floor(r() * 110); near += `<rect x="${x}" y="${285 - h}" width="${w}" height="${h}" fill="#0B1730"/>${litgrid(x, 285 - h, w, h, { seed: x + 9, p: .5 })}`; x += w + 4; }
  const esb = `<g fill="#0B1730"><rect x="672" y="140" width="76" height="145"/><rect x="684" y="108" width="52" height="34"/><rect x="694" y="84" width="32" height="26"/><rect x="702" y="66" width="16" height="20"/><rect x="708" y="40" width="4" height="28"/></g><g fill="#FFD27A" fill-opacity=".85"><rect x="682" y="140" width="56" height="2"/><rect x="692" y="108" width="36" height="2"/><rect x="700" y="84" width="20" height="2"/><rect x="706" y="66" width="8" height="2"/></g>${litgrid(672, 146, 76, 139, { seed: 4, p: .45 })}<circle cx="710" cy="38" r="2.6" fill="#FF6B6B"/>`;
  const wtc = `<path d="M800 285V120L817 86L834 120V285Z" fill="#0F1D38"/><path d="M817 86V20" stroke="#0F1D38" stroke-width="3"/><circle cx="817" cy="18" r="2.6" fill="#FF6B6B"/><path d="M817 86L800 120V285H817Z" fill="#1A2D4F"/>${litgrid(800, 124, 34, 160, { seed: 21, p: .35, c: '#BFE0FF', o: .6, sx: 7 })}`;
  const statue = `<g transform="translate(925 285)"><ellipse cx="0" cy="2" rx="46" ry="9" fill="#0A1222"/><path d="M-20 0L-14 -16H14L20 0Z" fill="#101F3A"/><rect x="-11" y="-42" width="22" height="26" fill="#14284A"/><path d="M-9 -42L-12 -86L-6 -98H6L12 -86L9 -42Z" fill="#1B3A5E"/><circle cx="0" cy="-104" r="6.5" fill="#1B3A5E"/><g stroke="#1B3A5E" stroke-width="2"><path d="M0 -110L0 -118M-5 -108L-9 -115M5 -108L9 -115M-7 -104L-14 -108M7 -104L14 -108"/></g><path d="M6 -92L15 -128" stroke="#1B3A5E" stroke-width="4.5" stroke-linecap="round"/><rect x="11" y="-136" width="8" height="8" fill="#243F66"/><path d="M15 -137Q9 -146 15 -154Q21 -146 15 -137Z" fill="#FFD27A"/><rect x="-14" y="-84" width="9" height="13" fill="#243F66" transform="rotate(-8 -9 -78)"/></g>`;
  let refl = ''; const rr = rngf(77); for (let i = 0; i < 46; i++) { const rx = rr() * 1000, ry = 290 + rr() * 46; refl += `M${rx.toFixed(0)} ${ry.toFixed(0)}v${(3 + rr() * 6).toFixed(0)}`; }
  return `<defs>${lingrad('nySky', [[0, '#071225'], [.55, '#173A66'], [1, '#4A82B8']])}${lingrad('nyWater', [[0, '#1E4468'], [.35, '#0D2038'], [1, '#050C18']])}</defs>
  <rect width="1000" height="340" fill="url(#nySky)"/>${starfield(50, 14, 150)}
  <circle cx="540" cy="70" r="22" fill="#EAF1F6" fill-opacity=".92"/><circle cx="548" cy="64" r="22" fill="#173A66" fill-opacity=".55"/>
  ${far}${near}${esb}${wtc}
  <rect y="285" width="1000" height="55" fill="url(#nyWater)"/>
  <path d="${refl}" stroke="#FFD27A" stroke-opacity=".45" stroke-width="2.2" fill="none"/>
  ${statue}`;
};
/* ---------- Rio de Janeiro: Suikerbroodberg, Corcovado en Copacabana ---------- */
SCENES.rio = () => {
  const r = rngf(31);
  let city = '', x = 0;
  while (x < 560) { const w = 18 + Math.floor(r() * 22), h = 20 + Math.floor(r() * 56); city += `<rect x="${x}" y="${285 - h}" width="${w}" height="${h}" fill="#2A1A47"/>${litgrid(x, 285 - h, w, h, { seed: x + 2, p: .45, sx: 7, sy: 9 })}`; x += w + 2; }
  let lamps = ''; for (let t = 0; t <= 1; t += .045) { const px = 20 + t * 520, py = 285 - Math.sin(t * Math.PI) * 14; lamps += `<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="1.8"/>`; }
  let waves = ''; for (let i = 0; i < 22; i++) { const wx = r() * 1000, wy = 292 + r() * 44; waves += `M${wx.toFixed(0)} ${wy.toFixed(0)}q6 -4 12 0t12 0`; }
  const palm = (px, py, s) => `<g transform="translate(${px} ${py}) scale(${s})" stroke="#150E2B" fill="none" stroke-linecap="round"><path d="M0 0Q4 -30 -2 -62" stroke-width="3.4"/><path d="M-2 -62Q-22 -64 -34 -50M-2 -62Q-14 -78 -30 -76M-2 -62Q6 -80 22 -78M-2 -62Q22 -62 34 -48M-2 -62Q-2 -76 4 -86" stroke-width="2.6"/></g>`;
  return `<defs>${lingrad('rioSky', [[0, '#18173F'], [.45, '#6B2F6B'], [.8, '#FF7A59'], [1, '#FFC77A']])}${lingrad('rioSea', [[0, '#E56A63'], [.25, '#4B2B63'], [1, '#120E2B']])}</defs>
  <rect width="1000" height="340" fill="url(#rioSky)"/>${starfield(28, 6, 100)}
  <circle cx="500" cy="270" r="64" fill="#FFD27A" fill-opacity=".9"/>
  <path d="M0 285V230C60 210 120 235 190 222C260 210 330 240 400 226C470 214 520 240 560 285Z" fill="#3A2160"/>
  <path d="M570 285C575 232 610 176 655 172C705 170 748 214 762 285Z" fill="#2B1B52"/>
  <path d="M498 285C502 248 530 218 558 216C586 216 606 244 612 285Z" fill="#33205A"/>
  <path d="M655 172L553 216" stroke="#150E2B" stroke-width="1.4"/><rect x="598" y="186" width="9" height="6" rx="1" fill="#FFD27A" transform="rotate(-23 602 189)"/>
  <path d="M770 285C800 222 842 132 886 114C932 102 976 160 1000 205V285Z" fill="#241743"/>
  <path d="M886 114C860 140 836 188 806 250L840 285H900C930 240 950 190 930 150C920 128 905 112 886 114Z" fill="#2E1F57" fill-opacity=".6"/>
  <g fill="#E8F0F8" fill-opacity=".95"><rect x="883" y="84" width="5" height="32"/><rect x="866" y="91" width="40" height="5" rx="2"/><circle cx="885.5" cy="80" r="4.6"/><path d="M880 96L891 96L894 116L877 116Z"/></g>
  <circle cx="885" cy="98" r="30" fill="#FFD27A" fill-opacity=".1"/>
  ${city}
  <rect y="285" width="1000" height="55" fill="url(#rioSea)"/>
  <path d="M470 292H530M455 300H545M440 310H560M430 322H570" stroke="#FFD27A" stroke-opacity=".45" stroke-width="2.4"/>
  <path d="${waves}" stroke="#fff" stroke-opacity=".14" stroke-width="1.6" fill="none"/>
  <g fill="#FFD27A" fill-opacity=".9">${lamps}</g>
  <path d="M0 310C120 292 300 300 420 340H0Z" fill="#3A2447"/><path d="M0 322C140 308 280 316 360 340H0Z" fill="#2A1A3A"/>
  ${palm(60, 318, 1.1)}${palm(150, 332, .9)}${palm(640, 340, 1.2)}${palm(950, 340, 1.4)}`;
};

/* ---------- Caïro: piramides van Gizeh, Sfinx en moskeeën ---------- */
SCENES.cairo = () => {
  const mosque = (mx, s, c) => `<g transform="translate(${mx} 260) scale(${s})" fill="${c}"><rect x="-26" y="-18" width="52" height="18"/><path d="M-20 -18A20 20 0 0 1 20 -18Z"/><rect x="-1.5" y="-46" width="3" height="10"/><rect x="-44" y="-70" width="6" height="70"/><path d="M-46 -70H-36L-41 -84Z"/><rect x="38" y="-62" width="6" height="62"/><path d="M36 -62H46L41 -76Z"/><rect x="-47" y="-48" width="12" height="3"/><rect x="35" y="-42" width="12" height="3"/></g>`;
  const r = rngf(17); let blocks = ''; for (let x = 0; x < 380; x += 14) { const h = 14 + r() * 30; blocks += `<rect x="${x}" y="${272 - h}" width="13" height="${h}" fill="#3A2145"/>`; }
  let courses = ''; for (let i = 1; i < 9; i++) { const yy = 100 + i * 20.5, k = (yy - 100) / 185; courses += `<path d="M${(820 - 130 * k).toFixed(0)} ${yy.toFixed(0)}H${(820 + 130 * k).toFixed(0)}"/>`; }
  const sphinx = `<g fill="#2B1A33" stroke="#FFB36B" stroke-opacity=".55" stroke-width="1.2"><path d="M430 296V288H492L494 252C492 246 496 240 503 238L503 222C500 214 504 204 515 202H533C544 204 548 214 545 222L545 238C560 242 578 244 596 254C616 262 618 284 612 296Z"/><path d="M503 224H488L490 244H503Z M545 224H560L558 244H545Z"/></g><circle cx="524" cy="219" r="1.6" fill="#FFB36B"/>`;
  return `<defs>${lingrad('caiSky', [[0, '#1A1A40'], [.4, '#6B3F7A'], [.78, '#E8794A'], [1, '#FFC857']])}${lingrad('caiSand', [[0, '#8A4A4A'], [1, '#2F1B35']])}</defs>
  <rect width="1000" height="340" fill="url(#caiSky)"/>${starfield(32, 22, 120)}
  <circle cx="610" cy="238" r="74" fill="#FFE29A" fill-opacity=".9"/><circle cx="610" cy="238" r="120" fill="#FFC857" fill-opacity=".16"/>
  <g>${blocks}${mosque(60, .9, '#3A2145')}${mosque(240, 1.1, '#3A2145')}</g>
  <g><polygon points="575,285 655,170 735,285" fill="#8A5155"/><polygon points="655,170 735,285 655,285" fill="#5A3445"/>
  <polygon points="690,285 820,100 950,285" fill="#D98A4F"/><polygon points="820,100 950,285 820,285" fill="#8A4A4F"/>
  <g stroke="#6B3A3A" stroke-opacity=".35" stroke-width="1">${courses}</g>
  <polygon points="945,285 985,214 1025,285" fill="#C87A4D"/><polygon points="985,214 1025,285 985,285" fill="#7A4350"/></g>
  <path d="M0 292C140 270 300 282 440 276C560 270 700 288 1000 276V340H0Z" fill="#7A3F4A"/>
  <path d="M0 308C180 290 340 304 520 296C700 288 860 306 1000 296V340H0Z" fill="url(#caiSand)"/>
  ${sphinx}
  <path d="M0 326C200 312 420 330 640 320C800 313 920 326 1000 320V340H0Z" fill="#1F1230"/>
  <g stroke="#150C24" stroke-width="2.6" fill="none" stroke-linecap="round"><path d="M940 340Q944 308 936 280M936 280Q918 276 908 288M936 280Q924 268 910 268M936 280Q944 266 958 268M936 280Q956 280 966 292"/></g>`;
};
/* ---------- Mumbai: Gateway of India, Taj-hotel en de Sea Link ---------- */
SCENES.mumbai = () => {
  const r = rngf(41);
  let towers = '', x = 0;
  while (x < 520) { const w = 16 + Math.floor(r() * 20), h = 50 + Math.floor(r() * 120); towers += `<rect x="${x}" y="${285 - h}" width="${w}" height="${h}" fill="#2A1748"/>${litgrid(x, 285 - h, w, h, { seed: x + 5, p: .4, sx: 6, sy: 9, w: 2.4 })}`; x += w + 3; }
  let cables = ''; for (let i = 1; i <= 9; i++) cables += `M560 176L${560 - i * 17} 262M560 176L${560 + i * 17} 262`;
  const gate = `<g fill="#34193F"><rect x="700" y="206" width="120" height="79"/><rect x="694" y="200" width="132" height="8"/>
    <g>${[706, 734, 782, 810].map(tx => `<rect x="${tx}" y="176" width="12" height="26"/><path d="M${tx - 1} 176A7 7 0 0 1 ${tx + 13} 176Z"/><rect x="${tx + 5}" y="164" width="2" height="8"/>`).join('')}</g>
    <rect x="740" y="190" width="40" height="12"/><path d="M740 190H780L760 176Z"/></g>
    <path d="M736 285V252A24 24 0 0 1 784 252V285Z" fill="url(#muSky)"/>
    <g fill="#1E0F2C"><path d="M707 285V258A8 8 0 0 1 723 258V285Z"/><path d="M797 285V258A8 8 0 0 1 813 258V285Z"/></g>
    <g fill="#FFD27A" fill-opacity=".9">${[712, 728, 744, 760, 776, 792, 808].map(lx => `<circle cx="${lx}" cy="212" r="1.8"/>`).join('')}</g>`;
  const taj = `<g fill="#3A1D4A"><rect x="862" y="200" width="104" height="85"/><rect x="876" y="186" width="76" height="16"/><rect x="900" y="174" width="28" height="14"/><path d="M898 174A16 16 0 0 1 930 174Z"/><rect x="913" y="146" width="2" height="12"/><path d="M866 200A10 10 0 0 1 886 200Z"/><path d="M944 200A10 10 0 0 1 964 200Z"/><rect x="846" y="226" width="18" height="59"/><path d="M846 226A9 9 0 0 1 864 226Z"/></g>${litgrid(862, 204, 104, 80, { seed: 7, p: .55, sx: 8, sy: 11 })}`;
  const boat = (bx, by, s) => `<g transform="translate(${bx} ${by}) scale(${s})" fill="#1B0E2B"><path d="M-30 0H28L20 8H-22Z"/><path d="M-4 0V-38L22 -4Z"/><path d="M-6 0V-26L-26 -2Z"/></g>`;
  let streaks = ''; for (let i = 0; i < 16; i++) { const sx = 640 + r() * 300, sy = 290 + r() * 44; streaks += `M${(sx - 20 - r() * 24).toFixed(0)} ${sy.toFixed(0)}H${(sx + 20 + r() * 24).toFixed(0)}`; }
  return `<defs><linearGradient id="muSky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="285"><stop offset="0" stop-color="#1B1740"/><stop offset=".5" stop-color="#7B2F6E"/><stop offset=".82" stop-color="#FF7A9C"/><stop offset="1" stop-color="#FFC49A"/></linearGradient>${lingrad('muSea', [[0, '#E0708F'], [.3, '#4A2760'], [1, '#150C2B']])}</defs>
  <rect width="1000" height="285" fill="url(#muSky)"/>${starfield(26, 12, 100)}
  <circle cx="600" cy="262" r="56" fill="#FFD9A8" fill-opacity=".85"/><rect y="230" width="1000" height="55" fill="#FFC49A" fill-opacity=".14"/>
  <g opacity=".7" stroke="#6B3A7A" fill="none"><path d="M380 262H1000" stroke-width="5"/><path d="M552 262L560 176L568 262M556 232H564" stroke-width="3"/><path d="${cables}" stroke-width="1"/></g>
  ${towers}${taj}${gate}
  <rect y="285" width="1000" height="55" fill="url(#muSea)"/>
  <path d="${streaks}" stroke="#FFD9A8" stroke-opacity=".5" stroke-width="2.4"/>
  ${boat(640, 292, .9)}${boat(900, 306, 1.15)}${boat(560, 312, .7)}`;
};

/* ---------- Tokio: Fuji, Tokyo Tower, wolkenkrabbers en pagode ---------- */
SCENES.tokyo = () => {
  const r = rngf(53);
  let city = '', x = 0;
  while (x < 560) { const w = 18 + Math.floor(r() * 28), h = 40 + Math.floor(r() * 130); city += `<rect x="${x}" y="${290 - h}" width="${w}" height="${h}" fill="#1B1245"/>${litgrid(x, 290 - h, w, h, { seed: x + 8, p: .5, sx: 6, sy: 8, w: 2.4, c: '#FFE29A' })}`; x += w + 3; }
  let lights = ''; for (let i = 0; i < 120; i++) lights += `<circle cx="${(r() * 1000).toFixed(0)}" cy="${(296 + r() * 44).toFixed(0)}" r="${(.8 + r() * 1.2).toFixed(1)}"/>`;
  const tower = `<g transform="translate(690 0)"><path d="M-34 292L-8 150H8L34 292" fill="none" stroke="#FF6A45" stroke-width="3.4" stroke-linejoin="round"/><path d="M-8 150L-4 80H4L8 150" fill="none" stroke="#FF6A45" stroke-width="3"/><g stroke="#FF6A45" stroke-width="1.4"><path d="M-30 270L30 270M-26 250L26 250M-22 230L22 230M-18 210L18 210M-14 190L14 190M-11 170L11 170M-30 270L22 230M30 270L-22 230M-22 230L14 190M22 230L-14 190"/></g><rect x="-24" y="196" width="48" height="9" fill="#FFF3E8"/><rect x="-24" y="196" width="48" height="3" fill="#FF6A45"/><rect x="-9" y="112" width="18" height="6" fill="#FFF3E8"/><path d="M0 80V34" stroke="#FF6A45" stroke-width="2.2"/><circle cx="0" cy="32" r="2.4" fill="#FF5A3C"/></g>`;
  const pagoda = `<g transform="translate(935 300)" fill="#150C34"><rect x="-1.5" y="-170" width="3" height="28"/>${[0, 1, 2, 3, 4].map(i => { const w = 70 - i * 10, y = -i * 30; return `<path d="M${-w - 8} ${y}Q${-w / 2} ${y - 6} 0 ${y - 22}Q${w / 2} ${y - 6} ${w + 8} ${y}Z"/><rect x="${-w + 8}" y="${y - 8}" width="${(w - 8) * 2}" height="10"/><rect x="${-w + 13}" y="${y - 8}" width="4" height="7" fill="#FFD27A"/><rect x="-2" y="${y - 8}" width="4" height="7" fill="#FFD27A"/><rect x="${w - 17}" y="${y - 8}" width="4" height="7" fill="#FFD27A"/>`; }).join('')}<rect x="-24" y="2" width="48" height="40"/></g>`;
  let petals = ''; const pr = rngf(5); for (let i = 0; i < 26; i++) { petals += `<ellipse cx="${(pr() * 1000).toFixed(0)}" cy="${(pr() * 280).toFixed(0)}" rx="3" ry="1.8" transform="rotate(${(pr() * 180).toFixed(0)} ${(pr() * 1000).toFixed(0)} 100)"/>`; }
  let blossoms = ''; const br = rngf(88); for (let i = 0; i < 60; i++) { const t = br(), bx = 1000 - t * 190 + (br() - .5) * 22, by = 6 + t * 54 + (br() - .5) * 26; blossoms += `<circle cx="${bx.toFixed(0)}" cy="${by.toFixed(0)}" r="${(2.6 + br() * 3.4).toFixed(1)}" fill="${br() < .5 ? '#FFB7D5' : '#FF8FBF'}" fill-opacity=".92"/>`; }
  return `<defs>${lingrad('tyoSky', [[0, '#0E0B2E'], [.45, '#3A2A78'], [.8, '#9B6FD0'], [1, '#F5A3C8']])}${lingrad('tyoFuji', [[0, '#6C58B8'], [1, '#2E2468']])}</defs>
  <rect width="1000" height="340" fill="url(#tyoSky)"/>${starfield(34, 19, 120)}
  <circle cx="420" cy="86" r="26" fill="#FFE9F2" fill-opacity=".9"/>
  <path d="M640 292C700 250 760 190 826 118H934C990 176 1040 250 1120 292Z" fill="url(#tyoFuji)"/>
  <path d="M826 118H934C948 134 960 150 972 166L952 158L940 176L922 156L906 178L890 158L872 176L858 156L842 170L826 152L812 164C816 146 820 132 826 118Z" fill="#F4EEFF"/>
  <path d="M640 292C700 250 760 190 826 118L850 140C800 200 730 262 700 292Z" fill="#FFB7D5" fill-opacity=".14"/>
  <rect y="289" width="1000" height="51" fill="#0F0A2A"/>${city}
  ${tower}
  <path d="M0 290H1000" stroke="#F5A3C8" stroke-opacity=".35" stroke-width="2"/>
  <g fill="#FFE29A" fill-opacity=".8">${lights}</g>
  ${pagoda}
  <g stroke="#2A1236" stroke-width="3" fill="none" stroke-linecap="round"><path d="M1000 4Q930 8 880 36Q850 52 820 60"/><path d="M930 14Q912 34 900 40M900 38Q880 30 862 40"/></g>${blossoms}
  <g fill="#FFB7D5" fill-opacity=".7">${petals}</g>`;
};
/* ---------- İstanbul: koepels, minaretten, Galatatoren en de Bosporus ---------- */
SCENES.ist = () => {
  const r = rngf(77);
  const minaret = (x, base, h, scale = 1) => `<g transform="translate(${x} ${base}) scale(${scale})" fill="#32141F"><rect x="-3.5" y="${-h}" width="7" height="${h}"/><rect x="-7" y="${-h + 34}" width="14" height="4"/><rect x="-5.5" y="${-h + 12}" width="11" height="3"/><path d="M-3.5 ${-h}L0 ${-h - 20}L3.5 ${-h}Z"/></g>`;
  const dome = (cx, base, rad) => `<path d="M${cx-rad} ${base}A${rad} ${rad} 0 0 1 ${cx+rad} ${base}Z"/>`;
  // Galata Tower: round stone tower, projecting upper gallery and a pointed roof.
  const galata = `<g transform="translate(866 0)">
    <path d="M-36 285V151Q-36 139 -27 132L-24 121H24L27 132Q36 139 36 151V285Z" fill="#32141F"/>
    <path d="M-42 151H42L36 140H-36Z" fill="#5A2630"/>
    <rect x="-29" y="159" width="58" height="6" fill="#6A343A"/>
    <rect x="-33" y="184" width="66" height="5" fill="#6A343A"/>
    <rect x="-36" y="208" width="72" height="5" fill="#6A343A"/>
    <rect x="-36" y="232" width="72" height="5" fill="#6A343A"/>
    <path d="M-31 121L-27 91H27L31 121Z" fill="#4A222C"/>
    <path d="M-31 91L0 42L31 91Z" fill="#24121D"/>
    <path d="M0 42V29" stroke="#24121D" stroke-width="3"/>
    ${[-21,-7,7,21].map(x=>`<rect x="${x}" y="101" width="4" height="11" rx="1" fill="#FFD27A" fill-opacity=".85"/>`).join('')}
    ${[-22,-8,8,22].map(x=>`<rect x="${x}" y="174" width="4" height="8" fill="#FFD27A" fill-opacity=".65"/>`).join('')}
    ${[-25,-10,10,25].map(x=>`<rect x="${x}" y="197" width="4" height="8" fill="#FFD27A" fill-opacity=".65"/>`).join('')}
  </g>`;
  // Bosphorus suspension bridge in the distance.
  const bridge = `<g fill="none" stroke="#341522" stroke-linecap="round"><path d="M430 230Q580 172 730 230" stroke-width="4"/><path d="M460 225V278M700 225V278" stroke-width="8"/><path d="M460 225L470 205H450ZM700 225L710 205H690Z" fill="#341522" stroke="none"/><path d="M430 230H760" stroke-width="3"/>${Array.from({length:17},(_,i)=>{const x=440+i*18;return `<path d="M${x} ${225-52*Math.sin((x-430)/330*Math.PI)}V278" stroke-width="1.2"/>`;}).join('')}</g>`;
  let boats = '';
  [[560, 304, .8], [760, 316, 1], [650, 326, .65]].forEach(([x,y,sc]) => boats += `<g transform="translate(${x} ${y}) scale(${sc})" fill="#1E0D18"><path d="M-30 0H27L18 8H-21Z"/><rect x="-11" y="-12" width="23" height="12"/><rect x="-3" y="-20" width="3" height="8"/><path d="M-7 -12L-1 -17L5 -12Z"/></g>`);
  let ripples = ''; for (let i = 0; i < 24; i++) { const x = 500 + r()*490, y = 291 + r()*45; ripples += `M${x.toFixed(0)} ${y.toFixed(0)}h${(12+r()*34).toFixed(0)}`; }
  const mosques = `<g fill="#32141F">
    <rect x="570" y="228" width="220" height="57"/><rect x="550" y="224" width="260" height="8"/>
    ${dome(680,228,67)}${dome(610,232,34)}${dome(750,232,34)}${dome(680,172,24)}
    <rect x="677" y="142" width="6" height="9"/><path d="M680 142L675 151H685Z"/>
    </g>`;
  return `<defs>${lingrad('isSky', [[0, '#25123A'], [.48, '#A84350'], [.82, '#FF9A6A'], [1, '#FFD39A']])}${lingrad('isSea', [[0, '#C9585A'], [.3, '#4B1F3F'], [1, '#170B22']])}</defs>
    <rect width="1000" height="285" fill="url(#isSky)"/>${starfield(24, 9, 90)}
    <circle cx="640" cy="270" r="50" fill="#FFE0AE" fill-opacity=".85"/>
    <g fill="#3B1620" opacity=".55"><path d="M0 285V262L90 250L190 262L300 246L420 262L560 252V285Z"/></g>
    ${bridge}${mosques}${minaret(586,280,148,.92)}${minaret(770,280,158,1)}${minaret(807,280,126,.78)}${galata}
    <rect y="285" width="1000" height="55" fill="url(#isSea)"/><path d="${ripples}" stroke="#FFD39A" stroke-opacity=".38" stroke-width="2" fill="none"/>${boats}`;
};

/* ---------- Jakarta: Monas, wolkenkrabbers en palmen ---------- */
SCENES.cgk = () => {
  const r = rngf(23);
  let towers = '', x = 360;
  while (x < 700) { const w = 20 + Math.floor(r() * 24), h = 60 + Math.floor(r() * 130); towers += `<rect x="${x}" y="${285 - h}" width="${w}" height="${h}" fill="#2B3410"/>${litgrid(x, 285 - h, w, h, { seed: x, p: .4, sx: 6, sy: 9, w: 2.4 })}`; x += w + 3; }
  const palm = (px, h, s) => { let f = ''; for (let k = 0; k < 6; k++) { const a = -150 + k * 60; f += `<path d="M0 0Q${22 * Math.cos(a * Math.PI / 180)} ${-14 + 22 * Math.sin(a * Math.PI / 180)} ${38 * Math.cos(a * Math.PI / 180)} ${38 * Math.sin(a * Math.PI / 180) + 8}" stroke="#1B230A" stroke-width="4" fill="none" stroke-linecap="round"/>`; } return `<g transform="translate(${px} ${285 - h}) scale(${s})"><path d="M0 ${h}Q6 ${h / 2} 0 0" stroke="#1B230A" stroke-width="5" fill="none"/>${f}</g>`; };
  return `<defs>${lingrad('jkSky', [[0, '#1D2A4A'], [.45, '#A8512D'], [.8, '#F0A23A'], [1, '#FFE08A']])}</defs>
  <rect width="1000" height="285" fill="url(#jkSky)"/>${starfield(20, 4, 80)}
  <circle cx="560" cy="262" r="58" fill="#FFF0B0" fill-opacity=".8"/>
  ${towers}
  <g fill="#2B3410"><rect x="760" y="262" width="150" height="23"/><rect x="778" y="254" width="114" height="10"/><rect x="826" y="130" width="12" height="126"/><rect x="818" y="196" width="28" height="6"/><rect x="822" y="124" width="20" height="8"/><rect x="826" y="112" width="12" height="14"/>
  <path d="M832 112C818 98 826 84 832 72C838 84 846 98 832 112Z" fill="#FFC857"/></g>
  <path d="M0 285H1000" stroke="#1B230A" stroke-width="2"/><rect y="285" width="1000" height="55" fill="#17200A"/>
  ${palm(940, 140, 1)}${palm(700, 110, .85)}${palm(985, 90, .7)}`;
};

/* ---------- Sydney: Opera House, Harbour Bridge en de haven ---------- */
SCENES.syd = () => {
  const sail = (x, y, w, h, f) => `<path d="M${x} ${y}Q${x + w * .25} ${y - h * 1.05} ${x + w} ${y - h}Q${x + w * .7} ${y - h * .35} ${x + w} ${y}Z" fill="${f}"/>`;
  let hang = ''; for (let i = 0; i <= 10; i++) { const hx = 90 + i * 40; hang += `M${hx} ${178 + Math.pow((hx - 290) / 200, 2) * 0 + 0}V${262}`; }
  let streaks = ''; const r = rngf(9); for (let i = 0; i < 14; i++) { const sx = 500 + r() * 460, sy = 296 + r() * 36; streaks += `M${(sx - 20).toFixed(0)} ${sy.toFixed(0)}H${(sx + 20 + r() * 20).toFixed(0)}`; }
  return `<defs>${lingrad('syS', [[0, '#0F2A4A'], [.5, '#1E8C9A'], [.85, '#F7B267'], [1, '#FFE3A3']])}${lingrad('syW', [[0, '#2DB3A8'], [.3, '#0F4C63'], [1, '#08203A']])}</defs>
  <rect width="1000" height="285" fill="url(#syS)"/>${starfield(18, 15, 70)}
  <circle cx="470" cy="265" r="52" fill="#FFEBB8" fill-opacity=".8"/>
  <g fill="#0C2A3A" opacity=".85"><path d="M0 285V240H40V220H70V240H110V228H150V240H200V250H300V285Z"/></g>
  <g stroke="#0C2A3A" fill="none"><path d="M330 262Q440 112 550 262" stroke-width="7"/><path d="M330 262H550" stroke-width="6"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7].map(k => { const x = 352 + k * 25, t = (x - 330) / 220, y = 262 - 4 * t * (1 - t) * 150 * .98; return `<path d="M${x} ${y.toFixed(0)}V262" stroke-width="1.5"/>`; }).join('')}</g>
  <g fill="#0C2A3A"><rect x="324" y="228" width="12" height="57"/><rect x="544" y="228" width="12" height="57"/></g>
  <rect x="640" y="272" width="330" height="13" fill="#0F3A4A"/>
  <g>${sail(660, 272, 70, 76, '#F4F1E8')}${sail(718, 272, 62, 62, '#E9E4D6')}${sail(768, 272, 52, 46, '#F4F1E8')}${sail(838, 272, 60, 54, '#E9E4D6')}${sail(886, 272, 54, 40, '#F4F1E8')}</g>
  <rect y="285" width="1000" height="55" fill="url(#syW)"/><path d="${streaks}" stroke="#FFE3A3" stroke-opacity=".4" stroke-width="2" fill="none"/>
  <g transform="translate(400 312)" fill="#08203A"><path d="M-26 0H24L16 7H-18Z"/><path d="M-4 0V-26L18 -2Z"/></g>`;
};
/* ============ HULPFUNCTIES ============ */
const $ = (s, r = document) => r.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SUPM = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'−' };
function rich(s) {
  return String(s)
    .replace(/[₀-₉]+/g, m => '<sub>' + [...m].map(c => c.charCodeAt(0) - 0x2080).join('') + '</sub>')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, m => '<sup>' + [...m].map(c => SUPM[c]).join('') + '</sup>');
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function parseNum(s) {
  const supers = { '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁻':'-','⁺':'+' };
  s = String(s).trim().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, c => supers[c])
    .replace(/\s/g, '').replace(/,/g, '.').replace(/[−–]/g, '-');
  // Convert multiplication-by-ten notation to JavaScript scientific notation.
  s = s.replace(/(?:[·×x*])10\^?([-+]?\d+)/i, 'e$1')
       .replace(/^([-+]?(?:\d+\.?\d*|\.\d+))10\^([-+]?\d+)$/i, '$1e$2');
  return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}
const star = on => `<svg viewBox="0 0 24 24" class="star${on ? ' on' : ''}" aria-hidden="true"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.5 6 20.9l1.3-6.7-5-4.7 6.8-.8z"/></svg>`;
const starRow = n => `<span class="stars" role="img" aria-label="${n} van 3 sterren">${[0, 1, 2].map(k => star(k < n)).join('')}</span>`;
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
function burst(el) {
  if (RM || !el) return;
  const r = el.getBoundingClientRect();
  for (let k = 0; k < 12; k++) {
    const b = document.createElement('i'); b.className = 'bub';
    b.style.left = (r.left + r.width / 2) + 'px'; b.style.top = (r.top + r.height / 2) + 'px';
    b.style.setProperty('--dx', (Math.random() * 180 - 90) + 'px');
    b.style.setProperty('--dy', (-40 - Math.random() * 130) + 'px');
    b.style.setProperty('--s', (6 + Math.random() * 10) + 'px');
    document.body.appendChild(b); setTimeout(() => b.remove(), 900);
  }
}
function stampSVG(ep, i, slam, lvl) {
  const id = 'ring' + i + Math.random().toString(36).slice(2, 6);
  const rot = [-9, 7, -5, 10, -8, 6][i % 6];
  return `<svg viewBox="0 0 120 120" class="stamp${slam ? ' slam' : ''}" style="--c:${lvl ? LVC[lvl] : ep.color};--rot:${rot}deg" role="img" aria-label="Stempel ${ep.city}${lvl ? ', niveau ' + LVN[lvl].toLowerCase() : ''}"><defs><path id="${id}" d="M60 60m-44 0a44 44 0 1 1 88 0a44 44 0 1 1-88 0"/></defs><circle cx="60" cy="60" r="56" class="s1"/><circle cx="60" cy="60" r="36" class="s2"/><text class="ring"><textPath href="#${id}" textLength="270" lengthAdjust="spacing">${ep.city.toUpperCase()} · CHEMIE-DOUANE · ${ep.code} ·</textPath></text><text x="60" y="64" text-anchor="middle" class="code">${ep.code}</text><text x="60" y="80" text-anchor="middle" class="ep">${lvl ? LVN[lvl].toUpperCase() : 'AFL. ' + (i + 1)}</text></svg>`;
}

/* ============ STATUS ============ */
const LVN = ['', 'Makkelijk', 'Medium', 'Moeilijk'], LVC = ['', '#D08A4A', '#C9D3E0', '#FFC83A'], LVM = [0, 1, 1.5, 2], LVT = ['', 'brons', 'zilver', 'goud'], HP = [0, 0, 40, 60];
const state = Object.assign({ level: 2, best: {}, stars: {}, passed: {}, cur: 0, ep: -1, qi: 0, qs: [], ans: [], ok: 0, run: 0, streak: 0, submitted: false, flying: false, lastIds: {} }, loadVoortgang());
window.exportVoortgang = () => ({ level: state.level, best: state.best, stars: state.stars, passed: state.passed, cur: state.cur, streak: state.streak, lastIds: state.lastIds });
const isOpen = () => true; // alle steden zijn vanaf het begin open
const passedAt = (i, l) => !!(state.passed[i] && state.passed[i][l]);
const topLevel = i => [3, 2, 1].find(l => passedAt(i, l)) || 0;
const totalScore = () => EP.reduce((s, _, i) => s + [1, 2, 3].reduce((t, l) => t + ((state.best[i] || {})[l] || 0), 0), 0);
const stampCount = () => EP.filter((_, i) => topLevel(i) > 0).length;
function hud() {
  $('#hud-score').textContent = totalScore();
  $('#hud-combo').textContent = '×' + state.streak;
  $('#hud-stamps').textContent = stampCount() + '/' + EP.length;
}
function show(name) {
  ['map', 'ep', 'result', 'final'].forEach(n => { $('#screen-' + n).hidden = n !== name; });
  document.body.dataset.screen = name;
  if (name !== 'ep') state.ep = name === 'map' || name === 'final' ? -1 : state.ep;
  window.scrollTo({ top: 0, behavior: 'auto' });
  hud();
}

/* ============ KAART ============ */
const W = 1000, H = 372, TOP = 78, BOT = -56;
const px = (lon, lat) => [(lon + 180) / 360 * W, (TOP - lat) / (TOP - BOT) * H];
const pos = EP.map(e => px(e.lon, e.lat));
function arc(a, b) {
  const [x1, y1] = a, [x2, y2] = b, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  let nx = dy / len, ny = -dx / len; if (ny > 0) { nx = -nx; ny = -ny; }
  const k = len * 0.28;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${((x1 + x2) / 2 + nx * k).toFixed(1)} ${((y1 + y2) / 2 + ny * k).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
function buildDots() {
  const mk = flat => { const p = new Path2D(); for (let k = 0; k < flat.length; k += 2) { const [x, y] = px(flat[k], flat[k + 1]); k ? p.lineTo(x, y) : p.moveTo(x, y); } p.closePath(); return p; };
  const land = LAND.map(mk), water = WATER.map(mk);
  const ctx = document.createElement('canvas').getContext('2d');
  const S = 8.4; let d = '';
  for (let y = S / 2, row = 0; y < H; y += S, row++) {
    for (let x = S / 2 + (row % 2 ? S / 2 : 0); x < W; x += S) {
      if (land.some(p => ctx.isPointInPath(p, x, y)) && !water.some(p => ctx.isPointInPath(p, x, y))) d += `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
    }
  }
  return d;
}
function buildMap() {
  let g = `<defs><radialGradient id="sea" cx="50%" cy="45%" r="75%"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#sea)"/>`;
  let gr = '';
  for (let lo = -150; lo <= 150; lo += 30) { const x = (lo + 180) / 360 * W; gr += `M${x} 0V${H}`; }
  for (let la = 60; la >= -30; la -= 30) { const y = (TOP - la) / (TOP - BOT) * H; gr += `M0 ${y}H${W}`; }
  g += `<path class="grat" d="${gr}"/><path class="dots" d="${buildDots()}"/>`;
  g += `<path id="trail" class="trail" d="M0 0"/><path id="flight" d="M0 0"/>`;
  EP.forEach((e, i) => {
    const [x, y] = pos[i];
    g += `<g class="node locked" data-i="${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${e.city}: ${e.title}"><circle r="17" fill="rgba(0,0,0,0)"/><circle class="ring" r="7"/><circle class="core" r="6.5"/><text class="nm" x="${e.label.dx}" y="${e.label.dy}" text-anchor="${e.label.a}">${e.city}</text></g>`;
  });
  g += `<g id="plane"><path d="M-10 0L-4 -2.4L-2 -10H1.5L0.5 -2.6L7 -3.4V-1.6L10 0L7 1.6V3.4L0.5 2.6L1.5 10H-2L-4 2.4Z"/></g>`;
  $('#map').innerHTML = g;
  $('#map').addEventListener('click', e => { const n = e.target.closest('.node'); if (n) startEpisode(+n.dataset.i); });
  $('#map').addEventListener('keydown', e => { const n = e.target.closest && e.target.closest('.node'); if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startEpisode(+n.dataset.i); } });
  placeAt(state.cur);
}
function placeAt(i) { const [x, y] = pos[i]; $('#plane').setAttribute('transform', `translate(${x} ${y - 16}) rotate(-20)`); }
function placeOn(path, t) {
  const len = path.getTotalLength(), p = path.getPointAtLength(t * len), q = path.getPointAtLength(Math.min(len, t * len + 1));
  const deg = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
  $('#plane').setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${deg})`);
}
function centerOn(i) {
  const sc = $('#mapScroll'), svg = $('#map');
  sc.scrollTo({ left: pos[i][0] / W * svg.getBoundingClientRect().width - sc.clientWidth / 2, behavior: RM ? 'auto' : 'smooth' });
}
function flyTo(i, done) {
  if (i === state.cur) { done(); return; }
  centerOn(i);
  const f = $('#flight'); f.setAttribute('d', arc(pos[state.cur], pos[i])); f.classList.add('go');
  const dur = RM ? 0 : 1600, t0 = performance.now();
  const step = now => {
    const t = dur ? Math.min(1, (now - t0) / dur) : 1, e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    placeOn(f, e);
    if (t < 1) requestAnimationFrame(step);
    else { f.classList.remove('go'); $('#trail').setAttribute('d', f.getAttribute('d')); state.cur = i; placeAt(i); done(); }
  };
  requestAnimationFrame(step);
}
function refresh() {
  document.querySelectorAll('.node').forEach(n => {
    const i = +n.dataset.i;
    n.classList.toggle('done', topLevel(i) > 0);
    n.classList.toggle('open', topLevel(i) === 0);
  });
  document.querySelectorAll('#levelBar .lv').forEach(b => { const on = +b.dataset.l === state.level; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#board').innerHTML = EP.map((e, i) => {
    const done = passedAt(i, state.level);
    const label = done ? 'Aangekomen' : 'Inchecken';
    const meds = [1, 2, 3].map(l => `<i class="med l${l}${passedAt(i, l) ? ' on' : ''}" title="${LVN[l]}${passedAt(i, l) ? ' gehaald' : ''}"></i>`).join('');
    return `<button class="row ${done ? 'done' : 'open'}" data-i="${i}"><span class="code">${e.code}</span><span class="city">${e.city}</span><span class="topic">${e.title}</span><span class="rt"><span class="st">${label}</span>${starRow(((state.stars[i] || {})[state.level]) || 0)}<span class="meds" aria-label="Gehaald op niveau">${meds}</span></span></button>`;
  }).join('');
  $('#stamps').innerHTML = EP.map((e, i) => topLevel(i) ? stampSVG(e, i, false, topLevel(i)) : `<div class="slot">${e.code}</div>`).join('');
  const allDone = EP.every((_, k) => topLevel(k) > 0);
  $('#passAct').innerHTML = allDone ? '<button class="btn go" id="passBtn">Bekijk je eindscore</button>' : '';
  if (allDone) $('#passBtn').addEventListener('click', showFinal);
  hud();
}
$('#levelBar').addEventListener('click', e => { const b = e.target.closest('.lv'); if (b) { state.level = +b.dataset.l; refresh(); } });
$('#board').addEventListener('click', e => { const r = e.target.closest('.row'); if (r) startEpisode(+r.dataset.i); });

/* ============ AFLEVERING ============ */
function startEpisode(i) {
  if (state.flying) return;
  state.flying = true; show('map');
  flyTo(i, () => { state.flying = false; beginEpisode(i); });
}
function genQ(tpl) {   // probeer opnieuw als er (heel zelden) minder dan vier verschillende opties uitkomen
  for (let t = 0; t < 15; t++) { try { const q = tpl(); if (q && (q.type !== 'mc' || q.options.length === 4)) return q; } catch (e) { /* nieuwe poging */ } }
  return tpl();
}
function pickQuestions(i) {
  LV = state.level;
  const ep = EP[i], set = ep.lv[LV], key = i + '-' + LV, prev = state.lastIds[key] || [];
  RUN.used.clear();
  let idx = shuffle(set);
  idx = [...idx.filter(k => !prev.includes(k)), ...idx.filter(k => prev.includes(k))].slice(0, 5);
  idx = shuffle(idx);
  state.lastIds[key] = idx;
  return idx.map(k => { const q = genQ(ep.pool[k]); q.id = k; return q; });
}
function beginEpisode(i) {
  const ep = EP[i];
  state.ep = i; state.qi = 0; state.run = 0; state.ok = 0; state.streak = 0; state.submitted = false;
  state.qs = pickQuestions(i);
  state.ans = state.qs.map(q => ({ hint: false, mc: null, num: '', coef: q.type === 'balance' ? [...q.reactants, ...q.products].map(() => 1) : null, touched: false, order: q.type === 'mc' ? shuffle(q.options.map((_, k) => k)) : null }));
  const head = $('#epHead');
  head.style.setProperty('--c', ep.color);
  head.innerHTML = `<div class="ep-top"><button class="back" id="backBtn">&larr; Kaart</button><span class="mono">VLUCHT CH-10${i + 1} &middot; ${LVN[state.level].toUpperCase()}</span><span class="tools"><button class="back pt-open" type="button">Periodiek systeem</button><button class="back mol-open" type="button">Molrekenschema</button></span></div><div><p class="kick">Aflevering ${i + 1} van ${EP.length} &middot; ${ep.land}</p><h2>${ep.city}</h2><p class="topic">${ep.title}</p></div><p class="blurb">${rich(ep.blurb)}</p><div class="dots5" id="dots"></div>`;
  head.insertAdjacentHTML('afterbegin', `<svg class="scene" viewBox="0 0 1000 340" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">${SCENES[ep.art](ep.color)}</svg><div class="shade"></div>`);
  $('#backBtn').addEventListener('click', () => { show('map'); refresh(); centerOn(state.cur); });
  show('ep'); state.ep = i;
  renderQuestion();
}
function isAnswered(k) {
  const q = state.qs[k], a = state.ans[k];
  return q.type === 'mc' ? a.mc != null : q.type === 'num' ? a.num.trim() !== '' : a.touched;
}
function updateDots() {
  $('#dots').innerHTML = state.qs.map((_, k) => `<button type="button" class="dot${k === state.qi ? ' cur' : ''}${isAnswered(k) ? ' ans' : ''}" data-k="${k}" aria-label="Ga naar vraag ${k + 1}${isAnswered(k) ? ' (beantwoord)' : ''}"></button>`).join('');
}
$('#epHead').addEventListener('click', e => { const d = e.target.closest('.dot'); if (d && !state.submitted) goTo(+d.dataset.k); });
function balanceMarkup(q, coef) {
  const sp = [...q.reactants, ...q.products], nR = q.reactants.length;
  let h = '<div class="rxn" id="rxn">';
  sp.forEach((f, k) => {
    h += `<div class="sp"><span class="stepper"><button type="button" data-k="${k}" data-d="-1" aria-label="Minder ${f}">&minus;</button><output id="c${k}">${coef[k]}</output><button type="button" data-k="${k}" data-d="1" aria-label="Meer ${f}">+</button></span><span class="formula">${rich(f)}</span></div>`;
    if (k < sp.length - 1) h += `<span class="op">${k === nR - 1 ? '&rarr;' : '+'}</span>`;
  });
  return h + '</div>';
}
function rxnString(q, coef) {
  const t = [...q.reactants, ...q.products].map((f, k) => (coef[k] > 1 ? coef[k] + ' ' : '') + f);
  return t.slice(0, q.reactants.length).join(' + ') + ' → ' + t.slice(q.reactants.length).join(' + ');
}
const optHTML = s => /^\s*<svg/.test(s) ? s : rich(s);
function renderQuestion() {
  const ep = EP[state.ep], q = state.qs[state.qi], a = state.ans[state.qi], t = $('#ticket'), last = state.qi === state.qs.length - 1, free = state.level === 1;
  t.style.setProperty('--c', ep.color);
  let body = '';
  if (q.type === 'mc') {
    body = '<div class="opts" role="group" aria-label="Antwoordopties">' + a.order.map((oi, k) => `<button type="button" class="opt${a.mc === oi ? ' sel' : ''}" data-oi="${oi}" aria-pressed="${a.mc === oi}"><span class="l">${'ABCD'[k]}</span><span class="ot">${optHTML(q.options[oi])}</span></button>`).join('') + '</div>';
  } else if (q.type === 'num') {
    body = `<div class="numrow"><label class="sr" for="ans">Jouw antwoord</label><input id="ans" type="text" inputmode="decimal" autocomplete="off" value="${a.num.replace(/"/g, '')}"><span class="unit">${rich(q.unit || '')}</span></div><p class="warn" id="warn" hidden></p><p class="numhint">Grote of kleine getallen mag je typen als 3,0e23 of 2,5e-3.</p>`;
  } else body = balanceMarkup(q, a.coef);
  const kind = { mc: 'Meerkeuze', num: 'Berekening', balance: 'Kloppend maken' }[q.type];
  t.innerHTML = `<div class="t-head"><span>Boarding pass</span><span>CH-10${state.ep + 1}</span><span>Stoel ${state.qi + 1}${'ABCDE'[state.qi]}</span></div>
    <div class="t-body"><p class="q-kicker">Vraag ${state.qi + 1} van ${state.qs.length} &middot; ${kind}</p><h3 class="q-text" style="font-weight:500">${rich(q.text)}</h3>${body}</div>
    <div class="perf"></div>
    <div class="t-foot"><div class="hintbox" id="hintBox" ${(a.hint || free) && q.hint ? '' : 'hidden'}>${(a.hint || free) && q.hint ? '<b>Tip:</b> ' + rich(q.hint) : ''}</div>
    <div class="nav"><button type="button" class="btn ghost" id="prevBtn" ${state.qi === 0 ? 'disabled' : ''}>&larr; Vorige</button>${q.hint && !free ? `<button type="button" class="btn ghost" id="hintBtn" ${a.hint ? 'disabled' : ''}>Hint (−${HP[state.level]} punten)</button>` : ''}<button type="button" class="btn${last ? ' go' : ''}" id="nextBtn">${last ? 'Inleveren' : 'Volgende &rarr;'}</button></div>
    <div id="confirm" aria-live="polite"></div></div>`;
  updateDots();
  $('#prevBtn').addEventListener('click', () => goTo(state.qi - 1));
  $('#nextBtn').addEventListener('click', () => last ? trySubmit() : goTo(state.qi + 1));
  const hb = $('#hintBtn');
  if (hb) hb.addEventListener('click', () => { a.hint = true; $('#hintBox').innerHTML = '<b>Tip:</b> ' + rich(q.hint); $('#hintBox').hidden = false; hb.disabled = true; });
  if (q.type === 'mc') t.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => selectMC(+b.dataset.oi)));
  if (q.type === 'num') {
    const inp = $('#ans');
    inp.addEventListener('input', () => { a.num = inp.value; $('#warn').hidden = true; updateDots(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); last ? trySubmit() : goTo(state.qi + 1); } });
    inp.focus({ preventScroll: true });
  }
  if (q.type === 'balance') {
    $('#rxn').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const k = +b.dataset.k; a.coef[k] = Math.min(30, Math.max(1, a.coef[k] + +b.dataset.d)); a.touched = true;
      $('#c' + k).textContent = a.coef[k]; updateDots();
    });
  }
}
function goTo(k) {
  if (k < 0 || k >= state.qs.length || state.submitted) return;
  state.qi = k; renderQuestion();
  window.scrollTo({ top: $('#ticket').offsetTop - 80, behavior: 'auto' });
}
function selectMC(oi) {
  const a = state.ans[state.qi]; a.mc = oi;
  document.querySelectorAll('.opt').forEach(b => { const on = +b.dataset.oi === oi; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  updateDots();
}
function trySubmit() {
  const open = state.qs.map((_, k) => k).filter(k => !isAnswered(k));
  if (!open.length) return submitRun();
  $('#confirm').innerHTML = `<div class="confirm"><p><b>Nog ${open.length} onbeantwoord:</b> vraag ${open.map(k => k + 1).join(', ')}. Onbeantwoorde vragen tellen als fout.</p><div class="nav"><button type="button" class="btn ghost" id="cBack">Terug naar vragen</button><button type="button" class="btn go" id="cGo">Toch inleveren</button></div></div>`;
  $('#cBack').addEventListener('click', () => goTo(open[0]));
  $('#cGo').addEventListener('click', submitRun);
  $('#cGo').focus({ preventScroll: true });
  $('#confirm').scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
}
function grade(q, a) {
  if (q.type === 'mc') return a.mc === q.correct;
  if (q.type === 'num') {
    const v = parseNum(a.num); if (!Number.isFinite(v) || !Number.isFinite(q.answer)) return false;
    const answer = q.answer, diff = Math.abs(v - answer);
    // Explanations show answers to about 3 significant figures. Include half of
    // the last displayed place so ordinary rounding is not marked incorrect.
    const roundingTol = answer === 0 ? 0.0005 : 0.5 * Math.pow(10, Math.floor(Math.log10(Math.abs(answer))) - 2);
    const allowed = q.tolAbs != null
      ? Math.max(q.tolAbs, roundingTol)
      : Math.max(Math.abs(answer) * (q.tol ?? 0.02), roundingTol);
    return diff <= allowed;
  }
  const u = a.coef; return u.every((v, i) => v === q.coef[i]);
}
document.addEventListener('keydown', e => {
  if (document.querySelector('.pt-ov:not([hidden])')) return;
  if (state.ep < 0 || $('#screen-ep').hidden || state.submitted) return;
  const q = state.qs[state.qi], a = state.ans[state.qi]; if (!q) return;
  const typing = e.target.closest && e.target.closest('input,textarea');
  if (!typing && e.key === 'ArrowRight') { goTo(state.qi + 1); return; }
  if (!typing && e.key === 'ArrowLeft') { goTo(state.qi - 1); return; }
  if (q.type !== 'mc' || typing) return;
  const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
  if (k >= 0 && k < a.order.length) selectMC(a.order[k]);
});

/* ============ INLEVEREN EN NABESPREKING ============ */
function showAnswer(q, a, correct) {
  const mine = (() => {
    if (q.type === 'mc') return a.mc == null ? null : optHTML(q.options[a.mc]);
    if (q.type === 'num') return a.num.trim() === '' ? null : rich(a.num.trim()) + ' ' + rich(q.unit || '');
    return a.touched ? rich(rxnString(q, a.coef)) : null;
  })();
  const good = q.type === 'mc' ? optHTML(q.options[q.correct]) : q.type === 'num' ? rich(sig(q.answer)) + ' ' + rich(q.unit || '') : rich(rxnString(q, q.coef));
  return `<div class="rv-ans"><div class="mine ${correct ? 'good' : 'bad'}"><small>Jouw antwoord</small><div>${mine == null ? '<i>niet beantwoord</i>' : mine}</div></div>${correct ? '' : `<div class="right"><small>Juist antwoord</small><div>${good}</div></div>`}</div>`;
}
function submitRun() {
  const i = state.ep, ep = EP[i];
  state.submitted = true; state.run = 0; state.ok = 0; state.streak = 0;
  const res = state.qs.map((q, k) => {
    const a = state.ans[k], ok = grade(q, a); let gain = 0;
    if (ok) { gain = Math.round(((a.hint && state.level > 1 ? 100 - HP[state.level] : 100) + Math.min(state.streak, 4) * 20) * LVM[state.level]); state.run += gain; state.streak++; state.ok++; } else state.streak = 0;
    return { q, a, ok, gain };
  });
  const ok = state.ok, n = state.qs.length, passed = ok >= 3, stars = ok >= 5 ? 3 : ok >= 4 ? 2 : ok >= 3 ? 1 : 0;
  const L = state.level;
  if (passed) { (state.passed[i] = state.passed[i] || {})[L] = true; (state.stars[i] = state.stars[i] || {})[L] = Math.max(state.stars[i][L] || 0, stars); }
  (state.best[i] = state.best[i] || {})[L] = Math.max(state.best[i][L] || 0, state.run);
  const all = EP.every((_, k) => topLevel(k) > 0), next = EP[i + 1];
  const r = $('#screen-result');
  r.innerHTML = `<div class="res-tools"><button class="back pt-open" type="button">Periodiek systeem</button><button class="back mol-open" type="button">Molrekenschema</button></div><div class="rv-sum">${passed ? stampSVG(ep, i, true, L) : ''}<h2>${passed ? `Welkom in ${ep.city}` : 'De douane laat je nog niet door'}</h2>${starRow(stars)}<span class="lvpill l${L}">Niveau ${LVN[L].toLowerCase()} &middot; punten ×${String(LVM[L]).replace('.', ',')}</span><p>${ok} van de ${n} vragen goed &middot; ${state.run} punten. ${passed ? `Je krijgt een ${['', 'bronzen', 'zilveren', 'gouden'][L]} stempel.` : ''}${passed ? '' : ' Je hebt minstens 3 goede antwoorden nodig. Bekijk hieronder wat er misging en probeer het opnieuw met nieuwe getallen.'}</p><div class="res-actions" id="resActions"></div></div>
  <h3 class="rv-title">Nabespreking</h3><div class="rv-list">${res.map((x, k) => `<article class="rv ${x.ok ? 'good' : 'bad'}" style="--c:${ep.color}"><div class="rv-head"><span class="rv-n">Vraag ${k + 1}</span><div class="verdict ${x.ok ? 'good' : 'bad'} vd" data-k="${k}">${x.ok ? 'Goedgekeurd' : 'Afgekeurd'}</div></div><h4 class="q-text">${rich(x.q.text)}</h4>${showAnswer(x.q, x.a, x.ok)}<p class="rv-ex">${rich(x.q.explain || '')}</p>${x.a.hint && L > 1 ? `<p class="rv-tag">Hint gebruikt: −${HP[L]} punten</p>` : ''}${x.ok ? `<p class="rv-tag ok">+${x.gain} punten</p>` : ''}</article>`).join('')}</div>
  <div class="res-actions" id="resActions2"></div>`;
  const mk = (a, txt, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = txt; b.addEventListener('click', fn); a.appendChild(b); };
  [$('#resActions'), $('#resActions2')].forEach(a => {
    if (passed && next) mk(a, `Volgende bestemming: ${next.city}`, 'go', () => { refresh(); startEpisode(i + 1); });
    if (passed && all) mk(a, 'Bekijk je paspoort', 'go', () => { refresh(); showFinal(); });
    if (passed && L < 3) mk(a, `Probeer ${LVN[L + 1].toLowerCase()}`, 'line', () => { state.level = L + 1; beginEpisode(i); });
    mk(a, 'Nieuwe vragen', passed ? 'line' : 'go', () => beginEpisode(i));
    mk(a, 'Terug naar de kaart', 'line', () => { show('map'); refresh(); centerOn(state.cur); });
  });
  state.streak = 0;
  show('result'); refresh();
  // oordeel-stempels: één voor één neerzetten zodra ze in beeld komen
  const vds = [...r.querySelectorAll('.vd')];
  if (RM || !('IntersectionObserver' in window)) vds.forEach(v => v.classList.add('pop'));
  else {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('pop'); if (en.target.classList.contains('good')) burst(en.target); io.unobserve(en.target); } }), { threshold: 0.9 });
    vds.forEach(v => io.observe(v));
  }
}
function showFinal() {
  const lv = EP.map((_, i) => topLevel(i)), total = lv.reduce((a, b) => a + b, 0), max = EP.length * 3, cnt = l => lv.filter(x => x === l).length;
  const rank = total >= max * .85 ? 'Nobelprijskandidaat' : total >= max * .65 ? 'Meester-chemicus' : total >= max * .45 ? 'Scheikundig ontdekkingsreiziger' : 'Reiziger met labjas';
  const f = $('#screen-final');
  f.innerHTML = `<h2>Je paspoort is vol</h2><p class="rank">${rank}</p><div class="final-stamps">${EP.map((e, i) => stampSVG(e, i, false, lv[i])).join('')}</div><p>${totalScore()} punten. Je haalde ${cnt(1)} ${cnt(1) === 1 ? 'stad' : 'steden'} op makkelijk niveau (brons), ${cnt(2)} op medium (zilver) en ${cnt(3)} op moeilijk (goud). Wil je een mooiere stempel? Speel een stad opnieuw op een hoger niveau. Je krijgt telkens andere vragen met nieuwe getallen.</p><div class="res-actions"><button class="btn line" id="fMap">Terug naar de kaart</button><button class="btn go" id="fReset">Opnieuw beginnen</button></div>`;
  $('#fMap').addEventListener('click', () => { show('map'); refresh(); });
  $('#fReset').addEventListener('click', () => { state.best = {}; state.stars = {}; state.passed = {}; state.cur = 0; placeAt(0); show('map'); refresh(); centerOn(0); });
  show('final');
}

/* ============ START ============ */
buildMap(); refresh(); document.body.dataset.screen = 'map'; setTimeout(() => centerOn(0), 50);
/* ============================================================
   PERIODIEK SYSTEEM. Eén regel per element:
   Z, symbool, naam, atoommassa (u), elektronegativiteit (Pauling, 0 = onbekend),
   smeltpunt (K, 0 = onbekend), kookpunt (K, 0 = onbekend)
   Controleer waarden voor een toets altijd met Binas.
   ============================================================ */
const PT_RAW = `
1,H,waterstof,1.008,2.20,14,20
2,He,helium,4.003,0,0,4.2
3,Li,lithium,6.941,0.98,454,1615
4,Be,beryllium,9.012,1.57,1560,2742
5,B,boor,10.81,2.04,2349,4200
6,C,koolstof,12.01,2.55,0,3915
7,N,stikstof,14.01,3.04,63,77
8,O,zuurstof,16.00,3.44,54,90
9,F,fluor,19.00,3.98,54,85
10,Ne,neon,20.18,0,25,27
11,Na,natrium,22.99,0.93,371,1156
12,Mg,magnesium,24.31,1.31,923,1363
13,Al,aluminium,26.98,1.61,933,2792
14,Si,silicium,28.09,1.90,1687,3538
15,P,fosfor,30.97,2.19,317,550
16,S,zwavel,32.06,2.58,388,718
17,Cl,chloor,35.45,3.16,172,239
18,Ar,argon,39.95,0,84,87
19,K,kalium,39.10,0.82,337,1032
20,Ca,calcium,40.08,1.00,1115,1757
21,Sc,scandium,44.96,1.36,1814,3109
22,Ti,titaan,47.87,1.54,1941,3560
23,V,vanadium,50.94,1.63,2183,3680
24,Cr,chroom,52.00,1.66,2180,2944
25,Mn,mangaan,54.94,1.55,1519,2334
26,Fe,ijzer,55.85,1.83,1811,3134
27,Co,kobalt,58.93,1.88,1768,3200
28,Ni,nikkel,58.69,1.91,1728,3186
29,Cu,koper,63.55,1.90,1358,2835
30,Zn,zink,65.38,1.65,693,1180
31,Ga,gallium,69.72,1.81,303,2477
32,Ge,germanium,72.64,2.01,1211,3106
33,As,arseen,74.92,2.18,0,887
34,Se,seleen,78.96,2.55,494,958
35,Br,broom,79.90,2.96,266,332
36,Kr,krypton,83.80,3.00,116,120
37,Rb,rubidium,85.47,0.82,312,961
38,Sr,strontium,87.62,0.95,1050,1655
39,Y,yttrium,88.91,1.22,1799,3609
40,Zr,zirkonium,91.22,1.33,2128,4682
41,Nb,niobium,92.91,1.6,2750,5017
42,Mo,molybdeen,95.94,2.16,2896,4912
43,Tc,technetium,98,1.9,2430,4538
44,Ru,ruthenium,101.1,2.2,2607,4423
45,Rh,rodium,102.9,2.28,2237,3968
46,Pd,palladium,106.4,2.20,1828,3236
47,Ag,zilver,107.9,1.93,1235,2435
48,Cd,cadmium,112.4,1.69,594,1040
49,In,indium,114.8,1.78,430,2345
50,Sn,tin,118.7,1.96,505,2875
51,Sb,antimoon,121.8,2.05,904,1860
52,Te,telluur,127.6,2.1,723,1261
53,I,jood,126.9,2.66,387,457
54,Xe,xenon,131.3,2.6,161,165
55,Cs,cesium,132.9,0.79,302,944
56,Ba,barium,137.3,0.89,1000,2170
57,La,lanthaan,138.9,1.10,1193,3737
58,Ce,cerium,140.1,1.12,1068,3716
59,Pr,praseodymium,140.9,1.13,1208,3793
60,Nd,neodymium,144.2,1.14,1297,3347
61,Pm,promethium,145,0,1315,3273
62,Sm,samarium,150.4,1.17,1345,2067
63,Eu,europium,152.0,0,1099,1802
64,Gd,gadolinium,157.3,1.20,1585,3546
65,Tb,terbium,158.9,0,1629,3503
66,Dy,dysprosium,162.5,1.22,1680,2840
67,Ho,holmium,164.9,1.23,1734,2993
68,Er,erbium,167.3,1.24,1802,3141
69,Tm,thulium,168.9,1.25,1818,2223
70,Yb,ytterbium,173.0,0,1097,1469
71,Lu,lutetium,175.0,1.27,1925,3675
72,Hf,hafnium,178.5,1.3,2506,4876
73,Ta,tantaal,180.9,1.5,3290,5731
74,W,wolfraam,183.8,2.36,3695,5828
75,Re,rhenium,186.2,1.9,3459,5869
76,Os,osmium,190.2,2.2,3306,5285
77,Ir,iridium,192.2,2.20,2719,4701
78,Pt,platina,195.1,2.28,2041,4098
79,Au,goud,197.0,2.54,1337,3129
80,Hg,kwik,200.6,2.00,234,630
81,Tl,thallium,204.4,1.62,577,1746
82,Pb,lood,207.2,2.33,601,2022
83,Bi,bismut,209.0,2.02,544,1837
84,Po,polonium,209,2.0,527,1235
85,At,astaat,210,2.2,0,0
86,Rn,radon,222,2.2,202,211
87,Fr,francium,223,0,0,0
88,Ra,radium,226,0.9,973,2010
89,Ac,actinium,227,1.1,1323,3573
90,Th,thorium,232.0,1.3,2115,5061
91,Pa,protactinium,231,1.5,1841,4300
92,U,uranium,238.0,1.38,1405,4404
93,Np,neptunium,237,1.36,917,4273
94,Pu,plutonium,244,1.28,913,3501
95,Am,americium,243,1.3,1449,2880
96,Cm,curium,247,1.3,1613,3383
97,Bk,berkelium,247,0,0,0
98,Cf,californium,251,0,0,0
99,Es,einsteinium,252,0,0,0
100,Fm,fermium,258,0,0,0
101,Md,mendelevium,257,0,0,0
102,No,nobelium,259,0,0,0
103,Lr,lawrencium,262,0,0,0
104,Rf,rutherfordium,267,0,0,0
105,Db,dubnium,268,0,0,0
106,Sg,seaborgium,269,0,0,0
107,Bh,bohrium,270,0,0,0
108,Hs,hassium,269,0,0,0
109,Mt,meitnerium,278,0,0,0
110,Ds,darmstadtium,281,0,0,0
111,Rg,roentgenium,281,0,0,0
112,Cn,copernicium,285,0,0,0
113,Nh,nihonium,286,0,0,0
114,Fl,flerovium,289,0,0,0
115,Mc,moscovium,288,0,0,0
116,Lv,livermorium,293,0,0,0
117,Ts,tennessine,294,0,0,0
118,Og,oganesson,294,0,0,0
`;

/* Afwijkende elektronenconfiguraties (alleen de orbitalen buiten de edelgaskern) */
const PT_CONF_EXC = {
  24: { '3d': 5, '4s': 1 }, 29: { '3d': 10, '4s': 1 },
  41: { '4d': 4, '5s': 1 }, 42: { '4d': 5, '5s': 1 }, 44: { '4d': 7, '5s': 1 }, 45: { '4d': 8, '5s': 1 },
  46: { '4d': 10, '5s': 0 }, 47: { '4d': 10, '5s': 1 },
  57: { '5d': 1, '6s': 2, '4f': 0 }, 58: { '4f': 1, '5d': 1, '6s': 2 }, 64: { '4f': 7, '5d': 1, '6s': 2 },
  78: { '5d': 9, '6s': 1 }, 79: { '5d': 10, '6s': 1 },
  89: { '6d': 1, '7s': 2, '5f': 0 }, 90: { '6d': 2, '7s': 2, '5f': 0 }, 91: { '5f': 2, '6d': 1, '7s': 2 },
  92: { '5f': 3, '6d': 1, '7s': 2 }, 93: { '5f': 4, '6d': 1, '7s': 2 }, 96: { '5f': 7, '6d': 1, '7s': 2 },
  103: { '5f': 14, '7s': 2, '6d': 0, '7p': 1 }
};
/* Elementen waarvan de massa een massagetal is (geen stabiele isotoop) */
const PT_MASSNUM = new Set([43, 61, 84, 85, 86, 87, 88, 89, ...Array.from({ length: 26 }, (_, k) => 93 + k)]);
/* Veelvoorkomende ionladingen */
const PT_IONS = { 1: 'H⁺', 7: 'N³⁻', 8: 'O²⁻', 9: 'F⁻', 13: 'Al³⁺', 15: 'P³⁻', 16: 'S²⁻', 17: 'Cl⁻', 24: 'Cr³⁺', 25: 'Mn²⁺', 26: 'Fe²⁺ en Fe³⁺', 27: 'Co²⁺', 28: 'Ni²⁺', 29: 'Cu⁺ en Cu²⁺', 30: 'Zn²⁺', 34: 'Se²⁻', 35: 'Br⁻', 47: 'Ag⁺', 50: 'Sn²⁺ en Sn⁴⁺', 53: 'I⁻', 80: 'Hg²⁺', 82: 'Pb²⁺' };
const PT_NOTE = { 2: 'Smelt alleen onder hoge druk; het kookpunt geldt bij 1 atm.', 6: 'Sublimeert bij ongeveer 3915 K (geen smeltpunt bij 1 atm).', 33: 'Sublimeert bij ongeveer 887 K.' };
const PT_CATS = {
  alkali: ['Alkalimetalen', '#FF6B6B'], aardalkali: ['Aardalkalimetalen', '#FF9F43'], overgang: ['Overgangsmetalen', '#5EA8FF'],
  lanthanide: ['Lanthaniden', '#B79BFF'], actinide: ['Actiniden', '#FF7AC8'], metaal: ['Overige metalen', '#9FB2C4'],
  halfmetaal: ['Halfmetalen', '#C9DE55'], niet: ['Niet-metalen', '#3DDC97'], halogeen: ['Halogenen', '#4DD8E8'], edelgas: ['Edelgassen', '#E3E9F1']
};

const PT = (() => {
  const nobles = [2, 10, 18, 36, 54, 86], coreEnd = { 2: '1s', 10: '2p', 18: '3p', 36: '4p', 54: '5p', 86: '6p' };
  const order = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'];
  const cap = { s: 2, p: 6, d: 10, f: 14 };
  const sup = n => String(n).replace(/\d/g, d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  const sortKey = o => +o[0] * 10 + 'spdf'.indexOf(o[1]);
  return PT_RAW.trim().split('\n').map(line => {
    const [z, sym, naam, mass, en, mp, bp] = line.split(','), Z = +z;
    // plek in tabel
    let row, col, f = false;
    if (Z === 1) { row = 1; col = 1; } else if (Z === 2) { row = 1; col = 18; }
    else if (Z <= 4) { row = 2; col = Z - 2; } else if (Z <= 10) { row = 2; col = Z + 8; }
    else if (Z <= 12) { row = 3; col = Z - 10; } else if (Z <= 18) { row = 3; col = Z; }
    else if (Z <= 36) { row = 4; col = Z - 18; } else if (Z <= 54) { row = 5; col = Z - 36; }
    else if (Z <= 56) { row = 6; col = Z - 54; } else if (Z <= 71) { row = 9; col = Z - 54; f = true; }
    else if (Z <= 86) { row = 6; col = Z - 68; } else if (Z <= 88) { row = 7; col = Z - 86; }
    else if (Z <= 103) { row = 10; col = Z - 86; f = true; } else { row = 7; col = Z - 100; }
    const period = row <= 7 ? row : row === 9 ? 6 : 7;
    const block = f ? 'f' : (col <= 2 || Z === 2) ? 's' : col >= 13 ? 'p' : 'd';
    // categorie
    let cat;
    if ([2, 10, 18, 36, 54, 86, 118].includes(Z)) cat = 'edelgas';
    else if ([9, 17, 35, 53, 85, 117].includes(Z)) cat = 'halogeen';
    else if ([5, 14, 32, 33, 51, 52].includes(Z)) cat = 'halfmetaal';
    else if ([1, 6, 7, 8, 15, 16, 34].includes(Z)) cat = 'niet';
    else if (Z >= 57 && Z <= 71) cat = 'lanthanide';
    else if (Z >= 89 && Z <= 103) cat = 'actinide';
    else if (col === 1) cat = 'alkali';
    else if (col === 2) cat = 'aardalkali';
    else if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(Z)) cat = 'metaal';
    else cat = 'overgang';
    // elektronenconfiguratie
    const cnt = {}; let left = Z;
    for (const o of order) { const c = Math.min(left, cap[o[1]]); cnt[o] = c; left -= c; if (!left) break; }
    Object.assign(cnt, PT_CONF_EXC[Z] || {});
    const core = [...nobles].reverse().find(n => n < Z);
    const coreIdx = core ? order.indexOf(coreEnd[core]) : -1;
    const shown = order.filter((o, i) => i > coreIdx && cnt[o]).sort((a, b) => sortKey(a) - sortKey(b));
    const sym2 = core ? ({ 2: 'He', 10: 'Ne', 18: 'Ar', 36: 'Kr', 54: 'Xe', 86: 'Rn' })[core] : '';
    const conf = (core ? `[${sym2}] ` : '') + shown.map(o => o + sup(cnt[o])).join(' ');
    // valentie-elektronen voor hoofdgroepen
    const val = Z === 2 ? 2 : (col <= 2 && !f) ? col : (col >= 13 && !f) ? col - 10 : null;
    const state = [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86].includes(Z) ? 'gas' : [35, 80].includes(Z) ? 'vloeistof' : Z >= 104 ? 'onbekend' : 'vast';
    const massStr = (PT_MASSNUM.has(Z) ? '(' + mass + ')' : mass).replace('.', ',');
    return { Z, sym, naam, mass: +mass, massStr, en: +en, mp: +mp, bp: +bp, row, col, f, period, block, cat, conf, val, state, rad: Z === 43 || Z === 61 || Z >= 84 };
  });
})();
/* ============ PERIODIEK SYSTEEM: WEERGAVE ============ */
(() => {
  const ov = document.createElement('div');
  ov.className = 'pt-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'ptTitle');
  ov.innerHTML = `<div class="pt-panel"><div class="pt-top"><h2 id="ptTitle">Periodiek systeem</h2><button class="pt-close" type="button" id="ptClose">Sluiten (Esc)</button></div>
    <div class="pt-detail" id="ptDetail" aria-live="polite"></div>
    <div class="pt-leg" id="ptLeg" role="group" aria-label="Filter op soort element"></div>
    <div class="pt-scroll"><div class="pt-grid" id="ptGrid"></div></div>
    <p class="pt-tip">Tik op een element voor de gegevens. Tik op een soort hierboven om die elementen te markeren. Atoommassa’s zijn afgerond volgens het BINAS-gebaseerde periodiek systeem van Exactwatjezoekt.nl.</p></div>`;
  document.body.appendChild(ov);

  let sel = 6, filter = null, lastFocus = null;
  const fmt = (x, d = 0) => x.toLocaleString('nl-NL', { minimumFractionDigits: d, maximumFractionDigits: d });
  const temp = k => k ? `${fmt(k)} K (${fmt(k - 273.15)} °C)` : 'onbekend';
  const col = e => PT_CATS[e.cat][1];

  // rooster
  let g = '';
  PT.forEach(e => {
    g += `<button type="button" class="el" data-z="${e.Z}" style="--c:${col(e)};grid-row:${e.row};grid-column:${e.col}" aria-label="${e.naam}, ${e.sym}, atoomnummer ${e.Z}" aria-pressed="false"><span class="n">${e.Z}</span><span class="s">${e.sym}</span></button>`;
  });
  g += `<div class="ph" style="grid-row:6;grid-column:3">57–71</div><div class="ph" style="grid-row:7;grid-column:3">89–103</div>`;
  $('#ptGrid').innerHTML = g;
  $('#ptLeg').innerHTML = Object.entries(PT_CATS).map(([k, [name, c]]) => `<button type="button" data-cat="${k}" style="--c:${c}" aria-pressed="false"><i></i>${name}</button>`).join('');

  function detail() {
    const e = PT[sel - 1], c = col(e);
    const ion = PT_IONS[e.Z] || (e.col === 1 && !e.f ? `${e.sym}⁺` : e.col === 2 && !e.f ? `${e.sym}²⁺` : null);
    const stoestand = { gas: 'gas', vloeistof: 'vloeistof', vast: 'vast', onbekend: 'onbekend' }[e.state];
    const massNote = PT_MASSNUM.has(e.Z) ? 'Massagetal van de langstlevende isotoop. Dit element heeft geen stabiele isotoop.' : '';
    const rows = [
      ['Atoommassa', `<dd class="big">${e.massStr} u</dd>`],
      ['Molaire massa', `<dd class="big">${e.massStr} g/mol</dd>`],
      ['Groep en periode', `<dd>${e.f ? 'f-blok (geen hoofdgroep)' : 'Groep ' + e.col} · periode ${e.period}</dd>`],
      ['Blok', `<dd>${e.block}-blok</dd>`],
      ['Elektronegativiteit', `<dd>${e.en ? fmt(e.en, 2) + ' (Pauling)' : 'geen waarde'}</dd>`],
      ['Aggregatietoestand (298 K)', `<dd>${stoestand}</dd>`],
      ['Smeltpunt', `<dd>${temp(e.mp)}</dd>`],
      ['Kookpunt', `<dd>${temp(e.bp)}</dd>`],
      ['Elektronenconfiguratie', `<dd>${rich(e.conf)}</dd>`]
    ];
    if (e.val != null) rows.push(['Valentie-elektronen', `<dd>${e.val}</dd>`]);
    if (ion) rows.push(['Veelvoorkomend ion', `<dd>${rich(ion)}</dd>`]);
    if (e.rad) rows.push(['Radioactief', '<dd>ja</dd>']);
    const notes = [PT_NOTE[e.Z], massNote].filter(Boolean).join(' ');
    $('#ptDetail').style.setProperty('--c', c);
    $('#ptDetail').innerHTML = `<div class="pt-tile" style="--c:${c}"><span class="z">${e.Z}</span><span class="sy">${e.sym}</span><span class="m">${e.massStr}</span></div>
      <div class="pt-info" style="--c:${c}"><h3>${e.naam}</h3><span class="cat">${PT_CATS[e.cat][0]}</span><dl>${rows.map(([t, d]) => `<div><dt>${t}</dt>${d}</div>`).join('')}${notes ? `<p class="note">${notes}</p>` : ''}</dl></div>`;
    document.querySelectorAll('.el').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.z === sel)));
  }
  function applyFilter() {
    document.querySelectorAll('.el').forEach(b => b.classList.toggle('dim', !!filter && PT[+b.dataset.z - 1].cat !== filter));
    document.querySelectorAll('#ptLeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === filter)));
  }
  $('#ptGrid').addEventListener('click', ev => { const b = ev.target.closest('.el'); if (b) { sel = +b.dataset.z; detail(); } });
  $('#ptLeg').addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; filter = filter === b.dataset.cat ? null : b.dataset.cat; applyFilter(); });

  function open() {
    lastFocus = document.activeElement; ov.hidden = false; document.body.style.overflow = 'hidden'; ov.scrollTop = 0;
    detail(); applyFilter(); $('#ptClose').focus({ preventScroll: true });
  }
  function close() { ov.hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  $('#ptClose').addEventListener('click', close);
  ov.addEventListener('click', ev => { if (ev.target === ov) close(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !ov.hidden) close(); });
  document.addEventListener('click', ev => { if (ev.target.closest('.pt-open')) open(); });
})();
/* ============ MOLREKENSCHEMA ============ */
(() => {
  const sub = s => s.replace(/_(\w+)/g, '<tspan dy="4" font-size="12">$1</tspan>');
  const ARR = [
    { id: 0, x1: 390, y1: 116, x2: 390, y2: 189, lx: 378, ly: 158, an: 'end', rule: '× V', sym: 'V', from: 'molariteit', to: 'mol', fm: 'n = c × V', ex: '0,10 mol/L × 0,250 L = 0,025 mol', tip: 'Reken mL eerst om naar L: 250 mL = 0,250 L.' },
    { id: 1, x1: 460, y1: 189, x2: 460, y2: 116, lx: 472, ly: 158, an: 'start', rule: ': V', sym: 'V', from: 'mol', to: 'molariteit', fm: 'c = n / V', ex: '0,025 mol : 0,250 L = 0,10 mol/L', tip: 'V is het volume van de oplossing in liter.' },
    { id: 2, x1: 390, y1: 311, x2: 390, y2: 404, lx: 378, ly: 358, an: 'end', rule: '× V_m', sym: 'Vm', from: 'mol', to: 'dm³ gas', fm: 'V = n × Vm', ex: '0,50 mol × 24,5 dm³/mol = 12 dm³', tip: 'Vm hangt af van temperatuur en druk. Zoek de waarde in Binas, bijvoorbeeld 22,4 dm³/mol bij 273 K en 24,5 dm³/mol bij 298 K (p = 1,013·10⁵ Pa).' },
    { id: 3, x1: 460, y1: 404, x2: 460, y2: 311, lx: 472, ly: 358, an: 'start', rule: ': V_m', sym: 'Vm', from: 'dm³ gas', to: 'mol', fm: 'n = V / Vm', ex: '49,0 dm³ : 24,5 dm³/mol = 2,00 mol', tip: 'Gebruik de Vm die bij de gegeven temperatuur hoort.' },
    { id: 4, x1: 324, y1: 222, x2: 196, y2: 222, lx: 260, ly: 210, an: 'middle', rule: '× M', sym: 'M', from: 'mol', to: 'gram', fm: 'm = n × M', ex: '0,50 mol NaCl × 58,44 g/mol = 29,2 g', tip: 'M vind je in het periodiek systeem: de atoommassa in u is de molaire massa in g/mol. Tel bij een molecuul de massa van alle atomen op.', pt: true },
    { id: 5, x1: 196, y1: 278, x2: 324, y2: 278, lx: 260, ly: 300, an: 'middle', rule: ': M', sym: 'M', from: 'gram', to: 'mol', fm: 'n = m / M', ex: '36,0 g H₂O : 18,02 g/mol = 2,00 mol', tip: 'Bereken M(H₂O) = 2 × 1,008 + 15,999 = 18,02 g/mol.', pt: true },
    { id: 6, x1: 526, y1: 222, x2: 654, y2: 222, lx: 590, ly: 210, an: 'middle', rule: '× N_A', sym: 'NA', from: 'mol', to: 'deeltjes', fm: 'N = n × N_A', ex: '0,50 mol × 6,022·10²³ per mol = 3,0·10²³ moleculen', tip: 'Deeltjes zijn atomen, moleculen of ionen. Dat hangt af van de stof.' },
    { id: 7, x1: 654, y1: 278, x2: 526, y2: 278, lx: 590, ly: 300, an: 'middle', rule: ': N_A', sym: 'NA', from: 'deeltjes', to: 'mol', fm: 'n = N / N_A', ex: '1,2·10²⁴ deeltjes : 6,022·10²³ per mol = 2,0 mol', tip: 'Schrijf grote aantallen in wetenschappelijke notatie.' },
    { id: 8, x1: 70, y1: 311, x2: 70, y2: 404, lx: 58, ly: 358, an: 'end', rule: ': ρ', sym: 'ρ', from: 'gram', to: 'cm³ (of mL)', fm: 'V = m / ρ', ex: '27 g aluminium : 2,70 g/cm³ = 10,0 cm³', tip: '1 cm³ is hetzelfde als 1 mL. De dichtheid ρ staat in Binas.' },
    { id: 9, x1: 130, y1: 404, x2: 130, y2: 311, lx: 142, ly: 358, an: 'start', rule: '× ρ', sym: 'ρ', from: 'cm³ (of mL)', to: 'gram', fm: 'm = V × ρ', ex: '25 cm³ water × 1,00 g/cm³ = 25 g', tip: 'Dit schema verbindt volume en massa van een vloeistof of vaste stof.' }
  ];
  function arrow(a) {
    const dx = a.x2 - a.x1, dy = a.y2 - a.y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const ex = a.x2 - ux * 9, ey = a.y2 - uy * 9;
    const head = `${a.x2},${a.y2} ${(a.x2 - ux * 12 + px * 6.5).toFixed(1)},${(a.y2 - uy * 12 + py * 6.5).toFixed(1)} ${(a.x2 - ux * 12 - px * 6.5).toFixed(1)},${(a.y2 - uy * 12 - py * 6.5).toFixed(1)}`;
    const dir = `${a.from} naar ${a.to}`;
    return `<g class="ar" data-i="${a.id}" tabindex="0" role="button" aria-label="${dir}: ${a.rule.replace('_', '')}"><line class="hit" x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}"/><line x1="${a.x1}" y1="${a.y1}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/><polygon class="hd" points="${head}"/><text class="lb" x="${a.lx}" y="${a.ly}" text-anchor="${a.an}">${sub(a.rule)}</text></g>`;
  }
  const box = (x, y, cls, lines) => `<rect class="bx ${cls}" x="${x}" y="${y}" width="${x === 330 ? 190 : 180}" height="${y === 195 ? 110 : 100}" rx="8"/>` + lines.map(([t, k, dy]) => `<text class="${k}${cls ? ' mid-t' : ''}" x="${x + (x === 330 ? 95 : 90)}" y="${y + dy}">${t}</text>`).join('');
  const two = [['aantal', 'bt', 38]];
  const svg = `<svg id="molSvg" viewBox="0 0 860 530" role="group" aria-label="Molrekenschema: omrekenen tussen mol, gram, deeltjes, dm³ gas, cm³ en molariteit">
    ${box(330, 10, '', [['molariteit', 'bt', 38], ['mol/L', 'bb', 70]])}
    ${box(10, 195, '', [['aantal', 'bt', 36], ['gram', 'bb', 62], ['stof', 'bt', 86]])}
    ${box(330, 195, 'mid', [['aantal', 'bt', 36], ['mol', 'bb', 62], ['stof', 'bt', 86]])}
    ${box(660, 195, '', [['aantal', 'bt', 36], ['deeltjes', 'bb', 62]])}
    ${box(10, 410, '', [['aantal', 'bt', 38], ['cm³ (of mL)', 'bb', 70]])}
    ${box(330, 410, '', [['aantal', 'bt', 38], ['dm³ gas', 'bb', 70]])}
    <text class="un" x="425" y="164">L</text><text class="un" x="425" y="363">dm³/mol</text><text class="un" x="260" y="254">g/mol</text>
    <text class="un" x="590" y="247">6,022·10²³</text><text class="un" x="590" y="262">deeltjes/mol</text><text class="un" x="100" y="363">g/cm³</text>
    ${ARR.map(arrow).join('')}</svg>`;

  const ov = document.createElement('div');
  ov.className = 'pt-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'molTitle');
  ov.innerHTML = `<div class="pt-panel"><div class="pt-top"><h2 id="molTitle">Molrekenschema</h2><button class="pt-close" type="button" id="molClose">Sluiten (Esc)</button></div>
    <p class="pt-tip">Tik op een pijl voor de formule en een voorbeeld. Alles loopt via het aantal mol in het midden.</p>
    <div class="mol-wrap"><div class="mol-scroll">${svg}</div><div class="mol-info" id="molInfo" aria-live="polite"></div></div></div>`;
  document.body.appendChild(ov);

  let sel = 4, lastFocus = null;
  function info() {
    const a = ARR[sel], verb = a.rule.startsWith('×') ? 'Vermenigvuldig met' : 'Deel door';
    const symTxt = { Vm: 'V<sub>m</sub> (molair volume)', M: 'M (molaire massa)', NA: 'N<sub>A</sub> (getal van Avogadro)', 'ρ': 'ρ (dichtheid)', V: 'V (volume in liter)' }[a.sym] || a.sym;
    const fm = a.fm.replace(/Vm/g, 'V<sub>m</sub>').replace('N_A', 'N<sub>A</sub>'), tip = rich(a.tip).replace(/\bVm\b/g, 'V<sub>m</sub>');
    $('#molInfo').innerHTML = `<span class="dir">${a.from} → ${a.to}</span><h3>${verb} ${symTxt}</h3><div class="fm">${fm}</div><div class="ex"><small>Voorbeeld</small>${rich(a.ex)}</div><p class="tip">${tip}</p>${a.pt ? '<button class="btn go" type="button" id="molToPt">Open periodiek systeem</button>' : ''}`;
    document.querySelectorAll('#molSvg .ar').forEach(g => g.classList.toggle('on', +g.dataset.i === sel));
    const b = $('#molToPt'); if (b) b.addEventListener('click', () => { close(); document.querySelector('.pt-btn.pt-open').click(); });
  }
  $('#molSvg').addEventListener('click', ev => { const g = ev.target.closest('.ar'); if (g) { sel = +g.dataset.i; info(); } });
  $('#molSvg').addEventListener('keydown', ev => { const g = ev.target.closest('.ar'); if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); sel = +g.dataset.i; info(); g.focus(); } });
  function open() { lastFocus = document.activeElement; ov.hidden = false; document.body.style.overflow = 'hidden'; ov.scrollTop = 0; info(); $('#molClose').focus({ preventScroll: true }); }
  function close() { ov.hidden = true; document.body.style.overflow = ''; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }
  $('#molClose').addEventListener('click', close);
  ov.addEventListener('click', ev => { if (ev.target === ov) close(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !ov.hidden) close(); });
  document.addEventListener('click', ev => { if (ev.target.closest('.mol-open')) open(); });
})();
