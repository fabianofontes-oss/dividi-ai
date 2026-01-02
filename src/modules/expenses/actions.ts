import { expensesRepository } from './repository';
import { 
  CreateExpenseInputSchema, 
  UpdateExpenseInputSchema, 
  Expense, 
  ExpenseHistory 
} from './types';
import { ZodError } from 'zod';

export const expensesActions = {
  async getExpensesByGroupIds(groupIds: string[]): Promise<{ expenses: Expense[]; error: null } | { expenses: null; error: string }> {
    try {
      const { expenses: expensesDb, paymentsMap, splitsMap, itemsMap } = 
        await expensesRepository.getExpensesByGroupIds(groupIds);

      const expenses: Expense[] = expensesDb.map(e => {
        const basicHistory: ExpenseHistory[] = [{
          id: 'h_create',
          userId: e.created_by || 'system',
          userName: 'Sistema',
          action: 'created',
          timestamp: e.created_at || new Date().toISOString(),
          details: 'Gasto criado',
        }];

        if (e.updated_at && e.updated_at !== e.created_at) {
          basicHistory.push({
            id: 'h_update',
            userId: 'system',
            userName: 'Sistema',
            action: 'edited',
            timestamp: e.updated_at,
            details: 'Gasto atualizado',
          });
        }

        return {
          id: e.id,
          groupId: e.group_id,
          description: e.description,
          amount: e.amount,
          date: e.date,
          category: e.category,
          kind: e.kind,
          status: 'confirmed',
          splitMode: e.split_mode,
          receiptUrl: e.receipt_path 
            ? expensesRepository.getReceiptPublicUrl(e.receipt_path) 
            : undefined,
          receiptId: undefined,
          payments: (paymentsMap.get(e.id) || []).map(p => ({
            userId: p.profile_id,
            amount: p.amount,
          })),
          splits: (splitsMap.get(e.id) || []).map(s => ({
            userId: s.profile_id,
            amount: s.amount,
            manualValue: s.manual_value || undefined,
          })),
          items: (itemsMap.get(e.id) || []).map(i => ({
            id: i.id || crypto.randomUUID(),
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            assignedTo: i.assigned_to,
          })),
          history: basicHistory.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          ),
          deletedAt: e.deleted_at || undefined,
          deletedBy: e.deleted_by || undefined,
        };
      });

      return { expenses, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { expenses: null, error: error.message };
      }
      return { expenses: null, error: 'Erro ao carregar despesas' };
    }
  },

  async createExpense(
    input: unknown,
    currentUserId: string,
    receiptBlob?: Blob
  ): Promise<{ expenseId: string; error: null } | { expenseId: null; error: string }> {
    try {
      const validated = CreateExpenseInputSchema.parse(input);

      let receiptPath: string | undefined;
      if (receiptBlob) {
        const path = await expensesRepository.uploadReceipt(receiptBlob, currentUserId);
        if (path) receiptPath = path;
      }

      const expenseId = await expensesRepository.createExpense(
        validated.groupId,
        validated.description,
        validated.amount,
        validated.date,
        validated.category,
        validated.kind,
        validated.splitMode,
        currentUserId,
        receiptPath
      );

      await Promise.all([
        expensesRepository.addPayments(expenseId, validated.payments),
        expensesRepository.addSplits(expenseId, validated.splits),
        validated.items && validated.items.length > 0
          ? expensesRepository.addItems(expenseId, validated.items)
          : Promise.resolve(),
      ]);

      return { expenseId, error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { expenseId: null, error: error.issues[0].message };
      }
      if (error instanceof Error) {
        return { expenseId: null, error: error.message };
      }
      return { expenseId: null, error: 'Erro ao criar despesa' };
    }
  },

  async updateExpense(
    input: unknown,
    currentUserId: string
  ): Promise<{ success: true; error: null } | { success: false; error: string }> {
    try {
      const validated = UpdateExpenseInputSchema.parse(input);

      const updates: Record<string, unknown> = {};
      if (validated.description) updates.description = validated.description;
      if (validated.amount) updates.amount = validated.amount;
      if (validated.date) updates.date = validated.date;
      if (validated.category) updates.category = validated.category;
      if (validated.splitMode) updates.split_mode = validated.splitMode;

      if (Object.keys(updates).length > 0) {
        await expensesRepository.updateExpense(validated.id, updates);
      }

      if (validated.payments) {
        await expensesRepository.deletePayments(validated.id);
        await expensesRepository.addPayments(validated.id, validated.payments);
      }

      if (validated.splits) {
        await expensesRepository.deleteSplits(validated.id);
        await expensesRepository.addSplits(validated.id, validated.splits);
      }

      if (validated.items !== undefined) {
        await expensesRepository.deleteItems(validated.id);
        if (validated.items.length > 0) {
          await expensesRepository.addItems(validated.id, validated.items);
        }
      }

      return { success: true, error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false, error: error.issues[0].message };
      }
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Erro ao atualizar despesa' };
    }
  },

  async deleteExpense(
    expenseId: string,
    currentUserId: string
  ): Promise<{ success: true; error: null } | { success: false; error: string }> {
    try {
      await expensesRepository.softDeleteExpense(expenseId, currentUserId);
      return { success: true, error: null };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Erro ao deletar despesa' };
    }
  },
};
