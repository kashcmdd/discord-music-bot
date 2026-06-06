const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { getMaximum } = require('../utils/tiers');
const { getTierForContext } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the volume')
    .addIntegerOption(opt => opt.setName('level').setDescription('Volume level (0-100)').setMinValue(0).setMaxValue(200).setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    const tier = await getTierForContext(client, interaction.guildId, interaction.user.id);
    const maxVol = getMaximum(tier, 'maxVolume');
    let level = interaction.options.getInteger('level');
    level = Math.max(0, Math.min(level, maxVol));

    player.setVolume(level);
    return interaction.editReply({ embeds: [successEmbed('Volume', `Volume set to **${level}%**${level < interaction.options.getInteger('level') ? ` (clamped to tier max: ${maxVol}%)` : ''}.`)] });
  },
};
