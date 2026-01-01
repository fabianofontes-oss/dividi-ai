import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { StoreProvider } from './store/StoreContext';
import AuthGuard from './components/AuthGuard';

import Dashboard from './pages/Dashboard';
import GroupsList from './pages/GroupsList';
import GroupDetail from './pages/GroupDetail';
import GroupSettings from './pages/GroupSettings';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import CreateGroup from './pages/CreateGroup';
import Profile from './pages/Profile';
import Activity from './pages/Activity';
import QuickSplit from './pages/QuickSplit';
import Login from './pages/Login';

const App = () => {
  return (
    <StoreProvider>
      <HashRouter>
        <Layout>
          <Routes>
            {/* Rota Pública */}
            <Route path="/login" element={<Login />} />
            
            {/* Rota Híbrida (funciona sem login, mas idealmente deveria pedir) */}
            <Route path="/quick-split" element={<QuickSplit />} />

            {/* Rotas Protegidas */}
            <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/groups" element={<AuthGuard><GroupsList /></AuthGuard>} /> 
            <Route path="/groups/new" element={<AuthGuard><CreateGroup /></AuthGuard>} />
            <Route path="/group/:id" element={<AuthGuard><GroupDetail /></AuthGuard>} />
            <Route path="/group/:id/settings" element={<AuthGuard><GroupSettings /></AuthGuard>} />
            <Route path="/add-expense/:groupId" element={<AuthGuard><AddExpense /></AuthGuard>} />
            <Route path="/edit-expense/:expenseId" element={<AuthGuard><EditExpense /></AuthGuard>} />
            <Route path="/activity" element={<AuthGuard><Activity /></AuthGuard>} />
            <Route path="/profile" element={<AuthGuard><Profile /></AuthGuard>} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </HashRouter>
    </StoreProvider>
  );
};

export default App;