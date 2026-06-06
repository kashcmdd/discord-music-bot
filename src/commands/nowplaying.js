const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed, nowPlayingEmbed, formatDuration } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show details about the currently playing track'),

  async execute(interaction, client) {
    await interaction.deferReply();
    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    const config = client.db?.getNpConfig(interaction.guildId) || {};
    const color = parseInt(config.np_color?.replace('#', '') || '9b59b6', 16);
    const embed = nowPlayingEmbed(player.currentTrack, player, { color, footer: config.np_footer });
    return interaction.editReply({ embeds: [embed] });
  },
};
