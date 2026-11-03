/* ============================================================
   app.js  -  Product (Chef Product)
   Chemie Wereldreis PREMIUM: extra uitleg voor 50 cent.

   De hoofdfunctie is controleerCode(): hoort deze code bij een
   verkochte premium-toegang? De rest zijn kleine hulpfuncties.
   Geen DOM nodig, dus ook te testen met Node (tests.js).
   ============================================================ */

const PREMIUM_PRIJS_CENT = 50;
const PREMIUM_SLEUTEL = 'chemieWereldreis.premium.v1';

// Hashes van de verkochte codes (gemaakt met tools/codes-maken.js).
// De codes zelf staan hier niet, alleen hun "vingerafdruk".
const GELDIGE_CODE_HASHES = [
  6827949199443371, 7901984743318494, 4698855044015479, 8473386156223139, 2549683797018499, 890035016003566, 6158022376051197, 1094214478354648, 2333837623619387, 3316056986122810, 5120281636532178, 4611179140754326, 7130372990319502, 3674582514890133, 7635088100955397, 5028794911130251, 4407025706055650, 2067528687196734, 3578932072421988, 5460087609493913, 6964341696598707, 8681487477925717, 3906759248752952, 6625616651522591, 4783979910780334, 7164798846136927, 1081785418837489, 8159183640563563, 516554672941180, 8018153118662596
];

// Maakt van "chem-ab12 cd34" -> "CHEMAB12CD34"
function normaliseerCode(invoer) {
  return String(invoer == null ? '' : invoer).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Eenvoudige hash (cyrb53): zelfde tekst geeft altijd hetzelfde getal.
function hashCode(tekst) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// DE HOOFDFUNCTIE.
// Geeft { geldig: true/false, reden: 'ok' | 'leeg' | 'lengte' | 'onbekend' } terug.
function controleerCode(invoer, hashes = GELDIGE_CODE_HASHES) {
  const code = normaliseerCode(invoer);
  if (code === '') return { geldig: false, reden: 'leeg' };
  if (code.length !== 12) return { geldig: false, reden: 'lengte' };   // CHEM + 8 tekens
  if (!code.startsWith('CHEM')) return { geldig: false, reden: 'onbekend' };
  return hashes.includes(hashCode(code))
    ? { geldig: true, reden: 'ok' }
    : { geldig: false, reden: 'onbekend' };
}

// Onthoudt in de browser dat deze speler premium heeft.
function ontgrendelPremium(invoer) {
  const uitkomst = controleerCode(invoer);
  if (uitkomst.geldig) {
    try { localStorage.setItem(PREMIUM_SLEUTEL, '1'); } catch (e) { /* opslag geblokkeerd */ }
  }
  return uitkomst;
}

function isPremium() {
  try { return localStorage.getItem(PREMIUM_SLEUTEL) === '1'; } catch (e) { return false; }
}

if (typeof module !== 'undefined') {
  module.exports = { controleerCode, normaliseerCode, hashCode, PREMIUM_PRIJS_CENT };
}