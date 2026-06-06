const { EmbedBuilder, Collection } = require('discord.js');

const COOLDOWNS = {
  play: 3,
  skip: 5,
  stop: 5,
  shuffle: 3,
  clear: 3,
  move: 3,
  remove: 3,
  playnext: 3,
  grab: 10,
  lyrics: 5,
};

module.exports = (client, interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (!client.cooldowns) client.cooldowns = new Collection();

  const cooldownTime = COOLDOWNS[interaction.commandName];
  if (cooldownTime) {
    const timestamps = client.cooldowns;
    const userId = interaction.user.id;
    const now = Date.now();
    const lastUsed = timestamps.get(userId)?.[interaction.commandName] || 0;

    if (lastUsed && now - lastUsed < cooldownTime * 1000) {
      const remaining = Math.ceil(cooldownTime - (now - lastUsed) / 1000);
      return interaction.reply({
        content: `⏳ Please wait **${remaining}s** before using \`/${interaction.commandName}\` again.`,
        flags: 64,
      });
    }

    const userCooldowns = timestamps.get(userId) || {};
    userCooldowns[interaction.commandName] = now;
    timestamps.set(userId, userCooldowns);
  }

  const executeCommand = async () => {
    try {
      await command.execute(interaction, client);
    } catch (err) {
      client.logger.error(`Error in /${interaction.commandName}: ${err.message} ${err.stack?.split('\n').slice(1,3).join(' | ')}`);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Error')
        .setDescription('An unexpected error occurred. Please try again.')
        .setFooter({ text: 'Discord Music Bot v2.0.0' });

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [embed], flags: 64 });
        } else {
          await interaction.reply({ embeds: [embed], flags: 64 });
        }
      } catch (_) {}
    }
  };

  executeCommand();
};
