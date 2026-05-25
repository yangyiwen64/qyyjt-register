export interface Account {
  id: string;
  phone: string;
  password: string;
  status: 'success' | 'failed' | 'pending' | 'expired';
  createTime: string;
  remark: string;
}

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'operator';
  createTime: string;
}

export type UserRole = 'admin' | 'operator';

export interface RegisterProgress {
  total: number;
  completed: number;
  currentStep: string;
  stepDetail: string;
  isRunning: boolean;
  logs: ProgressLog[];
}

export interface ProgressLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
