const { SlashCommandBuilder } = require('discord.js');
const { checkDJ, inSameVoiceChannel } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear the entire queue'),

  async execute(interaction, client) {
    await interaction.deferReply();
    const dj = await checkDJ(interaction);
    if (!dj) return interaction.editReply({ embeds: [errorEmbed('', 'You need the DJ role to use this command.')], flags: 64 });

    const vcCheck = await inSameVoiceChannel(interaction);
    if (!vcCheck.ok) return interaction.editReply({ embeds: [errorEmbed('', vcCheck.error)], flags: 64 });

    const player = client.players.get(interaction.guildId);
    if (!player || player.queue.length === 0) return interaction.editReply({ embeds: [errorEmbed('', 'Queue is already empty.')] });

    const count = player.queue.length;
    player.clear();
    return interaction.editReply({ embeds: [successEmbed('Cleared', `Queue cleared (**${count}** tracks removed).`)] });
  },
};
