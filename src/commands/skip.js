const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track')
    .addIntegerOption(opt => opt.setName('count').setDescription('Number of tracks to skip').setMinValue(1).setMaxValue(20)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    const count = interaction.options.getInteger('count') || 1;
    const skipped = player.currentTrack.title;
    player.skip(count);
    return interaction.editReply({ embeds: [successEmbed('Skipped', `Skipped **${skipped}**${count > 1 ? ` and ${count - 1} more` : ''}.`)] });
  },
};
