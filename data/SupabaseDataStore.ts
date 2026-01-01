import { DataStore } from './DataStore';
import { Group, Expense, ExpenseTemplate, User, SplitMode, ExpenseCategory, ExpenseHistory } from '../types';
import { supabase } from '../services/supabaseClient';
import { receiptsDb } from '../storage/receiptsDb';

// Helper para converter snake_case do banco para camelCase do App
const mapProfileToUser = (p: any): User => ({
    id: p.id,
    name: p.name || 'Sem nome',
    paymentHandles: p.payment_handles || []
});

// Helper para upload de imagem
const uploadReceiptToStorage = async (localReceiptId: string): Promise<string | null> => {
    try {
        const blob = await receiptsDb.getReceipt(localReceiptId);
        if (!blob) return null;

        const fileExt = blob.type.split('/')[1] || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error } = await supabase.storage
            .from('receipts')
            .upload(filePath, blob);

        if (error) {
            console.error('Error uploading receipt:', error);
            return null;
        }

        return filePath;
    } catch (e) {
        console.error('Failed to upload receipt', e);
        return null;
    }
};

// Helper interno para salvar sub-itens (payments, splits, items)
const saveSubItems = async (expenseId: string, expense: Expense) => {
    const paymentsPayload = expense.payments.map(p => ({
        expense_id: expenseId,
        profile_id: p.userId,
        amount: p.amount
    }));
    if (paymentsPayload.length) await supabase.from('expense_payments').insert(paymentsPayload);

    const splitsPayload = expense.splits.map(s => ({
        expense_id: expenseId,
        profile_id: s.userId,
        amount: s.amount,
        manual_value: s.manualValue
    }));
    if (splitsPayload.length) await supabase.from('expense_splits').insert(splitsPayload);
    
    if (expense.items && expense.items.length > 0) {
        const itemsPayload = expense.items.map(i => ({
            expense_id: expenseId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            assigned_to: i.assignedTo
        }));
        await supabase.from('expense_items').insert(itemsPayload);
    }
};

export const SupabaseDataStore: DataStore = {
  async loadInitialData() {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // 1. Carregar Perfil do Usuário Logado
    let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        const newProfile = { id: user.id, name: user.email?.split('@')[0] || 'Usuário', payment_handles: [] };
        const { data } = await supabase.from('profiles').insert(newProfile).select().single();
        profile = data;
    }

    const currentUser = mapProfileToUser(profile);

    // 2. Carregar Grupos onde sou membro
    const { data: myMemberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('profile_id', user.id);

    const myGroupIds = myMemberships?.map(m => m.group_id) || [];

    if (myGroupIds.length === 0) {
        return { currentUser, groups: [], expenses: [], templates: [] };
    }

    // Busca dados completos dos grupos
    const { data: groupsData } = await supabase
        .from('groups')
        .select(`
            *,
            members:group_members(
                profile:profiles(*)
            )
        `)
        .in('id', myGroupIds);

    const groups: Group[] = (groupsData || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        currency: g.currency,
        members: g.members.map((m: any) => mapProfileToUser(m.profile))
    }));

    // 3. Carregar Despesas
    const { data: expensesData } = await supabase
        .from('expenses')
        .select(`
            *,
            created_by_profile:profiles!created_by(name),
            payments:expense_payments(*),
            splits:expense_splits(*),
            items:expense_items(*)
        `)
        .in('group_id', myGroupIds)
        .is('deleted_at', null)
        .order('date', { ascending: false });

    // 4. Carregar Templates (Gastos Fixos)
    // Nota: Assume que a tabela expense_templates existe. Se não existir, falha silenciosamente.
    const { data: templatesData } = await supabase
        .from('expense_templates')
        .select('*')
        .in('group_id', myGroupIds);

    // Mapeia Despesas
    const expenses: Expense[] = (expensesData || []).map((e: any) => {
        // Reconstrói histórico básico baseado nos metadados do banco
        const basicHistory: ExpenseHistory[] = [{
            id: 'h_create',
            userId: e.created_by || 'system',
            userName: e.created_by_profile?.name || 'Alguém',
            action: 'created',
            timestamp: e.created_at,
            details: 'Gasto criado'
        }];

        // Se foi editado (updated_at > created_at), adiciona entrada
        if (e.updated_at && e.updated_at !== e.created_at) {
            basicHistory.push({
                id: 'h_update',
                userId: 'system',
                userName: 'Sistema',
                action: 'edited',
                timestamp: e.updated_at,
                details: 'Gasto atualizado'
            });
        }

        return {
            id: e.id,
            groupId: e.group_id,
            description: e.description,
            amount: Number(e.amount),
            date: e.date,
            category: e.category as ExpenseCategory,
            kind: e.kind,
            status: 'confirmed', 
            splitMode: e.split_mode as SplitMode,
            receiptUrl: e.receipt_path ? `${(import.meta as any).env.VITE_SUPABASE_URL}/storage/v1/object/public/receipts/${e.receipt_path}` : undefined,
            receiptId: undefined, 
            
            payments: e.payments.map((p: any) => ({
                userId: p.profile_id,
                amount: Number(p.amount)
            })),
            
            splits: e.splits.map((s: any) => ({
                userId: s.profile_id,
                amount: Number(s.amount),
                manualValue: s.manual_value ? Number(s.manual_value) : undefined
            })),

            items: e.items.map((i: any) => ({
                id: i.id,
                name: i.name,
                price: Number(i.price),
                quantity: Number(i.quantity),
                assignedTo: i.assigned_to || []
            })),
            
            history: basicHistory.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        };
    });

    // Mapeia Templates
    const templates: ExpenseTemplate[] = (templatesData || []).map((t: any) => ({
        id: t.id,
        groupId: t.group_id,
        description: t.description,
        defaultAmount: Number(t.default_amount),
        category: t.category,
        paidBy: t.paid_by,
        splitWith: t.split_with || [],
        splitMode: t.split_mode
    }));

    return {
        currentUser,
        groups,
        expenses,
        templates
    };
  },

  async saveUser(user: User) {
     await supabase.from('profiles').upsert({
         id: user.id,
         name: user.name,
         payment_handles: user.paymentHandles,
     });
  },

  async addGroup(group: Group) {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: groupData, error } = await supabase.from('groups').insert({
          name: group.name,
          type: group.type,
          currency: group.currency,
          created_by: user?.id
      }).select().single();
      
      if (error || !groupData) throw error;

      const membersPayload = [];
      for (const m of group.members) {
          let profileId = m.id;
          if (m.id.startsWith('temp_') || m.id.startsWith('u1')) {
             const { data: ghost } = await supabase.from('profiles').insert({
                 name: m.name,
                 payment_handles: []
             }).select().single();
             if (ghost) profileId = ghost.id;
          }
          membersPayload.push({
              group_id: groupData.id,
              profile_id: profileId,
              role: 'member'
          });
      }

      await supabase.from('group_members').insert(membersPayload);
      return groupData.id; 
  },

  async updateGroup(group: Group) {
      await supabase.from('groups').update({
          name: group.name,
          currency: group.currency,
          type: group.type
      }).eq('id', group.id);

      // Sincroniza membros: remove quem não está mais na lista
      const currentMemberIds = group.members.map(m => m.id);
      
      // Remove quem saiu
      await supabase.from('group_members')
        .delete()
        .eq('group_id', group.id)
        .not('profile_id', 'in', `(${currentMemberIds.join(',')})`);
      
      // Adiciona novos (upsert para garantir)
      const membersPayload = group.members.map(m => ({
          group_id: group.id,
          profile_id: m.id,
          role: 'member'
      }));
      // Nota: Profiles fantasmas novos devem ser criados antes, mas para MVP assumimos que addGroup já tratou
      // ou que updateGroup não adiciona fantasmas novos complexos sem refetch.
      await supabase.from('group_members').upsert(membersPayload, { onConflict: 'group_id,profile_id' });
  },

  async addExpense(expense: Expense) {
      const { data: { user } } = await supabase.auth.getUser();

      let receiptPath = null;
      if (expense.receiptId) {
          receiptPath = await uploadReceiptToStorage(expense.receiptId);
      }

      const { data: expData, error } = await supabase.from('expenses').insert({
          group_id: expense.groupId,
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          kind: expense.kind,
          split_mode: expense.splitMode,
          receipt_path: receiptPath,
          created_by: user?.id
      }).select().single();

      if (error || !expData) throw error;
      const expenseId = expData.id;

      await saveSubItems(expenseId, expense);
  },

  async updateExpense(expense: Expense) {
      // Update principal
      await supabase.from('expenses').update({
          description: expense.description,
          amount: expense.amount,
          date: expense.date,
          category: expense.category,
          split_mode: expense.splitMode,
          updated_at: new Date().toISOString()
      }).eq('id', expense.id);

      // Limpa tabelas filhas para recriar (estratégia mais segura para evitar diff complexo de arrays)
      await supabase.from('expense_payments').delete().eq('expense_id', expense.id);
      await supabase.from('expense_splits').delete().eq('expense_id', expense.id);
      await supabase.from('expense_items').delete().eq('expense_id', expense.id);

      // Recria sub-itens
      await saveSubItems(expense.id, expense);
  },

  async deleteExpense(expense: Expense) {
      // Soft delete
      await supabase.from('expenses').update({
          deleted_at: new Date().toISOString()
      }).eq('id', expense.id);
  },

  async addTemplate(template: ExpenseTemplate) {
      // Tenta salvar na tabela expense_templates
      // Se a tabela não existir, vai dar erro no console, mas não trava o app
      try {
          await supabase.from('expense_templates').insert({
              group_id: template.groupId,
              description: template.description,
              default_amount: template.defaultAmount,
              category: template.category,
              paid_by: template.paidBy,
              split_with: template.splitWith,
              split_mode: template.splitMode
          });
      } catch (e) {
          console.error("Templates table missing in Supabase?", e);
      }
  }
};