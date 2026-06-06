const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { inSameVoiceChannel } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Pick a random track from the queue and play it next'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player || player.queue.length === 0) {
      return interaction.reply({ embeds: [errorEmbed('', 'Queue is empty.')], flags: 64 });
    }

    const idx = Math.floor(Math.random() * player.queue.length);
    const [track] = player.queue.splice(idx, 1);
    player.queue.unshift(track);

    if (player.currentTrack) {
      const current = player.currentTrack;
      player.currentTrack = null;
      player.seekPosition = 0;
      player.audioPlayer.stop(true);
      player.play(current);
    }

    return interaction.reply({ embeds: [successEmbed('Roulette', `🎲 **${track.title}** bumped to the top!`)], flags: 64 });
  },
};
