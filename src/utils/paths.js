const fs = require('fs');
const path = require('path');
const os = require('os');

const isWin = os.platform() === 'win32';

const baseDir = path.join(__dirname, '..', '..');

const COMMON_PATHS = isWin ? [
  'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  'C:\\ffmpeg\\bin\\ffmpeg.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Packages\\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-essentials_build\\bin\\ffmpeg.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Packages\\ffmpeg.exe'),
  path.join(baseDir, 'bin', 'ffmpeg.exe'),
] : [
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  path.join(baseDir, 'bin', 'ffmpeg'),
  path.join(os.homedir(), 'ffmpeg'),
  path.join(os.homedir(), 'bin', 'ffmpeg'),
];

const COMMON_YTPATHS = isWin ? [
  'C:\\Program Files\\yt-dlp\\yt-dlp.exe',
  'C:\\yt-dlp\\yt-dlp.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Packages\\yt-dlp.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Microsoft\\WinGet\\Packages\\yt-dlp\\yt-dlp.exe'),
  path.join(baseDir, 'bin', 'yt-dlp.exe'),
] : [
  '/usr/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  path.join(baseDir, 'bin', 'yt-dlp'),
  path.join(os.homedir(), 'yt-dlp'),
  path.join(os.homedir(), 'bin', 'yt-dlp'),
];

function findExecutable(name, commonPaths) {
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const cmd = isWin ? `where ${name}` : `which ${name}`;
    const result = require('child_process').execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0];
    if (result && fs.existsSync(result.trim())) return result.trim();
  } catch {}
  return name;
}

let _ffmpegPath = null;
let _ytdlpPath = null;

function getFFmpegPath() {
  if (!_ffmpegPath) _ffmpegPath = findExecutable('ffmpeg', COMMON_PATHS);
  return _ffmpegPath;
}

function getYTDLPPath() {
  if (!_ytdlpPath) _ytdlpPath = findExecutable('yt-dlp', COMMON_YTPATHS);
  return _ytdlpPath;
}

module.exports = { getFFmpegPath, getYTDLPPath };
