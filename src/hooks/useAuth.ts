import { useState, useCallback } from 'react';
import type { User, UserRole } from '@/types';

const USERS_KEY = 'qyyjt_users';
const CURRENT_USER_KEY = 'qyyjt_current_user';

const DEFAULT_ADMIN: User = {
  id: 'admin_default',
  username: 'admin',
  password: 'admin',
  role: 'admin',
  createTime: new Date().toLocaleString('zh-CN'),
};

function loadUsers(): User[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) {
      localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
      return [DEFAULT_ADMIN];
    }
    const users = JSON.parse(data);
    // Ensure admin always exists
    if (!users.find((u: User) => u.username === 'admin')) {
      users.push(DEFAULT_ADMIN);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return users;
  } catch {
    localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
    return [DEFAULT_ADMIN];
  }
}

function loadCurrentUser(): User | null {
  try {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<User | null>(loadCurrentUser);
  const [users, setUsers] = useState<User[]>(loadUsers);

  const isAuthenticated = !!currentUser;
  const isAdmin = currentUser?.role === 'admin';

  const login = useCallback((username: string, password: string): boolean => {
    const allUsers = loadUsers();
    const found = allUsers.find(
      (u) => u.username === username && u.password === password
    );
    if (found) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(found));
      setCurrentUser(found);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CURRENT_USER_KEY);
    setCurrentUser(null);
  }, []);

  const switchUser = useCallback(() => {
    localStorage.removeItem(CURRENT_USER_KEY);
    setCurrentUser(null);
  }, []);

  // User management (admin only)
  const addUser = useCallback(
    (username: string, password: string, role: UserRole): boolean => {
      const allUsers = loadUsers();
      if (allUsers.find((u) => u.username === username)) {
        return false;
      }
      const newUser: User = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 8),
        username,
        password,
        role,
        createTime: new Date().toLocaleString('zh-CN'),
      };
      const updated = [...allUsers, newUser];
      localStorage.setItem(USERS_KEY, JSON.stringify(updated));
      setUsers(updated);
      return true;
    },
    []
  );

  const deleteUser = useCallback((userId: string): boolean => {
    const allUsers = loadUsers();
    const user = allUsers.find((u) => u.id === userId);
    if (!user || user.username === 'admin') return false;
    const updated = allUsers.filter((u) => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    setUsers(updated);
    return true;
  }, []);

  const updateUserPassword = useCallback(
    (userId: string, newPassword: string): boolean => {
      const allUsers = loadUsers();
      const idx = allUsers.findIndex((u) => u.id === userId);
      if (idx === -1) return false;
      allUsers[idx].password = newPassword;
      localStorage.setItem(USERS_KEY, JSON.stringify(allUsers));
      setUsers(allUsers);
      // Update current user if it's the same user
      if (currentUser && currentUser.id === userId) {
        const updated = { ...currentUser, password: newPassword };
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        setCurrentUser(updated);
      }
      return true;
    },
    [currentUser]
  );

  return {
    currentUser,
    isAuthenticated,
    isAdmin,
    users,
    login,
    logout,
    switchUser,
    addUser,
    deleteUser,
    updateUserPassword,
  };
}
