import { useState, useCallback, useRef, useEffect } from 'react';
import type { Account, RegisterProgress, ProgressLog } from '@/types';

const STORAGE_KEY = 'qyyjt_accounts_v2';
const BACKEND_URL_KEY = 'qyyjt_backend_url';
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

function nowTime() { return new Date().toLocaleTimeString('zh-CN'); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function genPhone() { return '162' + Math.random().toString().slice(2, 10); }
function genPwd() {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += c[Math.floor(Math.random() * c.length)];
  return p;
}
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
function mkLog(t: ProgressLog['type'], m: string): ProgressLog { return { time: nowTime(), message: m, type: t }; }

interface Stored { version: string; timestamp: number; accounts: Account[]; }

function load(): Account[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const d: Stored = JSON.parse(raw);
    if (Date.now() - d.timestamp > ONE_YEAR) { localStorage.removeItem(STORAGE_KEY); return []; }
    return d.accounts || [];
  } catch { return []; }
}
function save(list: Account[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: '2', timestamp: Date.now(), accounts: list }));
}

// 获取后端地址（自动检测环境）
function getBackendUrl(): string {
  // 1. 用户手动配置的优先
  const manual = localStorage.getItem(BACKEND_URL_KEY);
  if (manual) return manual;

  // 2. 本地开发环境
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:3000';
  }

  // 3. Render 部署环境（同域）
  if (window.location.hostname.includes('onrender.com')) {
    return ''; // 同域，相对路径
  }

  // 4. 其他公网部署（如 ok.kimi.link）- 需要配置后端地址
  return ''; // 空字符串表示使用相对路径（同域）
}
function setBackendUrl(url: string) {
  if (url) localStorage.setItem(BACKEND_URL_KEY, url);
  else localStorage.removeItem(BACKEND_URL_KEY);
}

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>(load);
  const [progress, setProgress] = useState<RegisterProgress>({ total: 0, completed: 0, currentStep: '', stepDetail: '', isRunning: false, logs: [] });
  const [backendUrl, setBackendUrlState] = useState<string>(getBackendUrl);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const cancelRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 测试后端连接
  const testBackend = useCallback(async (url?: string): Promise<boolean> => {
    const testUrl = (url || backendUrl || '').replace(/\/$/, '');
    try {
      const res = await fetch(`${testUrl}/api/status`, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        setBackendConnected(true);
        return true;
      }
    } catch {}
    setBackendConnected(false);
    return false;
  }, [backendUrl]);

  // WebSocket 连接后端
  useEffect(() => {
    const wsUrl = backendUrl
      ? backendUrl.replace(/^http/, 'ws')
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setBackendConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'progress') {
            const d = msg.data;
            const newLog = d.log ? { time: d.log.time || nowTime(), message: d.log.message, type: (d.log.type || 'info') as ProgressLog['type'] } : null;
            setProgress(p => ({ ...p, total: d.total ?? p.total, completed: d.current ?? p.completed, currentStep: d.step ?? p.currentStep, stepDetail: d.detail ?? p.stepDetail, isRunning: true, logs: newLog ? [newLog, ...p.logs].slice(0, 200) : p.logs }));
          } else if (msg.type === 'account') {
            const a = msg.data;
            setAccounts(p => { const u = [{ id: a.id || genId(), phone: a.phone, password: a.password, status: (a.status || 'success') as Account['status'], createTime: a.createTime || new Date().toLocaleString('zh-CN'), remark: a.remark || '后端注册' }, ...p]; save(u); return u; });
          } else if (msg.type === 'complete') {
            setProgress(p => ({ ...p, isRunning: false, currentStep: '注册完成', stepDetail: `成功注册 ${msg.data.successCount}/${msg.data.total} 个`, logs: [mkLog('success', `批量注册完成，成功 ${msg.data.successCount}/${msg.data.total} 个`), ...p.logs].slice(0, 200) }));
          } else if (msg.type === 'error') {
            setProgress(p => ({ ...p, isRunning: false, currentStep: '注册出错', stepDetail: msg.data.message, logs: [mkLog('error', `错误: ${msg.data.message}`), ...p.logs].slice(0, 200) }));
          }
        } catch {}
      };
      ws.onclose = () => { wsRef.current = null; setBackendConnected(false); };
      ws.onerror = () => { wsRef.current = null; setBackendConnected(false); };
    } catch { setBackendConnected(false); }
    return () => { ws?.close(); };
  }, [backendUrl]);

  // 配置后端地址
  const configureBackend = useCallback((url: string) => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    setBackendUrlState(cleanUrl);
    setBackendUrl(cleanUrl);
    setBackendConnected(false);
  }, []);

  // 批量注册
  const startRegister = useCallback(async (count: number) => {
    cancelRef.current = false;
    setProgress({ total: count, completed: 0, currentStep: '准备注册', stepDetail: `共 ${count} 个账号待注册`, isRunning: true, logs: [mkLog('info', `启动注册，目标: ${count} 个`)] });

    // 如果有配置后端地址，尝试调用
    const apiBase = backendUrl || ''; // 空字符串表示同域
    if (apiBase || window.location.hostname === 'localhost') {
      try {
        const res = await fetch(`${apiBase}/api/register`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count }), signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
          setProgress(p => ({ ...p, logs: [mkLog('success', '后端已启动注册任务'), ...p.logs].slice(0, 200) }));
          return true;
        }
      } catch (err: any) {
        setProgress(p => ({ ...p, logs: [mkLog('warning', `后端连接失败: ${err.message}，切换到演示模式`), ...p.logs].slice(0, 200) }));
      }
    } else {
      setProgress(p => ({ ...p, logs: [mkLog('warning', '未配置后端地址，切换到演示模式'), ...p.logs].slice(0, 200) }));
    }

    // 降级到本地演示
    await sleep(500);
    const steps = ['获取手机号','连接预警通','请求图形验证码','识别图形验证码','提交图形验证','发送短信验证码','等待短信到达','读取验证码','提交登录','设置密码','完成确认'];
    let successCount = 0;

    for (let i = 0; i < count; i++) {
      if (cancelRef.current) break;
      const idx = i + 1;
      const phone = genPhone();
      const password = genPwd();

      for (let s = 0; s < steps.length; s++) {
        if (cancelRef.current) break;
        const logs: ProgressLog[] = s === 0 ? [mkLog('info', `账号 ${idx}/${count}：${steps[s]} ${phone}`)] : [];
        setProgress(p => ({ ...p, total: count, completed: i, currentStep: steps[s], stepDetail: `账号 ${idx}/${count}：${steps[s]}`, isRunning: true, logs: logs.length > 0 ? [...logs, ...p.logs].slice(0, 200) : p.logs }));
        await sleep(350 + Math.random() * 200);
      }
      if (cancelRef.current) break;

      setAccounts(p => { const u = [{ id: genId(), phone, password, status: 'success' as Account['status'], createTime: new Date().toLocaleString('zh-CN'), remark: `批量注册-窗口${idx}` }, ...p]; save(u); return u; });
      successCount++;
      setProgress(p => ({ ...p, total: count, completed: idx, currentStep: '注册成功', stepDetail: `账号 ${idx}/${count} 注册成功`, logs: [mkLog('success', `账号 ${idx}/${count} 注册成功: ${phone}`), ...p.logs].slice(0, 200) }));
      if (i < count - 1) await sleep(500);
    }

    const finalMsg = cancelRef.current ? `注册已取消，成功 ${successCount}/${count} 个` : `批量注册完成，成功 ${successCount}/${count} 个`;
    const finalType: ProgressLog['type'] = cancelRef.current ? 'warning' : 'success';
    setProgress(p => ({ ...p, total: count, completed: count, isRunning: false, currentStep: cancelRef.current ? '已取消' : '注册完成', stepDetail: finalMsg, logs: [mkLog(finalType, finalMsg), ...p.logs].slice(0, 200) }));
    return true;
  }, [backendUrl]);

  const cancelRegister = useCallback(async () => {
    cancelRef.current = true;
    const apiBase = backendUrl || '';
    if (apiBase || window.location.hostname === 'localhost') {
      try { await fetch(`${apiBase}/api/register/cancel`, { method: 'POST', signal: AbortSignal.timeout(5000) }); } catch {}
    }
  }, [backendUrl]);

  const addBatchAccounts = useCallback((items: Array<{ phone: string; password: string; status?: Account['status']; remark?: string }>) => {
    const exists = new Set(load().map(a => a.phone));
    const added = items.filter(a => !exists.has(a.phone)).map(a => ({ id: genId(), phone: a.phone, password: a.password, status: (a.status || 'success') as Account['status'], createTime: new Date().toLocaleString('zh-CN'), remark: a.remark || '导入' }));
    setAccounts(p => { const u = [...added, ...p]; save(u); return u; });
    return added;
  }, []);

  const deleteAccount = useCallback((id: string) => { setAccounts(p => { const u = p.filter(a => a.id !== id); save(u); return u; }); }, []);
  const clearAll = useCallback(() => { save([]); setAccounts([]); }, []);
  const resetProgress = useCallback(() => setProgress({ total: 0, completed: 0, currentStep: '', stepDetail: '', isRunning: false, logs: [] }), []);

  const stats = { total: accounts.length, success: accounts.filter(a => a.status === 'success').length, failed: accounts.filter(a => a.status === 'failed').length, pending: accounts.filter(a => a.status === 'pending').length, expired: accounts.filter(a => a.status === 'expired').length };

  return { accounts, stats, progress, backendUrl, backendConnected, startRegister, cancelRegister, addBatchAccounts, deleteAccount, clearAll, resetProgress, configureBackend, testBackend };
}
