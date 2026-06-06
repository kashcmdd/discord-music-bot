const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sleep')
    .setDescription('Set a timer to stop playing after a duration')
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('e.g. 15m, 1h, 30s, 2h30m')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) {
      return interaction.reply({ embeds: [errorEmbed('', 'Nothing is playing.')], flags: 64 });
    }

    const input = interaction.options.getString('duration');
    const match = input.match(/^(\d+)(s|m|h)$/);
    if (!match) {
      return interaction.reply({ embeds: [errorEmbed('', 'Use a format like `15m`, `1h`, `30s`.')], flags: 64 });
    }

    const value = parseInt(match[1]);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000 };
    const ms = value * multipliers[unit];

    if (ms < 30000) {
      return interaction.reply({ embeds: [errorEmbed('', 'Minimum sleep timer is 30 seconds.')], flags: 64 });
    }
    if (ms > 3600000 * 6) {
      return interaction.reply({ embeds: [errorEmbed('', 'Maximum sleep timer is 6 hours.')], flags: 64 });
    }

    if (player.sleepTimer) clearTimeout(player.sleepTimer);

    player.sleepTimer = setTimeout(() => {
      if (player.currentTrack) {
        player.stop();
      }
    }, ms);

    const label = `${value}${unit}`;
    return interaction.reply({ embeds: [successEmbed('Sleep Timer', `⏰ Stopping playback in **${label}**.`)], flags: 64 });
  },
};
