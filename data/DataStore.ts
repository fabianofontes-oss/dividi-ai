import { Group, Expense, ExpenseTemplate, User } from '../types';

export interface DataStore {
  /**
   * Carrega todos os dados iniciais.
   * Em local: lê do localStorage e faz migrações.
   * Em remoto: faz fetch das tabelas.
   */
  loadInitialData(): Promise<{
    currentUser: User;
    groups: Group[];
    expenses: Expense[];
    templates: ExpenseTemplate[];
  }>;

  saveUser(user: User): Promise<void>;
  
  addGroup(group: Group): Promise<string | void>;
  
  updateGroup(group: Group): Promise<void>;

  addExpense(expense: Expense): Promise<void>;
  
  updateExpense(expense: Expense): Promise<void>;
  
  // No nosso modelo soft-delete, deletar é na verdade um update (deletedAt), 
  // mas mantemos explícito para clareza da interface
  deleteExpense(expense: Expense): Promise<void>;
  
  addTemplate(template: ExpenseTemplate): Promise<void>;
}