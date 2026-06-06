const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { formatDuration } = require('../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('grab')
    .setDescription('DM yourself the current song'),

  async execute(interaction, client) {
    const player = client.players.get(interaction.guildId);
    if (!player || !player.currentTrack) {
      return interaction.reply({ embeds: [errorEmbed('', 'Nothing is playing right now.')], flags: 64 });
    }

    const track = player.currentTrack;
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(track.title)
      .setURL(track.url)
      .addFields(
        { name: 'Duration', value: formatDuration(track.duration), inline: true },
        { name: 'Requested by', value: `<@${track.requester}>`, inline: true },
        { name: 'Guild', value: interaction.guild.name, inline: true },
      )
      .setFooter({ text: 'Discord Music Bot v2.0.0' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(track.url).setLabel('Open in YouTube'),
    );

    try {
      await interaction.user.send({ embeds: [embed], components: [row] });
      return interaction.reply({ embeds: [successEmbed('Grabbed', `Sent **${track.title}** to your DMs.`)], flags: 64 });
    } catch {
      return interaction.reply({ embeds: [errorEmbed('', "Couldn't DM you. Enable DMs from server members in your privacy settings.")], flags: 64 });
    }
  },
};
