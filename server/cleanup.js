
import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PORTS = [3001, 8080, 8081];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCK_FILE = path.join(__dirname, 'bridge.lock');

console.log('🧹 [CLEANUP] Vérification des ports occupés...');

// --- LOCK FILE CLEANUP ---
if (fs.existsSync(LOCK_FILE)) {
    try {
        fs.unlinkSync(LOCK_FILE);
        console.log('🔓 [CLEANUP] Fichier bridge.lock supprimé.');
    } catch (e) {
        console.error('❌ [CLEANUP] Impossible de supprimer bridge.lock:', e.message);
    }
}

// --- PORT KILLER ---
function killPort(port) {
    const command = os.platform() === 'win32'
        ? `netstat -ano | findstr :${port}`
        : `lsof -i :${port} -t`;

    exec(command, (err, stdout) => {
        if (err || !stdout) return; // Rien trouvé, tout va bien

        const lines = stdout.trim().split('\n');
        lines.forEach(line => {
            let pid;
            if (os.platform() === 'win32') {
                // Windows: "  TCP    0.0.0.0:3001    0.0.0.0:0    LISTENING    12345"
                const parts = line.trim().split(/\s+/);
                pid = parts[parts.length - 1]; // PID est à la fin
            } else {
                pid = line.trim();
            }

            if (pid && !isNaN(pid) && parseInt(pid) > 0) {
                console.log(`💀 [CLEANUP] Tuer le processus PID ${pid} sur le port ${port}`);
                try {
                    process.kill(pid, 'SIGKILL');
                } catch (e) {
                    // Ignore si déjà mort
                }
            }
        });
    });
}

PORTS.forEach(killPort);

// Petit délai pour laisser le temps au système de libérer les ressources
setTimeout(() => {
    console.log('✨ [CLEANUP] Nettoyage terminé.');
    process.exit(0);
}, 1000);
