
import fetch from 'node-fetch';

// Trying a different free tier key
const KEY = '5b3ce3597851110001cf62480914993c306443770ea457388089e273';

const payload = {
    jobs: [{ id: 1, amount: [1], location: [2.3522, 48.8566] }, { id: 2, amount: [1], location: [4.8357, 45.7640] }],
    vehicles: [{ id: 1, profile: "driving-car", start: [2.3522, 48.8566], end: [2.3522, 48.8566], capacity: [4] }]
};

async function testORS() {
    console.log("Testing Key:", KEY);
    try {
        const response = await fetch('https://api.openrouteservice.org/optimization', {
            method: 'POST',
            headers: { 'Authorization': KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        console.log(response.ok ? "✅ KEY IS VALID" : "❌ KEY IS DEAD: " + JSON.stringify(data));
    } catch (e) {
        console.error("error", e);
    }
}
testORS();
