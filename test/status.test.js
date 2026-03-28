// backend/test/status.test.js
const request = require('supertest');

jest.mock('fs/promises', () => ({ readFile: jest.fn() }));
jest.mock('child_process', () => ({ exec: jest.fn() }));

const mockProcStat1 = 'cpu  100 0 100 800 0 0 0 0 0 0';
const mockProcStat2 = 'cpu  150 0 150 900 0 0 0 0 0 0';
const mockProcMeminfo = 'MemTotal:        4096000 kB\nMemAvailable:    2048000 kB\n';
const mockTemp = '52000';
const mockUptime = '12060.50 23456.78';
const mockOsRelease = 'NAME="Raspbian GNU/Linux"\nPRETTY_NAME="Raspbian GNU/Linux 11 (bullseye)"\nID=raspbian\n';

function setupFsMock(overrides = {}) {
  const freshFs = require('fs/promises');
  // Suppress unhandledRejection warnings for pre-rejected promise overrides
  Object.values(overrides).forEach(v => { if (v && typeof v.catch === 'function') v.catch(() => {}); });
  let callCount = 0;
  freshFs.readFile.mockImplementation((path) => {
    if (path in overrides) return overrides[path];
    if (path === '/proc/stat') return Promise.resolve(callCount++ === 0 ? mockProcStat1 : mockProcStat2);
    if (path === '/proc/meminfo') return Promise.resolve(mockProcMeminfo);
    if (path.includes('thermal')) return Promise.resolve(mockTemp);
    if (path === '/proc/uptime') return Promise.resolve(mockUptime);
    if (path === '/etc/os-release') return Promise.resolve(mockOsRelease);
    return Promise.reject(new Error('unexpected path: ' + path));
  });
}

describe('GET /status', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    setupFsMock();
    require('child_process').exec.mockImplementation((cmd, cb) => cb(new Error('not found'), '', ''));
    app = require('../server');
  });

  it('gibt korrekte System-Daten zurück', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      cpu_percent: expect.any(Number),
      ram_used_mb: expect.any(Number),
      ram_total_mb: expect.any(Number),
      temp_celsius: expect.any(Number),
      uptime_seconds: expect.any(Number),
      autodarts_version: expect.any(String),
      os_version: expect.any(String),
    });
    expect(res.body.temp_celsius).toBe(52.0);
    expect(res.body.ram_total_mb).toBe(4000);
    expect(res.body.uptime_seconds).toBe(12060.5);
    expect(res.body.autodarts_version).toBe('unbekannt');
    expect(res.body.os_version).toBe('Raspbian GNU/Linux 11 (bullseye)');
  });

  it('erkennt autodarts-version wenn PATH-Binary antwortet', async () => {
    jest.resetModules();
    setupFsMock();
    require('child_process').exec.mockImplementation((cmd, cb) => {
      if (cmd === 'autodarts --version') cb(null, 'autodarts 1.2.3\n', '');
      else cb(new Error('not found'), '', '');
    });
    app = require('../server');
    const res = await request(app).get('/status');
    expect(res.body.autodarts_version).toBe('1.2.3');
  });

  it('erkennt autodarts-version vom /home/pi/.autodarts Pfad', async () => {
    jest.resetModules();
    setupFsMock();
    require('child_process').exec.mockImplementation((cmd, cb) => {
      if (cmd === '/home/pi/.autodarts/autodarts --version') cb(null, 'autodarts 1.5.0\n', '');
      else cb(new Error('not found'), '', '');
    });
    app = require('../server');
    const res = await request(app).get('/status');
    expect(res.body.autodarts_version).toBe('1.5.0');
  });

  it('erkennt autodarts-version vom /root/.autodarts Pfad', async () => {
    jest.resetModules();
    setupFsMock();
    require('child_process').exec.mockImplementation((cmd, cb) => {
      if (cmd === '/root/.autodarts/autodarts --version') cb(null, 'autodarts 2.0.1\n', '');
      else cb(new Error('not found'), '', '');
    });
    app = require('../server');
    const res = await request(app).get('/status');
    expect(res.body.autodarts_version).toBe('2.0.1');
  });

  it('gibt unbekannt zurück wenn alle autodarts-Pfade fehlschlagen', async () => {
    const res = await request(app).get('/status');
    expect(res.body.autodarts_version).toBe('unbekannt');
  });

  it('gibt unbekannt zurück wenn /etc/os-release nicht lesbar ist', async () => {
    jest.resetModules();
    setupFsMock({ '/etc/os-release': Promise.reject(new Error('ENOENT')) });
    require('child_process').exec.mockImplementation((cmd, cb) => cb(new Error('not found'), '', ''));
    app = require('../server');
    const res = await request(app).get('/status');
    expect(res.body.os_version).toBe('unbekannt');
  });
});
