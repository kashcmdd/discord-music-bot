const { SlashCommandBuilder } = require('discord.js');
const { inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume playback'),

  async execute(interaction, client) {
    await interaction.deferReply();
    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    player.resume();
    return interaction.editReply({ embeds: [successEmbed('Resumed', 'Playback has been resumed.')] });
  },
};
