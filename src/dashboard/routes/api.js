const express = require('express');
const rateLimit = require('express-rate-limit').default || require('express-rate-limit');
const router = express.Router();

const apiLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  message: { error: 'Rate limit exceeded. Try again later.' },
});

router.use(apiLimiter);

function isAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function getClient() {
  return require('../../index');
}

async function userInGuild(req, guildId) {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${req.user.id}`, {
      headers: { Authorization: `Bot ${process.env.BOT_TOKEN}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function ensurePlayer(guildId) {
  const client = getClient();
  return client.players.get(guildId) || null;
}

router.use(isAuthenticated);

router.get('/guilds', async (req, res) => {
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${req.user.accessToken}` },
    });
    const guilds = await response.json();
    const client = getClient();
    const mutual = guilds.filter(g => client.guilds.cache.has(g.id));
    res.json(mutual.map(g => ({ id: g.id, name: g.name, icon: g.icon })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/guild/:id/player', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.json({ active: false });
  res.json({ active: true, ...player.serialize() });
});

router.post('/guild/:id/skip', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.skip();
  res.json({ success: true });
});

router.post('/guild/:id/pause', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  if (player.paused) {
    player.resume();
  } else {
    player.pause();
  }
  res.json({ success: true, paused: player.paused });
});

router.post('/guild/:id/stop', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.stop();
  res.json({ success: true });
});

router.post('/guild/:id/volume', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { volume } = req.body;
  if (volume === undefined || volume < 0 || volume > 200) return res.status(400).json({ error: 'Volume must be 0-200' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.setVolume(volume);
  res.json({ success: true, volume: player.volume });
});

router.post('/guild/:id/remove', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { position } = req.body;
  if (!position) return res.status(400).json({ error: 'Position required' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  const removed = player.remove(position);
  if (!removed) return res.status(400).json({ error: 'Invalid position' });
  res.json({ success: true });
});

router.post('/guild/:id/move', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'From and to required' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  if (!player.move(from, to)) return res.status(400).json({ error: 'Invalid positions' });
  res.json({ success: true });
});

router.post('/guild/:id/seek', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { seconds } = req.body;
  if (seconds === undefined) return res.status(400).json({ error: 'Seconds required' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.seek(seconds);
  res.json({ success: true });
});

router.post('/guild/:id/loop', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.setLoop();
  res.json({ success: true, loopMode: player.loopMode });
});

router.post('/guild/:id/shuffle', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.shuffle();
  res.json({ success: true });
});

router.post('/guild/:id/clear', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.clear();
  res.json({ success: true });
});

router.post('/guild/:id/play', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  const client = getClient();
  const guild = client.guilds.cache.get(req.params.id);
  if (!guild) return res.status(404).json({ error: 'Guild not found' });

  const member = guild.members.cache.get(req.user.id);
  if (!member || !member.voice.channel) return res.status(400).json({ error: 'You are not in a voice channel' });

  const Resolver = require('../../music/Resolver');
  const resolver = client.resolver || (client.resolver = new Resolver(client));
  const tracks = await resolver.resolve(query, req.user.id);
  if (!tracks || tracks.length === 0) return res.status(404).json({ error: 'No results found' });

  let player = ensurePlayer(req.params.id);
  if (!player) {
    const GuildPlayer = require('../../music/Player');
    player = new GuildPlayer(req.params.id, client, member.voice.channel);
    client.players.set(req.params.id, player);
  } else if (!player.connection) {
    player._joinVoice(member.voice.channel);
  }

  const isPlaying = player.audioPlayer.state.status === 'playing' || player.audioPlayer.state.status === 'paused';
  const first = tracks[0];

  if (!isPlaying && player.queue.length === 0) {
    const rest = tracks.slice(1);
    player.queue.push(...rest);
    player.play(first);
  } else {
    player.queue.push(...tracks);
  }

  res.json({ success: true, track: first.title });
});

router.post('/guild/:id/autoplay', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.autoplay = !player.autoplay;
  res.json({ success: true, autoplay: player.autoplay });
});

router.post('/guild/:id/filters', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { filter } = req.body;
  if (!filter) return res.status(400).json({ error: 'Filter name required' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.setFilter(filter);
  res.json({ success: true, filter: player.filters });
});

router.post('/guild/:id/247', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const player = ensurePlayer(req.params.id);
  if (!player) return res.status(404).json({ error: 'No active player' });
  player.stay247 = !player.stay247;
  res.json({ success: true, stay247: player.stay247 });
});

router.get('/guild/:id/playlists', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const client = getClient();
  const playlists = client.db.listPlaylists(req.params.id, req.user.id);
  res.json(playlists);
});

router.post('/guild/:id/playlists/save', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const player = ensurePlayer(req.params.id);
  if (!player || (!player.currentTrack && player.queue.length === 0)) return res.status(400).json({ error: 'Nothing to save' });
  const client = getClient();
  const allTracks = player.currentTrack ? [player.currentTrack, ...player.queue] : [...player.queue];
  client.db.savePlaylist(req.params.id, req.user.id, name, allTracks);
  res.json({ success: true, count: allTracks.length });
});

router.post('/guild/:id/playlists/load', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const client = getClient();
  const tracks = client.db.loadPlaylist(req.params.id, req.user.id, name);
  if (!tracks) return res.status(404).json({ error: 'Playlist not found' });

  const guild = client.guilds.cache.get(req.params.id);
  const member = guild?.members.cache.get(req.user.id);
  if (!member || !member.voice.channel) return res.status(400).json({ error: 'Not in voice channel' });

  let player = ensurePlayer(req.params.id);
  if (!player) {
    const GuildPlayer = require('../../music/Player');
    player = new GuildPlayer(req.params.id, client, member.voice.channel);
    client.players.set(req.params.id, player);
  }

  player.queue.push(...tracks);
  if (!player.currentTrack) player.play(player.queue.shift());
  res.json({ success: true, count: tracks.length });
});

router.post('/guild/:id/playlists/delete', async (req, res) => {
  if (!await userInGuild(req, req.params.id)) return res.status(403).json({ error: 'Not in guild' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const client = getClient();
  client.db.deletePlaylist(req.params.id, req.user.id, name);
  res.json({ success: true });
});

module.exports = router;
