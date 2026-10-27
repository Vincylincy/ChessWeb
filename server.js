const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/script.js': ['script.js', 'text/javascript; charset=utf-8']
};

const server = http.createServer((req, res) => {
  const f = FILES[req.url.split('?')[0]];
  if (!f) { res.writeHead(404); return res.end('404'); }
  fs.readFile(path.join(__dirname, f[0]), (err, data) => {
    if (err) { res.writeHead(500); return res.end('error'); }
    res.writeHead(200, { 'Content-Type': f[1] });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // codigo -> Set<ws>
let counter = 0;

function broadcastPeers(code) {
  const set = rooms.get(code);
  if (!set) return;
  const ids = [...set].map(w => w.id);
  for (const w of set) w.send(JSON.stringify({ t: 'peers', ids }));
}

wss.on('connection', ws => {
  ws.id = 'p' + (++counter) + Math.random().toString(36).slice(2, 6);
  ws.code = null;

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join' && !ws.code && /^\d{4}$/.test(m.code)) {
      if (!rooms.has(m.code)) rooms.set(m.code, new Set());
      const set = rooms.get(m.code);
      if (set.size >= 20) return ws.close();
      set.add(ws);
      ws.code = m.code;
      ws.send(JSON.stringify({ t: 'hello', id: ws.id }));
      broadcastPeers(m.code);
    } else if (m.t === 'emit' && ws.code && typeof m.topic === 'string') {
      const msg = JSON.stringify({ t: 'msg', topic: m.topic, from: ws.id, data: m.data });
      for (const w of rooms.get(ws.code)) if (w !== ws && w.readyState === 1) w.send(msg);
    }
  });

  ws.on('close', () => {
    if (!ws.code) return;
    const set = rooms.get(ws.code);
    set.delete(ws);
    if (set.size === 0) rooms.delete(ws.code);
    else broadcastPeers(ws.code);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Ajedrez en http://localhost:' + PORT));