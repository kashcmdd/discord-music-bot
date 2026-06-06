const { SlashCommandBuilder } = require('discord.js');
const { inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, infoEmbed } = require('../utils/embeds');
const { paginate, formatDuration } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the queue')
    .addIntegerOption(opt => opt.setName('page').setDescription('Page number').setMinValue(1)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const player = client.players.get(interaction.guildId);
    if (!player) return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing.')] });

    const page = interaction.options.getInteger('page') || 1;
    const { items, totalPages, page: currentPage } = paginate(player.queue, page);

    const embed = infoEmbed('Queue', items.length === 0
      ? 'Queue is empty.'
      : player.queue.map((t, i) => {
          const pos = i + 1;
          const playing = player.currentTrack && i === 0 ? '🎵 ' : '';
          return `${playing}**${pos}.** [${t.title}](${t.url}) [${formatDuration(t.duration)}] — <@${t.requester}>`;
        }).join('\n')
    ).setFooter({ text: `Page ${currentPage}/${totalPages} • ${player.queue.length} tracks • Discord Music Bot v2.0.0` });

    const totalDuration = player.queue.reduce((s, t) => s + (t.duration || 0), 0) + (player.currentTrack?.duration || 0);
    embed.addFields(
      { name: 'Now Playing', value: player.currentTrack ? `[${player.currentTrack.title}](${player.currentTrack.url})` : 'Nothing', inline: true },
      { name: 'Total Duration', value: formatDuration(totalDuration), inline: true },
      { name: 'Loop', value: player.loopMode || 'off', inline: true },
    );

    await interaction.editReply({ embeds: [embed] });
  },
};
