const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { errorEmbed, successEmbed, infoEmbed } = require('../utils/embeds');

const LAYOUTS = [
  { name: 'Full', value: 'full' },
  { name: 'Compact', value: 'compact' },
  { name: 'Minimal', value: 'minimal' },
  { name: 'Seek', value: 'seek' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('npconfig')
    .setDescription('Customize the now-playing embed')
    .addSubcommand(sub =>
      sub.setName('color')
        .setDescription('Set embed accent color')
        .addStringOption(opt =>
          opt.setName('color').setDescription('Hex color (e.g. #5865F2)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('footer')
        .setDescription('Set embed footer text')
        .addStringOption(opt =>
          opt.setName('text').setDescription('Footer text').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('layout')
        .setDescription('Choose button layout')
        .addStringOption(opt =>
          opt.setName('preset').setDescription('Button layout preset').setRequired(true)
            .addChoices(...LAYOUTS)
        )
    )
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset all NP embed settings to defaults')
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show current NP embed settings')
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const db = client.db;

    if (sub === 'color') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('', 'You need the **Manage Server** permission to change the embed color.')], flags: 64 });
      }
      const color = interaction.options.getString('color');
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return interaction.reply({ embeds: [errorEmbed('', 'Invalid hex color. Use format `#RRGGBB`.')], flags: 64 });
      }
      db.setNpColor(guildId, color);
      const player = client.players.get(guildId);
      if (player) player._updateNowPlaying();
      return interaction.reply({ embeds: [successEmbed('NP Color', `Embed color set to ${color}`)], flags: 64 });
    }

    if (sub === 'footer') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('', 'You need the **Manage Server** permission to change the footer text.')], flags: 64 });
      }
      const text = interaction.options.getString('text');
      if (text.length > 50) {
        return interaction.reply({ embeds: [errorEmbed('', 'Footer text must be 50 characters or less.')], flags: 64 });
      }
      db.setNpFooter(guildId, text);
      const player = client.players.get(guildId);
      if (player) player._updateNowPlaying();
      return interaction.reply({ embeds: [successEmbed('NP Footer', `Footer set to "${text}"`)], flags: 64 });
    }

    if (sub === 'layout') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('', 'You need the **Manage Server** permission to change the button layout.')], flags: 64 });
      }
      const layout = interaction.options.getString('preset');
      db.setNpLayout(guildId, layout);
      const player = client.players.get(guildId);
      if (player) player._updateNowPlaying();
      return interaction.reply({ embeds: [successEmbed('NP Layout', `Button layout set to **${layout}**.`)], flags: 64 });
    }

    if (sub === 'reset') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [errorEmbed('', 'You need the **Manage Server** permission to reset NP settings.')], flags: 64 });
      }
      db.resetNpConfig(guildId);
      const player = client.players.get(guildId);
      if (player) player._updateNowPlaying();
      return interaction.reply({ embeds: [successEmbed('NP Reset', 'NP embed settings restored to defaults.')], flags: 64 });
    }

    if (sub === 'show') {
      const config = db.getNpConfig(guildId);
      const embed = infoEmbed('NP Embed Configuration', null)
        .addFields(
          { name: 'Color', value: config.np_color, inline: true },
          { name: 'Footer', value: config.np_footer, inline: true },
          { name: 'Layout', value: config.np_layout, inline: true },
        );
      return interaction.reply({ embeds: [embed], flags: 64 });
    }
  },
};
