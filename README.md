# vpanel-pro

Full-featured QEMU/KVM virtual server management panel built with Node.js, Express, better-sqlite3 and Socket.IO.

## Features

- **QEMU VM management** — create, start, stop, restart, resize, backup, schedule
- **Graphical console (VNC/noVNC)** — auto-connecting web console, works even when guest SSH auth fails
- **SSH Terminal** — interactive shell over WebSocket (socket.io + xterm.js)
- **File Manager** — driven by an in-guest **vPanel Agent** (lightweight Python HTTP API), with automatic SSH fallback
  - list / read / write / upload / download / mkdir / delete / rename / chmod
- **Multi-user** — user accounts, sub-users per server, admin panel
- **Cloud-init provisioning** — auto-installs SSH config + vPanel agent on first boot
- **Backups & schedules** — create, restore, download, cron-based

## Requirements

- Linux host (Debian/Ubuntu, Fedora/RHEL, Arch)
- root access
- Node.js 18+ (installer installs Node 20 LTS if missing)
- QEMU system emulator (`qemu-system-x86_64`), `qemu-img`, `cloud-localds` (cloud-image-utils), `wget`, `openssl`, `python3`

## Quick install

```bash
git clone https://github.com/nobita329/vpanel-pro.git && cd vpanel-pro
sudo bash install.sh --admin-pass 'your-secure-password'
```

Installer:

1. installs system dependencies (QEMU, cloud-image-utils, Node, etc.)
2. runs `npm install`
3. runs `npm run build` (downloads noVNC for the graphical console)
4. generates `.env` with a random `JWT_SECRET`
5. creates the admin user
6. starts the panel with pm2 (add `--no-pm2` to run with plain `node`)

## Manual setup

```bash
npm install
npm run build
cp .env.example .env            # then edit values
npm run createuser              # create the admin account
npm start                       # or: pm2 start ecosystem.config.js
```

Open `http://<host>:3001` and log in. The API runs on port `3002`.

## Configuration (.env)

| Variable | Default | Description |
| --- | --- | --- |
| `PANEL_PORT` | `3001` | Web panel port |
| `API_PORT` | `3002` | REST API port |
| `JWT_SECRET` | — | **Change this** |
| `AUTO_PORT_MIN/MAX` | `25501/25600` | Auto SSH port range for new VMs |
| `AUTO_VNC_PORT_MIN/MAX` | `25901/26000` | Auto VNC port range (noVNC console) |
| `AUTO_AGENT_PORT_MIN/MAX` | `26101/26200` | Auto vPanel agent port range (File Manager) |
| `VM_DIR` | `./vms` | VM disk storage |
| `DB_PATH` | `./data/vpanel.db` | SQLite database |
| `ALLOW_REGISTER` | `1` | Enable self-registration |

## How the access stack works

| Feature | Mechanism |
| --- | --- |
| Console | noVNC client → WebSocket proxy (`/vncws/:vmId`) → QEMU `-vnc 127.0.0.1:<port>` |
| Terminal | xterm.js → socket.io `console:*` events → `ssh2` shell stream |
| File Manager | Web UI → REST API → **vPanel agent** in guest (Python HTTP, bearer token, port 9090 mapped via QEMU hostfwd `agent_port`→9090); falls back to SSH if the agent is unreachable |

## Security notes

- `vm.agent_token` is generated per VM (32 hex chars) and never exposed through the API
- The agent only accepts requests with the correct bearer token (`/etc/vpanel-agent.token` in the guest)
- VNC is bound to `127.0.0.1` on the host; the panel proxy enforces session auth
