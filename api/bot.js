const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ===================== STATE =====================
let botState = {
    connected: false,
    qrCode: null,
    pairingCode: null
};

let sock = null;

// ===================== START BOT =====================
async function startBot(pairingCode = null) {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');
    
    sock = makeWASocket({
        logger: console,
        auth: state,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: true,
        markOnlineOnConnect: true
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, isNewLogin } = update;
        
        if (qr) {
            botState.qrCode = qr;
            console.log('📱 QR Code siap');
        }
        
        // 🔥 TUNGGU EVENT DULU SEBELUM MINTA PAIRING CODE
        if (connection === "connecting" || qr) {
            if (pairingCode) {
                try {
                    const code = await sock.requestPairingCode(pairingCode);
                    botState.pairingCode = code;
                    console.log(`🔗 Pairing Code: ${code}`);
                } catch (error) {
                    console.log(`❌ Pairing gagal: ${error.message}`);
                }
            }
        }

        if (connection === 'open') {
            botState.connected = true;
            console.log('✅ Bot terhubung!');
        }

        if (connection === 'close') {
            botState.connected = false;
            console.log('❌ Bot terputus!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
    
    return sock;
}

// ===================== API ROUTES =====================
app.get('/api/status', (req, res) => {
    res.json({
        connected: botState.connected,
        hasPairing: !!botState.pairingCode,
        qr: botState.qrCode
    });
});

app.get('/api/qr', (req, res) => {
    res.json({ qr: botState.qrCode });
});

app.get('/api/pairing', (req, res) => {
    res.json({ code: botState.pairingCode });
});

app.post('/api/start', async (req, res) => {
    const { pairingCode } = req.body;
    if (botState.connected) {
        return res.json({ success: false, error: 'Bot sudah terhubung!' });
    }
    await startBot(pairingCode);
    res.json({ success: true, message: 'Bot mulai...' });
});

// ===================== SERVER =====================
module.exports = app;
