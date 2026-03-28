// backend/routes/power.js
const express = require('express');
const { exec } = require('child_process');

const rebootRouter = express.Router();
rebootRouter.post('/', (req, res) => {
  res.json({ ok: true });
  setTimeout(() => exec('sudo /sbin/reboot'), 500);
});

const shutdownRouter = express.Router();
shutdownRouter.post('/', (req, res) => {
  res.json({ ok: true });
  setTimeout(() => exec('sudo /sbin/shutdown -h now'), 500);
});

module.exports = { rebootRouter, shutdownRouter };
