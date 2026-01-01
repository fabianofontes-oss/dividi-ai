import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Expense, Debt } from '../types';
import { Icons } from '../components/ui/Icons';
import { calculateGroupDebts, formatCurrency } from '../core/calculations';
import ExpenseDetailModal from '../components/ExpenseDetailModal';
import { useStore } from '../store/StoreContext';
import { copyToClipboard } from '../core/pix';
import { ReceiptImage } from '../components/ui/ReceiptImage';
import { resolvePaymentHandle } from '../core/paymentRails';

const GroupDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { groups, expenses, templates, currentUser, addTemplate, createExpenseFromTemplate, settleDebt, confirmPayment, isLoadingAuth, isLoadingData } = useStore();

  const group = groups.find(g => g.id === id);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'templates' | 'gallery' | 'info'>('expenses');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [activeDebt, setActiveDebt] = useState<Debt | null>(null);

  const groupExpenses = useMemo(() => expenses.filter(e => e.groupId === id && !e.deletedAt).sort((a,b) => b.date.localeCompare(a.date)), [expenses, id]);
  const debts = useMemo(() => group ? calculateGroupDebts(group, groupExpenses) : [], [group, groupExpenses]);
  const groupTemplates = templates.filter(t => t.groupId === id);
  const images = groupExpenses.filter(e => e.receiptUrl || e.receiptId);

  // Evita flash de erro durante carregamento inicial
  if (!group) {
      if (isLoadingAuth || isLoadingData) {
          return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 space-y-4 animate-pulse">
               <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-3xl w-full"></div>
               <div className="flex space-x-2">
                   <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg flex-1"></div>
                   <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg flex-1"></div>
                   <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg flex-1"></div>
               </div>
               <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
               <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
               <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl w-full"></div>
            </div>
          );
      }
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-slate-500">
            <Icons.AlertCircle className="w-12 h-12 mb-2 text-slate-300"/>
            <p>Grupo não encontrado ou acesso negado.</p>
            <button onClick={() => navigate('/')} className="mt-4 text-purple-600 font-bold">Voltar ao Início</button>
        </div>
      );
  }

  const getMember = (uid: string) => group.members.find(m => m.id === uid);

  const getPaymentInfo = (userId: string) => {
    const member = getMember(userId);
    if (!member) return { key: '', label: 'Desconhecido', actionLabel: 'Pagar', qr: false };
    const handle = resolvePaymentHandle(member, group.currency);
    if (handle) {
      return {
        key: handle.value,
        label: `${handle.rail.name} (${handle.rail.countryCode})`,
        actionLabel: `Já paguei no ${handle.rail.name}`,
        qr: handle.rail.supportsQr
      };
    }
    return { key: '', label: 'Dados não cadastrados', actionLabel: 'Pagar', qr: false };
  };

  const paymentInfo = activeDebt ? getPaymentInfo(activeDebt.to) : null;
  const getQrCodeUrl = (data: string) => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;

  return (
    <div className="pb-20 relative min-h-screen bg-slate-50 dark:bg-slate-950">
       {/* Header */}
       <div className="h-44 bg-slate-900 relative overflow-hidden flex items-end p-4 shadow-lg z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-slate-900 to-slate-950 opacity-90" />
          
          {/* Cover decorative */}
          <div className="absolute right-0 top-0 w-48 h-48 bg-purple-600 rounded-full blur-[80px] opacity-30 -translate-y-10 translate-x-10 pointer-events-none"></div>

          <button onClick={() => navigate('/')} className="absolute top-safe-top left-4 p-2 bg-black/20 backdrop-blur-sm rounded-full text-white hover:bg-black/30 transition-colors mt-2"><Icons.ChevronLeft/></button>
          
          <button onClick={() => navigate(`/group/${id}/settings`)} className="absolute top-safe-top right-4 p-2 bg-black/20 backdrop-blur-sm rounded-full text-white hover:bg-black/30 transition-colors mt-2">
            <Icons.Settings className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex justify-between w-full items-end pb-1">
             <div>
               <h1 className="text-2xl font-bold text-white tracking-tight">{group.name}</h1>
               <div className="flex items-center space-x-3 mt-2">
                  <span className="bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-medium text-white flex items-center">
                     <Icons.Users className="w-3 h-3 mr-1.5 opacity-70"/> {group.members.length}
                  </span>
                  <span className="bg-purple-500/20 backdrop-blur-sm border border-purple-500/30 px-2 py-1 rounded-lg text-xs font-bold text-purple-200">
                     {group.currency}
                  </span>
               </div>
             </div>
          </div>
       </div>

       {/* Tabs */}
       <div className="flex border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur z-20 shadow-sm overflow-x-auto no-scrollbar">
          {[
              { id: 'expenses', label: 'Gastos' },
              { id: 'balances', label: 'Acerto' },
              { id: 'info', label: 'Info' },
              { id: 'templates', label: 'Fixos' },
              { id: 'gallery', label: 'Fotos' }
          ].map(tab => (
             <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)} 
                className={`flex-1 min-w-[70px] py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === tab.id ? 'border-purple-600 text-purple-600 dark:text-purple-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
             >
                {tab.label}
             </button>
          ))}
       </div>

       <div className="p-4 min-h-[50vh]">
          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && (
             <div className="space-y-4 animate-in slide-in-from-left duration-300">
                {groupExpenses.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-16 opacity-70">
                       <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                           <Icons.Receipt className="w-10 h-10 text-slate-300 dark:text-slate-600"/>
                       </div>
                       <p className="text-slate-500 font-medium">Nenhum gasto ainda</p>
                       <p className="text-xs text-slate-400 mt-1">Toque no + para adicionar a primeira conta.</p>
                   </div>
                )}
                {groupExpenses.map(e => (
                   <div key={e.id} onClick={() => setSelectedExpense(e)} className="flex justify-between items-center py-4 border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 -mx-2 px-3 rounded-xl transition-colors">
                      <div className="flex items-center space-x-4">
                         <div className={`p-3 rounded-2xl ${e.kind === 'settlement' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            {e.kind === 'settlement' ? <Icons.Check className="w-5 h-5"/> : <Icons.Receipt className="w-5 h-5"/>}
                         </div>
                         <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{e.description}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                {e.kind === 'settlement' ? 'Pagamento' : <span className="flex items-center"><span className="font-bold mr-1">{getMember(e.payments[0]?.userId)?.name.split(' ')[0]}</span> pagou</span>}
                            </p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className={`font-bold text-sm ${e.kind === 'settlement' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{formatCurrency(e.amount, group.currency)}</p>
                         <p className="text-[10px] text-slate-400 mt-0.5">{new Date(e.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</p>
                      </div>
                   </div>
                ))}
             </div>
          )}

          {/* BALANCES TAB */}
          {activeTab === 'balances' && (
             <div className="space-y-6 animate-in slide-in-from-right duration-300">
                {groupExpenses.filter(e => e.kind === 'settlement' && e.status === 'pending').length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Confirmação Pendente</h3>
                        {groupExpenses.filter(e => e.kind === 'settlement' && e.status === 'pending').map(e => (
                        <div key={e.id} className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/30 flex justify-between items-center">
                            <div>
                                <p className="text-amber-800 dark:text-amber-400 font-bold text-sm">{getMember(e.payments[0].userId)?.name} diz que pagou</p>
                                <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-1">{formatCurrency(e.amount, group.currency)} para {getMember(e.splits[0].userId)?.name}</p>
                            </div>
                            {e.splits[0].userId === currentUser.id && (
                                <button onClick={() => confirmPayment(e.id)} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors">Confirmar</button>
                            )}
                        </div>
                        ))}
                    </div>
                )}

                <div className="space-y-3">
                   {debts.length === 0 && (
                       <div className="flex flex-col items-center justify-center py-10">
                           <div className="w-32 h-32 bg-emerald-50 dark:bg-emerald-900/10 rounded-full flex items-center justify-center mb-4 border border-emerald-100 dark:border-emerald-800/30">
                               <Icons.Check className="w-16 h-16 text-emerald-400 dark:text-emerald-600"/>
                           </div>
                           <h3 className="font-bold text-emerald-700 dark:text-emerald-400 text-lg">Tudo Quitado!</h3>
                           <p className="text-emerald-600/70 dark:text-emerald-500/70 text-sm">Ninguém deve nada a ninguém.</p>
                       </div>
                   )}
                   {debts.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                         <div className="flex items-center space-x-3">
                             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">
                                {getMember(d.from)?.name.substring(0,2).toUpperCase()}
                             </div>
                             <div className="text-sm flex flex-col">
                               <span className="font-bold text-slate-700 dark:text-slate-200">{getMember(d.from)?.name}</span>
                               <span className="text-xs text-slate-400">deve para <strong className="text-slate-600 dark:text-slate-400">{getMember(d.to)?.name}</strong></span>
                             </div>
                         </div>
                         <div className="text-right flex flex-col items-end">
                            <p className="font-bold text-slate-900 dark:text-white text-base">{formatCurrency(d.amount, group.currency)}</p>
                            
                            {d.from === currentUser.id && (
                               <button onClick={() => setActiveDebt(d)} className="mt-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold transition-colors shadow-sm">Pagar</button>
                            )}

                            {d.to === currentUser.id && (
                               <button onClick={() => setActiveDebt(d)} className="mt-2 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg font-bold flex items-center border border-purple-200 dark:border-purple-800/50">
                                 <Icons.QrCode className="w-3 h-3 mr-1"/> Cobrar
                               </button>
                            )}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {/* INFO TAB */}
          {activeTab === 'info' && (
             <div className="space-y-6 animate-in slide-in-from-right duration-300">
                {/* Stats */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider mb-1">Total Gasto</p>
                    <p className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(groupExpenses.reduce((acc, e) => acc + e.amount, 0), group.currency)}
                    </p>
                    <p className="text-xs text-slate-400 mt-2">{groupExpenses.length} lançamentos</p>
                </div>

                {/* Members */}
                <div>
                    <div className="flex items-center justify-between mb-3 px-1">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">Membros</h3>
                        <button onClick={() => navigate(`/group/${id}/settings`)} className="text-xs font-bold text-purple-600 dark:text-purple-400">
                            Gerenciar
                        </button>
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                        {group.members.map(m => (
                            <div key={m.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
                                        {m.name.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">{m.name}</p>
                                        <p className="text-xs text-slate-500">{m.id === currentUser.id ? 'Você' : 'Membro'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Invite */}
                 <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Convidar amigos</h3>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Chame mais gente para o grupo.</p>
                    </div>
                    <button 
                        onClick={() => {
                             const text = `Vem pro meu grupo "${group.name}" no dividi.ai!`;
                             window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                        className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-md transition-all"
                    >
                        <Icons.Share2 className="w-5 h-5" />
                    </button>
                </div>
             </div>
          )}

          {/* TEMPLATES TAB */}
          {activeTab === 'templates' && (
             <div className="space-y-4 animate-in slide-in-from-right duration-300">
                <button 
                  onClick={() => {
                     const desc = prompt("Nome do gasto (ex: Aluguel):");
                     if(desc) addTemplate({ id: Math.random().toString(), groupId: id!, description: desc, category: 'utilities', paidBy: currentUser.id, splitWith: group.members.map(m=>m.id), splitMode: 'equal' });
                  }} 
                  className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 font-bold flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <Icons.Plus className="mr-2"/> Novo Gasto Fixo
                </button>
                {groupTemplates.map(t => (
                   <div key={t.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                      <div>
                         <h3 className="font-bold text-slate-900 dark:text-white">{t.description}</h3>
                         <p className="text-xs text-slate-500 mt-1">{t.defaultAmount ? formatCurrency(t.defaultAmount, group.currency) : 'Valor Variável'} • Mensal</p>
                      </div>
                      <button onClick={() => createExpenseFromTemplate(t)} className="p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors">
                         <Icons.Play className="w-5 h-5"/>
                      </button>
                   </div>
                ))}
             </div>
          )}

          {/* GALLERY TAB */}
          {activeTab === 'gallery' && (
             <div className="grid grid-cols-3 gap-1 animate-in slide-in-from-right duration-300">
                {images.map(img => (
                   <div key={img.id} onClick={() => setSelectedExpense(img)} className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden relative cursor-pointer group">
                      <ReceiptImage receiptId={img.receiptId} receiptUrl={img.receiptUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                          <p className="text-[10px] text-white truncate font-medium">{img.description}</p>
                      </div>
                   </div>
                ))}
                {images.length === 0 && (
                    <div className="col-span-3 py-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Icons.Image className="w-8 h-8 text-slate-300 dark:text-slate-600"/>
                        </div>
                        <p className="text-slate-500 text-sm">Sem fotos de recibos.</p>
                    </div>
                )}
             </div>
          )}
       </div>

       {/* FAB */}
       {activeTab === 'expenses' && (
          <button onClick={() => navigate(`/add-expense/${id}`)} className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full text-white shadow-lg shadow-purple-500/30 flex items-center justify-center hover:scale-105 transition-transform active:scale-95 z-30">
             <Icons.Plus className="w-8 h-8"/>
          </button>
       )}

       {/* MODALS */}
       {selectedExpense && (
         <ExpenseDetailModal expense={selectedExpense} group={group} currentUser={currentUser} onClose={() => setSelectedExpense(null)} />
       )}

       {activeDebt && paymentInfo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 relative animate-in zoom-in-95 duration-200 shadow-2xl">
               <button onClick={() => setActiveDebt(null)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-10">
                  <Icons.X className="w-5 h-5"/>
               </button>

               {/* Case 1: I am Paying */}
               {activeDebt.from === currentUser.id && (
                  <>
                     <h3 className="font-bold text-lg dark:text-white mb-4">Pagar {getMember(activeDebt.to)?.name}</h3>
                     <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl mb-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 uppercase flex items-center mb-2 font-bold tracking-wider">
                           <Icons.Zap className="w-3 h-3 mr-1" />
                           {paymentInfo.label}
                        </p>
                        <div className="flex items-center justify-between">
                           <p className={`font-mono font-bold text-slate-900 dark:text-white truncate pr-2 ${paymentInfo.key.length > 25 ? 'text-xs whitespace-pre-wrap' : 'text-base'}`}>
                           {paymentInfo.key || 'Dados não cadastrados'}
                           </p>
                           {paymentInfo.key && (
                             <button onClick={() => { copyToClipboard(paymentInfo.key || ''); alert('Copiado!'); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
                               <Icons.Copy className="w-4 h-4 text-purple-600"/>
                             </button>
                           )}
                        </div>
                        {!paymentInfo.key && (
                        <p className="text-[10px] text-rose-500 mt-2 font-medium">Peça para o amigo cadastrar este método no perfil dele.</p>
                        )}
                     </div>
                     <div className="text-center py-4">
                        <p className="text-sm text-slate-500 mb-1">Valor a pagar</p>
                        <p className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{formatCurrency(activeDebt.amount, group.currency)}</p>
                     </div>
                     
                     <button onClick={() => { settleDebt(activeDebt, id!); setActiveDebt(null); }} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold mb-3 shadow-lg shadow-emerald-500/20 transition-all">
                        {paymentInfo.actionLabel}
                     </button>
                     <button onClick={() => setActiveDebt(null)} className="w-full py-3 text-slate-500 font-medium">Cancelar</button>
                  </>
               )}

               {/* Case 2: I am Receiving */}
               {activeDebt.to === currentUser.id && (
                   <div className="flex flex-col items-center pt-2">
                       <h3 className="font-bold text-lg dark:text-white mb-1">Cobrar {getMember(activeDebt.from)?.name}</h3>
                       
                       {paymentInfo.qr && paymentInfo.key ? (
                           <>
                               <p className="text-sm text-slate-500 mb-6">Mostre o QR Code para receber</p>
                               <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-200 mb-6">
                                   <img 
                                     src={getQrCodeUrl(paymentInfo.key)} 
                                     alt="QR Code" 
                                     className="w-48 h-48 mix-blend-multiply" 
                                   />
                               </div>
                           </>
                       ) : (
                           <div className="my-6 text-center w-full">
                               <p className="text-sm text-slate-500 mb-2">Seus dados para receber:</p>
                               <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl font-mono text-sm break-all text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                                   {paymentInfo.key || 'Dados não cadastrados. Vá ao perfil.'}
                               </div>
                           </div>
                       )}

                       <p className="text-4xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">{formatCurrency(activeDebt.amount, group.currency)}</p>

                       {paymentInfo.key && (
                           <button onClick={() => { copyToClipboard(paymentInfo.key || ''); alert('Copiado!'); }} className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg shadow-purple-500/20 transition-all">
                               <Icons.Copy className="w-4 h-4" />
                               <span>Copiar {paymentInfo.label}</span>
                           </button>
                       )}
                   </div>
               )}
            </div>
         </div>
       )}
    </div>
  );
};
export default GroupDetail;