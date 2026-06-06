const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue')
    .addIntegerOption(opt => opt.setName('position').setDescription('Queue position').setMinValue(1).setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || player.queue.length === 0) return interaction.editReply({ embeds: [errorEmbed('', 'Queue is empty.')] });

    const position = interaction.options.getInteger('position');
    const removed = player.remove(position);
    if (!removed) return interaction.editReply({ embeds: [errorEmbed('', 'Invalid position.')] });

    return interaction.editReply({ embeds: [successEmbed('Removed', `Removed **${removed.title}** from position ${position}.`)] });
  },
};
