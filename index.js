
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Sophisticated CORS configuration
app.use(cors({
    origin: '*', // Allow all for now to debug, can be restricted later
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Store for all active clients
const clients = new Map();
const qrs = new Map();
const errors = new Map();

// Global process error handlers to prevent crash loops
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Global health check
app.get('/', (req, res) => {
    res.json({ online: true, message: 'Fox WhatsApp Bridge is active' });
});

app.get('/status', (req, res) => {
    res.json({ online: true, version: '1.0.1' });
});

const createClient = (restaurantId) => {
    console.log(`[${new Date().toISOString()}] Initializing client for: ${restaurantId}`);

    try {
        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: restaurantId,
                dataPath: path.join(__dirname, '.wwebjs_auth')
            }),
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
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
            console.log(`[${restaurantId}] QR received`);
            qrs.set(restaurantId, qr);
        });

        client.on('ready', () => {
            console.log(`[${restaurantId}] Client is ready!`);
            qrs.delete(restaurantId);
            errors.delete(restaurantId);
        });

        client.on('authenticated', () => {
            console.log(`[${restaurantId}] Authenticated`);
        });

        client.on('auth_failure', (msg) => {
            console.error(`[${restaurantId}] Auth failure:`, msg);
            errors.set(restaurantId, `Auth failure: ${msg}`);
        });

        client.on('disconnected', (reason) => {
            console.log(`[${restaurantId}] Disconnected:`, reason);
            clients.delete(restaurantId);
            qrs.delete(restaurantId);
        });

        client.initialize().catch(err => {
            console.error(`[${restaurantId}] Initialization error:`, err);
            errors.set(restaurantId, err.message);
        });

        clients.set(restaurantId, client);
        return client;
    } catch (e) {
        console.error(`[${restaurantId}] Create client fatal error:`, e);
        errors.set(restaurantId, e.message);
    }
};

// Endpoints
app.get('/status/:restaurantId', (req, res) => {
    const { restaurantId } = req.params;
    const client = clients.get(restaurantId);
    const qr = qrs.get(restaurantId);

    // If we have an error but no client, report from errors map
    const hasError = errors.has(restaurantId);

    res.json({
        bridgeOnline: true,
        online: !!client && !!client.info,
        whatsapp: client?.info ? 'connected' : (qr ? 'needs_scan' : (hasError ? 'error' : (clients.has(restaurantId) ? 'initializing' : 'disconnected'))),
        qr: qr || null,
        user: client?.info?.pushname || null,
        error: errors.get(restaurantId) || null
    });
});

app.post('/initialize/:restaurantId', (req, res) => {
    const { restaurantId } = req.params;
    console.log(`[${new Date().toISOString()}] Init request: ${restaurantId}`);
    errors.delete(restaurantId);

    if (clients.has(restaurantId)) {
        const oldClient = clients.get(restaurantId);
        oldClient.destroy().catch(() => { });
        clients.delete(restaurantId);
    }

    createClient(restaurantId);
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
        console.error(`[${restaurantId}] Send error:`, error);
        res.status(500).json({ error: error.message });
    }
});

// 404 Handler
app.use((req, res) => {
    console.warn(`[404] No route for ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Route not found' });
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Multi-Tenant WhatsApp Bridge running on http://0.0.0.0:${PORT}`);

    // Auto-restart existing sessions on boot
    const authPath = path.join(__dirname, '.wwebjs_auth');
    if (fs.existsSync(authPath)) {
        try {
            const sessions = fs.readdirSync(authPath).filter(f => f.startsWith('session-'));
            console.log(`Found ${sessions.length} existing sessions to restart`);
            sessions.forEach(s => {
                const restaurantId = s.replace('session-', '');
                createClient(restaurantId);
            });
        } catch (e) {
            console.error('Error reading sessions:', e);
        }
    }
});
