const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor() {
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new DatabaseSync(path.join(dbDir, 'music-bot.db'));
    this.db.exec('PRAGMA journal_mode=WAL');
    this._init();
  }

  _init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saved_playlists (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tracks TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id, name)
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        volume INTEGER DEFAULT 50,
        request_channel TEXT,
        np_color TEXT DEFAULT '#9b59b6',
        np_footer TEXT DEFAULT 'Discord Music Bot v2.0.0',
        np_layout TEXT DEFAULT 'full'
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        volume INTEGER DEFAULT 50,
        request_channel TEXT,
        np_color TEXT DEFAULT '#9b59b6',
        np_footer TEXT DEFAULT 'Discord Music Bot v2.0.0',
        np_layout TEXT DEFAULT 'full'
      );

      CREATE TABLE IF NOT EXISTS guild_tiers (
        guild_id TEXT PRIMARY KEY,
        tier TEXT DEFAULT 'free' CHECK(tier IN ('free','pro','vip')),
        set_by TEXT,
        set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_overrides (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tier TEXT NOT NULL CHECK(tier IN ('free','pro','vip')),
        set_by TEXT,
        set_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS tier_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        old_tier TEXT,
        new_tier TEXT,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS track_plays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        track_url TEXT NOT NULL,
        track_title TEXT NOT NULL,
        played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try { this.db.exec('ALTER TABLE guild_settings ADD COLUMN np_color TEXT DEFAULT \'#9b59b6\''); } catch {}
    try { this.db.exec('ALTER TABLE guild_settings ADD COLUMN np_footer TEXT DEFAULT \'Discord Music Bot v2.0.0\''); } catch {}
    try { this.db.exec('ALTER TABLE guild_settings ADD COLUMN np_layout TEXT DEFAULT \'full\''); } catch {}
  }

  savePlaylist(guildId, userId, name, tracks) {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO saved_playlists (guild_id, user_id, name, tracks) VALUES (?, ?, ?, ?)'
    );
    stmt.run(guildId, userId, name, JSON.stringify(tracks));
  }

  loadPlaylist(guildId, userId, name) {
    const stmt = this.db.prepare(
      'SELECT tracks FROM saved_playlists WHERE guild_id = ? AND user_id = ? AND name = ?'
    );
    const row = stmt.get(guildId, userId, name);
    return row ? JSON.parse(row.tracks) : null;
  }

  deletePlaylist(guildId, userId, name) {
    const stmt = this.db.prepare(
      'DELETE FROM saved_playlists WHERE guild_id = ? AND user_id = ? AND name = ?'
    );
    return stmt.run(guildId, userId, name);
  }

  listPlaylists(guildId, userId) {
    const stmt = this.db.prepare(
      'SELECT name, tracks FROM saved_playlists WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(guildId, userId);
    return rows.map(r => ({ name: r.name, count: JSON.parse(r.tracks).length }));
  }

  countPlaylists(guildId, userId) {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM saved_playlists WHERE guild_id = ? AND user_id = ?'
    );
    return stmt.get(guildId, userId).count;
  }

  setGuildTier(guildId, tier, setBy) {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO guild_tiers (guild_id, tier, set_by) VALUES (?, ?, ?)'
    );
    stmt.run(guildId, tier, setBy);
  }

  getGuildTier(guildId) {
    const stmt = this.db.prepare('SELECT tier FROM guild_tiers WHERE guild_id = ?');
    const row = stmt.get(guildId);
    return row ? row.tier : 'free';
  }

  setUserOverride(guildId, userId, tier, setBy) {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO user_overrides (guild_id, user_id, tier, set_by) VALUES (?, ?, ?, ?)'
    );
    stmt.run(guildId, userId, tier, setBy);
  }

  logTierChange(guildId, changedBy, oldTier, newTier) {
    const stmt = this.db.prepare(
      'INSERT INTO tier_audit_log (guild_id, changed_by, old_tier, new_tier) VALUES (?, ?, ?, ?)'
    );
    stmt.run(guildId, changedBy, oldTier, newTier);
  }

  setRequestChannel(guildId, channelId) {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO guild_settings (guild_id, request_channel) VALUES (?, ?)'
    );
    stmt.run(guildId, channelId);
  }

  getRequestChannel(guildId) {
    const stmt = this.db.prepare('SELECT request_channel FROM guild_settings WHERE guild_id = ?');
    const row = stmt.get(guildId);
    return row ? row.request_channel : null;
  }

  removeRequestChannel(guildId) {
    const stmt = this.db.prepare('UPDATE guild_settings SET request_channel = NULL WHERE guild_id = ?');
    stmt.run(guildId);
  }

  logTrackPlay(guildId, trackUrl, trackTitle) {
    const stmt = this.db.prepare(
      'INSERT INTO track_plays (guild_id, track_url, track_title) VALUES (?, ?, ?)'
    );
    stmt.run(guildId, trackUrl, trackTitle);
  }

  getWeeklyLeaderboard(guildId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT track_title, track_url, COUNT(*) as plays
      FROM track_plays
      WHERE guild_id = ? AND played_at >= datetime('now', '-7 days')
      GROUP BY track_url
      ORDER BY plays DESC
      LIMIT ?
    `);
    return stmt.all(guildId, limit);
  }

  getNpConfig(guildId) {
    const stmt = this.db.prepare('SELECT np_color, np_footer, np_layout FROM guild_settings WHERE guild_id = ?');
    const row = stmt.get(guildId);
    return row || { np_color: '#9b59b6', np_footer: 'Discord Music Bot v2.0.0', np_layout: 'full' };
  }

  setNpColor(guildId, color) {
    this.db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    this.db.prepare('UPDATE guild_settings SET np_color = ? WHERE guild_id = ?').run(color, guildId);
  }

  setNpFooter(guildId, footer) {
    this.db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    this.db.prepare('UPDATE guild_settings SET np_footer = ? WHERE guild_id = ?').run(footer, guildId);
  }

  setNpLayout(guildId, layout) {
    this.db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    this.db.prepare('UPDATE guild_settings SET np_layout = ? WHERE guild_id = ?').run(layout, guildId);
  }

  resetNpConfig(guildId) {
    this.db.prepare('INSERT OR IGNORE INTO guild_settings (guild_id) VALUES (?)').run(guildId);
    this.db.prepare('UPDATE guild_settings SET np_color = \'#9b59b6\', np_footer = \'Discord Music Bot v2.0.0\', np_layout = \'full\' WHERE guild_id = ?').run(guildId);
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
