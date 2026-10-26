/*
 * Voortgang opslaan in deze browser.
 * Let op: localStorage is per browser/apparaat en per website-adres.
 * Wis je browsergegevens of open je spel op een ander apparaat, dan kan
 * de opgeslagen voortgang ontbreken.
 */
const VOORTGANG_KEY = 'chemieWereldreisVoortgang_v1';

function loadVoortgang() {
  try {
    const raw = localStorage.getItem(VOORTGANG_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    console.warn('Voortgang kon niet worden geladen:', error);
    return {};
  }
}

function saveVoortgang() {
  try {
    if (typeof window.exportVoortgang !== 'function') return;
    localStorage.setItem(VOORTGANG_KEY, JSON.stringify(window.exportVoortgang()));
  } catch (error) {
    console.warn('Voortgang kon niet worden opgeslagen:', error);
  }
}

// Gebeurtenissen worden na de spelhandlers opgeslagen, zodat de nieuwste
// score of voortgang in state staat voordat we die naar localStorage schrijven.
['click', 'input', 'change'].forEach(type => {
  document.addEventListener(type, () => window.setTimeout(saveVoortgang, 0));
});
window.addEventListener('pagehide', saveVoortgang);
window.addEventListener('beforeunload', saveVoortgang);
