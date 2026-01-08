
import fetch from 'node-fetch';

const ORS_API_KEY = '5b3ce3597851110001cf62480914993c9e614716b19e51b17409dbac'; // From server/index.js

const payload = {
    jobs: [
        {
            id: 1,
            amount: [1],
            location: [2.3522, 48.8566] // Paris
        },
        {
            id: 2,
            amount: [1],
            location: [4.8357, 45.7640] // Lyon
        }
    ],
    vehicles: [
        {
            id: 1,
            profile: "driving-car",
            start: [2.3522, 48.8566],
            end: [2.3522, 48.8566],
            capacity: [4]
        }
    ]
};

async function testORS() {
    console.log("Testing Cloud ORS API...");
    try {
        const response = await fetch('https://api.openrouteservice.org/optimization', {
            method: 'POST',
            headers: {
                'Authorization': ORS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("✅ ORS Success:", JSON.stringify(data, null, 2));
        } else {
            console.error("❌ ORS Error:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("❌ Network/Script Error:", e);
    }
}

testORS();
