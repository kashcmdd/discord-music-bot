const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { formatDuration } = require('../utils/formatters');
const { getTierForContext, checkGate } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a position in the track')
    .addIntegerOption(opt => opt.setName('seconds').setDescription('Position in seconds').setMinValue(0).setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();

    const tier = await getTierForContext(client, interaction.guildId, interaction.user.id);
    if (!checkGate(tier, 'seek')) {
      return interaction.editReply({ embeds: [require('../utils/embeds').warningEmbed('Pro Feature', 'Seeking requires Pro tier or higher. Ask an admin to upgrade with `/tier set`.')] });
    }

    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    const seconds = interaction.options.getInteger('seconds');
    const clamped = Math.max(0, Math.min(seconds, player.currentTrack.duration));
    player.seek(clamped);

    return interaction.editReply({ embeds: [successEmbed('Seeked', `Jumped to ${formatDuration(clamped)}`)] });
  },
};
