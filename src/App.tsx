import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import LoginPage from '@/sections/LoginPage';
import Dashboard from '@/sections/Dashboard';

function App() {
  const { currentUser, isAuthenticated, users, login, logout, switchUser, addUser, deleteUser, updateUserPassword } = useAuth();
  const { accounts, stats, progress, backendUrl, backendConnected, startRegister, cancelRegister, addBatchAccounts, deleteAccount, clearAll, resetProgress, configureBackend, testBackend } = useAccounts();

  const [isParallel, setIsParallel] = useState(true);

  const handleRegister = useCallback(async (count: number, parallel: boolean) => {
    setIsParallel(parallel);
    await startRegister(count);
  }, [startRegister]);

  if (!isAuthenticated) return <LoginPage onLogin={login} />;

  return (
    <Dashboard
      accounts={accounts}
      stats={stats}
      progress={progress}
      isRegistering={progress.isRunning}
      isParallel={isParallel}
      currentUser={currentUser}
      users={users}
      backendUrl={backendUrl}
      backendConnected={backendConnected}
      onLogout={logout}
      onSwitchUser={switchUser}
      onRegister={handleRegister}
      onCancelRegister={cancelRegister}
      onDelete={deleteAccount}
      onClear={clearAll}
      onResetProgress={resetProgress}
      onAddUser={addUser}
      onDeleteUser={deleteUser}
      onUpdateUserPassword={updateUserPassword}
      onImportAccounts={addBatchAccounts}
      onConfigureBackend={configureBackend}
      onTestBackend={testBackend}
    />
  );
}

export default App;
