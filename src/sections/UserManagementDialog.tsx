import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { X, UserPlus, Trash2, KeyRound, Shield, User, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { User as UserType } from '@/types';

interface UserManagementDialogProps {
  users: UserType[];
  currentUserId: string;
  onClose: () => void;
  onAddUser: (username: string, password: string, role: 'admin' | 'operator') => boolean;
  onDeleteUser: (userId: string) => boolean;
  onUpdatePassword: (userId: string, newPassword: string) => boolean;
}

export default function UserManagementDialog({
  users,
  currentUserId,
  onClose,
  onAddUser,
  onDeleteUser,
  onUpdatePassword,
}: UserManagementDialogProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operator'>('operator');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = () => {
    setError('');
    setSuccess('');
    if (!newUsername || !newPassword) {
      setError('请填写用户名和密码');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }
    if (newPassword.length < 4) {
      setError('密码至少4位');
      return;
    }
    const result = onAddUser(newUsername, newPassword, newRole);
    if (result) {
      setSuccess(`用户 "${newUsername}" 创建成功`);
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      setShowAddForm(false);
    } else {
      setError('用户名已存在');
    }
  };

  const handleUpdatePassword = (userId: string) => {
    setError('');
    setSuccess('');
    if (!newPassword) {
      setError('请输入新密码');
      return;
    }
    if (newPassword.length < 4) {
      setError('密码至少4位');
      return;
    }
    onUpdatePassword(userId, newPassword);
    setSuccess('密码修改成功');
    setNewPassword('');
    setEditingUser(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card className="w-full max-w-2xl max-h-[85vh] border-0 shadow-2xl bg-white flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              用户管理
              <Badge variant="secondary" className="text-xs">{users.length} 人</Badge>
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
        <CardContent className="overflow-y-auto space-y-4">
          {/* Messages */}
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
              <CheckIcon />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Add user button */}
          {!showAddForm && (
            <Button
              onClick={() => {
                setShowAddForm(true);
                setError('');
                setSuccess('');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9"
              size="sm"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              新增用户
            </Button>
          )}

          {/* Add user form */}
          {showAddForm && (
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">新增用户</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">用户名</Label>
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="输入用户名"
                    className="h-9 border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">角色</Label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewRole('operator')}
                      className={`flex-1 py-2 rounded-md text-xs font-medium transition-all border ${
                        newRole === 'operator'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      操作员
                    </button>
                    <button
                      onClick={() => setNewRole('admin')}
                      className={`flex-1 py-2 rounded-md text-xs font-medium transition-all border ${
                        newRole === 'admin'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      管理员
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">密码</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="输入密码"
                    className="h-9 border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">确认密码</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className="h-9 border-slate-200"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setError('');
                    setNewUsername('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="h-8 border-slate-200"
                >
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  创建用户
                </Button>
              </div>
            </div>
          )}

          {/* User list */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold text-slate-500">用户名</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">角色</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">创建时间</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm font-medium text-slate-700">
                      <div className="flex items-center gap-2">
                        {u.role === 'admin' ? (
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        {u.username}
                        {u.id === currentUserId && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                            当前
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === 'admin' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {u.role === 'admin' ? '管理员' : '操作员'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{u.createTime}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingUser === u.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="新密码"
                              className="h-7 w-28 text-xs border-slate-200"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdatePassword(u.id)}
                              className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingUser(null);
                                setNewPassword('');
                                setError('');
                              }}
                              className="h-7 px-2 text-xs text-slate-400"
                            >
                              取消
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingUser(u.id);
                                setNewPassword('');
                                setError('');
                              }}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              title="修改密码"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                            {u.username !== 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`确定删除用户 "${u.username}" 吗？`)) {
                                    onDeleteUser(u.id);
                                    setSuccess(`用户 "${u.username}" 已删除`);
                                  }
                                }}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="删除用户"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Role legend */}
          <div className="flex gap-4 text-xs text-slate-500 pt-1">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-600" />
              <span>管理员：完整权限（注册/导出/用户管理/处理步骤）</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              <span>操作员：仅批量注册</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
