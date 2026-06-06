const { EmbedBuilder } = require('discord.js');

const URL_PATTERN = /(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/\S+/i;

module.exports = (client, message) => {
  if (message.author.bot || !message.guild) return;

  const requestChannel = client.db.getRequestChannel(message.guild.id);
  if (!requestChannel || message.channel.id !== requestChannel) return;

  const match = message.content.match(URL_PATTERN);
  if (!match) return;

  const url = match[0];

  (async () => {
    try {
      const command = client.commands.get('play');
      if (!command) return;

      const fakeInteraction = {
        guildId: message.guild.id,
        guild: message.guild,
        member: message.member,
        user: message.author,
        channel: message.channel,
        client,
        options: {
          getString: () => url,
        },
        reply: async (payload) => {
          if (payload.embeds) {
            await message.reply({ embeds: payload.embeds }).catch(() => {});
          } else if (payload.content) {
            await message.reply({ content: payload.content, flags: 64 }).catch(() => {});
          }
        },
        deferReply: async () => {},
        editReply: async () => {},
        isCommand: () => false,
      };

      await command.execute(fakeInteraction, client);
    } catch (err) {
      client.logger.error(`Song request error in ${message.guild.id}: ${err.message}`);
    }
  })();
};
