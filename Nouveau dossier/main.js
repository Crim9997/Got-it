const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const noblox = require('noblox.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();


async function initializeRoblox() {
    try {
        if (!process.env.ROBLOX_COOKIE) {
            console.error('❌ ROBLOX_COOKIE not found in environment variables');
            return false;
        }
        
        await noblox.setCookie(process.env.ROBLOX_COOKIE);
        
       
        const currentUser = await noblox.getCurrentUser();
        console.log('✅ Roblox connection established');
        console.log(`🤖 Bot connected as: ${currentUser.UserName} (ID: ${currentUser.UserID})`);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Roblox connection:', error.message);
        return false;
    }
}


const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}


const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}



const express = require("express");
const app = express();
const port = 3000;
app.get('/', (req, res) => {
    const imagePath = path.join(__dirname, 'index.html');
    res.sendFile(imagePath);
});
app.listen(port, () => {
    console.log(`🔗 Listening to GlaceYT : http://localhost:${port}`);
});

async function startBot() {
    try {
      
        const robloxConnected = await initializeRoblox();
        
        if (!robloxConnected) {
            console.log('⚠️ Bot will start without Roblox functionality');
        }
        
      
        await client.login(process.env.TOKEN);
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}


process.on('SIGINT', () => {
    console.log('🛑 Bot shutting down...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Bot shutting down...');
    client.destroy();
    process.exit(0);
});


startBot();