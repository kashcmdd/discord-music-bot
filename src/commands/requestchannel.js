const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('requestchannel')
    .setDescription('Set or remove the song request channel')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Designate this channel as the song request channel')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Text channel for song requests').setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove the song request channel')
    ),

  async execute(interaction, client) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ embeds: [errorEmbed('', 'Only administrators can change this.')], flags: 64 });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const channel = interaction.options.getChannel('channel');
      client.db.setRequestChannel(interaction.guildId, channel.id);
      return interaction.reply({ embeds: [successEmbed('Request Channel', `Song requests will be accepted in ${channel}.`)], flags: 64 });
    }

    if (sub === 'remove') {
      client.db.removeRequestChannel(interaction.guildId);
      return interaction.reply({ embeds: [successEmbed('Request Channel', 'Song request channel removed.')], flags: 64 });
    }
  },
};
