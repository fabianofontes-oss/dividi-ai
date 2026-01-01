import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SplitMode, Payment } from '../types';
import { Icons } from '../components/ui/Icons';
import { formatCurrency } from '../core/calculations';
import { useStore } from '../store/StoreContext';
import { buildSplits } from '../core/splits';
import { receiptsDb } from '../storage/receiptsDb';
import { ReceiptImage } from '../components/ui/ReceiptImage';

const EditExpense: React.FC = () => {
  const { expenseId } = useParams();
  const navigate = useNavigate();
  const { groups, currentUser, editExpense, expenses } = useStore();

  const expense = expenses.find(e => e.id === expenseId);
  const group = groups.find(g => g.id === expense?.groupId);

  // Wizard Steps
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Data
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<any>('food');
  
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [existingReceiptId, setExistingReceiptId] = useState<string | undefined>(undefined);
  
  const [payers, setPayers] = useState<Payment[]>([]);
  const [multiPayer, setMultiPayer] = useState(false);

  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, number>>({});

  const fileRef = useRef<HTMLInputElement>(null);

  // Load initial data
  useEffect(() => {
    if (expense && group) {
      setDescription(expense.description);
      setAmountStr(expense.amount.toString());
      setDate(expense.date.substring(0, 10)); // YYYY-MM-DD
      setCategory(expense.category);
      setPayers(expense.payments);
      setSplitMode(expense.splitMode);
      setParticipantIds(expense.splits.map(s => s.userId));
      setExistingReceiptId(expense.receiptId);

      setMultiPayer(expense.payments.length > 1);

      // Reconstruct manual values map (needed for splits recalculation)
      const values: Record<string, number> = {};
      expense.splits.forEach(s => {
        if(s.manualValue) values[s.userId] = s.manualValue;
        // If mode is exact, amount is the manual value
        if(expense.splitMode === 'exact') values[s.userId] = s.amount;
        // If mode is percentage, we need to infer or store it. 
        // For MVP simplification in Edit, we might reset percentage to calculated amount or just use amount.
      });
      setManualValues(values);
    }
  }, [expense, group]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }
  }, [previewUrl]);

  if (!expense || !group) return <div>Despesa não encontrada</div>;

  // Currency Symbol Logic
  const currencySymbol = 
    group.currency === 'BRL' ? 'R$' : 
    group.currency === 'EUR' ? '€' : 
    group.currency === 'GBP' ? '£' : 
    group.currency === 'INR' ? '₹' : '$';

  const totalAmount = parseFloat(amountStr.replace(',', '.') || '0');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  useEffect(() => {
    // Keep single payer sync with total if not multi
    if (!multiPayer && payers.length > 0) {
       // Only update if amount changed significantly to avoid typing lag loop
       if (payers[0].amount !== totalAmount) {
         setPayers([{ userId: payers[0].userId, amount: totalAmount }]);
       }
    }
  }, [totalAmount, multiPayer]);

  const splits = buildSplits({
    total: totalAmount,
    users: group.members,
    participantIds,
    mode: splitMode,
    values: manualValues
  });

  const payerTotal = payers.reduce((acc, p) => acc + p.amount, 0);
  const splitTotal = splits.reduce((acc, s) => acc + s.amount, 0);
  const isValid = Math.abs(payerTotal - totalAmount) < 0.05 && Math.abs(splitTotal - totalAmount) < 0.05;

  const handleSave = async () => {
    if (!isValid || !description) return alert("Verifique valores e descrição.");
    setIsSaving(true);
    
    let finalReceiptId = existingReceiptId;
    
    if (receiptBlob) {
        try {
            finalReceiptId = await receiptsDb.saveReceipt(receiptBlob);
        } catch(e) {
            console.error("Failed to save receipt", e);
        }
    }

    const updatedExpense = {
      ...expense,
      description,
      amount: totalAmount,
      date,
      category,
      payments: payers,
      splits,
      splitMode,
      receiptId: finalReceiptId,
      // receiptUrl is deprecated/legacy, we rely on receiptId now
    };
    
    await editExpense(updatedExpense);
    navigate(-1);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="px-4 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-slate-900">
        <button onClick={() => step > 1 ? setStep(step-1) : navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <Icons.ChevronLeft className="w-6 h-6 text-slate-500 dark:text-slate-300" />
        </button>
        <div className="flex space-x-1">
          {[1,2,3].map(i => (
             <div key={i} className={`h-1 w-6 rounded-full ${step >= i ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
          ))}
        </div>
        <div className="w-8" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        <h2 className="text-xl font-bold mb-6 dark:text-white">Editar Gasto</h2>

        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right">
             <div onClick={() => fileRef.current?.click()} className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer overflow-hidden ${previewUrl || existingReceiptId ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-700'}`}>
               <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
               
               {previewUrl ? (
                 <img src={previewUrl} className="h-full object-contain" alt="New Receipt" />
               ) : existingReceiptId ? (
                 <ReceiptImage receiptId={existingReceiptId} className="h-full object-contain" />
               ) : (
                 <span className="text-slate-400 text-sm flex items-center"><Icons.Camera className="mr-2"/> Adicionar Comprovante</span>
               )}
             </div>
             
             <div className="space-y-4">
               <div>
                 <label className="text-xs font-bold text-slate-500 uppercase">Valor</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currencySymbol}</span>
                   <input type="number" value={amountStr} onChange={e => setAmountStr(e.target.value)} className="w-full text-3xl font-bold p-4 pl-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-purple-500 dark:text-white" placeholder="0.00" />
                 </div>
               </div>
               
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-purple-500 dark:text-white" placeholder="Ex: Mercado" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Data</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none dark:text-white" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Categoria</label>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none dark:text-white">
                      <option value="food">Alimentação</option>
                      <option value="transport">Transporte</option>
                      <option value="accommodation">Hospedagem</option>
                      <option value="entertainment">Lazer</option>
                      <option value="utilities">Contas</option>
                      <option value="other">Outros</option>
                    </select>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="space-y-4 animate-in slide-in-from-right">
             <div className="flex justify-between items-center mb-2">
               <h3 className="font-bold text-slate-900 dark:text-white">Quem pagou?</h3>
               <button onClick={() => setMultiPayer(!multiPayer)} className="text-xs text-purple-600 font-bold bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-lg">
                 {multiPayer ? 'Modo Simples' : 'Múltiplos'}
               </button>
             </div>
             
             {group.members.map(m => {
               const p = payers.find(x => x.userId === m.id);
               return (
                 <div key={m.id} 
                      onClick={() => {
                        if (multiPayer) {
                           if (p) {
                             if (payers.length > 1) setPayers(prev => prev.filter(x => x.userId !== m.id));
                           } else setPayers(prev => [...prev, { userId: m.id, amount: 0 }]);
                        } else {
                           setPayers([{ userId: m.id, amount: totalAmount }]);
                        }
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border ${p ? 'bg-white dark:bg-slate-900 border-purple-500 shadow-sm' : 'border-transparent opacity-60'}`}>
                    <div className="flex items-center space-x-3">
                       <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${p ? 'bg-purple-600 border-purple-600' : 'border-slate-400'}`}>
                         {p && <Icons.Check className="w-3 h-3 text-white"/>}
                       </div>
                       <span className="font-medium dark:text-white">{m.name}</span>
                    </div>
                    {multiPayer && p && (
                       <input 
                         type="number" 
                         onClick={e => e.stopPropagation()}
                         value={p.amount || ''}
                         onChange={e => {
                           const val = parseFloat(e.target.value) || 0;
                           setPayers(prev => prev.map(x => x.userId === m.id ? { ...x, amount: val } : x));
                         }}
                         className="w-24 text-right bg-transparent border-b border-slate-300 outline-none font-bold dark:text-white"
                         placeholder="0.00"
                       />
                    )}
                    {!multiPayer && p && <span className="font-bold dark:text-white">{formatCurrency(totalAmount, group.currency)}</span>}
                 </div>
               )
             })}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="space-y-4 animate-in slide-in-from-right">
             <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                {['equal', 'percentage', 'shares', 'exact'].map(m => (
                  <button key={m} onClick={() => setSplitMode(m as any)} className={`flex-1 py-2 text-[10px] uppercase font-bold rounded ${splitMode === m ? 'bg-white dark:bg-slate-800 shadow text-purple-600' : 'text-slate-400'}`}>
                    {m === 'percentage' ? '%' : m === 'shares' ? 'Cotas' : m === 'exact' ? currencySymbol : 'Igual'}
                  </button>
                ))}
             </div>
             
             <div className="text-right text-sm mt-4">
                <span className="text-slate-500">Restante: </span>
                <span className={`font-bold ${Math.abs(splitTotal - totalAmount) > 0.05 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {formatCurrency(totalAmount - splitTotal, group.currency)}
                </span>
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/5">
         <button 
           onClick={() => {
             if (step < 3) {
               if (step === 1 && (!amountStr || !description)) return alert("Preencha dados");
               setStep(step + 1);
             } else {
               handleSave();
             }
           }}
           disabled={isSaving}
           className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] transition-transform flex justify-center"
         >
           {isSaving ? <Icons.Repeat className="animate-spin"/> : step === 3 ? 'Salvar Alterações' : 'Continuar'}
         </button>
      </div>
    </div>
  );
};
export default EditExpense;