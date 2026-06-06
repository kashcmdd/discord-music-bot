const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const SpotifyWebApi = require('spotify-web-api-node');
const Track = require('./Track');
const { getYTDLPPath } = require('../utils/paths');

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|playlist\?list=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const PLAYLIST_RE = /(?:youtube\.com|youtu\.be)\/.*[?&]list=([a-zA-Z0-9_-]+)/;
const SPOTIFY_TRACK_RE = /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/;
const SPOTIFY_ALBUM_RE = /open\.spotify\.com\/album\/([a-zA-Z0-9]+)/;
const SPOTIFY_PLAYLIST_RE = /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/;

class Resolver {
  constructor(client) {
    this.client = client;

    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      this.spotify = new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      });
      this._initSpotify();
    } else {
      this.spotify = null;
    }
  }

  async _initSpotify() {
    try {
      const data = await this.spotify.clientCredentialsGrant();
      this.spotify.setAccessToken(data.body.access_token);
      setTimeout(() => this._initSpotify(), data.body.expires_in * 900);
    } catch (err) {
      this.client.logger.warn(`Spotify init failed: ${err.message}`);
    }
  }

  isYouTubeUrl(query) {
    return YOUTUBE_RE.test(query);
  }

  isYouTubePlaylist(query) {
    return PLAYLIST_RE.test(query);
  }

  isSpotifyUrl(query) {
    return SPOTIFY_TRACK_RE.test(query) || SPOTIFY_ALBUM_RE.test(query) || SPOTIFY_PLAYLIST_RE.test(query);
  }

  isSoundCloudUrl(query) {
    return /soundcloud\.com/i.test(query);
  }

  async resolve(query, requester) {
    if (this.isYouTubePlaylist(query)) {
      return this.resolveYouTubePlaylist(query, requester);
    }
    if (this.isYouTubeUrl(query)) {
      const track = await this.resolveYouTubeVideo(query, requester);
      return [track];
    }
    if (this.isSpotifyUrl(query)) {
      return this.resolveSpotify(query, requester);
    }
    if (this.isSoundCloudUrl(query)) {
      this.client.logger.warn('SoundCloud resolution is not yet implemented');
      return [];
    }
    return this.searchYouTube(query, requester);
  }

  async resolveYouTubeVideo(url, requester) {
    const result = await this._ytdlpResolve(url, requester);
    if (result.length > 0) return result;
    this.client.logger.warn(`yt-dlp failed for ${url}, trying ytdl-core fallback...`);
    try {
      const info = await ytdl.getInfo(url);
      return Track.fromYouTube(info, requester);
    } catch (err) {
      this.client.logger.warn(`ytdl-core also failed: ${err.message}`);
      return [];
    }
  }

  async resolveYouTubePlaylist(url, requester) {
    const match = url.match(PLAYLIST_RE);
    if (!match) return [];

    try {
      const data = await ytSearch({ listId: match[1], limit: 200 });
      const tracks = data.videos.map(v => Track.fromYtSearch(v, requester));
      return tracks;
    } catch (err) {
      this.client.logger.warn(`Playlist resolution failed: ${err.message}`);
      return [];
    }
  }

  async searchYouTube(query, requester) {
    try {
      const result = await ytSearch(query);
      const videos = result.videos;
      if (!videos || videos.length === 0) return [];
      return [Track.fromYtSearch(videos[0], requester)];
    } catch (err) {
      this.client.logger.warn(`YouTube search failed for "${query}": ${err.message}`);
      return [];
    }
  }

  async searchYouTubeMulti(query, requester, limit = 5) {
    try {
      const result = await ytSearch(query);
      const videos = result.videos;
      if (!videos || videos.length === 0) return [];
      return videos.slice(0, limit).map(v => Track.fromYtSearch(v, requester));
    } catch (err) {
      this.client.logger.warn(`YouTube search failed for "${query}": ${err.message}`);
      return [];
    }
  }

  async resolveSpotify(url, requester) {
    if (!this.spotify) {
      this.client.logger.warn('Spotify credentials not configured');
      return [];
    }

    try {
      const trackMatch = url.match(SPOTIFY_TRACK_RE);
      if (trackMatch) {
        const data = await this.spotify.getTrack(trackMatch[1]);
        const track = Track.fromSpotify(data.body, requester);
        const resolved = await this.searchYouTube(track.title, requester);
        return resolved.length > 0 ? resolved : [track];
      }

      const albumMatch = url.match(SPOTIFY_ALBUM_RE);
      if (albumMatch) {
        const data = await this.spotify.getAlbum(albumMatch[1]);
        const tracks = data.body.tracks.items.map(t => Track.fromSpotify(t, requester));
        return this._batchResolve(tracks, requester);
      }

      const playlistMatch = url.match(SPOTIFY_PLAYLIST_RE);
      if (playlistMatch) {
        const data = await this.spotify.getPlaylist(playlistMatch[1]);
        const tracks = data.body.tracks.items
          .filter(item => item.track)
          .map(item => Track.fromSpotify(item.track, requester));
        return this._batchResolve(tracks, requester);
      }
    } catch (err) {
      this.client.logger.warn(`Spotify resolution failed: ${err.message}`);
    }
    return [];
  }

  async _batchResolve(tracks, requester) {
    const resolved = [];
    for (const track of tracks) {
      try {
        const result = await this.searchYouTube(track.title, requester);
        if (result.length > 0) {
          resolved.push(result[0]);
        } else {
          resolved.push(track);
        }
      } catch {
        resolved.push(track);
      }
    }
    return resolved;
  }

  async _ytdlpResolve(url, requester) {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const yt = spawn(getYTDLPPath(), ['-j', '--no-playlist', url]);
      let stdout = '';
      yt.stdout.on('data', d => stdout += d);
      yt.on('close', (code) => {
        if (code !== 0 || !stdout) {
          resolve([]);
          return;
        }
        try {
          const info = JSON.parse(stdout.trim().split('\n')[0]);
          const track = new Track({
            title: info.title || 'Unknown',
            url: info.webpage_url || url,
            duration: info.duration || 0,
            requester,
            thumbnail: info.thumbnail || null,
            source: 'youtube',
          });
          resolve([track]);
        } catch {
          resolve([]);
        }
      });
      yt.on('error', () => resolve([]));
    });
  }
}

module.exports = Resolver;
