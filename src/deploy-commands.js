require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

fs.readdirSync(commandsPath).filter(f => f.endsWith('.js')).forEach(f => {
  const cmd = require(`./commands/${f}`);
  if (cmd.data) {
    commands.push(cmd.data.toJSON());
  }
});

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
const guildId = process.argv[2] || process.env.GUILD_ID;

(async () => {
  try {
    if (guildId) {
      console.log(`Registering ${commands.length} slash commands for guild ${guildId}...`);
      const data = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), {
        body: commands,
      });
      console.log(`Successfully registered ${data.length} commands for guild ${guildId}.`);
    } else {
      console.log(`Registering ${commands.length} slash commands globally...`);
      const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
        body: commands,
      });
      console.log(`Successfully registered ${data.length} commands globally.`);
    }
  } catch (err) {
    console.error('Failed to register commands:', err.message);
    process.exit(1);
  }
})();
