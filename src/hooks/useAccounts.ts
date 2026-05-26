import { useState, useCallback, useRef, useEffect } from 'react';
import type { Account, RegisterProgress, ProgressLog } from '@/types';

// Render 后端地址（硬编码，前后端分离部署）
const BACKEND_URL = 'https://qyyjt-register.onrender.com';

const STORAGE_KEY = 'qyyjt_accounts_v2';
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

function nowTime() { return new Date().toLocaleTimeString('zh-CN'); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
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

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>(load);
  const [progress, setProgress] = useState<RegisterProgress>({ total: 0, completed: 0, currentStep: '', stepDetail: '', isRunning: false, logs: [] });
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const cancelRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket 连接 Render 后端
  useEffect(() => {
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          setBackendConnected(true);
          setProgress(p => ({ ...p, logs: [mkLog('success', '后端连接成功'), ...p.logs].slice(0, 200) }));
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'progress') {
              const d = msg.data;
              const newLog = d.log ? { time: d.log.time || nowTime(), message: d.log.message, type: (d.log.type || 'info') as ProgressLog['type'] } : null;
              setProgress(p => ({ ...p, total: d.total ?? p.total, completed: d.current ?? p.completed, currentStep: d.step ?? p.currentStep, stepDetail: d.detail ?? p.stepDetail, isRunning: true, logs: newLog ? [newLog, ...p.logs].slice(0, 200) : p.logs }));
            } else if (msg.type === 'account') {
              const a = msg.data;
              setAccounts(p => { const u = [{ id: a.id || genId(), phone: a.phone, password: a.password, status: (a.status || 'success') as Account['status'], createTime: a.createTime || new Date().toLocaleString('zh-CN'), remark: a.remark || '真实注册' }, ...p]; save(u); return u; });
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
    };

    connect();
    // 每10秒检查重连
    reconnectTimer = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();
      }
    }, 10000);

    return () => { if (reconnectTimer) clearInterval(reconnectTimer); ws?.close(); };
  }, []);

  // 预热衷醒 Render 后端（免费计划会休眠）
  const wakeBackend = useCallback(async (): Promise<boolean> => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${BACKEND_URL}/api/status`, { signal: ctrl.signal });
      clearTimeout(timer);
      return res.ok;
    } catch { return false; }
  }, []);

  // 批量注册 - 直接调用后端真实引擎
  const startRegister = useCallback(async (count: number) => {
    cancelRef.current = false;
    setProgress({ total: count, completed: 0, currentStep: '准备注册', stepDetail: `共 ${count} 个账号待注册`, isRunning: true, logs: [mkLog('info', `启动真实注册，目标: ${count} 个`)] });

    // Step 1: 预热衷醒后端
    setProgress(p => ({ ...p, currentStep: '连接后端', stepDetail: '正在唤醒 Render 后端服务...', logs: [mkLog('info', '正在连接 Render 后端（首次可能需要 30 秒冷启动）...'), ...p.logs].slice(0, 200) }));
    const awake = await wakeBackend();
    if (!awake) {
      setProgress(p => ({ ...p, isRunning: false, currentStep: '连接失败', stepDetail: '无法连接 Render 后端', logs: [mkLog('error', '连接 Render 后端失败，请检查：'), mkLog('error', '1. 后端是否已部署到 Render'), mkLog('error', '2. 访问 https://qyyjt-register.onrender.com 查看状态'), ...p.logs].slice(0, 200) }));
      return;
    }
    setProgress(p => ({ ...p, logs: [mkLog('success', 'Render 后端已连接'), ...p.logs].slice(0, 200) }));

    // Step 2: 调用注册 API
    try {
      setProgress(p => ({ ...p, currentStep: '启动注册', stepDetail: '正在发送注册指令...', logs: [mkLog('info', '正在调用真实注册引擎...'), ...p.logs].slice(0, 200) }));
      const res = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: '后端响应错误' }));
        setProgress(p => ({ ...p, isRunning: false, currentStep: '注册失败', stepDetail: err.message || '后端请求失败', logs: [mkLog('error', `后端错误: ${err.message || '未知错误'}`), ...p.logs].slice(0, 200) }));
      } else {
        setProgress(p => ({ ...p, logs: [mkLog('success', '注册指令已发送，等待后端处理...'), ...p.logs].slice(0, 200) }));
      }
    } catch (err: any) {
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? '请求超时（Render 冷启动可能需要 30-60 秒，请重试）' : `${err.message}`;
      setProgress(p => ({ ...p, isRunning: false, currentStep: '注册失败', stepDetail: msg, logs: [mkLog('error', `请求失败: ${msg}`), mkLog('info', '提示: Render 免费计划会休眠，首次请求需要唤醒'), ...p.logs].slice(0, 200) }));
    }
  }, []);

  const cancelRegister = useCallback(async () => {
    cancelRef.current = true;
    try { await fetch(`${BACKEND_URL}/api/register/cancel`, { method: 'POST', signal: AbortSignal.timeout(5000) }); } catch {}
  }, []);

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

  return { accounts, stats, progress, backendConnected, startRegister, cancelRegister, addBatchAccounts, deleteAccount, clearAll, resetProgress };
}
