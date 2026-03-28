// routes/status.js
const express = require('express');
const fs = require('fs/promises');
const { exec } = require('child_process');
const os = require('os');
const router = express.Router();

function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

async function readCpuPercent() {
  const parse = (raw) => {
    const parts = raw.split('\n')[0].split(/\s+/).slice(1).map(Number);
    const total = parts.reduce((a, b) => a + b, 0);
    const idle = parts[3];
    return { total, idle };
  };
  const raw1 = await fs.readFile('/proc/stat', 'utf8');
  const s1 = parse(raw1);
  await new Promise(r => setTimeout(r, 500));
  const raw2 = await fs.readFile('/proc/stat', 'utf8');
  const s2 = parse(raw2);
  const totalDelta = s2.total - s1.total;
  const idleDelta = s2.idle - s1.idle;
  return totalDelta === 0 ? 0 : Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
}

async function readRam() {
  const raw = await fs.readFile('/proc/meminfo', 'utf8');
  const get = (key) => {
    const match = raw.match(new RegExp(`${key}:\\s+(\\d+)`));
    return match ? Math.round(parseInt(match[1]) / 1024) : 0;
  };
  const total = get('MemTotal');
  const available = get('MemAvailable');
  return { ram_total_mb: total, ram_used_mb: total - available };
}

async function readTemp() {
  const raw = await fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
  return parseInt(raw.trim()) / 1000;
}

async function readUptime() {
  const raw = await fs.readFile('/proc/uptime', 'utf8');
  return parseFloat(raw.split(' ')[0]);
}

function getAutodartVersion() {
  const candidates = [
    '/usr/local/bin/autodarts --version',
    'autodarts --version',
    '/home/pi/.local/bin/autodarts --version',
    '/home/pi/.local/opt/autodarts/autodarts --version',
    '/home/pi/.autodarts/autodarts --version',
  ];
  return new Promise((resolve) => {
    const tryNext = (i) => {
      if (i >= candidates.length) return resolve('unknown');
      exec(candidates[i], (err, stdout) => {
        if (!err && stdout) {
          const m = stdout.match(/(\d+\.\d+[\d.]*)/);
          if (m) return resolve(m[1]);
        }
        tryNext(i + 1);
      });
    };
    tryNext(0);
  });
}

router.get('/', async (req, res) => {
  try {
    const [cpu_percent, ram, temp_celsius, uptime_seconds, autodarts_version] = await Promise.all([
      readCpuPercent(),
      readRam(),
      readTemp(),
      readUptime(),
      getAutodartVersion(),
    ]);
    const { version } = require('../package.json');
    res.json({ cpu_percent, ...ram, temp_celsius, uptime_seconds, autodarts_version, ip_address: getLocalIP(), raspdarts_version: version });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
