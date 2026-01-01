import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SplitMode, Payment, Expense, ReceiptItem } from '../types';
import { Icons } from '../components/ui/Icons';
import { formatCurrency } from '../core/calculations';
import { useStore } from '../store/StoreContext';
import { buildSplits } from '../core/splits';
import { receiptsDb } from '../storage/receiptsDb';

const AddExpense: React.FC = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { groups, currentUser, addExpense, expenses } = useStore();
  const group = groups.find(g => g.id === groupId);

  // Wizard Steps: 1=Details, 2=Payers, 3=Splits
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  // Data
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [category, setCategory] = useState<any>('food');
  
  // Storage (CR-3)
  const [receiptBlob, setReceiptBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Payers
  const [payers, setPayers] = useState<Payment[]>([]);
  const [multiPayer, setMultiPayer] = useState(false);

  // Splits
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, number>>({});

  // Itemized Split Data (Premium)
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [isItemizedMode, setIsItemizedMode] = useState(false);
  const [serviceFeePercent, setServiceFeePercent] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (group) {
      setPayers([{ userId: currentUser.id, amount: 0 }]);
      setParticipantIds(group.members.map(m => m.id));
      const defaults: Record<string, number> = {};
      group.members.forEach(m => defaults[m.id] = 1);
      setManualValues(defaults);
    }
  }, [group, currentUser]);

  // Clean up preview URL
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }
  }, [previewUrl]);

  if (!group) return <div>Grupo não encontrado</div>;

  // Currency Symbol Logic
  const currencySymbol = 
    group.currency === 'BRL' ? 'R$' : 
    group.currency === 'EUR' ? '€' : 
    group.currency === 'GBP' ? '£' : 
    group.currency === 'INR' ? '₹' : '$';

  const totalAmount = parseFloat(amountStr.replace(',', '.') || '0');

  const handleRepeatLast = () => {
    const last = expenses.filter(e => e.groupId === groupId && e.kind === 'expense')[0];
    if (last) {
      setDescription(last.description + ' (Cópia)');
      setCategory(last.category);
      setSplitMode(last.splitMode);
      setAmountStr(last.amount.toString());
      setPayers(last.payments);
      const pIds = last.splits.map(s => s.userId);
      setParticipantIds(pIds);
      if (last.items && last.items.length > 0) {
          // Clone items with new IDs
          setItems(last.items.map(i => ({...i, id: Math.random().toString()})));
          setIsItemizedMode(true);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setReceiptBlob(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  useEffect(() => {
    if (!multiPayer && payers.length > 0) {
      setPayers([{ userId: payers[0].userId, amount: totalAmount }]);
    }
  }, [totalAmount, multiPayer]);

  // Recalculate totals based on Items if in itemized mode
  useEffect(() => {
    if (isItemizedMode && items.length > 0) {
        const itemsSum = items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        // Add service fee
        const totalWithService = itemsSum * (1 + (serviceFeePercent/100));
        setAmountStr(totalWithService.toFixed(2));
    }
  }, [items, isItemizedMode, serviceFeePercent]);

  // Toggle User Assignment for an Item
  const toggleItemAssignment = (itemId: string, userId: string) => {
      setItems(prev => prev.map(item => {
          if (item.id !== itemId) return item;
          const assigned = item.assignedTo.includes(userId)
             ? item.assignedTo.filter(id => id !== userId)
             : [...item.assignedTo, userId];
          return { ...item, assignedTo: assigned };
      }));
  };

  // Lógica centralizada no core/splits
  const splits = buildSplits({
    total: totalAmount,
    users: group.members,
    participantIds,
    mode: isItemizedMode ? 'itemized' : splitMode,
    values: manualValues,
    items: isItemizedMode ? items : undefined,
    serviceFeePercent: isItemizedMode ? serviceFeePercent : 0
  });

  const payerTotal = payers.reduce((acc, p) => acc + p.amount, 0);
  const splitTotal = splits.reduce((acc, s) => acc + s.amount, 0);
  const isValid = Math.abs(payerTotal - totalAmount) < 0.05 && Math.abs(splitTotal - totalAmount) < 0.05;

  const handleSave = async () => {
    if (!isValid || !description) return alert("Verifique valores e descrição.");
    setIsSaving(true);
    
    let receiptId = undefined;
    if (receiptBlob) {
        try {
            receiptId = await receiptsDb.saveReceipt(receiptBlob);
        } catch(e) {
            console.error("Failed to save receipt", e);
        }
    }

    const expense: Expense = {
      id: '',
      groupId: group.id,
      description,
      amount: totalAmount,
      date,
      category,
      kind: 'expense',
      status: 'confirmed',
      payments: payers,
      splits,
      splitMode: isItemizedMode ? 'itemized' : splitMode,
      items: isItemizedMode ? items : undefined,
      receiptId, 
      history: []
    };
    
    await addExpense(expense);
    navigate(-1);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="px-4 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0 z-20">
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
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right">
             <div onClick={() => fileRef.current?.click()} className={`h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer ${previewUrl ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 dark:border-slate-700'}`}>
               <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
               {previewUrl ? <div className="text-emerald-600 font-bold text-sm flex items-center"><Icons.Check className="mr-1"/> Comprovante OK</div> :
                <span className="text-slate-400 text-sm flex items-center"><Icons.Camera className="mr-2"/> 
                  Anexar Comprovante
                </span>
               }
             </div>
             
             {/* ITEMIZED TOGGLE */}
             {items.length > 0 && (
                 <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-800/30">
                     <div className="flex items-center space-x-2">
                         <Icons.Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                         <div>
                             <p className="text-sm font-bold text-purple-900 dark:text-purple-100">Modo Detalhado</p>
                             <p className="text-[10px] text-purple-600 dark:text-purple-300">Dividir item por item</p>
                         </div>
                     </div>
                     <button 
                        onClick={() => setIsItemizedMode(!isItemizedMode)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${isItemizedMode ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                     >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isItemizedMode ? 'translate-x-6' : 'translate-x-0'}`} />
                     </button>
                 </div>
             )}

             {isItemizedMode ? (
                 <div className="space-y-4">
                     <div className="flex items-center justify-between">
                         <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase">Lista de Itens</h3>
                         <button 
                             onClick={() => {
                                 const name = prompt("Nome do item:");
                                 const price = parseFloat(prompt("Valor:") || '0');
                                 if (name && price) {
                                     setItems([...items, { id: Math.random().toString(), name, price, quantity: 1, assignedTo: [] }]);
                                 }
                             }}
                             className="text-xs text-purple-600 font-bold flex items-center"
                         >
                             <Icons.Plus className="w-3 h-3 mr-1"/> Add Item
                         </button>
                     </div>
                     
                     <div className="space-y-3">
                         {items.map(item => (
                             <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl">
                                 <div className="flex justify-between items-center mb-2">
                                     <div>
                                         <p className="font-bold text-sm dark:text-white">{item.name}</p>
                                         <p className="text-xs text-slate-400">{item.quantity}x {formatCurrency(item.price, group.currency)}</p>
                                     </div>
                                     <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.price * item.quantity, group.currency)}</p>
                                 </div>
                                 
                                 {/* Avatar Selector Row */}
                                 <div className="flex space-x-2 overflow-x-auto pb-1 no-scrollbar">
                                     {group.members.map(m => {
                                         const isSelected = item.assignedTo.includes(m.id);
                                         return (
                                             <button 
                                                key={m.id}
                                                onClick={() => toggleItemAssignment(item.id, m.id)}
                                                className={`flex-shrink-0 flex items-center space-x-1 px-2 py-1 rounded-full border transition-all ${isSelected ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 grayscale'}`}
                                             >
                                                 <div className="w-4 h-4 rounded-full bg-current opacity-20"/>
                                                 <span className="text-[10px] font-bold">{m.name.split(' ')[0]}</span>
                                             </button>
                                         )
                                     })}
                                 </div>
                             </div>
                         ))}
                     </div>

                     <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
                         <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Taxa de Serviço (%)</span>
                         <input 
                            type="number" 
                            value={serviceFeePercent} 
                            onChange={(e) => setServiceFeePercent(Number(e.target.value))}
                            className="w-16 bg-white dark:bg-slate-900 rounded-lg p-1 text-center font-bold text-sm outline-none"
                         />
                     </div>
                 </div>
             ) : (
                 <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Valor Total</label>
                        <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currencySymbol}</span>
                        <input type="number" value={amountStr} onChange={e => setAmountStr(e.target.value)} className="w-full text-3xl font-bold p-4 pl-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-purple-500 dark:text-white" placeholder="0.00" />
                        </div>
                    </div>
                </div>
             )}
             
             <div className="space-y-4">
               <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Descrição</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:border-purple-500 dark:text-white" placeholder="Ex: Mercado" />
                  <button onClick={handleRepeatLast} className="text-xs text-purple-600 font-bold mt-2 hover:underline">Repetir último gasto</button>
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
             {isItemizedMode ? (
                 <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800/30 text-center">
                     <p className="font-bold text-purple-800 dark:text-purple-200">Divisão Itemizada Ativa</p>
                     <p className="text-xs text-purple-600 dark:text-purple-300">Os valores foram calculados com base nos itens selecionados.</p>
                 </div>
             ) : (
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                    {['equal', 'percentage', 'shares', 'exact'].map(m => (
                    <button key={m} onClick={() => setSplitMode(m as any)} className={`flex-1 py-2 text-[10px] uppercase font-bold rounded ${splitMode === m ? 'bg-white dark:bg-slate-800 shadow text-purple-600' : 'text-slate-400'}`}>
                        {m === 'percentage' ? '%' : m === 'shares' ? 'Cotas' : m === 'exact' ? currencySymbol : 'Igual'}
                    </button>
                    ))}
                </div>
             )}

             {/* Render Splits simplified */}
             <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 mt-4">
                 {splits.map(s => {
                     const member = group.members.find(m => m.id === s.userId);
                     if (!member || s.amount === 0) return null;
                     return (
                         <div key={s.userId} className="flex justify-between p-3 text-sm">
                             <span className="text-slate-700 dark:text-slate-300">{member.name}</span>
                             <span className="font-bold dark:text-white">{formatCurrency(s.amount, group.currency)}</span>
                         </div>
                     )
                 })}
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
           {isSaving ? <Icons.Repeat className="animate-spin"/> : step === 3 ? 'Confirmar' : 'Continuar'}
         </button>
      </div>
    </div>
  );
};
export default AddExpense;