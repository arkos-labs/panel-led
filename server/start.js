
import { spawn } from 'child_process';
import path from 'path';

console.log("🚀 Lancement du serveur sécurisé (Node v24 workaround)...");

const serverProcess = spawn('node', ['--openssl-legacy-provider', 'server/index.js'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: "3001" } // Force port 3001
});

serverProcess.on('error', (err) => {
    console.error('❌ Erreur de lancement:', err);
});

serverProcess.on('close', (code) => {
    console.log(`⚠️ Serveur arrêté avec le code ${code}`);
});
