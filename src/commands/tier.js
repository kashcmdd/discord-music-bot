const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, warningEmbed, infoEmbed } = require('../utils/embeds');
const { TIER_LIMITS, TIER_NAMES } = require('../utils/tiers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tier')
    .setDescription('View or manage guild tiers')
    .addSubcommand(sub => sub.setName('info').setDescription('Show guild tier and feature limits'))
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set guild tier (admin only)')
        .addStringOption(opt =>
          opt.setName('tier').setDescription('Tier to set').setRequired(true)
            .addChoices({ name: 'free', value: 'free' }, { name: 'pro', value: 'pro' }, { name: 'vip', value: 'vip' })
        )
    )
    .addSubcommand(sub =>
      sub.setName('user')
        .setDescription('Set user tier override (admin only)')
        .addUserOption(opt => opt.setName('user').setDescription('User to override').setRequired(true))
        .addStringOption(opt =>
          opt.setName('tier').setDescription('Tier').setRequired(true)
            .addChoices({ name: 'free', value: 'free' }, { name: 'pro', value: 'pro' }, { name: 'vip', value: 'vip' })
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const db = client.db;

    if (sub === 'info') {
      const tier = await require('../utils/tiers').getTierForContext(client, interaction.guildId, interaction.user.id);
      const limits = TIER_LIMITS[tier];

      const embed = infoEmbed(`Tier: ${tier.toUpperCase()}`, null)
        .addFields(
          { name: 'Max Queue', value: limits.maxQueueSize === Infinity ? 'Unlimited' : String(limits.maxQueueSize), inline: true },
          { name: 'Max Playlists', value: limits.maxPlaylists === Infinity ? 'Unlimited' : String(limits.maxPlaylists), inline: true },
          { name: 'Max Playlist Tracks', value: limits.maxPlaylistTracks === Infinity ? 'Unlimited' : String(limits.maxPlaylistTracks), inline: true },
          { name: 'Filters', value: limits.allowedFilters.filter(f => f !== 'clear').join(', ') || 'None', inline: true },
          { name: 'Max Volume', value: `${limits.maxVolume}%`, inline: true },
          { name: 'Autoplay', value: limits.autoplay ? '✅' : '❌', inline: true },
          { name: 'Seek', value: limits.seek ? '✅' : '❌', inline: true },
          { name: 'Play Next', value: limits.playnext ? '✅' : '❌', inline: true },
          { name: 'Custom Filter', value: limits.customFilter ? '✅' : '❌', inline: true },
          { name: '24/7 Mode', value: limits.stay247 ? '✅' : '❌', inline: true },
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'set') {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.editReply({ embeds: [errorEmbed('', 'Only administrators can set tiers.')], flags: 64 });
      }

      const newTier = interaction.options.getString('tier');
      const oldTier = db.getGuildTier(interaction.guildId);
      db.setGuildTier(interaction.guildId, newTier, interaction.user.id);
      db.logTierChange(interaction.guildId, interaction.user.id, oldTier, newTier);

      client.tierCache.clear();

      const channelId = process.env.AUDIT_LOG_CHANNEL_ID;
      if (channelId) {
        const channel = client.channels.cache.get(channelId);
        if (channel) {
          channel.send({
            embeds: [new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('Tier Change')
              .addFields(
                { name: 'Guild', value: interaction.guild.name, inline: true },
                { name: 'Changed By', value: `<@${interaction.user.id}>`, inline: true },
                { name: 'Old Tier', value: oldTier, inline: true },
                { name: 'New Tier', value: newTier, inline: true },
              )
              .setTimestamp(),
            ],
          }).catch(() => {});
        }
      }

      return interaction.editReply({ embeds: [successEmbed('Tier Updated', `Guild tier changed from **${oldTier}** to **${newTier}**.`)] });
    }

    if (sub === 'user') {
      if (!interaction.member.permissions.has('Administrator')) {
        return interaction.editReply({ embeds: [errorEmbed('', 'Only administrators can set user overrides.')], flags: 64 });
      }

      const user = interaction.options.getUser('user');
      const tier = interaction.options.getString('tier');
      db.setUserOverride(interaction.guildId, user.id, tier, interaction.user.id);
      client.tierCache.clear();

      return interaction.editReply({ embeds: [successEmbed('User Override', `<@${user.id}> has been set to **${tier}**.`)] });
    }
  },
};
