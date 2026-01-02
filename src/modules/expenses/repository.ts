import { supabase } from '../../lib/supabase';
import { 
  ExpenseDb, 
  ExpenseDbSchema, 
  ExpensePaymentDb, 
  ExpenseSplitDb, 
  ExpenseItemDb,
  Payment,
  Split,
  ReceiptItem
} from './types';

export const expensesRepository = {
  async getExpensesByGroupIds(groupIds: string[]): Promise<{
    expenses: ExpenseDb[];
    paymentsMap: Map<string, ExpensePaymentDb[]>;
    splitsMap: Map<string, ExpenseSplitDb[]>;
    itemsMap: Map<string, ExpenseItemDb[]>;
  }> {
    if (groupIds.length === 0) {
      return { 
        expenses: [], 
        paymentsMap: new Map(), 
        splitsMap: new Map(), 
        itemsMap: new Map() 
      };
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .in('group_id', groupIds)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (expensesError) throw expensesError;

    const expenses = (expensesData || []).map(e => ExpenseDbSchema.parse(e));
    const expenseIds = expenses.map(e => e.id);

    if (expenseIds.length === 0) {
      return { 
        expenses, 
        paymentsMap: new Map(), 
        splitsMap: new Map(), 
        itemsMap: new Map() 
      };
    }

    const [paymentsData, splitsData, itemsData] = await Promise.all([
      supabase.from('expense_payments').select('*').in('expense_id', expenseIds),
      supabase.from('expense_splits').select('*').in('expense_id', expenseIds),
      supabase.from('expense_items').select('*').in('expense_id', expenseIds),
    ]);

    const paymentsMap = new Map<string, ExpensePaymentDb[]>();
    paymentsData.data?.forEach(p => {
      if (!paymentsMap.has(p.expense_id)) {
        paymentsMap.set(p.expense_id, []);
      }
      paymentsMap.get(p.expense_id)!.push(p);
    });

    const splitsMap = new Map<string, ExpenseSplitDb[]>();
    splitsData.data?.forEach(s => {
      if (!splitsMap.has(s.expense_id)) {
        splitsMap.set(s.expense_id, []);
      }
      splitsMap.get(s.expense_id)!.push(s);
    });

    const itemsMap = new Map<string, ExpenseItemDb[]>();
    itemsData.data?.forEach(i => {
      if (!itemsMap.has(i.expense_id)) {
        itemsMap.set(i.expense_id, []);
      }
      itemsMap.get(i.expense_id)!.push(i);
    });

    return { expenses, paymentsMap, splitsMap, itemsMap };
  },

  async createExpense(
    groupId: string,
    description: string,
    amount: number,
    date: string,
    category: string,
    kind: string,
    splitMode: string,
    createdBy: string,
    receiptPath?: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        group_id: groupId,
        description,
        amount,
        date,
        category,
        kind,
        split_mode: splitMode,
        receipt_path: receiptPath || null,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  },

  async addPayments(expenseId: string, payments: Payment[]): Promise<void> {
    const payload = payments.map(p => ({
      expense_id: expenseId,
      profile_id: p.userId,
      amount: p.amount,
    }));

    const { error } = await supabase
      .from('expense_payments')
      .insert(payload);

    if (error) throw error;
  },

  async addSplits(expenseId: string, splits: Split[]): Promise<void> {
    const payload = splits.map(s => ({
      expense_id: expenseId,
      profile_id: s.userId,
      amount: s.amount,
      manual_value: s.manualValue || null,
    }));

    const { error } = await supabase
      .from('expense_splits')
      .insert(payload);

    if (error) throw error;
  },

  async addItems(expenseId: string, items: ReceiptItem[]): Promise<void> {
    if (items.length === 0) return;

    const payload = items.map(i => ({
      expense_id: expenseId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      assigned_to: i.assignedTo,
    }));

    const { error } = await supabase
      .from('expense_items')
      .insert(payload);

    if (error) throw error;
  },

  async updateExpense(
    expenseId: string,
    updates: Partial<ExpenseDb>
  ): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', expenseId);

    if (error) throw error;
  },

  async deletePayments(expenseId: string): Promise<void> {
    const { error } = await supabase
      .from('expense_payments')
      .delete()
      .eq('expense_id', expenseId);

    if (error) throw error;
  },

  async deleteSplits(expenseId: string): Promise<void> {
    const { error } = await supabase
      .from('expense_splits')
      .delete()
      .eq('expense_id', expenseId);

    if (error) throw error;
  },

  async deleteItems(expenseId: string): Promise<void> {
    const { error } = await supabase
      .from('expense_items')
      .delete()
      .eq('expense_id', expenseId);

    if (error) throw error;
  },

  async softDeleteExpense(expenseId: string, deletedBy: string): Promise<void> {
    const { error } = await supabase
      .from('expenses')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy,
      })
      .eq('id', expenseId);

    if (error) throw error;
  },

  async uploadReceipt(blob: Blob, userId: string): Promise<string | null> {
    try {
      const fileExt = blob.type.split('/')[1] || 'jpg';
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { error } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob);

      if (error) {
        console.error('Error uploading receipt:', error);
        return null;
      }

      return fileName;
    } catch (e) {
      console.error('Failed to upload receipt', e);
      return null;
    }
  },

  getReceiptPublicUrl(path: string): string {
    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(path);

    return data.publicUrl;
  },
};
