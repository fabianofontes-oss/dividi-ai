import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../modules/auth';
import { useGroups } from '../modules/groups';
import { useExpenses } from '../modules/expenses';

interface NotificationContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within AppProvider');
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [notification, setNotification] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const clearNotification = () => setNotification(null);

  return (
    <NotificationContext.Provider value={{ showToast, clearNotification }}>
      {children}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-top ${
          notification.type === 'success' ? 'bg-emerald-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useApp = () => {
  const auth = useAuth();
  const groups = useGroups(auth.currentUser?.id || null);
  const expenses = useExpenses(groups.groups.map(g => g.id));
  const notification = useNotification();

  return {
    ...auth,
    groups: groups.groups,
    groupsLoading: groups.isLoading,
    groupsError: groups.error,
    createGroup: groups.createGroup,
    updateGroup: groups.updateGroup,
    removeMember: groups.removeMember,
    refreshGroups: groups.refresh,
    expenses: expenses.expenses,
    expensesLoading: expenses.isLoading,
    expensesError: expenses.error,
    createExpense: expenses.createExpense,
    updateExpense: expenses.updateExpense,
    deleteExpense: expenses.deleteExpense,
    refreshExpenses: expenses.refresh,
    ...notification,
  };
};
