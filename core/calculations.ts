import { Expense, Debt, Group } from '../types';

export const formatCurrency = (amount: number, currency: string = 'BRL') => {
  let locale = 'pt-BR';
  if (currency === 'USD') locale = 'en-US';
  if (currency === 'EUR') locale = 'pt-PT'; // Default EUR locale
  if (currency === 'CAD') locale = 'en-CA';
  if (currency === 'CLP') locale = 'es-CL';
  if (currency === 'GBP') locale = 'en-GB';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const calculateGroupDebts = (group: Group, expenses: Expense[]): Debt[] => {
  const balances: Record<string, number> = {};

  // Inicializa zerado
  group.members.forEach(m => balances[m.id] = 0);

  expenses.forEach(expense => {
    // Ignorar deletados
    if (expense.deletedAt) return;
    
    // Ignorar settlements pendentes (eles só entram no cálculo quando confirmados/pagos)
    if (expense.kind === 'settlement' && expense.status === 'pending') return;

    // QUEM PAGOU (Crédito +)
    expense.payments.forEach(payment => {
      if (balances[payment.userId] === undefined) balances[payment.userId] = 0;
      balances[payment.userId] += payment.amount;
    });

    // QUEM CONSOMIU/DEVE (Débito -)
    expense.splits.forEach(split => {
      if (balances[split.userId] === undefined) balances[split.userId] = 0;
      balances[split.userId] -= split.amount;
    });
  });

  // Simplificação (Greedy algorithm)
  let debtors: { id: string, amount: number }[] = [];
  let creditors: { id: string, amount: number }[] = [];

  Object.entries(balances).forEach(([id, amount]) => {
    const val = Math.round(amount * 100) / 100;
    if (val < -0.01) debtors.push({ id, amount: val });
    if (val > 0.01) creditors.push({ id, amount: val });
  });

  debtors.sort((a, b) => a.amount - b.amount); // Mais negativo primeiro
  creditors.sort((a, b) => b.amount - a.amount); // Mais positivo primeiro

  const debts: Debt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(Math.abs(debtor.amount), creditor.amount);
    
    if (amount > 0) {
      debts.push({
        from: debtor.id,
        to: creditor.id,
        amount: Number(amount.toFixed(2))
      });
    }

    debtor.amount += amount;
    creditor.amount -= amount;

    if (Math.abs(debtor.amount) < 0.01) i++;
    if (Math.abs(creditor.amount) < 0.01) j++;
  }

  return debts;
};

export const getCategoryIcon = (category: string) => category;