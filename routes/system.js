// routes/system.js — RasPi Manager self-update
const express = require('express');
const { spawn } = require('child_process');
const router = express.Router();

const INSTALL_DIR = '/home/pi/raspdarts';

function spawnLogged(res, cmd, args, opts) {
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, opts || {});
    proc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', line })));
    proc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(line => send({ type: 'log', line })));
    proc.on('error', (err) => { send({ type: 'log', line: `Fehler: ${err.message}` }); resolve(1); });
    proc.on('close', resolve);
  });
}

router.post('/update', (req, res) => {
  const { isAptRunning, setAptRunning } = req.app.locals;
  if (isAptRunning()) return res.status(409).json({ error: 'Already running' });
  setAptRunning(true);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  (async () => {
    send({ type: 'log', line: '=== RasPi Manager Update ===' });

    // Step 1: git pull
    send({ type: 'log', line: '--- git pull ---' });
    const code1 = await spawnLogged(res, 'git', ['-C', INSTALL_DIR, 'pull', '--ff-only', 'origin', 'main']);
    if (code1 !== 0) {
      send({ type: 'done', success: false, error: `git pull failed (exit ${code1})` });
      setAptRunning(false);
      return res.end();
    }

    // Step 2: npm install
    send({ type: 'log', line: '--- npm install ---' });
    const code2 = await spawnLogged(res, 'sudo', ['bash', '-c', `cd ${INSTALL_DIR} && npm install --omit=dev`]);
    if (code2 !== 0) {
      send({ type: 'done', success: false, error: `npm install failed (exit ${code2})` });
      setAptRunning(false);
      return res.end();
    }

    // Step 3: send done, then restart service
    send({ type: 'log', line: '--- Restarting backend... ---' });
    send({ type: 'done', success: true });
    setAptRunning(false);
    res.end();

    setTimeout(() => {
      spawn('sudo', ['bash', '-c', 'systemctl restart raspdarts'], { detached: true, stdio: 'ignore' }).unref();
    }, 500);
  })();
});

module.exports = { router };
