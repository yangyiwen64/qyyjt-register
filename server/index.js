/**
 * 预警通注册管理后端服务
 * Express + WebSocket + Playwright浏览器自动化
 */
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { startBrowserRegistration, cancelRegistration, resetCancel } from './register_browser.js';
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
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
function broadcast(data) {
    const msg = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN)
            client.send(msg);
    });
}
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => { });
});
// ==================== API 路由 ====================
app.post('/api/register', async (req, res) => {
    const { count = 1 } = req.body;
    if (isRegistering)
        return res.status(409).json({ success: false, message: '已有注册任务在进行中' });
    if (count < 1 || count > 20)
        return res.status(400).json({ success: false, message: '注册数量1-20' });
    isRegistering = true;
    resetCancel();
    res.json({ success: true, message: `开始注册 ${count} 个账号`, count });
    startBrowserRegistration({
        count,
        onProgress: (data) => {
            broadcast({ type: 'progress', data: { current: data.current, total: data.total, step: data.step, detail: data.detail, log: data.log } });
            if (data.account) {
                const account = {
                    id: generateId(), phone: data.account.phone, password: data.account.password,
                    status: data.account.status, createTime: new Date().toLocaleString('zh-CN'), remark: data.account.remark,
                };
                registeredAccounts.unshift(account);
                broadcast({ type: 'account', data: account });
            }
        },
        onComplete: (successCount, accounts) => {
            isRegistering = false;
            broadcast({ type: 'complete', data: { successCount, total: count, accounts } });
        },
    }).catch((err) => {
        isRegistering = false;
        broadcast({ type: 'error', data: { message: err.message } });
    });
});
app.post('/api/register/cancel', (_req, res) => {
    cancelRegistration();
    isRegistering = false;
    res.json({ success: true, message: '已取消' });
});
app.get('/api/accounts', (_req, res) => {
    res.json({ success: true, data: registeredAccounts });
});
app.delete('/api/accounts/:id', (req, res) => {
    const idx = registeredAccounts.findIndex(a => a.id === req.params.id);
    if (idx === -1)
        return res.status(404).json({ success: false, message: '不存在' });
    registeredAccounts.splice(idx, 1);
    res.json({ success: true, message: '已删除' });
});
app.post('/api/accounts/clear', (_req, res) => {
    registeredAccounts.length = 0;
    res.json({ success: true, message: '已清空' });
});
app.get('/api/status', (_req, res) => {
    res.json({ success: true, data: { isRegistering, totalAccounts: registeredAccounts.length } });
});
// 静态文件
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));
app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[服务器] 启动于端口 ${PORT}`);
    console.log(`[豪猪网] 账号: todayis0607, 项目: 49827`);
    console.log(`[模式] Playwright浏览器自动化`);
});
