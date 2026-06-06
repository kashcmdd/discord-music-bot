const { SlashCommandBuilder } = require('discord.js');
const { inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed, warningEmbed } = require('../utils/embeds');
const { getTierForContext, checkGate, getMaximum } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playnext')
    .setDescription('Add a track to play next (Pro+)')
    .addStringOption(opt => opt.setName('query').setDescription('URL or search query').setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();

    const tier = await getTierForContext(client, interaction.guildId, interaction.user.id);
    if (!checkGate(tier, 'playnext')) {
      return interaction.editReply({ embeds: [warningEmbed('Pro Feature', 'Play Next requires Pro tier or higher. Ask an admin to upgrade with `/tier set`.')] });
    }

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    const query = interaction.options.getString('query');
    const resolver = client.resolver || (client.resolver = new (require('../music/Resolver'))(client));
    const tracks = await resolver.resolve(query, interaction.user.id);

    if (!tracks || tracks.length === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Not Found', 'Could not find any results.')] });
    }

    const track = tracks[0];
    const maxQueue = getMaximum(tier, 'maxQueueSize');
    if (player.queue.length >= maxQueue) {
      return interaction.editReply({ embeds: [warningEmbed('Queue Full', `Your queue is at the **${tier}** tier limit of **${maxQueue}** tracks. Remove some tracks or upgrade your tier.`)] });
    }
    player.queue.unshift(track);
    return interaction.editReply({ embeds: [successEmbed('Added Next', `[${track.title}](${track.url}) will play next.`)] });
  },
};
