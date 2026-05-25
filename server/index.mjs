import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { startBrowserRegistration, cancelRegistration, resetCancel } from './register_browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const registeredAccounts = [];
let isRegistering = false;
const clients = new Set();

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 8); }
function now() { return new Date().toLocaleTimeString('zh-CN'); }

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

wss.on('connection', (ws) => { clients.add(ws); ws.on('close', () => clients.delete(ws)); });

app.post('/api/register', (req, res) => {
  const count = req.body.count || 1;
  if (isRegistering) return res.status(409).json({ success: false, message: '已有任务进行中' });
  if (count < 1 || count > 20) return res.status(400).json({ success: false, message: '数量1-20' });
  isRegistering = true; resetCancel();
  res.json({ success: true, message: `开始注册 ${count} 个`, count });
  startBrowserRegistration(count,
    (data) => {
      broadcast({ type: 'progress', data: { current: data.current, total: data.total, step: data.step, detail: data.detail, log: data.log } });
      if (data.account) { const acc = { id: generateId(), phone: data.account.phone, password: data.account.password, status: data.account.status, createTime: now(), remark: data.account.remark }; registeredAccounts.unshift(acc); broadcast({ type: 'account', data: acc }); }
    },
    (successCount, accounts) => { isRegistering = false; broadcast({ type: 'complete', data: { successCount, total: count, accounts } }); }
  ).catch(err => { isRegistering = false; broadcast({ type: 'error', data: { message: err.message } }); });
});

app.post('/api/register/cancel', (_req, res) => { cancelRegistration(); isRegistering = false; res.json({ success: true }); });
app.get('/api/accounts', (_req, res) => res.json({ success: true, data: registeredAccounts }));
app.get('/api/status', (_req, res) => res.json({ success: true, data: { isRegistering, totalAccounts: registeredAccounts.length } }));

const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[服务器] 端口 ${PORT}`);
  console.log(`[豪猪网] 账号: todayis0607, 项目: 49827`);
  console.log(`[模式] Playwright浏览器自动化`);
});
