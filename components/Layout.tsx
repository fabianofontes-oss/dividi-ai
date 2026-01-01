import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Icons } from './ui/Icons';
import { useStore } from '../store/StoreContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { notification, clearNotification } = useStore();
  
  const isHome = location.pathname === '/';
  const isAddExpense = location.pathname.includes('/add');
  const isQuickSplit = location.pathname === '/quick-split';
  
  // Hide nav on specific operational flows
  const hideNav = isAddExpense || isQuickSplit;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans selection:bg-purple-500 selection:text-white pb-24 transition-colors duration-300">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 animate-in slide-in-from-top-4 fade-in duration-300">
           <div 
             className={`flex items-center p-4 rounded-xl shadow-2xl border backdrop-blur-md ${
               notification.type === 'error' ? 'bg-rose-500/90 border-rose-600 text-white' : 
               notification.type === 'info' ? 'bg-slate-800/90 border-slate-700 text-white' : 
               'bg-emerald-500/90 border-emerald-600 text-white'
             }`}
           >
              {notification.type === 'success' && <Icons.Check className="w-5 h-5 mr-3" />}
              {notification.type === 'error' && <Icons.AlertCircle className="w-5 h-5 mr-3" />}
              {notification.type === 'info' && <Icons.Zap className="w-5 h-5 mr-3" />}
              
              <span className="font-medium text-sm flex-1">{notification.message}</span>
              
              <button onClick={clearNotification} className="ml-2 opacity-80 hover:opacity-100">
                 <Icons.X className="w-4 h-4" />
              </button>
           </div>
        </div>
      )}

      {/* Top Bar (Contextual) */}
      {!isHome && !isAddExpense && !isQuickSplit && (
        <div className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-white/5 px-4 h-14 flex items-center justify-between transition-colors duration-300">
           <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300">
             <Icons.ChevronLeft className="w-6 h-6" />
           </button>
           <span className="font-semibold text-lg tracking-tight text-slate-900 dark:text-white">dividi.ai</span>
           <div className="w-8" /> {/* Spacer */}
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-md mx-auto w-full min-h-screen relative animate-in fade-in duration-300">
        {children}
      </main>

      {/* Bottom Navigation */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl pb-safe transition-colors duration-300">
          <div className="max-w-md mx-auto flex items-center justify-around h-16">
            <NavItem to="/" icon={<Icons.Home className="w-6 h-6" />} label="Home" />
            <NavItem to="/groups" icon={<Icons.Users className="w-6 h-6" />} label="Grupos" />
            
            <div className="relative -top-5">
              <button 
                onClick={() => navigate('/groups/new')}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 shadow-lg shadow-purple-500/30 flex items-center justify-center text-white hover:scale-105 transition-transform active:scale-95 border-4 border-slate-50 dark:border-slate-900"
              >
                <Icons.Plus className="w-7 h-7" />
              </button>
            </div>

            <NavItem to="/activity" icon={<Icons.Receipt className="w-6 h-6" />} label="Extrato" />
            <NavItem to="/profile" icon={<Icons.Settings className="w-6 h-6" />} label="Perfil" />
          </div>
        </nav>
      )}
    </div>
  );
};

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  return (
    <NavLink 
      to={to} 
      className={({ isActive }) => `
        flex flex-col items-center justify-center w-16 h-full space-y-1
        transition-colors duration-200
        ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}
      `}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
};

export default Layout;