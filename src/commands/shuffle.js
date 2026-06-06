const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle the queue'),

  async execute(interaction, client) {
    await interaction.deferReply();
    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || player.queue.length < 2) return interaction.editReply({ embeds: [errorEmbed('', 'Not enough tracks in the queue to shuffle.')] });

    const count = player.queue.length;
    player.shuffle();
    return interaction.editReply({ embeds: [successEmbed('Shuffled', `Queue shuffled (**${count}** tracks).`)] });
  },
};
