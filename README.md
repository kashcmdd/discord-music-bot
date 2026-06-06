# Discord Music Bot v2.0.0

A fully-featured Discord music bot with web dashboard and premium tier system. Supports YouTube, Spotify, and SoundCloud playback with a rich set of controls.

## Prerequisites

- **Node.js** 20.0.0 or higher
- **ffmpeg** in PATH ([download](https://ffmpeg.org/download.html))
- **yt-dlp** in PATH ([download](https://github.com/yt-dlp/yt-dlp/releases))
- A Discord Application ([Developer Portal](https://discord.com/developers/applications))

## Installation

```bash
# Clone the repository
cd discord-music-bot

# Install dependencies
npm install

# Create and fill in your .env file
cp .env.example .env
# Edit .env with your tokens (see below)

# Register slash commands
npm run deploy

# Start the bot
npm start
```

## .env Setup

Create a `.env` file in the project root:

```
BOT_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
GENIUS_TOKEN=your_genius_api_token
```

### Getting a Discord Bot Token

1. Go to https://discord.com/developers/applications
2. Create a New Application
3. Go to the Bot tab → Reset Token → Copy it
4. Enable these Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent
   - Voice States Intent
5. Go to OAuth2 → URL Generator → Select `bot` and `applications.commands`
6. Bot permissions: `Connect`, `Speak`, `Use Voice Activity`, `Read Messages`, `Send Messages`, `Embed Links`
7. Use the generated URL to invite the bot to your server

### Spotify Credentials (Optional)

1. Go to https://developer.spotify.com/dashboard
2. Create an App
3. Copy the Client ID and Client Secret into your `.env`

### Genius API Token (Optional — for lyrics)

1. Go to https://genius.com/api-clients
2. Create an API Client
3. Generate an Access Token

## Commands Reference

| Command | Options | DJ Only | Requires Pro+ | Description |
|---------|---------|---------|---------------|-------------|
| `/play` | `query` (string) | No | — | Play or queue a song/playlist |
| `/pause` | — | No | — | Pause current track |
| `/resume` | — | No | — | Resume current track |
| `/skip` | `count` (int, 1-20) | Yes | — | Skip current or N tracks |
| `/stop` | — | Yes | — | Stop playback and disconnect |
| `/queue` | `page` (int) | No | — | Show paginated queue |
| `/nowplaying` | — | No | — | Show current track info |
| `/seek` | `seconds` (int) | Yes | Pro+ | Seek to a position in the track |
| `/volume` | `level` (0-100/150/200) | Yes | — (clamped by tier) | Set volume |
| `/loop` | — | No | — | Cycle loop: off → track → queue |
| `/shuffle` | — | Yes | — | Shuffle the queue |
| `/remove` | `position` (int) | Yes | — | Remove a track by position |
| `/move` | `from` (int), `to` (int) | Yes | — | Move a track in the queue |
| `/clear` | — | Yes | — | Clear the entire queue |
| `/lyrics` | `song` (string, opt) | No | — | Show song lyrics |
| `/filters` | `preset` (enum) | Yes | Free limited | Apply audio filter |
| `/autoplay` | — | No | Pro+ | Auto-add related tracks |
| `/playlist save` | `name` (string) | No | Free limited | Save current queue |
| `/playlist load` | `name` (string) | No | — | Load a saved playlist |
| `/playlist list` | — | No | — | List your playlists |
| `/playlist delete` | `name` (string) | No | — | Delete a playlist |
| `/playnext` | `query` (string) | No | Pro+ | Add a track to play next |
| `/tier info` | — | No | — | Show guild tier and limits |
| `/tier set` | `tier` (enum) | Admin | — | Set guild tier |
| `/tier user` | `user`, `tier` (enum) | Admin | — | Set user tier override |
| `/247` | `state` (bool) | No | VIP | Stay in voice 24/7 |

## DJ Role

Create a role named **DJ** (case-insensitive) in your server and assign it to trusted users. Users with this role (or Administrator permission) can use restricted commands: `/skip`, `/stop`, `/clear`, `/filters`, `/volume`.

## Premium Tiers

| Feature | Free | Pro | VIP |
|---------|------|-----|-----|
| Max queue size | 50 | 200 | Unlimited |
| Max playlists | 3 (50 each) | 15 (200 each) | Unlimited |
| Filters | Bass only | All presets | All + custom |
| Max volume | 100% | 150% | 200% |
| Autoplay | — | ✓ | ✓ |
| Seek | — | ✓ | ✓ |
| Play Next | — | ✓ | ✓ |
| Custom filter | — | — | ✓ |
| 24/7 mode | — | — | ✓ |

Admins can set tiers with: `/tier set pro` or `/tier set vip`

## Web Dashboard (Optional)

1. Create a separate Discord OAuth2 application for the dashboard
2. Add redirect URI: `http://localhost:3000/auth/callback`
3. Fill in `DASHBOARD_*` variables in `.env`
4. Run: `npm run dashboard`
5. Visit: `http://localhost:3000`

## Docker Deployment

```bash
docker build -t discord-music-bot .
docker run -d --name music-bot --env-file .env discord-music-bot
```

## Troubleshooting

- **"yt-dlp not found"** — Install yt-dlp and ensure it's in your PATH
- **"ffmpeg not found"** — Install ffmpeg and ensure it's in your PATH
- **No audio** — Ensure the bot has `Connect` and `Speak` permissions in the voice channel
- **Commands not appearing** — Re-run `npm run deploy` and wait up to 1 hour for global sync
