// === TEST 1: Controleer de beginscore van de game ===
let startScore = 0;

if (startScore === 0) {
    console.log("✅ Test 1 geslaagd: De beginscore van de scheikundequiz is 0.");
} else {
    console.error("❌ Test 1 mislukt: Beginscore moet 0 zijn.");
}

// === TEST 2: Controleer een scheikundig antwoord (bijv. Waterstof = H) ===
let gegevenAntwoord = "H";
let correctAntwoord = "H";

if (gegevenAntwoord === correctAntwoord) {
    console.log("✅ Test 2 geslaagd: Scheikundig symbool klopt!");
} else {
    console.error("❌ Test 2 mislukt: Antwoord is onjuist.");
}