
export interface UserPaymentHandle {
  railId: string;
  value: string;
  isPrimary?: boolean; // Se tiver multiplos do mesmo rail (futuro)
}

export interface User {
  id: string;
  name: string;
  email?: string; // Adicionado para sync com Auth
  avatar?: string;
  defaultCurrency?: CurrencyCode; 
  activeCurrencies?: CurrencyCode[]; 
  
  // O sistema antigo de chaves soltas foi substituído por handles genéricos
  paymentHandles: UserPaymentHandle[];
}

export type CurrencyCode = 'BRL' | 'USD' | 'EUR' | 'CAD' | 'CLP' | 'GBP' | 'INR' | 'SGD' | 'AUD' | 'THB' | 'SEK' | 'PLN' | 'MXN' | 'PEN' | 'COP';

export interface PaymentRail {
  id: string;
  name: string;
  countryCode: string; // ISO 3166-1 alpha-2
  flag: string;
  currencies: CurrencyCode[];
  inputType: 'phone' | 'email' | 'national_id' | 'iban' | 'alphanumeric' | 'bank_details';
  placeholder: string;
  priority: number; // 1 = Preferencial (Instantâneo), 10 = Fallback (Transferência Bancária)
  supportsQr: boolean;
  prefix?: string; // Ex: "+55" para pre-fill visual
}

export interface Group {
  id: string;
  name: string;
  type: 'trip' | 'home' | 'event' | 'couple' | 'other';
  coverImage?: string;
  members: User[];
  currency: CurrencyCode;
  dates?: string;
}

export type SplitMode = 'equal' | 'exact' | 'percentage' | 'shares' | 'custom' | 'itemized';

export type ExpenseCategory = 'food' | 'transport' | 'accommodation' | 'entertainment' | 'utilities' | 'other';

export interface Split {
  userId: string;
  amount: number;
  manualValue?: number;
}

export interface Payment {
  userId: string;
  amount: number;
}

export interface ExpenseHistory {
  id: string;
  userId: string;
  userName: string;
  action: 'created' | 'edited' | 'commented' | 'settled' | 'deleted';
  timestamp: string;
  details?: string;
}

export interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  assignedTo: string[]; // User IDs
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  kind: 'expense' | 'settlement';
  
  payments: Payment[];
  splitMode: SplitMode;
  splits: Split[];
  
  // Itens detalhados (Premium Feature)
  items?: ReceiptItem[];
  
  // CR-3: receiptId aponta para Blob no IndexedDB. receiptUrl reservado para Cloud URL futuro.
  receiptId?: string; 
  receiptUrl?: string; 
  
  status: 'pending' | 'confirmed';
  history: ExpenseHistory[];
  
  deletedAt?: string;
  deletedBy?: string;
}

export interface ExpenseTemplate {
  id: string;
  groupId: string;
  description: string;
  defaultAmount?: number;
  category: ExpenseCategory;
  paidBy: string;
  splitWith: string[];
  splitMode: SplitMode;
}

export interface Debt {
  from: string;
  to: string;
  amount: number;
}

export interface ReceiptData {
  total?: number;
  date?: string;
  merchant?: string;
  items?: string[];
  category?: string;
  
  // Novos campos para o Racha Rápido Inteligente
  foodTotal?: number;
  drinkTotal?: number;
  
  // Itemized parsing
  itemsList?: { name: string, price: number, quantity: number }[];
}