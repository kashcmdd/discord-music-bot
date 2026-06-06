const { Client } = require('genius-lyrics');

class LyricsProvider {
  constructor() {
    this.client = new Client(process.env.GENIUS_TOKEN);
  }

  async getLyrics(songTitle, artistName) {
    const query = artistName ? `${artistName} - ${songTitle}` : songTitle;
    const clean = LyricsProvider._cleanTitle(query);

    try {
      const searches = await this.client.songs.search(clean);
      if (searches && searches.length > 0) {
        const lyrics = await searches[0].lyrics();
        if (lyrics) return lyrics;
      }
    } catch {}

    return this._fetchFallback(clean);
  }

  async _fetchFallback(query) {
    const https = require('https');
    const clean = LyricsProvider._cleanTitle(query);
    const parts = clean.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : '';
    const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : clean;

    const fetcher = (url) => new Promise((resolve) => {
      https.get(url, { timeout: 8000 }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try { resolve(JSON.parse(d)); } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });

    if (artist && title) {
      const r = await fetcher(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
      if (r && r.lyrics) return r.lyrics;
    }

    return null;
  }

  static chunkLyrics(text, maxLength = 4096) {
    if (!text) return [];
    if (text.length <= maxLength) return [text];

    const chunks = [];
    const lines = text.split('\n');
    let current = '';

    for (const line of lines) {
      if (current.length + line.length + 1 > maxLength) {
        chunks.push(current.trim());
        current = '';
      }
      current += line + '\n';
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  static _cleanTitle(raw) {
    return raw
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/ft\.|feat\.|featuring\b/gi, '')
      .split('/')[0]
      .split('|')[0]
      .split('（')[0]
      .trim();
  }

  async getSyncedLyrics(trackTitle) {
    const https = require('https');
    const rawClean = LyricsProvider._cleanTitle(trackTitle);
    const parts = rawClean.split(' - ');
    const artist = parts.length > 1 ? parts[0].trim() : '';
    let title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : rawClean;

    const fetcher = (url) => new Promise((resolve) => {
      https.get(url, { timeout: 8000 }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode !== 200) return resolve(null);
          try { resolve(JSON.parse(d)); } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });

    const findSynced = (data) => {
      if (!data) return null;
      if (data.syncedLyrics) return data.syncedLyrics;
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.syncedLyrics) return item.syncedLyrics;
        }
      }
      return null;
    };

    if (artist && title) {
      const r = await fetcher(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`);
      const found = findSynced(r);
      if (found) return found;
    }

    for (const q of [
      title ? `track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}` : null,
      title ? `track_name=${encodeURIComponent(title)}` : null,
      `track_name=${encodeURIComponent(rawClean)}`,
      `track_name=${encodeURIComponent(rawClean.replace(/ - /g, ' '))}`,
    ]) {
      if (!q) continue;
      const r = await fetcher(`https://lrclib.net/api/search?${q}`);
      const found = findSynced(r);
      if (found) return found;
    }

    return null;
  }

  static parseLRC(lrcText) {
    if (!lrcText) return null;
    const lines = lrcText.split('\n');
    const result = [];
    const regex = /\[(\d+):(\d{2})(?:\.(\d{2,3}))?\](.*)/;

    for (const line of lines) {
      const match = line.match(regex);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ms = parseInt(match[3] || '0');
        const divisor = match[3] && match[3].length >= 3 ? 1000 : 100;
        const time = minutes * 60 + seconds + ms / divisor;
        const text = match[4].trim();
        if (text) {
          result.push({ time, text });
        }
      }
    }

    return result.length > 0 ? result : null;
  }
}

module.exports = LyricsProvider;
