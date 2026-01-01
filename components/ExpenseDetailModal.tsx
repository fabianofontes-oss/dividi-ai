import React, { useState } from 'react';
import { Expense, Group, User } from '../types';
import { Icons } from './ui/Icons';
import { formatCurrency } from '../core/calculations';
import { ReceiptImage } from './ui/ReceiptImage';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreContext';

interface ExpenseDetailModalProps {
  expense: Expense;
  group: Group;
  currentUser: User;
  onClose: () => void;
}

const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({ expense, group, currentUser, onClose }) => {
  const navigate = useNavigate();
  const { deleteExpense } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);

  const getMemberName = (id: string) => group.members.find(m => m.id === id)?.name || 'Desconhecido';
  
  const mainPayerId = expense.payments?.[0]?.userId;
  const payer = group.members.find(m => m.id === mainPayerId);
  const isMultiPayer = expense.payments.length > 1;

  const handleDelete = async () => {
    if (confirm("Tem certeza que deseja excluir este gasto? O valor será removido do saldo do grupo.")) {
      setIsDeleting(true);
      await deleteExpense(expense.id);
      onClose();
    }
  };

  const handleEdit = () => {
    onClose();
    navigate(`/edit-expense/${expense.id}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-10 duration-300 max-h-[90vh] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10 transition-colors">
          <h3 className="font-semibold text-slate-900 dark:text-slate-200">Detalhes do Gasto</h3>
          <div className="flex items-center space-x-1">
            <button onClick={handleEdit} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400" title="Editar">
              <Icons.Settings className="w-5 h-5" />
            </button>
            <button onClick={handleDelete} className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500" title="Excluir">
              {isDeleting ? <Icons.Repeat className="w-5 h-5 animate-spin"/> : <Icons.Trash2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 ml-2">
              <Icons.X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          
          {/* Main Info */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400">
              {expense.category === 'food' && <Icons.Utensils className="w-8 h-8" />}
              {expense.category === 'transport' && <Icons.Car className="w-8 h-8" />}
              {expense.category === 'other' && <Icons.Receipt className="w-8 h-8" />}
              {expense.category === 'utilities' && <Icons.Zap className="w-8 h-8" />}
              {expense.category === 'accommodation' && <Icons.Bed className="w-8 h-8" />}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{expense.description}</h2>
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">{formatCurrency(expense.amount)}</p>
            <p className="text-sm text-slate-500 mt-2">
              Pago por <span className="text-slate-700 dark:text-slate-300 font-medium">{payer?.name}{isMultiPayer ? ` +${expense.payments.length - 1}` : ''}</span> em {new Date(expense.date).toLocaleDateString()}
            </p>
          </div>

          {/* Receipt Preview */}
          {expense.receiptId || expense.receiptUrl ? (
             <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 relative group cursor-pointer">
                <div className="h-48 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                   <ReceiptImage receiptId={expense.receiptId} receiptUrl={expense.receiptUrl} className="w-full h-full object-contain" />
                </div>
             </div>
          ) : (
            <div className="flex items-center justify-center py-4 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl text-slate-500 text-sm">
                <Icons.FileText className="w-4 h-4 mr-2" />
                Sem comprovante anexado
            </div>
          )}

          {/* Split Details */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Divisão</h4>
            <div className="space-y-2">
              {expense.splits.map((split, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] text-slate-600 dark:text-slate-400">
                      {getMemberName(split.userId).substring(0,2)}
                    </div>
                    <span className="text-slate-700 dark:text-slate-300">{getMemberName(split.userId)}</span>
                  </div>
                  <span className="text-slate-500 dark:text-slate-400">{formatCurrency(split.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Log / Contestação */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/5">
             <div className="flex justify-between items-center mb-4">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico & Contestação</h4>
               <button className="text-xs text-rose-500 dark:text-rose-400 font-bold flex items-center hover:underline">
                 <Icons.AlertCircle className="w-3 h-3 mr-1" />
                 Contestar
               </button>
             </div>

             <div className="space-y-4 pl-2 border-l border-slate-200 dark:border-slate-800">
                {/* Creation Log */}
                <div className="relative">
                  <div className="absolute -left-[13px] top-1 w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600 ring-4 ring-white dark:ring-slate-900"></div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold text-slate-700 dark:text-slate-300">{payer?.name}</span> criou este gasto.
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-600">{new Date(expense.date).toLocaleString()}</p>
                </div>
                
                {/* History */}
                {expense.history?.map((h, i) => (
                   <div key={i} className="relative pt-2">
                      <div className="absolute -left-[13px] top-3 w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-600 ring-4 ring-white dark:ring-slate-900"></div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{getMemberName(h.userId)}</span> {h.action === 'edited' ? 'editou o valor' : h.action === 'deleted' ? 'excluiu o gasto' : 'comentou'}:
                      </p>
                      {h.details && <p className="text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg mt-1 border border-slate-200 dark:border-slate-700">{h.details}</p>}
                      <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">{new Date(h.timestamp).toLocaleString()}</p>
                   </div>
                ))}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ExpenseDetailModal;