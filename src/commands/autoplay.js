const { SlashCommandBuilder } = require('discord.js');
const { inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { getTierForContext, checkGate } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay (automatically add related tracks)'),

  async execute(interaction, client) {
    await interaction.deferReply();

    const tier = await getTierForContext(client, interaction.guildId, interaction.user.id);
    if (!checkGate(tier, 'autoplay')) {
      return interaction.editReply({ embeds: [warningEmbed('Pro Feature', 'Autoplay requires Pro tier or higher. Ask an admin to upgrade with `/tier set`.')] });
    }

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    player.autoplay = !player.autoplay;
    return interaction.editReply({ embeds: [successEmbed('Autoplay', `Autoplay is now **${player.autoplay ? 'on' : 'off'}**.`)] });
  },
};
