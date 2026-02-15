
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());

// Store for all active clients
const clients = new Map();
const qrs = new Map();
const errors = new Map();

// Global health check
app.get('/status', (req, res) => {
    res.json({ online: true, version: '1.0.0' });
});

const createClient = (restaurantId) => {
    console.log(`Initializing client for restaurant: ${restaurantId}`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: restaurantId,
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        webVersionCache: {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1014581017.html',
        },
        puppeteer: {
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-setuid-sandbox',
                '--enable-features=NetworkService,NetworkServiceInProcess',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            ],
            handleSIGINT: false,
            headless: 'new'
        }
    });

    client.on('qr', (qr) => {
        console.log(`QR received for ${restaurantId}`);
        qrs.set(restaurantId, qr);
    });

    client.on('ready', () => {
        console.log(`Client ${restaurantId} is ready!`);
        qrs.delete(restaurantId);
    });

    client.on('authenticated', () => {
        console.log(`Client ${restaurantId} authenticated!`);
    });

    client.on('auth_failure', (msg) => {
        console.error(`Auth failure for ${restaurantId}:`, msg);
    });

    client.on('disconnected', (reason) => {
        console.log(`Client ${restaurantId} disconnected:`, reason);
        clients.delete(restaurantId);
        qrs.delete(restaurantId);
    });

    client.initialize().catch(err => {
        console.error(`Failed to initialize ${restaurantId}:`, err);
        errors.set(restaurantId, err.message);
    });

    clients.set(restaurantId, client);
    return client;
};

// Endpoints
app.get('/status/:restaurantId', (req, res) => {
    const { restaurantId } = req.params;
    const client = clients.get(restaurantId);
    const qr = qrs.get(restaurantId);

    res.json({
        bridgeOnline: true,
        online: !!client,
        whatsapp: client?.info ? 'connected' : (qr ? 'needs_scan' : (errors.has(restaurantId) ? 'error' : 'initializing')),
        qr: qr || null,
        user: client?.info?.pushname || null,
        error: errors.get(restaurantId) || null
    });
});

app.post('/initialize/:restaurantId', (req, res) => {
    const { restaurantId } = req.params;
    console.log(`Initialization request for: ${restaurantId}`);
    errors.delete(restaurantId); // Clear previous errors
    if (!clients.has(restaurantId)) {
        createClient(restaurantId);
    }
    res.json({ success: true, message: 'Initialization started' });
});

app.post('/send-bill', async (req, res) => {
    const { restaurantId, phone, imageUrl, message } = req.body;

    const client = clients.get(restaurantId);
    if (!client || !client.info) {
        return res.status(400).json({ error: 'WhatsApp not connected for this restaurant' });
    }

    try {
        const cleanPhone = phone.replace(/\D/g, '');
        const chatId = `${cleanPhone}@c.us`;
        const media = await MessageMedia.fromUrl(imageUrl);
        await client.sendMessage(chatId, media, { caption: message });
        res.json({ success: true });
    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Multi-Tenant WhatsApp Bridge running on port ${PORT}`);

    // Auto-restart existing sessions on boot
    const authPath = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authPath)) {
        const sessions = fs.readdirSync(authPath).filter(f => f.startsWith('session-'));
        sessions.forEach(s => {
            const restaurantId = s.replace('session-', '');
            createClient(restaurantId);
        });
    }
});
