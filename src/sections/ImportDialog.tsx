import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Upload, FileSpreadsheet, CheckCircle2, FileUp, Type } from 'lucide-react';

interface ImportDialogProps {
  onClose: () => void;
  onImport: (accounts: Array<{ phone: string; password: string; remark?: string }>) => void;
}

// Pre-loaded today successful accounts from Excel files
const PRELOADED_ACCOUNTS = `16294722794\t7h8296Z0\t并行注册-窗口5
16270990407\tZ99f2216\t并行注册-窗口4
16233226985\tN649086l\t并行注册-窗口3
16270993457\t7133C7m3\t并行注册-窗口2
16294726546\t306n125K\t并行注册-窗口1
16294727894\tNk490092\t手动注册`;

export default function ImportDialog({ onClose, onImport }: ImportDialogProps) {
  const [text, setText] = useState(PRELOADED_ACCOUNTS);
  const [imported, setImported] = useState(false);
  const [importType, setImportType] = useState<'text' | 'file'>('text');
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState<Array<{ phone: string; password: string; remark?: string }> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse text input
  const parseText = (input: string): Array<{ phone: string; password: string; remark?: string }> => {
    const lines = input.trim().split('\n').filter(l => l.trim());
    const accounts: Array<{ phone: string; password: string; remark?: string }> = [];
    for (const line of lines) {
      const parts = line.split(/\t|,/);
      if (parts.length >= 2) {
        const phone = parts[0].trim();
        const password = parts[1].trim();
        const remark = parts[2]?.trim() || '导入数据';
        if (phone && password && /^1\d{10}$/.test(phone)) {
          accounts.push({ phone, password, remark });
        }
      }
    }
    return accounts;
  };

  // Handle Excel file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet);

      const accounts: Array<{ phone: string; password: string; remark?: string }> = [];
      for (const row of jsonData) {
        // Try common column names
        const phone = row['手机号'] || row['电话'] || row['手机'] || row['phone'] || '';
        const password = row['密码'] || row['password'] || row['pwd'] || '';
        const remark = row['备注'] || row['remark'] || row['来源'] || 'Excel导入';
        if (phone && password && /^1\d{10}$/.test(phone.toString())) {
          accounts.push({
            phone: phone.toString().trim(),
            password: password.toString().trim(),
            remark: remark.toString().trim(),
          });
        }
      }

      setFileData(accounts);
    } catch {
      alert('文件解析失败，请检查文件格式');
      setFileName('');
      setFileData(null);
    }
  };

  // Handle import action
  const handleImport = () => {
    let accounts: Array<{ phone: string; password: string; remark?: string }> = [];

    if (importType === 'text') {
      accounts = parseText(text);
    } else if (importType === 'file' && fileData) {
      accounts = fileData;
    }

    if (accounts.length > 0) {
      onImport(accounts);
      setImported(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const textCount = parseText(text).length;
  const readyCount = importType === 'text' ? textCount : (fileData?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-lg border-0 shadow-2xl bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg font-bold text-slate-800">导入账号数据</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            从备份文件或粘贴文本恢复历史数据
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {imported ? (
            <div className="flex flex-col items-center justify-center py-8 text-emerald-600">
              <CheckCircle2 className="w-12 h-12 mb-2" />
              <p className="font-medium">导入成功！</p>
              <p className="text-sm text-slate-400 mt-1">即将关闭...</p>
            </div>
          ) : (
            <>
              {/* Import type switch */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setImportType('text')}
                  className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    importType === 'text'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  粘贴文本
                </button>
                <button
                  onClick={() => setImportType('file')}
                  className={`flex-1 py-2.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    importType === 'file'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FileUp className="w-3.5 h-3.5" />
                  上传Excel
                </button>
              </div>

              {/* Text import */}
              {importType === 'text' && (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">已预加载今日注册成功数据</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        共 {textCount} 条有效记录
                      </p>
                    </div>
                  </div>
                  <Textarea
                    value={text}
                    onChange={(e) => { setText(e.target.value); setFileData(null); }}
                    className="min-h-[200px] font-mono text-sm border-slate-200"
                    placeholder={`手机号1\t密码1\t备注1\n手机号2\t密码2\t备注2`}
                  />
                </>
              )}

              {/* File import */}
              {importType === 'file' && (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-300 rounded-lg p-6 cursor-pointer transition-colors text-center space-y-2"
                  >
                    <FileUp className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-600">点击上传Excel备份文件</p>
                    <p className="text-xs text-slate-400">支持 .xlsx / .xls / .csv 格式</p>
                  </div>

                  {fileName && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-800 truncate">{fileName}</p>
                        <p className="text-xs text-blue-600">
                          有效记录：{fileData?.length || 0} 条
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-slate-400" onClick={() => { setFileName(''); setFileData(null); }}>
                        清除
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  有效记录：{readyCount} 条
                </Badge>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onClose} className="h-9">
                    取消
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={readyCount === 0}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white h-9 shadow-lg shadow-blue-500/20"
                  >
                    <Upload className="w-4 h-4 mr-1.5" />
                    导入 {readyCount > 0 ? `(${readyCount})` : ''}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
