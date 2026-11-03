// Haal de functies op uit app.js
const { controleerCode, normaliseerCode } = require('./app.js');

console.log("=== START KWALITEITSTESTEN ===");

// TEST 1: Controleer of een lege invoer netjes wordt afgewezen
const uitslagLeeg = controleerCode('');
if (uitslagLeeg.geldig === false && uitslagLeeg.reden === 'leeg') {
    console.log("✅ Test 1 geslaagd: Lege code geeft correct 'leeg' terug.");
} else {
    console.error("❌ Test 1 mislukt.");
}

// TEST 2: Controleer of een code met de foute lengte wordt afgewezen
const uitslagLengte = controleerCode('CHEM123'); // Moet 12 tekens zijn
if (uitslagLengte.geldig === false && uitslagLengte.reden === 'lengte') {
    console.log("✅ Test 2 geslaagd: Foute lengte geeft correct 'lengte' terug.");
} else {
    console.error("❌ Test 2 mislukt.");
}

// EXTRA TEST: Controleer of kleine letters en spaties goed schoongemaakt worden
const opgeschoond = normaliseerCode('chem-ab12 cd34');
if (opgeschoond === 'CHEMAB12CD34') {
    console.log("✅ Test 3 geslaagd: Code opschonen (normaliseren) werkt perfect.");
} else {
    console.error("❌ Test 3 mislukt.");
}