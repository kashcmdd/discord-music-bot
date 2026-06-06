class Track {
  constructor({ title, url, duration, requester, thumbnail, source }) {
    this.title = title;
    this.url = url;
    this.duration = duration || 0;
    this.requester = requester;
    this.thumbnail = thumbnail || null;
    this.source = source || 'youtube';
  }

  static fromYouTube(videoInfo, requester) {
    return new Track({
      title: videoInfo.title || videoInfo.videoDetails?.title || 'Unknown',
      url: videoInfo.url || videoInfo.videoDetails?.video_url || '',
      duration: parseInt(videoInfo.duration || videoInfo.videoDetails?.lengthSeconds || 0, 10),
      requester,
      thumbnail: videoInfo.thumbnail || videoInfo.videoDetails?.thumbnails?.[0]?.url || null,
      source: 'youtube',
    });
  }

  static fromSpotify(track, requester) {
    return new Track({
      title: `${track.artists?.map(a => a.name).join(', ') || 'Unknown'} - ${track.name || 'Unknown'}`,
      url: track.external_urls?.spotify || '',
      duration: Math.round((track.duration_ms || 0) / 1000),
      requester,
      thumbnail: track.album?.images?.[0]?.url || null,
      source: 'spotify',
    });
  }

  static fromYtSearch(result, requester) {
    return new Track({
      title: result.title,
      url: result.url,
      duration: result.duration?.seconds || result.seconds || 0,
      requester,
      thumbnail: result.thumbnail || result.image || null,
      source: 'youtube',
    });
  }
}

module.exports = Track;
