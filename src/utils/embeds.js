const { EmbedBuilder } = require('discord.js');

const COLORS = {
  INFO: 0x5865F2,
  ERROR: 0xED4245,
  SUCCESS: 0x57F287,
  WARNING: 0xFAA61A,
};

function makeEmbed(color, title, description) {
  const eb = new EmbedBuilder().setColor(color).setTitle(title || ' ');
  if (description) eb.setDescription(description);
  eb.setFooter({ text: 'Discord Music Bot v2.0.0' });
  return eb;
}

function infoEmbed(title, description) {
  return makeEmbed(COLORS.INFO, title, description);
}

function successEmbed(title, description) {
  return makeEmbed(COLORS.SUCCESS, title, description);
}

function errorEmbed(title, description) {
  return makeEmbed(COLORS.ERROR, title, description);
}

function warningEmbed(title, description) {
  return makeEmbed(COLORS.WARNING, title, description);
}

function extractArtist(title) {
  if (!title) return 'Unknown Artist';
  const parts = title.split(' - ');
  return parts.length > 1 ? parts[0].trim() : title;
}

function volumeBar(volume, length = 10) {
  const pct = Math.min(Math.max(volume / 200, 0), 1);
  const filled = Math.round(pct * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function nowPlayingEmbed(track, player, opts = {}) {
  const posMs = player.audioPlayer.state.resource?.playbackDuration || 0;
  const posSec = Math.floor(posMs / 1000);
  const bar = progressBar(posSec, track.duration);
  const artist = extractArtist(track.title);
  const volBar = volumeBar(player.volume);
  const color = opts.color || 0x9b59b6;
  const footer = opts.footer || 'Discord Music Bot v2.0.0';

  let description = `${artist}\nRequested by <@${track.requester}>`;

  const upcoming = player.queue.slice(0, 3);
  if (upcoming.length > 0) {
    const lines = upcoming.map((t, i) => `**${i + 1}.** [${t.title}](${t.url}) \`${formatDuration(t.duration)}\``);
    description += `\n\n**Up Next:**\n${lines.join('\n')}`;
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(track.title)
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
    .setDescription(description)
    .addFields(
      { name: 'Progress', value: `\`${formatDuration(posSec)}\` ${bar} \`${formatDuration(track.duration)}\`` },
      { name: 'Volume', value: `${volBar} ${player.volume}%`, inline: true },
      { name: 'Loop', value: player.loopMode, inline: true },
      { name: 'Filters', value: player.filters, inline: true },
    )
    .setFooter({ text: `Queue: ${player.queue.length} tracks • ${footer}` })
    .setTimestamp();
}

function queueEmbed(queue, currentTrack, page, totalPages, player) {
  const start = (page - 1) * 10;
  const items = queue.slice(start, start + 10);
  const totalDuration = queue.reduce((sum, t) => sum + (t.duration || 0), 0) + (currentTrack?.duration || 0);

  const desc = items.length === 0
    ? 'Queue is empty.'
    : items.map((t, i) => `**${start + i + 1}.** [${t.title}](${t.url}) [${formatDuration(t.duration)}] — <@${t.requester}>`).join('\n');

  return new EmbedBuilder()
    .setColor(COLORS.INFO)
    .setTitle('Queue')
    .setDescription(desc)
    .addFields(
      { name: 'Now Playing', value: currentTrack ? `[${currentTrack.title}](${currentTrack.url})` : 'Nothing' },
      { name: 'Total Duration', value: formatDuration(totalDuration), inline: true },
      { name: 'Loop', value: player.loopMode || 'off', inline: true },
      { name: 'Filters', value: player.filters || 'clear', inline: true },
    )
    .setFooter({ text: `Page ${page}/${totalPages} • ${queue.length} tracks • Discord Music Bot v2.0.0` });
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressBar(current, total, length = 16) {
  if (!total || total === 0) return '▬'.repeat(length);
  const progress = Math.min(Math.max(current / total, 0), 1);
  const pos = Math.round(progress * (length - 1));
  const bar = '▬'.repeat(pos) + '◉' + '▬'.repeat(length - pos - 1);
  return bar;
}

function paginate(array, page, perPage = 10) {
  const totalPages = Math.max(1, Math.ceil(array.length / perPage));
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * perPage;
  const items = array.slice(start, start + perPage);
  return { items, page: currentPage, totalPages, start };
}

module.exports = {
  COLORS,
  infoEmbed,
  successEmbed,
  errorEmbed,
  warningEmbed,
  nowPlayingEmbed,
  queueEmbed,
  formatDuration,
  progressBar,
  paginate,
};
