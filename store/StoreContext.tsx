import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { Group, User, Expense, ExpenseTemplate, Debt } from '../types';
import { LocalDataStore } from '../data/LocalDataStore';
import { SupabaseDataStore } from '../data/SupabaseDataStore';
import { supabase } from '../services/supabaseClient';

interface Notification {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface StoreContextType {
  currentUser: User | null;
  isLoadingAuth: boolean;
  isLoadingData: boolean;
  groups: Group[];
  expenses: Expense[];
  templates: ExpenseTemplate[];
  users: User[];
  notification: Notification | null;
  localImportAvailable: null | { groups: number; expenses: number };

  updateUser: (user: User) => Promise<void>;
  addGroup: (group: Group) => Promise<void>;
  updateGroup: (group: Group) => Promise<void>;
  addExpense: (expense: Expense) => Promise<void>;
  editExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  addComment: (expenseId: string, text: string) => Promise<void>;
  addTemplate: (template: ExpenseTemplate) => void;
  createExpenseFromTemplate: (template: ExpenseTemplate, amountOverride?: number) => void;
  settleDebt: (debt: Debt, groupId: string) => Promise<void>;
  confirmPayment: (expenseId: string) => void;

  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearNotification: () => void;
  refreshData: () => Promise<void>;
  importLocalData: () => Promise<void>;
  loginAsGuest: () => void;
  checkLocalImport: () => Promise<void>;
  clearLocalAfterDecision: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [localImportAvailable, setLocalImportAvailable] = useState<null | { groups: number; expenses: number }>(null);

  // === HELPERS ===
  const LOAD_TIMEOUT_MS = Number((import.meta as any).env?.VITE_LOAD_TIMEOUT_MS ?? 15000);
  const loadSeqRef = useRef(0);

  const getStore = (u: User | null) => (u && u.id !== 'guest') ? SupabaseDataStore : LocalDataStore;
  const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()));

  const resetState = () => {
    setGroups([]);
    setExpenses([]);
    setTemplates([]);
    setNotification(null);
  };

  const checkLocalImport = async () => {
    try {
      const local = await LocalDataStore.loadInitialData();
      const g = local?.groups?.length ?? 0;
      const e = local?.expenses?.length ?? 0;
      // só oferece import se tiver conteúdo real
      if (g > 0 || e > 0) setLocalImportAvailable({ groups: g, expenses: e });
      else setLocalImportAvailable(null);
    } catch {
      setLocalImportAvailable(null);
    }
  };

  // LIMPA dados locais SOMENTE quando o usuário decidir
  const clearLocalAfterDecision = async () => {
    try {
      localStorage.removeItem('dividi_db_mvp_v1');
    } catch { }
    try { indexedDB.deleteDatabase('dividi_blobs_v1'); } catch { }
    setLocalImportAvailable(null);
    showToast('Dados locais descartados', 'info');
  };

  const hardLogoutCleanup = async () => {
    localStorage.removeItem('dividi_is_guest');
    // IMPORTANTE: NÃO limpa dados locais aqui - preserva para importação
    // try { indexedDB.deleteDatabase('dividi_blobs_v1'); } catch { }
  };

  const activeStore = useMemo(() => getStore(currentUser), [currentUser]);

  // 1. Auth Init
  useEffect(() => {
    const initAuth = async () => {
      setIsLoadingAuth(true);
      try {
        const isGuest = localStorage.getItem('dividi_is_guest');
        if (isGuest === 'true') {
          const localData = await LocalDataStore.loadInitialData();
          setCurrentUser(localData.currentUser);
          setIsLoadingAuth(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          let { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();

          if (!profile) {
            const newProfile = {
              id: session.user.id,
              email: session.user.email,
              name: session.user.email?.split('@')[0] || 'Usuário',
              payment_handles: []
            };
            const { data, error } = await supabase.from('profiles').insert(newProfile).select().single();
            if (!error && data) profile = data;
            else profile = newProfile;
          }

          if (profile) {
            setCurrentUser({
              id: profile.id,
              name: profile.name,
              email: profile.email,
              paymentHandles: profile.payment_handles || []
            });
          }
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("Auth init error:", error);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('dividi_is_guest');
        setCurrentUser(null);
        resetState();
        setLocalImportAvailable(null);
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        // IMPORTANTE: NÃO delete local DB aqui.
        // Apenas desliga o flag de guest e checa se existe dado local para importar.
        localStorage.removeItem('dividi_is_guest');
        resetState();
        await initAuth();
        await checkLocalImport(); // <-- agora o banner/CTA aparece pós-login
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Load Data com proteção contra race conditions e timeout configurável
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
    ]);

  const loadData = async () => {
    const user = currentUser;

    if (!user && !isLoadingAuth) {
      setIsLoadingData(false);
      return;
    }

    const seq = ++loadSeqRef.current;
    setIsLoadingData(true);

    try {
      const store = getStore(user);
      const data: any = await withTimeout(store.loadInitialData(), LOAD_TIMEOUT_MS);

      // ignora respostas antigas (race condition protection)
      if (seq !== loadSeqRef.current) return;

      if (user) {
        setGroups(data.groups);
        setExpenses(data.expenses);
        setTemplates(data.templates);
      }
    } catch (e: any) {
      console.error("Failed to load data", e);
      if (e?.message === "Timeout") {
        showToast("A conexão está lenta. Alguns dados podem não aparecer.", "error");
      } else {
        showToast("Erro ao carregar dados.", "error");
      }
    } finally {
      if (seq === loadSeqRef.current) setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    } else if (!isLoadingAuth) {
      setIsLoadingData(false);
    }
  }, [currentUser, isLoadingAuth]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const clearNotification = () => setNotification(null);

  const users = useMemo(() => {
    const uniqueUsers = new Map<string, User>();
    if (currentUser) {
      uniqueUsers.set(currentUser.id, currentUser);
    }
    groups.forEach(g => {
      g.members.forEach(m => {
        if (!uniqueUsers.has(m.id)) {
          uniqueUsers.set(m.id, m);
        }
      });
    });
    return Array.from(uniqueUsers.values());
  }, [groups, currentUser]);

  // --- ACTIONS ---

  const loginAsGuest = () => {
    localStorage.setItem('dividi_is_guest', 'true');
    const guestUser = { id: 'guest', name: 'Visitante', paymentHandles: [] };
    setCurrentUser(guestUser);
    LocalDataStore.saveUser(guestUser);
  };

  const updateUser = async (u: User) => {
    if (!currentUser) return;
    setCurrentUser(u);
    try {
      await activeStore.saveUser(u);
      showToast("Perfil salvo");
    } catch (e) {
      showToast("Erro ao salvar perfil", "error");
    }
  };

  const addGroup = async (g: Group) => {
    // Usa ID do grupo se já existir, senão gera um novo
    const groupId = g.id || newId();
    const groupToSave = { ...g, id: groupId };
    setGroups(prev => [groupToSave, ...prev]);
    try {
      await activeStore.addGroup(groupToSave);
      await loadData();
      showToast(`Grupo "${g.name}" criado!`);
    } catch (e) {
      console.error(e);
      setGroups(prev => prev.filter(x => x.id !== groupId));
      showToast("Erro ao criar grupo", "error");
      throw e; // Re-throw para o caller tratar
    }
  };

  const updateGroup = async (updated: Group) => {
    setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
    await activeStore.updateGroup(updated);
    showToast("Grupo atualizado");
  };

  const addExpense = async (e: Expense) => {
    const tempId = e.id || newId();
    const newExpense = { ...e, id: tempId };
    setExpenses(prev => [newExpense, ...prev]);
    try {
      await activeStore.addExpense(newExpense);
      await loadData();
      showToast(e.kind === 'settlement' ? "Pagamento registrado!" : "Gasto adicionado!");
    } catch (err) {
      console.error(err);
      showToast("Erro ao salvar gasto", "error");
      setExpenses(prev => prev.filter(exp => exp.id !== tempId));
    }
  };

  const editExpense = async (updated: Expense) => {
    setExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
    await activeStore.updateExpense(updated);
    showToast("Gasto atualizado");
  };

  const deleteExpense = async (id: string) => {
    const toDelete = expenses.find(e => e.id === id);
    if (!toDelete) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    await activeStore.deleteExpense(toDelete);
    showToast("Gasto removido", "info");
  };

  const addComment = async (id: string, text: string) => {
    showToast("Comentários em breve", "info");
  };

  const addTemplate = async (t: ExpenseTemplate) => {
    setTemplates(prev => [...prev, t]);
    await activeStore.addTemplate(t);
  };

  const createExpenseFromTemplate = async (t: ExpenseTemplate, amountOverride?: number) => {
    const amount = amountOverride || t.defaultAmount || 0;
    const group = groups.find(g => g.id === t.groupId);
    if (!group) return;

    const participants = group.members.filter(m => t.splitWith.includes(m.id));
    const splitAmount = participants.length > 0 ? amount / participants.length : 0;

    const expense: Expense = {
      id: '',
      groupId: t.groupId,
      description: t.description,
      amount: amount,
      date: new Date().toISOString(),
      category: t.category,
      kind: 'expense',
      status: 'confirmed',
      splitMode: t.splitMode,
      payments: [{ userId: t.paidBy, amount }],
      splits: participants.map(p => ({ userId: p.id, amount: splitAmount })),
      history: []
    };
    await addExpense(expense);
  };

  const settleDebt = async (debt: Debt, groupId: string) => {
    const settlement: Expense = {
      id: '',
      groupId,
      description: 'Pagamento de Acerto',
      amount: debt.amount,
      date: new Date().toISOString(),
      category: 'other',
      kind: 'settlement',
      status: 'pending',
      splitMode: 'equal',
      payments: [{ userId: debt.from, amount: debt.amount }],
      splits: [{ userId: debt.to, amount: debt.amount }],
      history: []
    };
    await addExpense(settlement);
  };

  const confirmPayment = async (id: string) => {
    const exp = expenses.find(e => e.id === id);
    if (exp) {
      const updated = { ...exp, status: 'confirmed' } as Expense;
      await editExpense(updated);
      showToast("Pagamento confirmado!");
    }
  };

  const importLocalData = async () => {
    if (!currentUser || currentUser.id === 'guest') {
      showToast("Faça login em uma conta real para importar.", "error");
      return;
    }

    const localData = await LocalDataStore.loadInitialData();
    if (localData.groups.length === 0 && localData.expenses.length === 0) {
      showToast("Sem dados locais para importar.", "info");
      await clearLocalAfterDecision();
      return;
    }

    if (!confirm(`Deseja importar ${localData.groups.length} grupos e ${localData.expenses.length} gastos do dispositivo para a nuvem? Isso pode levar alguns segundos.`)) return;

    showToast("Iniciando migração...", "info");

    const groupIdMap: Record<string, string> = {};
    const memberIdMap: Record<string, string> = {};

    try {
      for (const localGroup of localData.groups) {
        const updatedMembers = localGroup.members.map(m => {
          if (m.id === 'u1' || m.id === localData.currentUser.id || m.id === 'guest') {
            memberIdMap[m.id] = currentUser.id;
            return currentUser;
          }
          return m;
        });

        const groupToCreate = { ...localGroup, members: updatedMembers };
        const newGroupId = await SupabaseDataStore.addGroup(groupToCreate);
        if (newGroupId) groupIdMap[localGroup.id] = newGroupId;
      }

      for (const localExpense of localData.expenses) {
        const newGroupId = groupIdMap[localExpense.groupId];
        if (!newGroupId) continue;

        const updatedPayments = localExpense.payments.map(p => ({
          ...p,
          userId: memberIdMap[p.userId] || p.userId
        }));

        const updatedSplits = localExpense.splits.map(s => ({
          ...s,
          userId: memberIdMap[s.userId] || s.userId
        }));

        const updatedItems = localExpense.items?.map(i => ({
          ...i,
          assignedTo: i.assignedTo.map(uid => memberIdMap[uid] || uid)
        }));

        const expenseToCreate: Expense = {
          ...localExpense,
          groupId: newGroupId,
          payments: updatedPayments,
          splits: updatedSplits,
          items: updatedItems,
        };

        await SupabaseDataStore.addExpense(expenseToCreate);
      }

      showToast("Migração concluída com sucesso!");
      await loadData();
      await clearLocalAfterDecision(); // <-- limpa após sucesso

    } catch (e) {
      console.error("Erro na migração", e);
      showToast("Erro ao migrar dados. Verifique o console.", "error");
    }
  };

  return (
    <StoreContext.Provider value={{
      currentUser, isLoadingAuth, isLoadingData, groups, expenses, templates, users, notification,
      localImportAvailable, checkLocalImport, clearLocalAfterDecision,
      updateUser, addGroup, updateGroup, addExpense, editExpense, deleteExpense, addComment,
      addTemplate, createExpenseFromTemplate, settleDebt, confirmPayment,
      showToast, clearNotification, refreshData: loadData, importLocalData, loginAsGuest
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
};