import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

let pythonDepsReady = false;

// 尝试安装 Python 依赖（多种方式）
async function ensurePythonDeps() {
  if (pythonDepsReady) return true;

  console.log('[Python] 正在检查和安装依赖...');

  // 需要: PIL(requests内置), requests, playwright
  const deps = ['pillow', 'requests', 'playwright'];
  const installers = [
    `pip3 install ${deps.join(' ')}`,
    `python3 -m pip install --user ${deps.join(' ')}`,
    `python -m pip install ${deps.join(' ')}`,
  ];

  for (const cmd of installers) {
    try {
      execSync(cmd, { stdio: 'ignore', timeout: 120000 });
      console.log(`[Python] 依赖安装成功: ${cmd.split(' ')[0]}`);
      pythonDepsReady = true;
      break;
    } catch {
      // 尝试下一个
    }
  }

  // 安装 Playwright 浏览器
  if (pythonDepsReady) {
    try {
      execSync('python3 -m playwright install chromium', { stdio: 'ignore', timeout: 180000 });
      console.log('[Python] Playwright chromium 安装成功');
    } catch {
      try {
        execSync('python -m playwright install chromium', { stdio: 'ignore', timeout: 180000 });
        console.log('[Python] Playwright chromium 安装成功');
      } catch {
        console.log('[Python] Playwright chromium 安装失败');
      }
    }
  }

  // 验证
  try {
    execSync('python3 -c "import PIL, requests, playwright"', { stdio: 'ignore' });
    console.log('[Python] 依赖验证通过');
    pythonDepsReady = true;
    return true;
  } catch {
    console.log('[Python] 依赖验证失败');
    return false;
  }
}

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

// 调用 Python 注册引擎（带依赖检查）
async function callPython(args, onData) {
  // 确保 Python 依赖已安装
  if (!pythonDepsReady) {
    const ok = await ensurePythonDeps();
    if (!ok) {
      throw new Error('Python 依赖安装失败，请手动在 Render Shell 执行: pip3 install opencv-python numpy pillow requests scipy playwright && python3 -m playwright install chromium');
    }
  }

  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH || 'python3';
    const scriptPath = path.join(__dirname, 'api_wrapper.py');
    const proc = spawn(pythonPath, [scriptPath, ...args], {
      cwd: __dirname,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      try {
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines) {
          if (line.startsWith('{') && line.endsWith('}')) {
            const parsed = JSON.parse(line);
            if (onData) onData(parsed);
          }
        }
      } catch {}
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[Python] ${data.toString().trim()}`);
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python进程退出码 ${code}: ${errorOutput}`));
        return;
      }
      try {
        const lines = output.split('\n').filter(l => l.trim());
        const lastJson = lines.reverse().find(l => l.startsWith('{') && l.endsWith('}'));
        if (lastJson) {
          resolve(JSON.parse(lastJson));
        } else {
          resolve({ success: false, error: '无有效输出', raw: output });
        }
      } catch (e) {
        resolve({ success: false, error: `解析失败: ${e.message}`, raw: output });
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

// API路由
app.post('/api/register', async (req, res) => {
  const count = Math.min(req.body.count || 1, 20);
  if (isRegistering) return res.status(409).json({ success: false, message: '已有任务进行中' });

  isRegistering = true;
  res.json({ success: true, message: `开始注册 ${count} 个`, count });

  try {
    broadcast({ type: 'progress', data: { current: 0, total: count, step: '准备注册', detail: `共 ${count} 个账号`, log: { time: now(), message: '启动真实浏览器注册...', type: 'info' } } });

    // 先确保依赖
    const depsOk = await ensurePythonDeps();
    if (!depsOk) {
      broadcast({ type: 'error', data: { message: 'Python 依赖安装失败，请检查 Render 日志' } });
      broadcast({ type: 'complete', data: { successCount: 0, total: count, accounts: [] } });
      isRegistering = false;
      return;
    }

    if (count === 1) {
      broadcast({ type: 'progress', data: { current: 0, total: 1, step: '登录豪猪网', detail: '正在登录豪猪网...', log: { time: now(), message: '正在登录豪猪网...', type: 'info' } } });

      const result = await callPython(['--single']);

      if (result.success) {
        const acc = { id: generateId(), phone: result.phone, password: result.password, status: 'success', createTime: now(), remark: result.remark || '真实注册' };
        registeredAccounts.unshift(acc);
        broadcast({ type: 'account', data: acc });
        broadcast({ type: 'progress', data: { current: 1, total: 1, step: '注册成功', detail: `账号注册成功: ${result.phone}`, log: { time: now(), message: `注册成功: ${result.phone}`, type: 'success' } } });
        broadcast({ type: 'complete', data: { successCount: 1, total: 1, accounts: [acc] } });
      } else {
        broadcast({ type: 'progress', data: { current: 0, total: 1, step: '注册失败', detail: result.error || '未知错误', log: { time: now(), message: `失败: ${result.error}`, type: 'error' } } });
        broadcast({ type: 'complete', data: { successCount: 0, total: 1, accounts: [] } });
      }
    } else {
      broadcast({ type: 'progress', data: { current: 0, total: count, step: '登录豪猪网', detail: '批量注册开始', log: { time: now(), message: `开始批量注册 ${count} 个`, type: 'info' } } });

      const results = await callPython(['--batch', String(count)]);
      const accounts = Array.isArray(results) ? results : [results];
      let successCount = 0;

      for (const result of accounts) {
        if (result.success) {
          successCount++;
          const acc = { id: generateId(), phone: result.phone, password: result.password, status: 'success', createTime: now(), remark: result.remark || '批量注册' };
          registeredAccounts.unshift(acc);
          broadcast({ type: 'account', data: acc });
        }
      }

      broadcast({ type: 'complete', data: { successCount, total: count, accounts } });
    }
  } catch (err) {
    console.error('[注册错误]', err);
    const errorMsg = err.message || String(err);
    broadcast({ type: 'progress', data: { current: 0, total: count, step: '注册失败', detail: errorMsg, log: { time: now(), message: `错误: ${errorMsg}`, type: 'error' } } });
    broadcast({ type: 'complete', data: { successCount: 0, total: count, accounts: [] } });
  } finally {
    isRegistering = false;
  }
});

app.post('/api/register/cancel', (_req, res) => {
  res.json({ success: true, message: '取消信号已发送（正在运行的注册无法中断）' });
});

app.get('/api/accounts', (_req, res) => res.json({ success: true, data: registeredAccounts }));
app.get('/api/status', (_req, res) => res.json({ success: true, data: { isRegistering, totalAccounts: registeredAccounts.length, pythonReady: pythonDepsReady } }));

// 测试 Python 环境
app.get('/api/test-env', async (_req, res) => {
  try {
    const result = await callPython([]);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 静态文件
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[服务器] 端口 ${PORT}`);
  console.log(`[豪猪网] 账号: todayis0607, 项目: 49827`);
  console.log(`[预警通] 地址: https://www.qyyjt.cn/user/login`);
  console.log(`[引擎] Python + Playwright 浏览器自动化`);
});
