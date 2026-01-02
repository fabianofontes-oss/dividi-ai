import { z } from 'zod';

export const SplitModeSchema = z.enum(['equal', 'exact', 'percentage', 'shares', 'custom', 'itemized']);
export const ExpenseCategorySchema = z.enum(['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'other']);
export const ExpenseKindSchema = z.enum(['expense', 'settlement']);
export const ExpenseStatusSchema = z.enum(['pending', 'confirmed']);

export const PaymentSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().min(0, 'Valor não pode ser negativo'),
});

export const SplitSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().min(0, 'Valor não pode ser negativo'),
  manualValue: z.number().optional(),
});

export const ReceiptItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nome do item é obrigatório'),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  quantity: z.number().int().min(1, 'Quantidade deve ser pelo menos 1'),
  assignedTo: z.array(z.string().uuid()),
});

export const ExpenseHistorySchema = z.object({
  id: z.string(),
  userId: z.string().uuid(),
  userName: z.string(),
  action: z.enum(['created', 'edited', 'commented', 'settled', 'deleted']),
  timestamp: z.string(),
  details: z.string().optional(),
});

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  description: z.string().min(1, 'Descrição é obrigatória').max(200, 'Descrição muito longa'),
  amount: z.number().min(0.01, 'Valor deve ser maior que zero'),
  date: z.string(),
  category: ExpenseCategorySchema,
  kind: ExpenseKindSchema,
  payments: z.array(PaymentSchema).min(1, 'Deve ter pelo menos um pagador'),
  splitMode: SplitModeSchema,
  splits: z.array(SplitSchema).min(1, 'Deve ter pelo menos uma divisão'),
  items: z.array(ReceiptItemSchema).optional(),
  receiptId: z.string().optional(),
  receiptUrl: z.string().url().optional(),
  status: ExpenseStatusSchema,
  history: z.array(ExpenseHistorySchema),
  deletedAt: z.string().optional(),
  deletedBy: z.string().uuid().optional(),
});

export const ExpenseDbSchema = z.object({
  id: z.string().uuid(),
  group_id: z.string().uuid(),
  description: z.string(),
  amount: z.number(),
  date: z.string(),
  category: ExpenseCategorySchema,
  kind: ExpenseKindSchema,
  split_mode: SplitModeSchema,
  receipt_path: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  deleted_at: z.string().nullable(),
  deleted_by: z.string().uuid().nullable(),
});

export const ExpensePaymentDbSchema = z.object({
  id: z.string().uuid().optional(),
  expense_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  amount: z.number(),
});

export const ExpenseSplitDbSchema = z.object({
  id: z.string().uuid().optional(),
  expense_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  amount: z.number(),
  manual_value: z.number().nullable(),
});

export const ExpenseItemDbSchema = z.object({
  id: z.string().uuid().optional(),
  expense_id: z.string().uuid(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  assigned_to: z.array(z.string().uuid()),
});

export const CreateExpenseInputSchema = z.object({
  groupId: z.string().uuid(),
  description: z.string().min(1).max(200),
  amount: z.number().min(0.01),
  date: z.string(),
  category: ExpenseCategorySchema,
  kind: ExpenseKindSchema.default('expense'),
  payments: z.array(PaymentSchema).min(1),
  splitMode: SplitModeSchema,
  splits: z.array(SplitSchema).min(1),
  items: z.array(ReceiptItemSchema).optional(),
  receiptId: z.string().optional(),
});

export const UpdateExpenseInputSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(200).optional(),
  amount: z.number().min(0.01).optional(),
  date: z.string().optional(),
  category: ExpenseCategorySchema.optional(),
  payments: z.array(PaymentSchema).optional(),
  splitMode: SplitModeSchema.optional(),
  splits: z.array(SplitSchema).optional(),
  items: z.array(ReceiptItemSchema).optional(),
});

export const ExpenseTemplateSchema = z.object({
  id: z.string().uuid(),
  groupId: z.string().uuid(),
  description: z.string().min(1),
  defaultAmount: z.number().min(0).optional(),
  category: ExpenseCategorySchema,
  paidBy: z.string().uuid(),
  splitWith: z.array(z.string().uuid()),
  splitMode: SplitModeSchema,
});

export type SplitMode = z.infer<typeof SplitModeSchema>;
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type ExpenseKind = z.infer<typeof ExpenseKindSchema>;
export type ExpenseStatus = z.infer<typeof ExpenseStatusSchema>;
export type Payment = z.infer<typeof PaymentSchema>;
export type Split = z.infer<typeof SplitSchema>;
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>;
export type ExpenseHistory = z.infer<typeof ExpenseHistorySchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type ExpenseDb = z.infer<typeof ExpenseDbSchema>;
export type ExpensePaymentDb = z.infer<typeof ExpensePaymentDbSchema>;
export type ExpenseSplitDb = z.infer<typeof ExpenseSplitDbSchema>;
export type ExpenseItemDb = z.infer<typeof ExpenseItemDbSchema>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseInputSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInputSchema>;
export type ExpenseTemplate = z.infer<typeof ExpenseTemplateSchema>;
