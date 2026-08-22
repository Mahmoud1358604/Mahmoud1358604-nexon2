import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
app.get('/health', (_, res) => res.json({ ok: true, game: 'WORLD LIFE', version: '0.1.0' }));
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const players = new Map();
let nextId = 1;
const names = ['Ahmed','Mona','Youssef','Nour','Omar','Salma'];

function broadcast(payload, except) {
  const msg = JSON.stringify(payload);
  for (const [ws] of players) if (ws !== except && ws.readyState === 1) ws.send(msg);
}
function snapshot() {
  return [...players.values()].map(p => ({ id:p.id, x:p.x, y:p.y, name:p.name, money:p.money, job:p.job }));
}

wss.on('connection', ws => {
  const id = String(nextId++);
  const player = { id, x: 430 + Math.random()*140, y: 260 + Math.random()*120, name: names[(+id-1)%names.length], money: 250, job: 'باحث عن عمل' };
  players.set(ws, player);
  ws.send(JSON.stringify({ type:'welcome', self:player, players:snapshot() }));
  broadcast({ type:'join', player }, ws);

  ws.on('message', raw => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === 'move') {
        player.x = Math.max(40, Math.min(1160, Number(m.x)||player.x));
        player.y = Math.max(40, Math.min(660, Number(m.y)||player.y));
        broadcast({ type:'move', player:{ id:player.id, x:player.x, y:player.y } }, ws);
      } else if (m.type === 'chat') {
        const text = String(m.text||'').trim().slice(0,120);
        if (text) broadcast({ type:'chat', from:player.name, text }, null);
      } else if (m.type === 'work') {
        player.job = 'عامل متجر'; player.money += 25;
        ws.send(JSON.stringify({ type:'stats', money:player.money, job:player.job, notice:'+25 جنيه — يوم عمل مكتمل' }));
      } else if (m.type === 'rent') {
        if (player.money >= 100) { player.money -= 100; player.job='صاحب محل'; ws.send(JSON.stringify({type:'stats',money:player.money,job:player.job,notice:'تم استئجار محل! أنت الآن صاحب محل.'})); }
        else ws.send(JSON.stringify({type:'notice',notice:'تحتاج 100 جنيه لاستئجار محل.'}));
      }
    } catch {}
  });
  ws.on('close', () => { players.delete(ws); broadcast({type:'leave', id}, null); });
});

httpServer.listen(3001, () => console.log('WORLD LIFE server listening on http://localhost:3001'));
