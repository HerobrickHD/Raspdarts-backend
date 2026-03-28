// backend/test/server.test.js
const request = require('supertest');

jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
}));
const { spawn, exec } = require('child_process');
const { EventEmitter, Readable } = require('stream');

// Hinweis: exec-Mock muss NACH jest.resetModules() in jedem beforeEach neu gesetzt werden.
// Der exec-Import oben ist nur für Typsicherheit — die aktive Mock-Instanz wird in den
// jeweiligen beforeEach-Blöcken per re-require neu geholt (siehe unten).

function mockSpawn(lines, exitCode = 0) {
  // Use require() at call time so we get the active mock instance after resetModules()
  const { spawn: currentSpawn } = require('child_process');
  currentSpawn.mockImplementation(() => {
    const proc = new EventEmitter();
    proc.stdout = new Readable({ read() {} });
    proc.stderr = new Readable({ read() {} });
    setTimeout(() => {
      lines.forEach(l => proc.stdout.push(l + '\n'));
      proc.stdout.push(null);
      proc.emit('close', exitCode);
    }, 10);
    proc.kill = jest.fn();
    return proc;
  });
}

describe('POST /system/update', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    // exec nach resetModules neu holen damit getAutodartVersion nicht hängt
    require('child_process').exec.mockImplementation((cmd, cb) => { if (cb) cb(new Error('not found'), '', ''); });
    mockSpawn(['Reading package lists...', 'Done.'], 0);
    app = require('../server');
  });

  it('streamt SSE-Events und sendet done bei Erfolg', (done) => {

    const chunks = [];
    request(app)
      .post('/system/update')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', d => chunks.push(d.toString()));
        res.on('end', () => cb(null, chunks.join('')));
      })
      .end((err, res) => {
        const body = chunks.join('');
        expect(res.headers['content-type']).toMatch('text/event-stream');
        expect(body).toContain('"type":"log"');
        expect(body).toContain('"type":"done"');
        expect(body).toContain('"success":true');
        done();
      });
  });

  it('gibt 409 zurück wenn apt bereits läuft', async () => {
    const appModule = require('../server');
    appModule.locals.setAptRunning(true);
    const res = await request(appModule).post('/system/update');
    expect(res.status).toBe(409);
    appModule.locals.setAptRunning(false);
  });
});

describe('POST /autodarts/update', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    require('child_process').exec.mockImplementation((cmd, cb) => { if (cb) cb(new Error('not found'), '', ''); });
    mockSpawn(['autodarts updated'], 0);
    app = require('../server');
  });

  it('streamt SSE und sendet done', (done) => {
    const chunks = [];
    request(app)
      .post('/autodarts/update')
      .buffer(false)
      .parse((res, cb) => {
        res.on('data', d => chunks.push(d.toString()));
        res.on('end', () => cb(null, chunks.join('')));
      })
      .end((err, res) => {
        const body = chunks.join('');
        expect(body).toContain('"type":"done"');
        expect(body).toContain('"success":true');
        done();
      });
  });

  it('gibt 409 zurück wenn apt bereits läuft', async () => {
    const appModule = require('../server');
    appModule.locals.setAptRunning(true);
    const res = await request(appModule).post('/autodarts/update');
    expect(res.status).toBe(409);
    appModule.locals.setAptRunning(false);
  });
});

describe('POST /reboot', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    require('child_process').exec.mockImplementation((cmd, cb) => { if (cb) cb(null, '', ''); });
    app = require('../server');
  });

  it('antwortet mit 200 ok bevor Befehl ausgeführt wird', async () => {
    const res = await request(app).post('/reboot');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('POST /shutdown', () => {
  let app;
  beforeEach(() => {
    jest.resetModules();
    require('child_process').exec.mockImplementation((cmd, cb) => { if (cb) cb(null, '', ''); });
    app = require('../server');
  });

  it('antwortet mit 200 ok', async () => {
    const res = await request(app).post('/shutdown');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
