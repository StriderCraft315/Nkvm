
# 🚀 VPanel Pro

Full-featured **QEMU/KVM virtual server management panel** built with Node.js, Express, better-sqlite3, and Socket.IO.

## ✨ Features

- 🖥️ **QEMU/KVM VM Management**
  - Create, start, stop, restart
  - Resize
  - Backup & restore
  - Scheduled tasks

- 🖥️ **Graphical Console**
  - VNC / noVNC
  - Auto-connecting web console
  - Works even when guest SSH authentication fails

- 💻 **SSH Terminal**
  - Interactive shell
  - WebSocket communication
  - Socket.IO + xterm.js

- 📁 **File Manager**
  - Powered by the in-guest **vPanel Agent**
  - Automatic SSH fallback
  - List / read / write
  - Upload / download
  - Create folders
  - Delete / rename
  - chmod permissions

- 👥 **Multi-user System**
  - User accounts
  - Sub-users per server
  - Admin panel

- ☁️ **Cloud-init Provisioning**
  - Automatic SSH configuration
  - Automatic vPanel Agent installation
  - First-boot provisioning

- 💾 **Backups & Schedules**
  - Create backups
  - Restore backups
  - Download backups
  - Cron-based scheduling

---

## 📋 Requirements

Supported operating systems:

- Debian / Ubuntu
- Fedora / RHEL
- Arch Linux

Required:

- Linux host
- Root access
- Node.js 18+
- QEMU system emulator
- `qemu-img`
- `cloud-localds`
- `wget`
- `openssl`
- `python3`

> The installer installs Node.js 20 LTS automatically if Node.js is missing.

---

## ⚡ Quick Install

```bash
git clone https://github.com/nobita329/vpanel-pro.git
cd vpanel-pro
sudo bash install.sh --admin-pass 'admin'
````

### Installer Process

The installer will:

1. Install required system dependencies
2. Install QEMU and cloud-image-utils
3. Install Node.js if required
4. Run `npm install`
5. Run `npm run build`
6. Download noVNC for the graphical console
7. Generate `.env`
8. Generate a random `JWT_SECRET`
9. Create the admin account
10. Start VPanel Pro with PM2

Use `--no-pm2` if you want to run VPanel Pro directly with Node.js.

---

## 🛠️ Manual Setup

```bash
npm install
npm run build
cp .env.example .env
npm run createuser
npm start
```

Or with PM2:

```bash
pm2 start ecosystem.config.js
```

### 🌐 Access

Panel:

```text
http://<host>:3001
```

API:

```text
http://<host>:3002
```

---

## ⚙️ Configuration

Edit the `.env` file:

| Variable                  |            Default | Description               |
| ------------------------- | -----------------: | ------------------------- |
| `PANEL_PORT`              |             `3001` | Web panel port            |
| `API_PORT`                |             `3002` | REST API port             |
| `JWT_SECRET`              |                  — | JWT authentication secret |
| `AUTO_PORT_MIN/MAX`       |      `25501/25600` | Automatic SSH port range  |
| `AUTO_VNC_PORT_MIN/MAX`   |      `25901/26000` | Automatic VNC port range  |
| `AUTO_AGENT_PORT_MIN/MAX` |      `26101/26200` | vPanel Agent port range   |
| `VM_DIR`                  |            `./vms` | VM disk storage           |
| `DB_PATH`                 | `./data/vpanel.db` | SQLite database           |
| `ALLOW_REGISTER`          |                `1` | Enable user registration  |

> ⚠️ **Important:** Change `JWT_SECRET` before using VPanel Pro in production.

---

## 🔌 Access Stack

| Feature        | Technology                         |
| -------------- | ---------------------------------- |
| Console        | noVNC → WebSocket proxy → QEMU VNC |
| Terminal       | xterm.js → Socket.IO → SSH shell   |
| File Manager   | Web UI → REST API → vPanel Agent   |
| Database       | SQLite / better-sqlite3            |
| Backend        | Node.js + Express                  |
| Real-time      | Socket.IO                          |
| Virtualization | QEMU/KVM                           |

### Console

```text
noVNC
   ↓
WebSocket Proxy
   ↓
/vncws/:vmId
   ↓
QEMU
   ↓
VNC 127.0.0.1:<port>
```

### File Manager

```text
Web File Manager
       ↓
   REST API
       ↓
 vPanel Agent
       ↓
 Guest VM
```

The vPanel Agent uses a Python HTTP API with bearer-token authentication.

If the agent is unavailable, VPanel Pro automatically falls back to SSH.

---

## 🔐 Security

VPanel Pro includes several security mechanisms:

* 🔑 Unique agent token per VM
* 🔒 Agent authentication using bearer tokens
* 🛡️ Agent token stored inside the guest
* 🔐 VNC bound to `127.0.0.1`
* 🔒 Authenticated panel-side VNC proxy
* 🎫 JWT-based authentication

Each VM receives its own `vm.agent_token`, generated as a 32-character hexadecimal token.

The agent token is **never exposed through the API**.

Inside the guest, the token is stored at:

```text
/etc/vpanel-agent.token
```

---

## 🧪 Beta

**VPanel Pro v2.1 — Beta Test**

🚧 This version is currently under beta testing.

### Coming in v2.1

* 🎨 New UI
* ⚡ Performance improvements
* 🖥️ Better VPS management
* 🛠️ More management tools
* 🐛 Bug fixes
* 🔒 Stability improvements
* 🚀 More features

---

## 📜 License

See the repository license for details.

---

## ⭐ Support

If VPanel Pro is useful to you:

⭐ Star the repository
🐛 Report bugs
💡 Suggest features
🤝 Contribute to the project

**VPanel Pro — Manage your virtual servers with ease. 🚀**

```

Is version ko `README.md` me paste karoge to GitHub par kaafi clean/professional lagega.
```
