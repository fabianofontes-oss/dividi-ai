import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { Icons } from '../components/ui/Icons';

const GroupsList: React.FC = () => {
  const navigate = useNavigate();
  const { groups, isLoadingData } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pb-24 animate-in fade-in duration-300">
      <div className="sticky top-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-white/5 p-4 z-10 space-y-4">
         <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold dark:text-white">Meus Grupos</h1>
            <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-full">{isLoadingData ? '...' : groups.length}</span>
         </div>
         
         <div className="relative">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar grupo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 dark:text-white transition-all"
            />
         </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoadingData ? (
             // Skeleton
             [1,2,3].map(i => (
                 <div key={i} className="h-20 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
             ))
        ) : filteredGroups.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20 opacity-70">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                 <Icons.Users className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-slate-900 dark:text-white font-bold text-lg">Nenhum grupo aqui</p>
              <p className="text-slate-500 text-sm mt-1 max-w-[200px] text-center">Crie um grupo para começar a dividir despesas.</p>
              {groups.length === 0 && (
                <button onClick={() => navigate('/groups/new')} className="mt-6 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 hover:scale-105 transition-transform">
                    Criar meu primeiro grupo
                </button>
              )}
           </div>
        ) : (
           filteredGroups.map(group => (
            <div 
                key={group.id}
                onClick={() => navigate(`/group/${group.id}`)}
                className="group relative overflow-hidden p-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 hover:border-purple-300 dark:hover:bg-slate-800/80 transition-all active:scale-[0.98] cursor-pointer shadow-sm flex items-center space-x-4"
            >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm ${
                    group.type === 'trip' ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400' :
                    group.type === 'home' ? 'bg-orange-50 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400' :
                    group.type === 'couple' ? 'bg-pink-50 text-pink-500 dark:bg-pink-500/20 dark:text-pink-400' :
                    'bg-purple-50 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400'
                }`}>
                    {group.type === 'trip' && <Icons.Car className="w-6 h-6" />}
                    {group.type === 'home' && <Icons.Home className="w-6 h-6" />}
                    {group.type === 'event' && <Icons.Music className="w-6 h-6" />}
                    {group.type === 'couple' && <Icons.Heart className="w-6 h-6" />}
                    {group.type === 'other' && <Icons.Zap className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{group.name}</h3>
                    <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1 space-x-2">
                        <span>{group.members.length} membros</span>
                        {group.currency !== 'BRL' && <span className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-[10px] font-bold">{group.currency}</span>}
                    </div>
                </div>
                <Icons.ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            </div>
           ))
        )}
      </div>
      
      {/* Floating Action Button for easy creation */}
      {filteredGroups.length > 0 && (
        <button 
            onClick={() => navigate('/groups/new')}
            className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full text-white shadow-lg shadow-purple-500/30 flex items-center justify-center hover:scale-105 transition-transform z-30 active:scale-95"
        >
            <Icons.Plus className="w-8 h-8" />
        </button>
      )}
    </div>
  );
};

export default GroupsList;