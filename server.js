const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const BOT_TOKEN = process.env.BOT_TOKEN; 
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = process.env.PORT || 3000;

// Per-user message queues: Map<username, string[]>
const userQueues = new Map();
const connectedUsers = new Set();

// ---------------------------------------------------------
// HTTP Server (Roblox Bridge)
// ---------------------------------------------------------
const app = express();
app.use(express.json());

// Roblox polls this endpoint to receive messages from Discord
app.get('/poll', async (req, res) => {
    const username = req.query.username;

    if (!username) {
        return res.status(400).json({ error: "Missing username" });
    }

    // Initialize queue for this user if it's their first time polling
    if (!userQueues.has(username)) {
        userQueues.set(username, []);
    }

    // Notify Discord when a new user connects for the first time
    if (!connectedUsers.has(username)) {
        connectedUsers.add(username);
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (channel) {
                await channel.send(`🟢 **${username}** connected to the Roblox client!`);
            }
        } catch (err) {
            console.error('[Discord] Failed to send connection log:', err);
        }
    }

    // Deliver the next message in this specific user's queue
    const queue = userQueues.get(username);
    if (queue && queue.length > 0) {
        const message = queue.shift(); // Take and remove the oldest unread message
        res.status(200).json({ message: message });
    } else {
        res.status(200).json({ message: null });
    }
});

// Roblox POSTs to this endpoint when a player speaks in chat
app.post('/chat', async (req, res) => {
    const { username, message } = req.body || {};

    if (!username || !message) {
        return res.status(400).json({ error: "Missing username or message" });
    }

    console.log(`[Roblox Chat] ${username}: ${message}`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel) {
            await channel.send(`💬 **[${username}]**: ${message}`);
        }
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('[Discord] Failed to send chat message:', err);
        res.status(500).json({ error: "Failed to forward to Discord" });
    }
});

app.listen(PORT, () => {
    console.log(`[HTTP] Bridge running on port ${PORT}`);
});

// ---------------------------------------------------------
// Discord Bot Setup
// ---------------------------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`[Discord] Bot logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== CHANNEL_ID) return;

    console.log(`[Discord] Broadcasting message to all active users: "${message.content}"`);

    // Push the Discord message into EVERY active user's queue so all clients receive it
    for (const [username, queue] of userQueues.entries()) {
        queue.push(message.content);
    }
});

client.login(BOT_TOKEN);
