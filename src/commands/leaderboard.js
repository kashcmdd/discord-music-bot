const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show weekly top played tracks'),

  async execute(interaction, client) {
    await interaction.deferReply();

    const rows = client.db.getWeeklyLeaderboard(interaction.guildId);
    if (rows.length === 0) {
      return interaction.editReply({ content: 'No plays recorded this week yet.' });
    }

    const desc = rows.map((r, i) =>
      `**${i + 1}.** [${r.track_title}](${r.track_url}) — ${r.plays} play${r.plays > 1 ? 's' : ''}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xFAA61A)
      .setTitle('🏆 Weekly Leaderboard')
      .setDescription(desc)
      .setFooter({ text: 'Discord Music Bot v2.0.0' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
