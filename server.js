const { spawn } = require('child_process');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Mot de passe administrateur récupéré depuis Clever Cloud (ou valeur par défaut sécurisée)
const ADMIN_PASSWORD = process.env.VNC_ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
const VNC_PASS_FILE = path.join(process.env.HOME, '.vnc', 'passwd');
console.log(`[INIT] Mot de passe d'accès généré/configuré.`);
execSync(`mkdir -p ${path.dirname(VNC_PASS_FILE)}`);
// Utilisation de vncpasswd pour écrire le mot de passe haché sans interaction
execSync(`printf "%s\n%s\n" "${ADMIN_PASSWORD}" "${ADMIN_PASSWORD}" | vncpasswd -f > ${VNC_PASS_FILE}`);
execSync(`chmod 600 ${VNC_PASS_FILE}`);

// 1. Démarrage de TigerVNC (affichage virtuel :1)
const vncServer = spawn('vncserver', [':1', '-geometry', '1280x720', '-depth', '24', '-localhost', 'no'], {
    env: { ...process.env, HOME: process.env.HOME }
});
vncServer.stdout.on('data', (data) => console.log(`[VNC]: ${data}`));
vncServer.stderr.on('data', (data) => console.error(`[VNC Error]: ${data}`));

// 2. Démarrage de Websockify (pont entre le navigateur et VNC)
setTimeout(() => {
    const websockify = spawn('websockify', ['--web', '/usr/share/novnc', '6080', 'localhost:5901']);
    websockify.stdout.on('data', (data) => console.log(`[Websockify]: ${data}`));
}, 2000);

// 3. Démarrage de XFCE dans l'environnement VNC
process.env.DISPLAY = ':1';
setTimeout(() => {
    spawn('startxfce4', [], { env: process.env });
    console.log('[XFCE] Bureau virtuel démarré.');
}, 4000);

// --- ROUTES EXPRESS POUR L'AUTHENTIFICATION ---

// Page de login simple
app.get('/login', (req, res) => {
    res.send(`
        <html>
            <head><title>Connexion sécurisée - noVNC</title></head>
            <body style="font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f4f9;">
                <form method="POST" action="/api/login" style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <h2>Accès Bureau Virtuel</h2>
                    <input type="password" name="password" placeholder="Mot de passe" required style="padding: 10px; width: 200px; margin-bottom: 15px; display: block; border: 1px solid #ccc; border-radius: 4px;" />
                    <button type="submit" style="background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; width: 100%;">Se connecter</button>
                </form>
            </body>
        </html>
    `);
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        // Création d'un cookie de session valide
        res.cookie('vnc_session', 'authenticated_secure_token', { httpOnly: true, secure: true, maxAge: 3600000 });
        return res.redirect('/');
    }
    res.redirect('/login?error=1');
});

// Route vérifiée par Nginx (auth_request)
app.get('/api/check-auth', (req, res) => {
    const sessionCookie = req.cookies.vnc_session;
    if (sessionCookie === 'authenticated_secure_token') {
        return res.sendStatus(200); // Autorisé
    }
    return res.status(401).redirect('/login'); // Non autorisé -> Redirigé vers le login
});

// 4. Démarrage du serveur Node.js et de Nginx en arrière-plan
app.listen(3000, () => {
    console.log('[Server] Application d\'authentification en écoute sur le port 3000');
    
    // Lancement de Nginx
    const nginx = spawn('nginx', ['-g', 'daemon off;']);
    nginx.stdout.on('data', (data) => console.log(`[Nginx]: ${data}`));
    nginx.stderr.on('data', (data) => console.error(`[Nginx Error]: ${data}`));
});
