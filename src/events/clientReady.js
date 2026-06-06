const { ActivityType } = require('discord.js');

module.exports = (client) => {
  client.logger.info(`Logged in as ${client.user.tag}`);
  client.user.setActivity('/play | v2.0.0', { type: ActivityType.Listening });

  const guildCount = client.guilds.cache.size;
  client.logger.info(`Serving ${guildCount} guild(s)`);
};
