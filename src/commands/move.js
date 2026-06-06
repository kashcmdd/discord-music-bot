const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a different position')
    .addIntegerOption(opt => opt.setName('from').setDescription('Current position').setMinValue(1).setRequired(true))
    .addIntegerOption(opt => opt.setName('to').setDescription('New position').setMinValue(1).setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || player.queue.length < 2) return interaction.editReply({ embeds: [errorEmbed('', 'Not enough tracks in queue.')] });

    const from = interaction.options.getInteger('from');
    const to = interaction.options.getInteger('to');
    if (from === to) return interaction.editReply({ embeds: [errorEmbed('', 'From and to positions are the same.')] });
    if (!player.move(from, to)) return interaction.editReply({ embeds: [errorEmbed('', 'Invalid positions.')] });

    return interaction.editReply({ embeds: [successEmbed('Moved', `Track moved from position **${from}** to **${to}**.`)] });
  },
};
