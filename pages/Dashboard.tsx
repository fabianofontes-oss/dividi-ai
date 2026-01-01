import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../components/ui/Icons';
import { calculateGroupDebts, formatCurrency } from '../core/calculations';
import { useStore } from '../store/StoreContext';
import { Expense } from '../types';

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser, groups, expenses, isLoadingData } = useStore();

    // --- CÁLCULO DE SALDO REAL (CROSS-GROUPS) ---
    const { totalOwed, totalOwes } = useMemo(() => {
        let owed = 0; // A receber
        let owes = 0; // A pagar

        if (!currentUser || groups.length === 0) return { totalOwed: 0, totalOwes: 0 };

        groups.forEach(group => {
            // Filtra despesas deste grupo
            const groupExpenses = expenses.filter(e => e.groupId === group.id && !e.deletedAt);
            // Calcula dívidas deste grupo
            const debts = calculateGroupDebts(group, groupExpenses);

            debts.forEach(debt => {
                if (debt.to === currentUser.id) {
                    // Alguém deve para mim
                    owed += debt.amount;
                } else if (debt.from === currentUser.id) {
                    // Eu devo para alguém
                    owes += debt.amount;
                }
            });
        });

        return { totalOwed: owed, totalOwes: owes };
    }, [groups, expenses, currentUser]);

    // --- ATIVIDADES RECENTES ---
    const recentActivity = useMemo(() => {
        if (!currentUser) return [];
        return expenses
            .filter(e => !e.deletedAt)
            .sort((a, b) => b.date.localeCompare(a.date) || (b.id || '').localeCompare(a.id || ''))
            .slice(0, 5); // Apenas as 5 últimas
    }, [expenses, currentUser]);

    const recentGroups = groups.slice(0, 3);

    const getGroupName = (id: string) => groups.find(g => g.id === id)?.name || 'Grupo';

    const getMemberName = (userId: string, groupId: string) => {
        if (userId === currentUser?.id) return 'Você';
        const group = groups.find(g => g.id === groupId);
        return group?.members.find(m => m.id === userId)?.name.split(' ')[0] || 'Alguém';
    };

    const formatActivityDate = (isoDate: string) => {
        const date = new Date(isoDate);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return `Hoje, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        if (days === 1) return `Ontem, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
    };

    const getActivityText = (e: Expense) => {
        const payerName = getMemberName(e.payments[0]?.userId, e.groupId);

        if (e.kind === 'settlement') {
            const receiverId = e.splits[0]?.userId;
            const receiverName = receiverId === currentUser?.id ? 'você' : getMemberName(receiverId, e.groupId).toLowerCase();
            return (
                <>
                    <span className="font-semibold text-slate-900 dark:text-white">{payerName}</span> pagou <span className="text-slate-900 dark:text-white">{receiverName}</span>
                </>
            );
        }
        return (
            <>
                <span className="font-semibold text-slate-900 dark:text-white">{payerName}</span> adicionou <span className="text-slate-900 dark:text-white">{e.description}</span>
            </>
        );
    };

    if (isLoadingData) {
        return (
            <div className="p-4 pt-8 space-y-6 animate-pulse">
                <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                    <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                </div>
                <div className="space-y-3">
                    <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                    <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                </div>
            </div>
        )
    }

    // --- ZERO STATE (Sem Caverna do Dragão) ---
    if (groups.length === 0 && expenses.length === 0) {
        return (
            <div className="p-4 pt-8 min-h-screen flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-400">
                            Olá, {currentUser?.name.split(' ')[0]}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Tudo pronto para começar.</p>
                    </div>
                    <div onClick={() => navigate('/profile')} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center text-sm font-semibold text-purple-600 dark:text-purple-400 cursor-pointer">
                        {currentUser?.name.substring(0, 2).toUpperCase()}
                    </div>
                </div>

                <div onClick={() => navigate('/quick-split')} className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/20 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform mb-6">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Icons.Zap className="w-6 h-6 text-white fill-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Racha Rápido</h3>
                            <p className="text-xs text-orange-50 opacity-90">Calculadora avulsa (Sem grupo)</p>
                        </div>
                    </div>
                    <Icons.ChevronRight className="w-5 h-5 opacity-70" />
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                    <div className="w-24 h-24 bg-purple-50 dark:bg-purple-900/20 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                        <Icons.Smile className="w-12 h-12 text-purple-500 dark:text-purple-400" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nada por aqui (ainda)</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-[250px]">
                        Crie um grupo para sua viagem, república ou rolê e comece a controlar os gastos.
                    </p>
                    <button
                        onClick={() => navigate('/groups/new')}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transition-all flex items-center justify-center space-x-2"
                    >
                        <Icons.Plus className="w-5 h-5" />
                        <span>Criar Primeiro Grupo</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 pt-8 space-y-6">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-400">
                        Olá, {currentUser?.name.split(' ')[0]}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Racha sem stress.</p>
                </div>
                <div
                    onClick={() => navigate('/profile')}
                    className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-semibold text-purple-600 dark:text-purple-400 shadow-sm cursor-pointer"
                >
                    {currentUser?.name.substring(0, 2).toUpperCase()}
                </div>
            </div>

            {/* QUICK ACTIONS ROW */}
            <div onClick={() => navigate('/quick-split')} className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/20 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Icons.Zap className="w-6 h-6 text-white fill-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg leading-tight">Racha Rápido</h3>
                        <p className="text-xs text-orange-50 opacity-90">Calculadora de restaurante sem criar grupo</p>
                    </div>
                </div>
                <Icons.ChevronRight className="w-5 h-5 opacity-70" />
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-emerald-900/40 dark:to-slate-900 border border-slate-200 dark:border-emerald-500/20 shadow-sm dark:backdrop-blur-sm">
                    <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 mb-2">
                        <Icons.ArrowRight className="w-4 h-4 rotate-45" />
                        <span className="text-xs font-medium uppercase tracking-wider">A receber</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{formatCurrency(totalOwed, currentUser?.defaultCurrency)}</p>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-rose-900/40 dark:to-slate-900 border border-slate-200 dark:border-rose-500/20 shadow-sm dark:backdrop-blur-sm">
                    <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 mb-2">
                        <Icons.ArrowRight className="w-4 h-4 -rotate-45" />
                        <span className="text-xs font-medium uppercase tracking-wider">A pagar</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{formatCurrency(totalOwes, currentUser?.defaultCurrency)}</p>
                </div>
            </div>

            {/* Groups List (Preview) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Seus Grupos</h2>
                    <button onClick={() => navigate('/groups')} className="text-purple-600 dark:text-purple-400 text-sm hover:underline font-medium">Ver todos</button>
                </div>

                <div className="space-y-3">
                    {recentGroups.length === 0 && (
                        <div className="text-center py-6 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-slate-500 text-sm">Você ainda não tem grupos.</p>
                            <button onClick={() => navigate('/groups/new')} className="text-purple-600 font-bold text-sm mt-2">Criar grupo</button>
                        </div>
                    )}
                    {recentGroups.map(group => (
                        <div
                            key={group.id}
                            onClick={() => {
                                alert(`Clicando em: ${group.name} (ID: ${group.id})`);
                                console.log('[Dashboard] Clicking group:', group.id, group.name);
                                navigate(`/group/${group.id}`);
                            }}
                            className="group relative overflow-hidden p-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 hover:border-purple-300 dark:hover:bg-slate-800/80 transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                        >
                            <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm ${group.type === 'trip' ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400' :
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
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {group.type === 'home' ? 'Contas mensais' : `${group.members.length} membros`}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <Icons.ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity List (Real) */}
            <div className="space-y-4 pt-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-200">Últimas atividades</h2>
                <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-6">
                    {recentActivity.length === 0 && (
                        <div className="text-sm text-slate-400 italic flex items-center">
                            <Icons.Ghost className="w-4 h-4 mr-2 opacity-50" />
                            Nenhuma atividade recente.
                        </div>
                    )}
                    {recentActivity.map(e => (
                        <div key={e.id} className="relative" onClick={() => navigate(`/group/${e.groupId}`)}>
                            <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-slate-50 dark:border-slate-950 ${e.kind === 'settlement' ? 'bg-emerald-500 dark:bg-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                                {getActivityText(e)}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                {formatActivityDate(e.date)} • {getGroupName(e.groupId)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default Dashboard;