const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, infoEmbed } = require('../utils/embeds');
const LyricsProvider = require('../music/LyricsProvider');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Get lyrics for a song')
    .addStringOption(opt => opt.setName('song').setDescription('Song title (optional, uses current track if omitted)')),

  async execute(interaction, client) {
    await interaction.deferReply();
    let query = interaction.options.getString('song');

    if (!query) {
      const player = client.players.get(interaction.guildId);
      if (player && player.currentTrack) {
        query = player.currentTrack.title;
      } else {
        return interaction.editReply({ embeds: [errorEmbed('', 'Nothing is playing. Provide a song title or play something first.')] });
      }
    }

    const provider = new LyricsProvider();
    const lyrics = await provider.getLyrics(query);

    if (!lyrics) {
      return interaction.editReply({ embeds: [errorEmbed('Not Found', `No lyrics found for **${query}**.`)] });
    }

    const chunks = LyricsProvider.chunkLyrics(lyrics);
    const embeds = chunks.map((chunk, i) =>
      infoEmbed(i === 0 ? `Lyrics — ${query}` : `Lyrics — ${query} (cont.)`, chunk.substring(0, 4096))
        .setFooter({ text: `Discord Music Bot v2.0.0 • Part ${i + 1}/${chunks.length}` })
    );

    await interaction.editReply({ embeds: [embeds[0]] });
    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({ embeds: [embeds[i]] });
    }
  },
};
