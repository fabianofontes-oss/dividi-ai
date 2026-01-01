import { DataStore } from './DataStore';
import { Group, Expense, ExpenseTemplate, User, UserPaymentHandle } from '../types';
import { receiptsDb } from '../storage/receiptsDb';

const STORAGE_KEY = 'dividi_db_mvp_v1';

const INITIAL_USER: User = { id: 'u1', name: 'Você', paymentHandles: [] };

// Helper para ler o DB completo
const getDB = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
};

// Helper para salvar o DB completo
const saveDB = (data: any) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// --- MIGRATION LOGIC ---
const migrateUserPaymentMethods = (user: any): User => {
  // Se já tiver handles e não for vazio, assume que já migrou ou é novo
  if (user.paymentHandles && Array.isArray(user.paymentHandles)) {
    // Check if we need to add legacy fields to handles (re-migration check)
    if (user.paymentHandles.length > 0) return user as User;
  }

  const newHandles: UserPaymentHandle[] = [];

  // Map legacy fields to new Rail IDs
  if (user.pixKey) newHandles.push({ railId: 'br_pix', value: user.pixKey });
  if (user.zelle) newHandles.push({ railId: 'us_zelle', value: user.zelle });
  if (user.mbWay) newHandles.push({ railId: 'pt_mbway', value: user.mbWay });
  if (user.bizum) newHandles.push({ railId: 'es_bizum', value: user.bizum });
  if (user.ukAccount) newHandles.push({ railId: 'gb_faster', value: user.ukAccount });
  if (user.interac) newHandles.push({ railId: 'ca_interac', value: user.interac });
  if (user.rut) newHandles.push({ railId: 'cl_rut', value: user.rut });
  if (user.iban) newHandles.push({ railId: 'eu_sepa', value: user.iban });

  return {
    ...user,
    paymentHandles: newHandles
  };
};

export const LocalDataStore: DataStore = {
  async loadInitialData() {
    const db = getDB();
    
    if (!db) {
      return {
        currentUser: INITIAL_USER,
        groups: [],
        expenses: [],
        templates: []
      };
    }

    let hasChanges = false;
    let expenses: Expense[] = db.expenses || [];
    let currentUser = db.currentUser || INITIAL_USER;
    let groups = db.groups || [];

    // 1. Migração de Blobs (Base64 -> IndexedDB)
    const migratedExpenses = await Promise.all(expenses.map(async (e) => {
      if (e.receiptUrl && e.receiptUrl.startsWith('data:image') && !e.receiptId) {
        try {
          const blob = receiptsDb.dataURLtoBlob(e.receiptUrl);
          const id = await receiptsDb.saveReceipt(blob);
          hasChanges = true;
          return { ...e, receiptId: id, receiptUrl: undefined };
        } catch (err) {
          console.error("Failed to migrate receipt", err);
          return e;
        }
      }
      return e;
    }));
    
    if (expenses.length > 0 && migratedExpenses !== expenses) {
       expenses = migratedExpenses;
    }

    // 2. Migração de Payment Handles (Legacy -> Rails)
    const migratedUser = migrateUserPaymentMethods(currentUser);
    if (JSON.stringify(migratedUser) !== JSON.stringify(currentUser)) {
      currentUser = migratedUser;
      hasChanges = true;
      console.log("Migration: User payment methods updated to Rails system.");
    }

    // Também migrar os membros dentro dos grupos (mocked users)
    const migratedGroups = groups.map((g: Group) => ({
      ...g,
      members: g.members.map(m => migrateUserPaymentMethods(m))
    }));
    if (JSON.stringify(migratedGroups) !== JSON.stringify(groups)) {
      groups = migratedGroups;
      hasChanges = true;
    }

    if (hasChanges) {
      db.expenses = expenses;
      db.currentUser = currentUser;
      db.groups = groups;
      saveDB(db);
    }

    return {
      currentUser,
      groups,
      expenses,
      templates: db.templates || []
    };
  },

  async saveUser(user: User) {
    const db = getDB() || {};
    db.currentUser = user;
    // Update user inside groups too
    if (db.groups) {
      db.groups = db.groups.map((g: Group) => ({
        ...g,
        members: g.members.map((m: User) => m.id === user.id ? user : m)
      }));
    }
    saveDB(db);
  },

  async addGroup(group: Group) {
    const db = getDB() || {};
    db.groups = [group, ...(db.groups || [])];
    saveDB(db);
    return group.id; // Retorna o ID (string) para satisfazer a interface
  },

  async updateGroup(group: Group) {
    const db = getDB() || {};
    db.groups = (db.groups || []).map((g: Group) => g.id === group.id ? group : g);
    saveDB(db);
  },

  async addExpense(expense: Expense) {
    const db = getDB() || {};
    db.expenses = [expense, ...(db.expenses || [])];
    saveDB(db);
  },

  async updateExpense(expense: Expense) {
    const db = getDB() || {};
    db.expenses = (db.expenses || []).map((e: Expense) => e.id === expense.id ? expense : e);
    saveDB(db);
  },

  async deleteExpense(expense: Expense) {
    await this.updateExpense(expense);
  },

  async addTemplate(template: ExpenseTemplate) {
    const db = getDB() || {};
    db.templates = [...(db.templates || []), template];
    saveDB(db);
  }
};