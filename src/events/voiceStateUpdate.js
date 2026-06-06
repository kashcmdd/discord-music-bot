const { VoiceConnectionStatus, entersState } = require('@discordjs/voice');

module.exports = (client, oldState, newState) => {
  const botId = client.user.id;

  if (newState.member && newState.member.id !== botId) return;
  if (oldState.channelId === newState.channelId) return;

  const guildId = oldState.guild.id || newState.guild.id;
  const player = client.players.get(guildId);
  if (!player) return;

  const botLeft = oldState.channelId && !newState.channelId;

  if (botLeft) {
    player._onBotDisconnect();
    return;
  }

  const botJoined = !oldState.channelId && newState.channelId;
  if (botJoined) {
    player._onBotRejoin();
    return;
  }

  const voiceChannel = newState.guild.members.me.voice.channel;
  if (voiceChannel) {
    const members = voiceChannel.members.filter(m => !m.user.bot);
    if (members.size === 0) {
      player._onEmptyChannel();
    } else if (player.paused && player.pauseOnEmpty) {
      player._onChannelReoccupied();
    }
  }
};
