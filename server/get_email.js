
import fs from 'fs';
import path from 'path';

const credPath = path.resolve('credentials.json');
try {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    console.log("EMAIL:" + creds.client_email);
} catch (e) {
    console.log("ERROR");
}
