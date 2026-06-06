require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('./db/Database');
const logger = require('./utils/logger');

if (!process.env.BOT_TOKEN) {
  logger.error('BOT_TOKEN is missing from .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.players = new Map();
client.db = new Database();
client.logger = logger;
client.commands = new Collection();
client.tierCache = new Map();

const eventsPath = path.join(__dirname, 'events');
fs.readdirSync(eventsPath).filter(f => f.endsWith('.js')).forEach(f => {
  const event = require(`./events/${f}`);
  const eventName = f.replace('.js', '');
  client.on(eventName, (...args) => event(client, ...args));
  logger.info(`Loaded event: ${eventName}`);
});

const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).filter(f => f.endsWith('.js')).forEach(f => {
  const cmd = require(`./commands/${f}`);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    logger.info(`Loaded command: ${cmd.data.name}`);
  }
});

client.login(process.env.BOT_TOKEN).catch(err => {
  logger.error(`Failed to login: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled rejection: ${err.message}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
});

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);
  for (const [, player] of client.players) {
    if (player.audioPlayer) player.audioPlayer.stop(true);
    if (player.connection) player.connection.destroy();
    player.queue = [];
    player.currentTrack = null;
  }
  await client.destroy();
  logger.info('Shutdown complete.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = client;
