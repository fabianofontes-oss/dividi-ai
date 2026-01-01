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

  React.useEffect(() => {
    console.log('[AuthGuard] Check:', {
      path: location.pathname,
      hasUser: !!currentUser,
      userId: currentUser?.id,
      isLoadingAuth
    });
  }, [location.pathname, currentUser, isLoadingAuth]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Icons.Repeat className="w-8 h-8 text-purple-600 animate-spin mb-4" />
        <p className="text-slate-500 text-sm animate-pulse">Carregando perfil...</p>
      </div>
    );
  }

  if (!currentUser) {
    console.log('[AuthGuard] No user, redirecting to login from:', location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;