
import fetch from 'node-fetch';

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
            profile: "car",
            start: [2.3522, 48.8566],
            end: [2.3522, 48.8566],
            capacity: [4]
        }
    ]
};

async function testLocalVroom() {
    console.log("Testing LOCAL VROOM (Docker port 3000)...");
    try {
        const response = await fetch('http://localhost:3000/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("✅ LOCAL VROOM SUCCESS:", JSON.stringify(data, null, 2).substring(0, 200) + "...");
        } else {
            console.error("❌ LOCAL VROOM ERROR:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("❌ Network Exception:", e.message);
    }
}

testLocalVroom();
