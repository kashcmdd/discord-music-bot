const { SlashCommandBuilder } = require('discord.js');
const { inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { getTierForContext, checkGate } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode (VIP only)')
    .addBooleanOption(opt => opt.setName('state').setDescription('Enable or disable 24/7 mode').setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();

    const tier = await getTierForContext(client, interaction.guildId, interaction.user.id);
    if (!checkGate(tier, 'stay247')) {
      return interaction.editReply({ embeds: [warningEmbed('VIP Feature', '24/7 mode requires VIP tier. Ask an admin to upgrade with `/tier set`.')] });
    }

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player) return interaction.editReply({ embeds: [errorEmbed('', 'Bot is not in a voice channel.')] });

    const state = interaction.options.getBoolean('state');
    player.stay247 = state;
    return interaction.editReply({ embeds: [successEmbed('24/7', `24/7 mode is now **${state ? 'enabled' : 'disabled'}**.`)] });
  },
};
