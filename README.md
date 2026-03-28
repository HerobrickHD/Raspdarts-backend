# Raspdarts Backend

A lightweight Node.js backend for managing a Raspberry Pi running [Autodarts](https://autodarts.io). Provides system monitoring, remote updates, and power control via a simple REST API.

## Features

- **System monitoring** — CPU usage, RAM, temperature, uptime, IP address
- **Autodarts updates** — trigger over-the-air updates with real-time log streaming
- **Self-updating** — backend can update itself via `git pull`
- **Power control** — reboot or shutdown the Pi remotely
- **Runs as a systemd service** — starts automatically on boot

## Installation

Run this on your Raspberry Pi:

```bash
curl -sL https://raw.githubusercontent.com/HerobrickHD/Raspdarts-backend/main/install.sh | bash
```

The installer will:
- Install Node.js 20 (if not present)
- Clone this repository to `~/raspdarts`
- Configure a systemd service that starts on boot
- Set up passwordless sudo for required system commands

## Update

Re-run the install command — it detects an existing installation and updates automatically:

```bash
curl -sL https://raw.githubusercontent.com/HerobrickHD/Raspdarts-backend/main/install.sh | bash
```

## Uninstall

```bash
curl -sL https://raw.githubusercontent.com/HerobrickHD/Raspdarts-backend/main/install.sh | bash -s -- --uninstall
```

## API

The backend runs on port **8743**.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | System metrics (CPU, RAM, temp, uptime, versions) |
| POST | `/autodarts/update` | Update Autodarts software (SSE stream) |
| POST | `/system/update` | Update this backend (SSE stream) |
| POST | `/reboot` | Reboot the Raspberry Pi |
| POST | `/shutdown` | Shutdown the Raspberry Pi |

### Example

```bash
curl http://raspdarts.local:8743/status
```

```json
{
  "cpu": 12.4,
  "ramTotal": 3814,
  "ramUsed": 512,
  "temp": 48.3,
  "uptime": 3600,
  "ip": "192.168.1.42",
  "autodarts": "0.20.1",
  "version": "1.0.0"
}
```

Update endpoints stream progress via [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events):

```
data: {"type":"log","line":"Updating Autodarts..."}
data: {"type":"done","success":true}
```

## Requirements

- Raspberry Pi running Raspberry Pi OS (Debian-based)
- Node.js 20+ (installed automatically by the installer)

## License

MIT
"# Raspdarts-backend" 
