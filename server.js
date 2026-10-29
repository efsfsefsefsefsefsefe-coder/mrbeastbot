const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// Your Discord Credentials & Config
const BOT_TOKEN = 'MTU2NTI0MzI5Mzc0MTA5Mjg3NA.GB31Gq.pEcT-RjK1XA6mrGSJ9-aVaduP1QDhzvmO7qaPs'; 
const CHANNEL_ID = '1565244786468716696'; 
const PORT = process.env.PORT || 3000;

let pendingMessage = "";
const connectedUsers = new Set(); // Track connected users to avoid spamming join messages

// 1. HTTP Server Setup
const app = express();
app.use(express.json());

// Endpoint polled by Roblox Luau script
app.get('/poll', async (req, res) => {
    const username = req.query.username;

    // Notify Discord when a new Roblox user connects
    if (username && !connectedUsers.has(username)) {
        connectedUsers.add(username);
        try {
            const channel = await client.channels.fetch(CHANNEL_ID);
            if (channel) {
                await channel.send(`🟢 **${username}** has connected to the Roblox client!`);
            }
        } catch (err) {
            console.error('[Discord] Failed to send connect message:', err);
        }
    }

    // Deliver pending messages to Roblox
    if (pendingMessage !== "") {
        res.status(200).json({ message: pendingMessage });
        pendingMessage = ""; // Clear message after sending
    } else {
        res.status(200).json({ message: null });
    }
});

app.listen(PORT, () => {
    console.log(`[HTTP] Bridge running on port ${PORT}`);
});

// 2. Discord Bot Setup
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

    console.log(`[Discord] Received message from ${message.author.tag}: "${message.content}"`);
    pendingMessage = message.content;
});

client.login(BOT_TOKEN);