// routes/autodarts.js
const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();

router.post('/update', (req, res) => {
  const { isAptRunning, setAptRunning } = req.app.locals;
  if (isAptRunning()) return res.status(409).json({ error: 'Already running' });
  setAptRunning(true);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // get.autodarts.io installer — runs as root via sudo bash
  const proc = spawn('sudo', ['bash', '-c', 'curl -sL get.autodarts.io | bash'], {
    env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive', HOME: '/home/pi' },
  });

  proc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', line })));
  proc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', line })));
  proc.on('error', (err) => {
    send({ type: 'log', line: `Error: ${err.message}` });
    send({ type: 'done', success: false, error: err.message });
    setAptRunning(false);
    res.end();
  });
  proc.on('close', (code) => {
    if (code === 0) {
      // Copy binary to /usr/local/bin so pi user can read the version
      const { exec } = require('child_process');
      exec("sudo bash -c 'bin=$(find /root/.local /home/pi/.local -name autodarts -maxdepth 6 -type f 2>/dev/null | head -1); [ -n \"$bin\" ] && rm -f /usr/local/bin/autodarts && cp \"$bin\" /usr/local/bin/autodarts && chmod 755 /usr/local/bin/autodarts'", () => {
        send({ type: 'done', success: true });
        setAptRunning(false);
        res.end();
      });
    } else {
      send({ type: 'done', success: false, error: `Exit code ${code}` });
      setAptRunning(false);
      res.end();
    }
  });

  res.on('close', () => {
    setAptRunning(false);
    proc.kill();
  });
});

router.post('/uninstall', (req, res) => {
  const { isAptRunning, setAptRunning } = req.app.locals;
  if (isAptRunning()) return res.status(409).json({ error: 'Already running' });
  setAptRunning(true);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  send({ type: 'log', line: '=== Uninstalling Autodarts ===' });

  const proc = spawn('sudo', ['bash', '-c',
    'rm -f /usr/local/bin/autodarts && ' +
    'find /root/.local /home/pi/.local -name autodarts -maxdepth 6 -type f 2>/dev/null | xargs rm -f && ' +
    'echo "Autodarts removed."'
  ]);

  proc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', line })));
  proc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', line })));
  proc.on('error', (err) => {
    send({ type: 'log', line: `Error: ${err.message}` });
    send({ type: 'done', success: false, error: err.message });
    setAptRunning(false);
    res.end();
  });
  proc.on('close', (code) => {
    send({ type: 'done', success: code === 0, error: code !== 0 ? `Exit code ${code}` : undefined });
    setAptRunning(false);
    res.end();
  });

  res.on('close', () => {
    setAptRunning(false);
    proc.kill();
  });
});

module.exports = router;
