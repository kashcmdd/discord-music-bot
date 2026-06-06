const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed, warningEmbed } = require('../utils/embeds');
const { getTierForContext, getMaximum } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage playlists')
    .addSubcommand(sub => sub.setName('save').setDescription('Save current queue as a playlist').addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(sub => sub.setName('load').setDescription('Load a saved playlist').addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete a saved playlist').addStringOption(opt => opt.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('List your saved playlists')),

  async execute(interaction, client) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const db = client.db;
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const tier = await getTierForContext(client, guildId, userId);

    if (sub === 'save') {
      const player = client.players.get(guildId);
      if (!player || (player.queue.length === 0 && !player.currentTrack)) {
        return interaction.editReply({ embeds: [errorEmbed('', 'Queue is empty. Play something first.')] });
      }

      const count = db.countPlaylists(guildId, userId);
      const maxPlaylists = getMaximum(tier, 'maxPlaylists');
      if (count >= maxPlaylists) {
        return interaction.editReply({ embeds: [warningEmbed('Limit Reached', `You have reached the max of **${maxPlaylists}** playlists${tier === 'free' ? '. Upgrade to Pro for more.' : ''}`)] });
      }

      const name = interaction.options.getString('name');
      const allTracks = player.currentTrack ? [player.currentTrack, ...player.queue] : [...player.queue];
      const maxTracks = getMaximum(tier, 'maxPlaylistTracks');
      const tracks = allTracks.slice(0, maxTracks).map(t => ({ title: t.title, url: t.url, duration: t.duration }));

      try {
        db.savePlaylist(guildId, userId, name, tracks);
        return interaction.editReply({ embeds: [successEmbed('Saved', `Saved **${tracks.length}** tracks as playlist **${name}**.`)] });
      } catch (err) {
        return interaction.editReply({ embeds: [errorEmbed('', `Failed to save playlist: ${err.message}`)] });
      }
    }

    if (sub === 'load') {
      const name = interaction.options.getString('name');
      const tracks = db.loadPlaylist(guildId, userId, name);
      if (!tracks || tracks.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Not Found', `No playlist named **${name}**. Use \`/playlist list\` to see your playlists.`)] });
      }

      const player = client.players.get(guildId);
      if (!player) {
        return interaction.editReply({ embeds: [errorEmbed('', 'Bot must be in a voice channel. Play something first.')] });
      }

      const Track = require('../music/Track');
      const resolver = client.resolver || (client.resolver = new (require('../music/Resolver'))(client));
      await interaction.editReply({ embeds: [infoEmbed('Loading', `Loading **${tracks.length}** tracks from **${name}**...`)] });

      let loaded = 0;
      for (const t of tracks) {
        const results = await resolver.resolve(t.url, userId);
        if (results.length > 0) {
          player.queue.push(results[0]);
          loaded++;
        }
      }

      if (player.audioPlayer.state.status === 'idle' && player.queue.length > 0) {
        player.play(player.queue.shift());
      }

      return interaction.editReply({ embeds: [successEmbed('Loaded', `Loaded **${loaded}** tracks from playlist **${name}**.`)] });
    }

    if (sub === 'delete') {
      const name = interaction.options.getString('name');
      const result = db.deletePlaylist(guildId, userId, name);
      if (result.changes === 0) {
        return interaction.editReply({ embeds: [errorEmbed('Not Found', `No playlist named **${name}**.`)] });
      }
      return interaction.editReply({ embeds: [successEmbed('Deleted', `Playlist **${name}** deleted.`)] });
    }

    if (sub === 'list') {
      const playlists = db.listPlaylists(guildId, userId);
      if (playlists.length === 0) {
        return interaction.editReply({ embeds: [infoEmbed('Playlists', 'You have no saved playlists. Use `/playlist save <name>` to create one.')] });
      }

      const desc = playlists.map((p, i) => `**${i + 1}.** ${p.name} — ${p.count} tracks`).join('\n');
      return interaction.editReply({ embeds: [infoEmbed('Your Playlists', desc)] });
    }
  },
};
