import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Activity, Info, CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';
import type { RegisterProgress } from '@/types';

interface ProcessStepsDialogProps {
  progress: RegisterProgress;
  onClose: () => void;
  onReset: () => void;
}

const typeIcon = {
  info: <Info className="w-3.5 h-3.5 text-blue-500" />,
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  error: <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

const typeBg = {
  info: 'bg-blue-50/50 border-blue-100',
  success: 'bg-emerald-50/50 border-emerald-100',
  warning: 'bg-amber-50/50 border-amber-100',
  error: 'bg-red-50/50 border-red-100',
};

export default function ProcessStepsDialog({
  progress,
  onClose,
  onReset,
}: ProcessStepsDialogProps) {
  const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  const steps = [
    { name: '获取手机号', desc: '从豪猪网获取可用手机号' },
    { name: '连接预警通', desc: '建立与企业预警通的连接' },
    { name: '请求图形验证码', desc: '获取图形验证码图片' },
    { name: '识别图形验证码', desc: '使用OCR识别验证码文字' },
    { name: '提交图形验证', desc: '将识别的验证码提交验证' },
    { name: '发送短信验证码', desc: '触发短信验证码发送' },
    { name: '等待短信到达', desc: '等待豪猪网接收短信（最多60秒）' },
    { name: '读取验证码', desc: '从豪猪网获取短信内容' },
    { name: '提交登录', desc: '使用短信验证码完成登录/注册' },
    { name: '设置密码', desc: '为新账号设置初始密码' },
    { name: '完成确认', desc: '确认注册成功并记录账号' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-3xl max-h-[85vh] border-0 shadow-2xl bg-white flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              注册处理步骤
              <Badge variant="secondary" className="text-xs">
                {progress.isRunning ? '进行中' : progress.total > 0 ? '已完成' : '未开始'}
              </Badge>
            </CardTitle>
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
        <CardContent className="overflow-y-auto space-y-5">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700 font-medium">
                {progress.currentStep || '等待开始'}
              </span>
              <span className="text-slate-500 text-xs">
                {progress.completed}/{progress.total}
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            {progress.stepDetail && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {progress.stepDetail}
              </p>
            )}
          </div>

          {/* Steps flow */}
          <div className="space-y-1">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              处理流程
            </h3>
            <div className="grid grid-cols-1 gap-1.5">
              {steps.map((step, idx) => {
                const isActive = progress.isRunning && idx === progress.completed % steps.length;
                const isCompleted = !progress.isRunning && progress.total > 0;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                      isActive
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isActive
                          ? 'bg-blue-500 text-white'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          isActive ? 'text-blue-700' : isCompleted ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {step.name}
                      </p>
                      <p className="text-xs text-slate-400">{step.desc}</p>
                    </div>
                    {isActive && (
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700 border-blue-200 shrink-0">
                        执行中
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                处理日志
              </h3>
              {progress.logs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="h-6 text-xs text-slate-400 hover:text-slate-600"
                >
                  清空日志
                </Button>
              )}
            </div>
            <ScrollArea className="h-48 border rounded-lg">
              {progress.logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Activity className="w-6 h-6 mb-1 text-slate-300" />
                  <p className="text-xs">暂无日志</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {progress.logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2.5 px-3 py-2 border-l-2 ${
                        typeBg[log.type].split(' ')[1]
                      } ${idx % 2 === 0 ? 'bg-slate-50/30' : ''}`}
                    >
                      <span className="mt-0.5 shrink-0">{typeIcon[log.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 break-all">{log.message}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                        {log.time}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
