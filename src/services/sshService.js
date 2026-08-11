const { Client } = require('ssh2');
const path = require('path');
const logger = require('../lib/logger');

function connect(vm, { readyTimeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!vm || !vm.ssh_port || !vm.username) {
      return reject(new Error('VM has no SSH configuration'));
    }
    const conn = new Client();
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; conn.end(); reject(new Error('SSH connection timed out')); }
    }, readyTimeout);
    conn.on('ready', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(conn);
    });
    conn.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) { settled = true; reject(err); }
    });
    conn.connect({
      host: '127.0.0.1',
      port: vm.ssh_port,
      username: vm.username,
      password: vm.password,
      readyTimeout,
    });
  });
}

function exec(conn, cmd, { timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => { out += d.toString(); });
      stream.stderr.on('data', (d) => { errOut += d.toString(); });
      stream.on('close', (code) => {
        resolve({ code, stdout: out, stderr: errOut });
      });
      stream.on('error', reject);
    });
  });
}

async function withExec(vm, cmd, opts) {
  let conn;
  try {
    conn = await connect(vm);
    return await exec(conn, cmd, opts);
  } finally {
    if (conn) conn.end();
  }
}

function shellStream(vm) {
  return connect(vm).then((conn) => {
    return new Promise((resolve, reject) => {
      conn.shell({ term: 'xterm-256color' }, (err, stream) => {
        if (err) return reject(err);
        resolve({ conn, stream });
      });
    });
  });
}

function statLineToFile(line, base) {
  const m = line.match(/^(\S+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([\s\S]+)$/);
  if (!m) return null;
  const [, perms, links, size, owner, group, mon, day, time, name] = m;
  const full = name.replace(/^"|"$/g, '');
  const isDir = perms.startsWith('d');
  const isLink = perms.startsWith('l');
  return {
    name: full,
    path: path.posix.join(base, full),
    type: isDir ? 'dir' : isLink ? 'link' : 'file',
    size: parseInt(size, 10) || 0,
    perms,
    owner,
    group,
    date: `${mon} ${day} ${time}`,
  };
}

async function listDir(vm, p = '.') {
  const target = p && p !== '/' ? p : '/';
  const r = await withExec(vm, `ls -la --time-style=long-iso "${target}" 2>/dev/null || ls -la "${target}"`);
  if (r.code !== 0) throw new Error(r.stderr || 'Failed to list directory');
  const lines = r.stdout.split('\n').filter((l) => l && !l.startsWith('total '));
  const files = [];
  for (const line of lines) {
    const f = statLineToFile(line, target === '/' ? '' : target);
    if (f && f.name !== '.' && f.name !== '..') files.push(f);
  }
  files.sort((a, b) => (a.type === 'dir' ? -1 : 1) - (b.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name));
  return files;
}

async function readFile(vm, p) {
  const r = await withExec(vm, `cat "${p}"`, { timeout: 15000 });
  if (r.code !== 0) throw new Error(r.stderr || 'Failed to read file');
  return r.stdout;
}

async function writeFile(vm, p, content) {
  const escaped = Buffer.from(content, 'utf8').toString('base64');
  const cmd = `mkdir -p "$(dirname '${p}')" && echo '${escaped}' | base64 -d > '${p}'`;
  const r = await withExec(vm, cmd, { timeout: 20000 });
  if (r.code !== 0) throw new Error(r.stderr || 'Failed to write file');
  return true;
}

async function mkdir(vm, p) {
  const r = await withExec(vm, `mkdir -p "${p}"`);
  if (r.code !== 0) throw new Error(r.stderr || 'Failed to create directory');
  return true;
}

async function rm(vm, p, { recursive = true } = {}) {
  const cmd = recursive ? `rm -rf "${p}"` : `rm -f "${p}"`;
  const r = await withExec(vm, cmd);
  if (r.code !== 0) throw new Error(r.stderr || 'Failed to delete');
  return true;
}

async function rename(vm, from, to) {
  const r = await withExec(vm, `mv "${from}" "${to}"`);
  if (r.code !== 0) throw new Error(r.stderr || 'Failed to rename');
  return true;
}

async function chmod(vm, p, mode) {
  const r = await withExec(vm, `chmod ${mode} "${p}"`);
  if (r.code !== 0) throw new Error(r.stderr || 'Failed to chmod');
  return true;
}

function uploadBuffer(conn, remotePath, buffer, { mode = 0o644 } = {}) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.writeFile(remotePath, buffer, { mode }, (e) => {
        if (e) return reject(e);
        resolve(true);
      });
    });
  });
}

function downloadBuffer(conn, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.readFile(remotePath, (e, data) => {
        if (e) return reject(e);
        resolve(data);
      });
    });
  });
}

module.exports = {
  connect, exec, withExec, shellStream, listDir, readFile, writeFile,
  mkdir, rm, rename, chmod, uploadBuffer, downloadBuffer,
};
