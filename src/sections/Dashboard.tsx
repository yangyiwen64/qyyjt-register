import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LogOut,
  Download,
  ListFilter,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Shield,
  Activity,
  UserCog,
  SwitchCamera,
  Loader2,
  Zap,
  Upload,
  Settings,
  X,
} from 'lucide-react';
import type { Account, User, RegisterProgress } from '@/types';
import RegisterDialog from './RegisterDialog';
import DetailDialog from './DetailDialog';
import UserManagementDialog from './UserManagementDialog';
import ProcessStepsDialog from './ProcessStepsDialog';
import ImportDialog from './ImportDialog';

interface DashboardProps {
  accounts: Account[];
  stats: { total: number; success: number; failed: number; pending: number; expired: number };
  progress: RegisterProgress;
  isRegistering: boolean;
  isParallel: boolean;
  currentUser: User | null;
  users: User[];
  onLogout: () => void;
  onSwitchUser: () => void;
  onRegister: (count: number, parallel: boolean) => void;
  onCancelRegister: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onResetProgress: () => void;
  onAddUser: (username: string, password: string, role: 'admin' | 'operator') => boolean;
  onDeleteUser: (userId: string) => boolean;
  onUpdateUserPassword: (userId: string, newPassword: string) => boolean;
  onImportAccounts: (accounts: Array<{ phone: string; password: string; remark?: string }>) => void;
  backendUrl: string;
  backendConnected: boolean;
  onConfigureBackend: (url: string) => void;
  onTestBackend: (url?: string) => Promise<boolean>;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  success: { label: '成功', variant: 'default', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: '失败', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
  pending: { label: '待注册', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  expired: { label: '过期', variant: 'outline', icon: <AlertTriangle className="w-3 h-3" /> },
};

export default function Dashboard({
  accounts,
  stats,
  progress,
  isRegistering,
  isParallel,
  currentUser,
  users,
  onLogout,
  onSwitchUser,
  onRegister,
  onCancelRegister,
  onDelete,
  onClear,
  onResetProgress,
  onAddUser,
  onDeleteUser,
  onUpdateUserPassword,
  onImportAccounts,
  backendUrl,
  backendConnected,
  onConfigureBackend,
  onTestBackend,
}: DashboardProps) {
  const isAdmin = currentUser?.role === 'admin';

  const [showRegister, setShowRegister] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showProcess, setShowProcess] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBackend, setShowBackend] = useState(false);
  const [backendInput, setBackendInput] = useState(backendUrl);

  const filteredAccounts = accounts.filter(
    (a) => a.phone.includes(searchTerm) || a.remark.includes(searchTerm) || a.id.includes(searchTerm)
  );

  // 退出时提示备份
  const handleLogout = () => {
    const today = new Date().toLocaleDateString('zh-CN');
    const todaySuccessCount = accounts.filter(
      (a) => a.status === 'success' && a.createTime.startsWith(today)
    ).length;

    if (accounts.length > 0) {
      const msg = todaySuccessCount > 0
        ? `您有 ${accounts.length} 条历史数据（含今日 ${todaySuccessCount} 个成功账号），退出前建议先导出备份！\n\n点击「确定」直接退出，点击「取消」先去导出。`
        : `您有 ${accounts.length} 条历史数据，退出前建议先导出备份！\n\n点击「确定」直接退出，点击「取消」先去导出。`;

      if (!confirm(msg)) {
        return; // 用户取消退出，留在页面去导出
      }
    }
    onLogout();
  };

  const handleExport = async (scope: 'all' | 'today-success' = 'all') => {
    // 筛选要导出的数据
    let exportAccounts = accounts;
    if (scope === 'today-success') {
      const today = new Date().toLocaleDateString('zh-CN');
      exportAccounts = accounts.filter(
        (a) => a.status === 'success' && a.createTime.startsWith(today)
      );
    }

    if (exportAccounts.length === 0) {
      alert(scope === 'today-success' ? '今天没有成功注册的账号可导出' : '没有账号数据可导出');
      return;
    }

    const data = exportAccounts.map((a, idx) => ({
      序号: idx + 1,
      手机号: a.phone,
      密码: a.password,
      状态: a.status === 'success' ? '注册成功' : a.status === 'failed' ? '注册失败' : a.status === 'pending' ? '待注册' : '验证码过期',
      创建时间: a.createTime,
      备注: a.remark || '-',
    }));

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '账号列表');
    ws['!cols'] = [{ wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];

    const todayStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
    const defaultFileName = `预警通账号_${scope === 'today-success' ? todayStr + '_今日成功' : '全部历史'}.xlsx`;

    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as unknown as { showSaveFilePicker: (opts: unknown) => Promise<{ createWritable: () => Promise<{ write: (data: unknown) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker({
          suggestedName: defaultFileName,
          types: [{
            description: 'Excel 文件',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
          }]
        });
        const writable = await handle.createWritable();
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        await writable.write(buf);
        await writable.close();
      } else {
        XLSX.writeFile(wb, defaultFileName);
      }
    } catch {
      // 用户取消选择，静默处理
    }
  };

  const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">预警通注册管理</h1>
                <div className="flex items-center gap-2 -mt-0.5">
                  <p className="text-xs text-slate-400">并行批量注册管理平台</p>
                  {currentUser && (
                    <Badge variant={currentUser.role === 'admin' ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                      {currentUser.username}{isAdmin ? '（管理员）' : '（操作员）'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => setShowUserMgmt(true)} className="text-slate-500 hover:text-blue-600 hover:bg-blue-50 h-8">
                  <UserCog className="w-4 h-4 mr-1.5" />用户管理
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onSwitchUser} className="text-slate-500 hover:text-amber-600 hover:bg-amber-50 h-8">
                <SwitchCamera className="w-4 h-4 mr-1.5" />切换用户
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-8">
                <LogOut className="w-4 h-4 mr-1.5" />退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: '账号总数', value: stats.total, color: 'text-slate-800', bg: 'bg-blue-50', icon: Users },
            { label: '注册成功', value: stats.success, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
            { label: '注册失败', value: stats.failed, color: 'text-red-500', bg: 'bg-red-50', icon: XCircle },
            { label: '待注册', value: stats.pending, color: 'text-amber-500', bg: 'bg-amber-50', icon: Clock },
            { label: '验证码过期', value: stats.expired, color: 'text-slate-400', bg: 'bg-slate-100', icon: AlertTriangle },
          ].map((s, i) => (
            <Card key={i} className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color} mt-0.5`}>{s.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Progress Bar */}
        {(isRegistering || progress.total > 0) && (
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isRegistering ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> : <Activity className="w-4 h-4 text-blue-600" />}
                    <span className="text-sm font-medium text-slate-700">
                      {isRegistering ? (isParallel ? `并行注册中（${progress.total}个窗口）` : '注册进行中...') : '注册完成'}
                    </span>
                    {isRegistering && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200 animate-pulse">处理中</Badge>}
                    {!isRegistering && progress.total > 0 && <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">已完成</Badge>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">{progress.completed}/{progress.total}</span>
                    <span className="text-sm font-bold text-blue-600">{progressPercent}%</span>
                  </div>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                </div>
                {progress.stepDetail && <p className="text-xs text-slate-400">{progress.stepDetail}</p>}
                {progress.logs.length > 0 && (
                  <div className="border-t border-slate-100 pt-2 max-h-28 overflow-y-auto space-y-1">
                    {progress.logs.slice(0, 8).map((log, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 tabular-nums">{log.time}</span>
                        <span className={log.type === 'success' ? 'text-emerald-600' : log.type === 'error' ? 'text-red-500' : 'text-slate-600'}>{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {isRegistering && <p className="text-xs text-amber-600">请勿刷新页面，后台并行注册中...</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* 后端状态指示灯 */}
          <div className="flex items-center gap-1.5 mr-2">
            <div className={`w-2.5 h-2.5 rounded-full ${backendConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-amber-400'}`} />
            <span className="text-xs text-slate-400">{backendConnected ? '真实注册' : '演示模式'}</span>
          </div>

          <Button onClick={() => { setBackendInput(backendUrl); setShowBackend(true); }} variant="outline" className="border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 h-10" title="配置后端服务地址">
            <Settings className="w-4 h-4 mr-1.5" />
            {backendUrl ? '已配置' : '配置后端'}
          </Button>

          {isRegistering ? (
            <Button onClick={onCancelRegister} variant="destructive" className="h-10 shadow-lg shadow-red-500/20 animate-pulse">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              取消注册
            </Button>
          ) : (
            <Button onClick={() => setShowRegister(true)} className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20 h-10">
              <Zap className="w-4 h-4 mr-2" />
              批量注册
            </Button>
          )}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <Button onClick={() => handleExport('all')} variant="outline" className="border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 h-10" disabled={accounts.length === 0}><Download className="w-4 h-4 mr-1.5" />导出全部历史</Button>
              <Button onClick={() => handleExport('today-success')} variant="outline" className="border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 h-10 px-3" disabled={accounts.filter((a) => a.status === 'success' && a.createTime.startsWith(new Date().toLocaleDateString('zh-CN'))).length === 0} title="仅导出今天成功注册的账号">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          )}
          {!isAdmin && <Button variant="outline" className="border-slate-200 h-10 opacity-50 cursor-not-allowed" disabled title="仅管理员可用"><Download className="w-4 h-4 mr-2" />导出全部历史<Badge variant="outline" className="ml-1 text-[10px] h-4 px-1">管理员</Badge></Button>}
          <Button onClick={() => setShowImport(true)} variant="outline" className="border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 h-10"><Upload className="w-4 h-4 mr-2" />导入数据</Button>
          <Button onClick={() => setShowDetail(true)} variant="outline" className="border-slate-200 hover:bg-slate-50 h-10"><ListFilter className="w-4 h-4 mr-2" />查看明细</Button>
          {isAdmin && <Button onClick={() => setShowProcess(true)} variant="outline" className="border-blue-200 hover:bg-blue-50 text-blue-700 h-10"><Activity className="w-4 h-4 mr-2" />处理步骤</Button>}
          {accounts.length > 0 && <Button onClick={onClear} variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50 ml-auto h-10"><Trash2 className="w-4 h-4 mr-1.5" />清空全部</Button>}
        </div>

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="p-4 border-b border-slate-100">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="搜索手机号、备注..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-9 border-slate-200" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="w-16 text-xs font-semibold text-slate-500">序号</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">手机号</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">密码</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">状态</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500">创建时间</TableHead>
                    <TableHead className="w-16 text-xs font-semibold text-slate-500">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center"><Users className="w-6 h-6 text-slate-300" /></div>
                          <p>{accounts.length === 0 ? '暂无账号数据' : '未找到匹配的账号'}</p>
                          {accounts.length === 0 && <p className="text-xs">点击「批量注册」开始并行注册</p>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredAccounts.map((a, i) => {
                    const s = statusMap[a.status];
                    return (
                      <TableRow key={a.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs text-slate-500">{i + 1}</TableCell>
                        <TableCell className="font-mono text-sm font-medium text-slate-700">{a.phone}</TableCell>
                        <TableCell className="font-mono text-sm text-slate-600">{a.password}</TableCell>
                        <TableCell><Badge variant={s.variant} className="text-xs flex items-center gap-1 w-fit">{s.icon}{s.label}</Badge></TableCell>
                        <TableCell className="text-xs text-slate-500">{a.createTime}</TableCell>
                        <TableCell><Button variant="ghost" size="sm" onClick={() => onDelete(a.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {showRegister && <RegisterDialog onClose={() => setShowRegister(false)} onRegister={onRegister} isRunning={isRegistering} />}
      {showDetail && <DetailDialog accounts={accounts} onClose={() => setShowDetail(false)} />}
      {showUserMgmt && isAdmin && <UserManagementDialog users={users} currentUserId={currentUser?.id || ''} onClose={() => setShowUserMgmt(false)} onAddUser={onAddUser} onDeleteUser={onDeleteUser} onUpdatePassword={onUpdateUserPassword} />}
      {showProcess && isAdmin && <ProcessStepsDialog progress={progress} onClose={() => setShowProcess(false)} onReset={onResetProgress} />}
      {showImport && <ImportDialog onClose={() => setShowImport(false)} onImport={onImportAccounts} />}

      {/* 后端配置弹窗 */}
      {showBackend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <Card className="w-full max-w-md border-0 shadow-2xl bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold text-slate-800">配置后端服务</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowBackend(false)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-slate-400 mt-1">输入后端服务地址，启用真实浏览器注册</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 状态显示 */}
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${backendConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                <div className={`w-2.5 h-2.5 rounded-full ${backendConnected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                {backendConnected ? '后端已连接 - 将使用真实浏览器注册' : '未连接后端 - 当前为演示模式'}
              </div>

              {/* 输入框 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">后端地址</label>
                <input
                  type="text"
                  value={backendInput}
                  onChange={(e) => setBackendInput(e.target.value)}
                  placeholder="https://xxxx.ngrok-free.app 或 http://localhost:3000"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400">支持 ngrok、localhost 等任意可访问地址</p>
              </div>

              {/* 快速指南 */}
              <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-slate-600">本地运行后端：</p>
                <code className="block bg-slate-800 text-green-400 text-xs p-2.5 rounded font-mono">cd app && npm install && node server/index.mjs</code>
                <p className="text-xs text-slate-400">然后用 ngrok 暴露：</p>
                <code className="block bg-slate-800 text-green-400 text-xs p-2.5 rounded font-mono">npx ngrok http 3000</code>
              </div>

              {/* 按钮 */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowBackend(false)} className="h-9">取消</Button>
                <Button variant="outline" onClick={async () => { const ok = await onTestBackend(backendInput); alert(ok ? '连接成功！' : '连接失败，请检查后重试'); }} className="h-9">测试连接</Button>
                <Button onClick={() => { onConfigureBackend(backendInput); setShowBackend(false); }} className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white h-9 shadow-lg shadow-blue-500/20">保存</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
