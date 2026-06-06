const TIER_LIMITS = {
  free: {
    maxQueueSize: 50,
    maxPlaylists: 3,
    maxPlaylistTracks: 50,
    allowedFilters: ['clear', 'bass'],
    maxVolume: 100,
    autoplay: false,
    seek: false,
    playnext: false,
    customFilter: false,
    stay247: false,
  },
  pro: {
    maxQueueSize: 200,
    maxPlaylists: 15,
    maxPlaylistTracks: 200,
    allowedFilters: ['clear', 'bass', 'nightcore', 'vaporwave'],
    maxVolume: 150,
    autoplay: true,
    seek: true,
    playnext: true,
    customFilter: false,
    stay247: false,
  },
  vip: {
    maxQueueSize: Infinity,
    maxPlaylists: Infinity,
    maxPlaylistTracks: Infinity,
    allowedFilters: ['clear', 'bass', 'nightcore', 'vaporwave', 'custom'],
    maxVolume: 200,
    autoplay: true,
    seek: true,
    playnext: true,
    customFilter: true,
    stay247: true,
  },
};

const TIER_NAMES = ['free', 'pro', 'vip'];

async function getTierForContext(client, guildId, userId) {
  const cacheKey = `${guildId}:${userId}`;
  const cached = client.tierCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 300000) {
    return cached.tier;
  }

  try {
    const db = client.db;

    const userOverride = db.prepare(
      'SELECT tier FROM user_overrides WHERE guild_id = ? AND user_id = ?'
    ).get(guildId, userId);

    if (userOverride) {
      client.tierCache.set(cacheKey, { tier: userOverride.tier, ts: Date.now() });
      return userOverride.tier;
    }

    const guildTier = db.prepare(
      'SELECT tier FROM guild_tiers WHERE guild_id = ?'
    ).get(guildId);

    const tier = guildTier ? guildTier.tier : 'free';
    client.tierCache.set(cacheKey, { tier, ts: Date.now() });
    return tier;
  } catch {
    return 'free';
  }
}

function checkGate(tier, feature) {
  const limits = TIER_LIMITS[tier];
  if (!limits) return false;
  return !!limits[feature];
}

function getMaximum(tier, property) {
  const limits = TIER_LIMITS[tier];
  if (!limits) return TIER_LIMITS.free[property];
  return limits[property];
}

module.exports = {
  TIER_LIMITS,
  TIER_NAMES,
  getTierForContext,
  checkGate,
  getMaximum,
};
