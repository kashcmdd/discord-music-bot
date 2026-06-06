const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const { inSameVoiceChannel } = require('../utils/permissions');
const { infoEmbed, errorEmbed, warningEmbed } = require('../utils/embeds');
const { formatDuration } = require('../utils/formatters');
const { getTierForContext, getMaximum } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist')
    .addStringOption(opt => opt.setName('query').setDescription('URL or search query').setRequired(true)),

  async execute(interaction, client) {
    await interaction.deferReply();
    const query = interaction.options.getString('query');
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) {
      return interaction.editReply({ embeds: [errorEmbed('Voice Channel', vcCheck.error)], flags: 64 });
    }

    const resolver = client.resolver || (client.resolver = new (require('../music/Resolver'))(client));

    if (resolver.isYouTubeUrl(query) || resolver.isYouTubePlaylist(query) || resolver.isSpotifyUrl(query) || resolver.isSoundCloudUrl(query)) {
      const tracks = await resolver.resolve(query, interaction.user.id);
      if (!tracks || tracks.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Not Found', 'Could not find any results for that query.')] });
      }
      return playTracks(interaction, client, voiceChannel, tracks);
    }

    const results = await resolver.searchYouTubeMulti(query, interaction.user.id, 5);
    if (!results || results.length === 0) {
      return interaction.editReply({ embeds: [errorEmbed('Not Found', 'Could not find any results for that query.')] });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('track_select')
      .setPlaceholder('Choose a track...')
      .addOptions(results.map((t, i) => ({
        label: t.title.length > 100 ? t.title.slice(0, 97) + '...' : t.title,
        description: formatDuration(t.duration),
        value: String(i),
      })));

    const row = new ActionRowBuilder().addComponents(select);
    const msg = await interaction.editReply({
      content: '**Search results — pick a track:**',
      components: [row],
    });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: i => i.user.id === interaction.user.id,
      time: 30000,
    });

    collector.on('collect', async (i) => {
      await i.deferUpdate();
      collector.stop();
      const chosen = results[parseInt(i.values[0])];
      await playTracks(interaction, client, voiceChannel, [chosen]);
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({ content: 'Selection timed out.', components: [] }).catch(() => {});
      }
    });
  },
};

async function playTracks(interaction, client, voiceChannel, tracks) {
  let player = client.players.get(interaction.guildId);

  if (!player) {
    const GuildPlayer = require('../music/Player');
    player = new GuildPlayer(interaction.guildId, client, voiceChannel);
    client.players.set(interaction.guildId, player);
  } else if (!player.connection) {
    player._joinVoice(voiceChannel);
  }
  player.setTextChannel(interaction.channel);

  const tier = await getTierForContext(client, interaction.guildId, interaction.user.id);
  const maxQueue = getMaximum(tier, 'maxQueueSize');
  if (player.queue.length + tracks.length > maxQueue) {
    const canFit = Math.max(0, maxQueue - player.queue.length);
    if (canFit === 0) {
      return interaction.editReply({ embeds: [warningEmbed('Queue Full', `Your queue is at the **${tier}** tier limit of **${maxQueue}** tracks. Remove some tracks or upgrade your tier.`)] });
    }
    tracks = tracks.slice(0, canFit);
  }

  const isPlaying = player.audioPlayer.state.status === 'playing' || player.audioPlayer.state.status === 'paused';
  const first = tracks[0];

  if (!isPlaying && player.queue.length === 0) {
    const rest = tracks.slice(1);
    player.queue.push(...rest);
    player.play(first);
    const embed = infoEmbed('Now Playing', `[${first.title}](${first.url})\nDuration: ${formatDuration(first.duration)}\nRequested by: <@${first.requester}>`);
    return interaction.editReply({ embeds: [embed], components: [] });
  }

  player.queue.push(...tracks);
  const embed = infoEmbed('Added to Queue',
    tracks.length === 1
      ? `[${first.title}](${first.url}) added at position ${player.queue.length}`
      : `${tracks.length} tracks added to queue`
  );
  return interaction.editReply({ embeds: [embed], components: [] });
}
