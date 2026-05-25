import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, CheckCircle2, XCircle, Clock, AlertTriangle, Inbox } from 'lucide-react';
import type { Account } from '@/types';

interface DetailDialogProps {
  accounts: Account[];
  onClose: () => void;
}

export default function DetailDialog({ accounts, onClose }: DetailDialogProps) {
  const statusConfig = {
    success: { label: '成功', color: 'text-emerald-600 bg-emerald-50', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" /> },
    failed: { label: '失败', color: 'text-red-500 bg-red-50', icon: <XCircle className="w-4 h-4 text-red-500" /> },
    pending: { label: '待注册', color: 'text-amber-500 bg-amber-50', icon: <Clock className="w-4 h-4 text-amber-500" /> },
    expired: { label: '验证码过期', color: 'text-slate-500 bg-slate-100', icon: <AlertTriangle className="w-4 h-4 text-slate-500" /> },
  };

  const grouped = {
    success: accounts.filter(a => a.status === 'success'),
    failed: accounts.filter(a => a.status === 'failed'),
    pending: accounts.filter(a => a.status === 'pending'),
    expired: accounts.filter(a => a.status === 'expired'),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[80vh] border-0 shadow-2xl bg-white flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-800">注册明细</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(grouped).map(([status, items]) => {
              const config = statusConfig[status as keyof typeof statusConfig];
              return (
                <div key={status} className={`p-3 rounded-lg ${config.color.split(' ')[1]} text-center`}>
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {config.icon}
                    <span className={`text-xs font-medium ${config.color.split(' ')[0]}`}>{config.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${config.color.split(' ')[0]}`}>{items.length}</p>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {accounts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <Inbox className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-medium">暂无账号数据</p>
              <p className="text-xs mt-1">请先点击「批量注册」创建账号</p>
            </div>
          )}

          {/* Account lists by status */}
          {accounts.length > 0 && Object.entries(grouped).map(([status, items]) => {
            if (items.length === 0) return null;
            const config = statusConfig[status as keyof typeof statusConfig];
            return (
              <div key={status} className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  {config.icon}
                  {config.label}
                  <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                </h3>
                <div className="bg-slate-50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">手机号</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">密码</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">时间</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(account => (
                        <tr key={account.id} className="border-b border-slate-100 last:border-0 hover:bg-white">
                          <td className="px-3 py-2 font-mono text-slate-700">{account.phone}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{account.password}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{account.createTime}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{account.remark || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
