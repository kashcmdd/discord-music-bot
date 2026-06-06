const express = require('express');
const passport = require('passport');
const { Strategy } = require('passport-discord');
const router = express.Router();

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new Strategy({
  clientID: process.env.DASHBOARD_CLIENT_ID || process.env.CLIENT_ID,
  clientSecret: process.env.DASHBOARD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  scope: ['identify', 'guilds'],
}, (accessToken, refreshToken, profile, done) => {
  profile.accessToken = accessToken;
  profile.refreshToken = refreshToken;
  return done(null, profile);
}));

router.get('/discord', passport.authenticate('discord'));

router.get('/callback', passport.authenticate('discord', {
  failureRedirect: '/',
  successRedirect: '/dashboard',
}));

router.get('/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      discriminator: req.user.discriminator,
      avatar: `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`,
    },
  });
});

module.exports = router;
