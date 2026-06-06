const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { getAvailableFilters, getFilterChain } = require('../music/Filters');
const { getTierForContext } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filters')
    .setDescription('Apply an audio filter')
    .addStringOption(opt =>
      opt.setName('preset')
        .setDescription('Filter preset')
        .setRequired(true)
        .addChoices(
          { name: 'clear', value: 'clear' },
          { name: 'bass', value: 'bass' },
          { name: 'nightcore', value: 'nightcore' },
          { name: 'vaporwave', value: 'vaporwave' },
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply();
    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    const tier = await getTierForContext(client, interaction.guildId, interaction.user.id);
    const filterName = interaction.options.getString('preset');
    const available = getAvailableFilters(tier);

    if (!available.includes(filterName)) {
      return interaction.editReply({ embeds: [warningEmbed('Pro Feature', `**${filterName}** requires Pro tier or higher. Ask an admin to upgrade with \`/tier set\`. Available: ${available.join(', ')}`)] });
    }

    player.setFilter(filterName);
    return interaction.editReply({ embeds: [successEmbed('Filter', `Filter set to **${filterName}**.`)] });
  },
};
