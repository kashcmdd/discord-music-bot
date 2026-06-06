const {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
} = require('@discordjs/voice');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const { getFilterChain } = require('./Filters');
const { getFFmpegPath, getYTDLPPath } = require('../utils/paths');
const { nowPlayingEmbed, progressBar, formatDuration } = require('../utils/embeds');

class GuildPlayer extends EventEmitter {
  constructor(guildId, client, voiceChannel) {
    super();
    this.guildId = guildId;
    this.client = client;
    this.queue = [];
    this.currentTrack = null;
    this.loopMode = 'off';
    this.volume = 50;
    this.filters = 'clear';
    this.autoplay = false;
    this.stay247 = false;
    this.paused = false;
    this.pauseOnEmpty = false;
    this.seekPosition = 0;
    this.syncedLyrics = null;
    this.showingLyrics = false;

    this.audioPlayer = createAudioPlayer();
    this.connection = null;
    this.currentResource = null;

    this.idleTimeout = null;
    this.emptyTimeout = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.sleepTimer = null;

    this.npChannel = null;
    this.npMessage = null;
    this.npInterval = null;
    this.npUpdating = false;
    this.npTrackUrl = null;
    this.lyricsMessage = null;
    this.plainLyrics = null;
    this.playStartTime = null;
    this.pauseStartTime = null;

    this._setupAudioPlayer();
    this._joinVoice(voiceChannel);
  }

  _setupAudioPlayer() {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.client.logger.info(`Player ${this.guildId}: Idle`);
      this.seekPosition = 0;
      this._advanceQueue();
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
      this.client.logger.info(`Player ${this.guildId}: Playing`);
      this.paused = false;
      if (this.currentTrack) {
        this.client.db.logTrackPlay(this.guildId, this.currentTrack.url, this.currentTrack.title);
      }
      this.emit('playerUpdate', this.serialize());
    });

    this.audioPlayer.on(AudioPlayerStatus.Paused, () => {
      this.client.logger.info(`Player ${this.guildId}: Paused`);
      this.paused = true;
      this.emit('playerUpdate', this.serialize());
    });

    this.audioPlayer.on(AudioPlayerStatus.Buffering, () => {
      this.client.logger.info(`Player ${this.guildId}: Buffering`);
    });

    this.audioPlayer.on('error', (err) => {
      this.client.logger.error(`AudioPlayer error in ${this.guildId}: ${err.message}`);
      if (this.currentTrack && (this.resourceAttempts || 0) < 2) {
        this.resourceAttempts = (this.resourceAttempts || 0) + 1;
        const track = this.currentTrack;
        this.currentTrack = null;
        this.audioPlayer.stop(true);
        this.play(track);
      } else {
        this.resourceAttempts = 0;
        this._advanceQueue();
      }
    });
  }

  async _joinVoice(channel) {
    try {
      this.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
      });

      this.client.logger.info(`Joining voice channel ${channel.id} in ${channel.guild.id}`);

      for (const status of [VoiceConnectionStatus.Ready, VoiceConnectionStatus.Connecting, VoiceConnectionStatus.Signalling, VoiceConnectionStatus.Destroyed]) {
        this.connection.on(status, () => {
          this.client.logger.info(`Voice ${status} in ${this.guildId}`);
        });
      }

      this.connection.on('error', (err) => {
        this.client.logger.error(`Voice connection error in ${this.guildId}: ${err.message}`);
      });

      this.connection.on('debug', (msg) => {
        this.client.logger.info(`Voice debug in ${this.guildId}: ${msg}`);
      });

      this.connection.on(VoiceConnectionStatus.Ready, () => {
        this.reconnectAttempts = 0;
      });

      this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
            this.client.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(async () => {
              try {
                await this.connection.rejoin();
              } catch {
                if (this.reconnectAttempts >= this.maxReconnectAttempts) this._cleanup();
              }
            }, delay);
          } else {
            this._cleanup();
          }
        }
      });

      this.connection.subscribe(this.audioPlayer);
    } catch (err) {
      this.client.logger.error(`Failed to join voice in ${this.guildId}: ${err.message}`);
    }
  }

  async play(track) {
    if (!track) return;

    this.currentTrack = track;
    this.seekPosition = 0;
    this.syncedLyrics = null;
    this.plainLyrics = null;
    this.showingLyrics = false;
    this.playStartTime = Date.now();
    this.pauseStartTime = null;
    if (this.lyricsMessage) {
      try { await this.lyricsMessage.delete(); } catch {}
      this.lyricsMessage = null;
    }
    this._updatePresence(track);

    try {
      this.client.logger.info(`Playing: ${track.title} (${track.url})`);
      const filterChain = getFilterChain(this.filters);
      const ffmpegPath = getFFmpegPath();
      const ytPath = getYTDLPPath();

      const ytProcess = spawn(ytPath, [
        '-f', 'bestaudio', '-o', '-', '--no-playlist',
        '--no-warnings', '--no-cache-dir', track.url,
      ]);
      ytProcess.stderr.on('data', () => {});
      ytProcess.on('error', () => {});

      const ff = spawn(ffmpegPath, [
        '-loglevel', '0', '-i', 'pipe:0',
        ...(this.seekPosition > 0 ? ['-ss', String(this.seekPosition)] : []),
        ...(filterChain ? ['-af', filterChain] : []),
        '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1',
      ]);
      ytProcess.stdout.pipe(ff.stdin).on('error', () => {});
      ff.on('error', () => {});

      const resource = createAudioResource(ff.stdout, {
        inlineVolume: true,
        inputType: 'raw',
      });

      resource.volume.setVolume(this.volume / 100);
      this.currentResource = resource;

      if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
        this.audioPlayer.unpause();
      }

      this.audioPlayer.play(resource);
      this._cancelIdleTimeout();
      this.emit('playerUpdate', this.serialize());
      this.emit('queueUpdate', this.serialize());
      this._updateNowPlaying();
    } catch (err) {
      this.client.logger.error(`Failed to play track in ${this.guildId}: ${err.message}`);
      this._advanceQueue();
    }
  }

  _advanceQueue() {
    const prevTrack = this.currentTrack;
    this.currentTrack = null;
    this.currentResource = null;
    this.syncedLyrics = null;
    this.showingLyrics = false;

    if (this.loopMode === 'track' && prevTrack) {
      this.play(prevTrack);
      return;
    }

    if (this.loopMode === 'queue' && prevTrack) {
      this.queue.push(prevTrack);
    }

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.play(next);
      return;
    }

    if (this.autoplay) {
      this._autoplayNext();
      return;
    }

    this._startIdleTimeout();
    this._resetPresence();
    this.emit('playerUpdate', this.serialize());
    this.emit('queueUpdate', this.serialize());
    this._updateNowPlaying();
  }

  async _autoplayNext() {
    if (!this.currentTrack) return;
    try {
      const ytSearch = require('yt-search');
      const result = await ytSearch(`${this.currentTrack.title} mix`);
      const videos = result.videos;
      if (videos && videos.length > 0) {
        const Track = require('./Track');
        const related = Track.fromYtSearch(videos[0], this.client.user.id);
        this.queue.unshift(related);
        this._advanceQueue();
        return;
      }
    } catch {}
    this._startIdleTimeout();
  }

  pause() {
    this.audioPlayer.pause();
    if (!this.pauseStartTime) this.pauseStartTime = Date.now();
    this._updateNowPlaying();
  }

  resume() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      if (this.pauseStartTime) {
        this.playStartTime += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
      }
      this.audioPlayer.unpause();
      this._updateNowPlaying();
    }
  }

  skip(count = 1) {
    for (let i = 0; i < count - 1; i++) {
      if (this.queue.length > 0) {
        this.queue.shift();
      }
    }
    this.audioPlayer.stop();
  }

  stop() {
    if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null; }
    this.queue = [];
    this.currentTrack = null;
    this.audioPlayer.stop(true);
    this._cleanup();
  }

  seek(seconds) {
    if (!this.currentTrack) return;
    const clamped = Math.max(0, Math.min(seconds, this.currentTrack.duration));
    this.seekPosition = clamped;
    const track = this.currentTrack;
    this.currentTrack = null;
    this.audioPlayer.stop(true);
    this.play(track);
  }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(level, 200));
    if (this.currentResource && this.currentResource.volume) {
      this.currentResource.volume.setVolume(this.volume / 100);
    }
    this.emit('playerUpdate', this.serialize());
  }

  setLoop(mode) {
    const modes = ['off', 'track', 'queue'];
    const idx = modes.indexOf(this.loopMode);
    this.loopMode = modes[(idx + 1) % 3];
    this.emit('playerUpdate', this.serialize());
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.emit('queueUpdate', this.serialize());
  }

  remove(position) {
    if (position < 1 || position > this.queue.length) return null;
    const [removed] = this.queue.splice(position - 1, 1);
    this.emit('queueUpdate', this.serialize());
    return removed;
  }

  move(from, to) {
    if (from < 1 || from > this.queue.length || to < 1 || to > this.queue.length) return false;
    const [item] = this.queue.splice(from - 1, 1);
    this.queue.splice(to - 1, 0, item);
    this.emit('queueUpdate', this.serialize());
    return true;
  }

  clear() {
    this.queue = [];
    this.emit('queueUpdate', this.serialize());
  }

  setFilter(name) {
    this.filters = name;
    if (this.currentTrack) {
      const track = this.currentTrack;
      const pos = this.seekPosition;
      this.currentTrack = null;
      this.seekPosition = pos;
      this.audioPlayer.stop(true);
      this.play(track);
    }
    this.emit('playerUpdate', this.serialize());
  }

  setTextChannel(channel) {
    this.npChannel = channel;
  }

  async _updateNowPlaying() {
    if (!this.npChannel || this.npUpdating) return;
    this.npUpdating = true;
    const track = this.currentTrack;
    try {
      if (!track) {
        this._stopNPInterval();
        this.npTrackUrl = null;
        if (this.npMessage) {
          const embed = new (require('discord.js').EmbedBuilder)()
            .setColor(0x57F287)
            .setTitle('Queue Finished')
            .setDescription('Add more songs with `/play`');
          await this.npMessage.edit({ embeds: [embed], components: [] }).catch(() => {});
          this.npMessage = null;
          this.npCollector = null;
        }
        return;
      }

      const isNewTrack = track.url !== this.npTrackUrl;
      if (isNewTrack) {
        this.npTrackUrl = track.url;
        if (this.npMessage) {
          await this.npMessage.delete().catch(() => {});
          this.npMessage = null;
          this.npCollector = null;
        }
      }

      const config = this.client.db ? this.client.db.getNpConfig(this.guildId) : {};
      const color = parseInt(config.np_color?.replace('#', '') || '9b59b6', 16);
      const embed = nowPlayingEmbed(track, this, { color, footer: config.np_footer });

      const B = (id, emoji, style = ButtonStyle.Secondary) =>
        new ButtonBuilder().setCustomId(id).setEmoji(emoji).setStyle(id === 'np_playpause' ? ButtonStyle.Primary : style);

      const layout = config.np_layout || 'full';
      let rows;

      if (layout === 'minimal') {
        rows = [
          new ActionRowBuilder().addComponents(
            B('np_playpause', this.paused ? '▶️' : '⏸️'),
            B('np_skip', '⏭️'),
            B('np_stop', '⏹️', ButtonStyle.Danger),
          ),
        ];
      } else if (layout === 'compact') {
        rows = [
          new ActionRowBuilder().addComponents(
            B('np_playpause', this.paused ? '▶️' : '⏸️'),
            B('np_skip', '⏭️'),
            B('np_stop', '⏹️', ButtonStyle.Danger),
          ),
          new ActionRowBuilder().addComponents(
            B('np_vol_down', '🔉'),
            B('np_vol_up', '🔊'),
          ),
        ];
      } else if (layout === 'seek') {
        rows = [
          new ActionRowBuilder().addComponents(
            B('np_rewind', '◀️'),
            B('np_playpause', this.paused ? '▶️' : '⏸️'),
            B('np_forward', '⏩'),
            B('np_skip', '⏭️'),
            B('np_stop', '⏹️', ButtonStyle.Danger),
          ),
        ];
      } else {
        rows = [
          new ActionRowBuilder().addComponents(
            B('np_rewind', '◀️'),
            B('np_playpause', this.paused ? '▶️' : '⏸️'),
            B('np_skip', '⏭️'),
            B('np_forward', '⏩'),
          ),
          new ActionRowBuilder().addComponents(
            B('np_shuffle', '🔀'),
            B('np_loop', '🔁', this.loopMode !== 'off' ? ButtonStyle.Primary : ButtonStyle.Secondary),
            B('np_stop', '⏹️', ButtonStyle.Danger),
            B('np_grab', '💾'),
            B('np_lyrics', '📝', this.showingLyrics ? ButtonStyle.Primary : ButtonStyle.Secondary),
          ),
          new ActionRowBuilder().addComponents(
            B('np_vol_down', '🔉'),
            B('np_vol_up', '🔊'),
          ),
        ];
      }

      const payload = { embeds: [embed], components: rows };
      if (this.npMessage) {
        await this.npMessage.edit(payload).catch(() => { this.npMessage = null; this.npCollector = null; });
      }
      if (!this.npMessage) {
        this.npMessage = await this.npChannel.send(payload);
        this._setupNPCollector();
      }
      this._scheduleNPUpdate();

      if (this.showingLyrics && this.syncedLyrics) {
        const lyricsEmbed = this._buildLyricsEmbed();
        if (this.lyricsMessage) {
          await this.lyricsMessage.edit({ embeds: [lyricsEmbed] }).catch(() => { this.lyricsMessage = null; });
        } else {
          this.lyricsMessage = await this.npChannel.send({ embeds: [lyricsEmbed] });
        }
      } else if (this.showingLyrics && this.plainLyrics) {
        const { EmbedBuilder } = require('discord.js');
        const LyricsProvider = require('./LyricsProvider');
        const chunks = LyricsProvider.chunkLyrics(this.plainLyrics);
        const embed = new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`📝 ${track.title}`)
          .setURL(track.url)
          .setThumbnail(track.thumbnail)
          .setDescription(chunks[0].substring(0, 4096));
        if (this.lyricsMessage) {
          await this.lyricsMessage.edit({ embeds: [embed] }).catch(() => { this.lyricsMessage = null; });
        } else {
          this.lyricsMessage = await this.npChannel.send({ embeds: [embed] });
        }
      } else if (this.lyricsMessage) {
        await this.lyricsMessage.delete().catch(() => {});
        this.lyricsMessage = null;
      }
    } catch (err) {
      this.client.logger.error(`NP update error in ${this.guildId}: ${err.message}`);
      this.npMessage = null;
      this.npCollector = null;
    } finally {
      this.npUpdating = false;
      this._scheduleNPUpdate();
    }
  }

  _scheduleNPUpdate() {
    if (this.npInterval) {
      clearTimeout(this.npInterval);
      this.npInterval = null;
    }
    if (!this.currentTrack && !this.showingLyrics) return;

    let delay = 1000;
    if (this.showingLyrics && this.syncedLyrics) {
      const now = this._getCurrentTime();
      const next = this.syncedLyrics.find(l => l.time > now);
      if (next) {
        const lineDelay = Math.max(50, (next.time - now) * 1000);
        delay = Math.min(lineDelay, 2000);
      } else {
        delay = 1000;
      }
    }

    this.npInterval = setTimeout(() => this._updateNowPlaying(), delay);
  }

  _stopNPInterval() {
    if (this.npInterval) {
      clearTimeout(this.npInterval);
      this.npInterval = null;
    }
  }

  _setupNPCollector() {
    if (!this.npMessage || this.npCollector) return;
    this.npCollector = this.npMessage.createMessageComponentCollector({ time: 0 });
    this.npCollector.on('collect', (i) => this._handleNPButton(i));
  }

  async _handleNPButton(interaction) {
    const memberVoice = interaction.member.voice.channel;
    const botVoice = interaction.guild.members.me.voice.channel;
    if (!memberVoice || (botVoice && botVoice.id !== memberVoice.id)) {
      try { await interaction.reply({ content: 'You must be in the same voice channel.', flags: 64 }); } catch {}
      return;
    }
    let msg = '';
    switch (interaction.customId) {
      case 'np_playpause':
        if (this.paused) { this.resume(); msg = '▶️ Resumed'; } else { this.pause(); msg = '⏸️ Paused'; }
        break;
      case 'np_skip':
        this.skip();
        msg = '⏩ Skipped';
        break;
      case 'np_stop':
        msg = '⏹️ Stopped';
        try { await interaction.reply({ content: msg, flags: 64 }); } catch {}
        this.stop();
        return;
      case 'np_loop':
        this.setLoop();
        msg = `🔁 Loop: ${this.loopMode === 'off' ? 'Off' : this.loopMode === 'track' ? 'Track' : 'Queue'}`;
        break;
      case 'np_shuffle':
        this.shuffle();
        msg = '🔀 Shuffled';
        break;
      case 'np_rewind':
        if (this.currentTrack) {
          const target = Math.max(0, this._getCurrentTime() - 10);
          this.seek(target);
          msg = `◀️ -10s (${require('../utils/embeds').formatDuration(target)})`;
        }
        break;
      case 'np_forward':
        if (this.currentTrack) {
          const target = Math.min(this.currentTrack.duration, this._getCurrentTime() + 10);
          this.seek(target);
          msg = `▶️ +10s (${require('../utils/embeds').formatDuration(target)})`;
        }
        break;
      case 'np_vol_down':
        this.setVolume(Math.max(0, this.volume - 10));
        msg = `🔉 Volume: ${this.volume}%`;
        break;
      case 'np_vol_up':
        this.setVolume(Math.min(200, this.volume + 10));
        msg = `🔊 Volume: ${this.volume}%`;
        break;
      case 'np_playlist':
        msg = '📋 View playlist on the dashboard: http://localhost:3000';
        break;
      case 'np_grab':
        if (this.currentTrack) {
          try {
            const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { formatDuration } = require('../utils/embeds');
            const track = this.currentTrack;
            const embed = new EmbedBuilder()
              .setColor(0x9b59b6).setTitle(track.title).setURL(track.url)
              .addFields({ name: 'Duration', value: formatDuration(track.duration), inline: true });
            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(track.url).setLabel('Open in YouTube'),
            );
            await interaction.user.send({ embeds: [embed], components: [row] });
            msg = '💾 Sent to your DMs';
          } catch {
            msg = '💾 Could not DM you';
          }
        }
        break;
      case 'np_lyrics':
        if (this.showingLyrics) {
          this.showingLyrics = false;
          try { await interaction.reply({ content: '📝 Lyrics off', flags: 64 }); } catch {}
          this._updateNowPlaying();
          return;
        }
        if (!this.currentTrack) {
          try { await interaction.reply({ content: 'Nothing is playing.', flags: 64 }); } catch {}
          return;
        }
        if (this.syncedLyrics) {
          this.showingLyrics = true;
          try { await interaction.reply({ content: '📝 Synced lyrics on', flags: 64 }); } catch {}
          this._updateNowPlaying();
          return;
        }
        await interaction.deferReply({ flags: 64 });
        try {
          const LyricsProvider = require('./LyricsProvider');
          const provider = new LyricsProvider();
          const title = this.currentTrack.title;
          this.client.logger.warn(`Lyrics: fetching for "${title}"`);
          const raw = await provider.getSyncedLyrics(title);
          this.client.logger.warn(`Lyrics: raw=${raw ? raw.length + ' chars' : 'null'}`);
          const parsed = LyricsProvider.parseLRC(raw);
          this.client.logger.warn(`Lyrics: parsed=${parsed ? parsed.length + ' lines' : 'null'}`);
          if (parsed && parsed.length > 0) {
            this.syncedLyrics = parsed;
            this.plainLyrics = null;
            this.showingLyrics = true;
            try { await interaction.editReply({ content: '📝 Synced lyrics loaded' }); } catch {}
            this._updateNowPlaying();
          } else {
            const plain = await provider.getLyrics(title);
            this.client.logger.warn(`Lyrics: plain=${plain ? plain.length + ' chars' : 'null'}`);
            if (plain) {
              this.plainLyrics = plain;
              this.syncedLyrics = null;
              this.showingLyrics = true;
              try { await interaction.editReply({ content: '📝 Lyrics loaded (no sync available)' }); } catch {}
              this._updateNowPlaying();
            } else {
              try { await interaction.editReply({ content: 'No lyrics available for this track.' }); } catch {}
            }
          }
        } catch (err) {
          this.client.logger.warn(`Lyrics: error "${err.message}"`);
          try { await interaction.editReply({ content: 'Error fetching lyrics.' }); } catch {}
        }
        return;
    }
    if (msg) {
      try { await interaction.reply({ content: msg, flags: 64 }); } catch {}
    }
    this._updateNowPlaying();
  }

  _updatePresence(track) {
    try {
      const title = track.title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/ft\..*/i, '').trim();
      this.client.user.setActivity(`🎵 ${title.substring(0, 80)}`, { type: require('discord.js').ActivityType.Playing });
    } catch {}
  }

  _resetPresence() {
    try {
      this.client.user.setActivity('/play | v2.0.0', { type: require('discord.js').ActivityType.Listening });
    } catch {}
  }

  _getLyricsLineIndex(time) {
    if (!this.syncedLyrics) return -1;
    for (let i = this.syncedLyrics.length - 1; i >= 0; i--) {
      if (time >= this.syncedLyrics[i].time) return i;
    }
    return 0;
  }

  _getCurrentTime() {
    const posMs = this.audioPlayer.state.resource?.playbackDuration || 0;
    return Math.floor(posMs / 1000) + this.seekPosition;
  }

  _buildLyricsEmbed() {
    const { EmbedBuilder } = require('discord.js');
    const posSec = this._getCurrentTime();
    const idx = this._getLyricsLineIndex(posSec);
    const track = this.currentTrack;
    const lines = [];

    for (let i = Math.max(0, idx - 3); i < idx; i++) {
      lines.push(`~~${this.syncedLyrics[i].text}~~`);
    }
    if (idx >= 0 && idx < this.syncedLyrics.length) {
      lines.push(`► **${this.syncedLyrics[idx].text}**`);
    }
    for (let i = idx + 1; i < Math.min(idx + 6, this.syncedLyrics.length); i++) {
      lines.push(`  ${this.syncedLyrics[i].text}`);
    }

    const bar = progressBar(posSec, track.duration);

    return new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🎤 ${track.title}`)
      .setURL(track.url)
      .setThumbnail(track.thumbnail)
      .setDescription(lines.join('\n'))
      .setFooter({ text: `\`${formatDuration(posSec)}\` ${bar} \`${formatDuration(track.duration)}\`` })
      .setTimestamp();
  }

  _onBotDisconnect() {
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
      this.pauseOnEmpty = true;
      this.audioPlayer.pause();
    }
    this.emptyTimeout = setTimeout(() => {
      this._cleanup();
    }, 5 * 60 * 1000);
  }

  _onBotRejoin() {
    if (this.emptyTimeout) {
      clearTimeout(this.emptyTimeout);
      this.emptyTimeout = null;
    }
    if (this.pauseOnEmpty) {
      this.pauseOnEmpty = false;
      this.audioPlayer.unpause();
    }
  }

  _onEmptyChannel() {
    if (this.stay247) return;
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
      this.pauseOnEmpty = true;
      this.audioPlayer.pause();
    }
    this.emptyTimeout = setTimeout(() => {
      this._onIdleTimeoutExpired();
    }, 2 * 60 * 1000);
  }

  _onChannelReoccupied() {
    if (this.emptyTimeout) {
      clearTimeout(this.emptyTimeout);
      this.emptyTimeout = null;
    }
    if (this.pauseOnEmpty) {
      this.pauseOnEmpty = false;
      this.audioPlayer.unpause();
    }
  }

  _startIdleTimeout() {
    if (this.stay247) return;
    this._cancelIdleTimeout();
    this.idleTimeout = setTimeout(() => {
      this._onIdleTimeoutExpired();
    }, 2 * 60 * 1000);
  }

  _cancelIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = null;
    }
  }

  _onIdleTimeoutExpired() {
    this._cleanup();
  }

  _cleanup() {
    this._cancelIdleTimeout();
    if (this.sleepTimer) { clearTimeout(this.sleepTimer); this.sleepTimer = null; }
    if (this.emptyTimeout) {
      clearTimeout(this.emptyTimeout);
      this.emptyTimeout = null;
    }
    this._stopNPInterval();
    this._resetPresence();
    if (this.npMessage) {
      try { this.npMessage.delete(); } catch {}
      this.npMessage = null;
      this.npCollector = null;
    }
    if (this.lyricsMessage) {
      try { this.lyricsMessage.delete(); } catch {}
      this.lyricsMessage = null;
    }
    this.npChannel = null;
    this.npTrackUrl = null;
    this.queue = [];
    this.currentTrack = null;

    try {
      this.audioPlayer.stop(true);
    } catch {}

    try {
      if (this.connection) {
        this.connection.destroy();
      }
    } catch {}

    this.connection = null;
    this.currentResource = null;
    this.client.players.delete(this.guildId);
    this.emit('botLeft', this.guildId);

    const channelId = process.env.AUDIT_LOG_CHANNEL_ID;
    if (channelId) {
      const channel = this.client.channels.cache.get(channelId);
      if (channel) {
        channel.send(`Left voice channel in guild ${this.guildId} due to inactivity.`).catch(() => {});
      }
    }
  }

  serialize() {
    return {
      current: this.currentTrack ? {
        title: this.currentTrack.title,
        url: this.currentTrack.url,
        duration: this.currentTrack.duration,
        thumbnail: this.currentTrack.thumbnail,
        requester: this.currentTrack.requester,
        source: this.currentTrack.source,
      } : null,
      queue: this.queue.slice(0, 50).map(t => ({
        title: t.title,
        url: t.url,
        duration: t.duration,
        thumbnail: t.thumbnail,
        requester: t.requester,
      })),
      loopMode: this.loopMode,
      volume: this.volume,
      filters: this.filters,
      autoplay: this.autoplay,
      stay247: this.stay247,
      paused: this.paused,
      position: this.audioPlayer.state.resource?.playbackDuration || 0,
      state: this.audioPlayer.state.status,
    };
  }
}

module.exports = GuildPlayer;
