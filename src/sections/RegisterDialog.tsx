import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Play, Users, Settings2, Loader2, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RegisterDialogProps {
  onClose: () => void;
  onRegister: (count: number, parallel: boolean) => void;
  isRunning?: boolean;
}

export default function RegisterDialog({ onClose, onRegister, isRunning = false }: RegisterDialogProps) {
  const [count, setCount] = useState(5);
  const [parallel, setParallel] = useState(true);

  const presetCounts = [3, 5, 10, 15, 20];

  const handleStart = () => {
    onRegister(count, parallel);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-lg border-0 shadow-2xl bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-600" />
              批量注册配置
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
        <CardContent className="space-y-5">
          {/* Info alert */}
          <Alert className="border-blue-200 bg-blue-50">
            <Zap className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 text-xs">
              {parallel
                ? `并行模式：同时开启 ${count} 个浏览器窗口同时注册，大幅缩短总时间`
                : '串行模式：逐个注册，适合调试'}
            </AlertDescription>
          </Alert>

          {/* Mode selector */}
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setParallel(true)}
              className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                parallel
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              并行注册（快速）
            </button>
            <button
              onClick={() => setParallel(false)}
              className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-all ${
                !parallel
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              串行注册
            </button>
          </div>

          {/* Count */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-700">
              注册数量 {parallel && <span className="text-blue-600">= 同时开 {count} 个窗口</span>}
            </Label>
            <div className="flex gap-2">
              {presetCounts.map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    count === c
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {c}个
                </button>
              ))}
            </div>
          </div>

          {/* Custom count */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-700">自定义数量（1-20）</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) =>
                setCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
              }
              className="h-10 border-slate-200"
            />
          </div>

          {/* Time estimate */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
              <Users className="w-3 h-3 mr-1" />
              注册 {count} 个账号
            </Badge>
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-600">
              <Zap className="w-3 h-3 mr-1" />
              {parallel ? `开${count}个窗口并行` : '串行逐个处理'}
            </Badge>
            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-600">
              预计 {parallel ? Math.ceil(count * 0.4) : count * 2} 分钟
            </Badge>
          </div>

          {/* Action */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10 border-slate-200"
              disabled={isRunning}
            >
              取消
            </Button>
            <Button
              onClick={handleStart}
              disabled={isRunning}
              className="flex-1 h-10 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/20"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  注册中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1.5" />
                  开始{parallel ? '并行' : ''}注册
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
