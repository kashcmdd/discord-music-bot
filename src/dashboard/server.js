require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const rateLimit = require('express-rate-limit').default || require('express-rate-limit');

const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');

const PORT = process.env.DASHBOARD_PORT || 3000;
const SECRET = process.env.DASHBOARD_SECRET || 'change-me-to-a-random-string';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
}));

app.use(passport.initialize());
app.use(passport.session());

const limiter = rateLimit({
  windowMs: 1000,
  max: 10,
  message: { error: 'Rate limit exceeded.' },
});
app.use(limiter);

app.use('/auth', authRouter);
app.use('/api', apiRouter);

app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

io.use((socket, next) => {
  const session = socket.request.session;
  if (session && session.passport && session.passport.user) {
    return next();
  }
  next(new Error('Not authenticated'));
});

io.on('connection', (socket) => {
  const guildId = socket.handshake.query.guildId;
  if (guildId) {
    socket.join(`guild:${guildId}`);
  }

  socket.on('joinGuild', (gid) => {
    socket.join(`guild:${gid}`);
  });
});

function startDashboard(client) {
  client.on('ready', () => {
    for (const [guildId, player] of client.players) {
      player.on('playerUpdate', (data) => {
        io.to(`guild:${guildId}`).emit('playerUpdate', { guildId, ...data });
      });
      player.on('queueUpdate', (data) => {
        io.to(`guild:${guildId}`).emit('queueUpdate', { guildId, ...data });
      });
      player.on('botLeft', (gid) => {
        io.to(`guild:${gid}`).emit('botLeft', { guildId: gid });
      });
    }

    const origSet = client.players.set;
    client.players.set = function(key, value) {
      origSet.call(this, key, value);
      value.on('playerUpdate', (data) => io.to(`guild:${key}`).emit('playerUpdate', { guildId: key, ...data }));
      value.on('queueUpdate', (data) => io.to(`guild:${key}`).emit('queueUpdate', { guildId: key, ...data }));
      value.on('botLeft', (gid) => io.to(`guild:${gid}`).emit('botLeft', { guildId: gid }));
    };
  });

  server.listen(PORT, () => {
    console.log(`Dashboard running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  const client = require('../index');
  startDashboard(client);
} else {
  module.exports = startDashboard;
}
