const { PermissionsBitField } = require('discord.js');

function getDJRole(guild) {
  return guild.roles.cache.find(r => r.name.toLowerCase() === 'dj');
}

async function checkDJ(interaction) {
  const member = interaction.member;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  const djRole = getDJRole(interaction.guild);
  if (!djRole) return true;
  return member.roles.cache.has(djRole.id);
}

async function inSameVoiceChannel(interaction) {
  const memberVoice = interaction.member.voice.channel;
  const botVoice = interaction.guild.members.me.voice.channel;

  if (!memberVoice) {
    return { ok: false, error: 'You must be in a voice channel to use this command.' };
  }
  if (botVoice && botVoice.id !== memberVoice.id) {
    return { ok: false, error: 'You must be in the same voice channel as the bot.' };
  }
  return { ok: true };
}

async function botHasPermissions(interaction) {
  const channel = interaction.member.voice.channel;
  if (!channel) return { ok: false, error: 'You must be in a voice channel.' };

  const perms = channel.permissionsFor(interaction.guild.members.me);
  const missing = [];
  if (!perms.has(PermissionsBitField.Flags.Connect)) missing.push('Connect');
  if (!perms.has(PermissionsBitField.Flags.Speak)) missing.push('Speak');
  if (!perms.has(PermissionsBitField.Flags.UseVAD)) missing.push('Use Voice Activity');

  if (missing.length > 0) {
    return { ok: false, error: `I need the following permissions in that channel: ${missing.join(', ')}` };
  }
  return { ok: true };
}

module.exports = { checkDJ, inSameVoiceChannel, botHasPermissions };
