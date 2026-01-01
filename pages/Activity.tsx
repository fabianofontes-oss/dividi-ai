import React from 'react';
import { Icons } from '../components/ui/Icons';
import { formatCurrency } from '../utils/calculations';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext';

const Activity: React.FC = () => {
  const navigate = useNavigate();
  const { expenses, groups, currentUser } = useStore();

  const myActivity = expenses
    .filter(e => !e.deletedAt && (e.payments.some(p => p.userId === currentUser.id) || e.splits.some(s => s.userId === currentUser.id)))
    .sort((a, b) => b.date.localeCompare(a.date));

  const getGroup = (id: string) => groups.find(g => g.id === id)?.name || 'Grupo';

  return (
    <div className="pb-24">
       <div className="sticky top-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-white/5 p-4 z-10">
          <h1 className="text-xl font-bold dark:text-white">Atividade</h1>
       </div>
       
       <div className="p-4 space-y-6">
          {myActivity.map(e => {
             const isPayer = e.payments.some(p => p.userId === currentUser.id);
             const myCost = e.splits.find(s => s.userId === currentUser.id)?.amount || 0;
             
             return (
               <div key={e.id} onClick={() => navigate(`/group/${e.groupId}`)} className="flex items-start space-x-3 pb-6 border-l-2 border-slate-200 dark:border-slate-800 pl-4 relative cursor-pointer">
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-950 ${e.kind === 'settlement' ? 'bg-emerald-500' : 'bg-purple-500'}`} />
                  
                  <div className="flex-1">
                     <div className="flex justify-between items-start">
                        <div>
                           <p className="font-bold text-sm dark:text-white">{e.description}</p>
                           <p className="text-xs text-slate-500">{getGroup(e.groupId)} • {new Date(e.date).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-sm font-bold ${isPayer ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-300'}`}>
                           {isPayer ? `+${formatCurrency(e.amount)}` : `-${formatCurrency(myCost)}`}
                        </span>
                     </div>
                     <p className="text-xs text-slate-400 mt-1">
                        {e.kind === 'settlement' ? 'Pagamento realizado' : isPayer ? 'Você pagou a conta' : 'Você participou do rateio'}
                     </p>
                  </div>
               </div>
             )
          })}
          {myActivity.length === 0 && <p className="text-center text-slate-400 mt-10">Nenhuma atividade recente.</p>}
       </div>
    </div>
  );
};
export default Activity;
