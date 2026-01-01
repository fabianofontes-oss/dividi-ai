import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { Icons } from './ui/Icons';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { currentUser, isLoadingAuth } = useStore();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Icons.Repeat className="w-8 h-8 text-purple-600 animate-spin mb-4" />
        <p className="text-slate-500 text-sm animate-pulse">Carregando perfil...</p>
      </div>
    );
  }

  if (!currentUser) {
    // Redireciona para login, salvando a origem para voltar depois
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;