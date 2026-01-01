import { Split, SplitMode, User, ReceiptItem } from '../types';

interface SplitParams {
  total: number;
  users: User[];
  participantIds: string[];
  mode: SplitMode;
  values: Record<string, number>; // Map userId -> valor manual (peso, %, valor)
  
  // Novos parâmetros opcionais para modo Itemizado
  items?: ReceiptItem[];
  serviceFeePercent?: number;
}

export const buildSplits = ({ total, users, participantIds, mode, values, items, serviceFeePercent = 0 }: SplitParams): Split[] => {
  // Se for itemizado, usamos a lógica específica independente do total global (que é derivado)
  if (mode === 'itemized' && items && items.length > 0) {
      const userTotals: Record<string, number> = {};
      
      // Inicializa com 0
      users.forEach(u => userTotals[u.id] = 0);

      items.forEach(item => {
          if (item.assignedTo && item.assignedTo.length > 0) {
              const costPerPerson = (item.price * item.quantity) / item.assignedTo.length;
              item.assignedTo.forEach(uid => {
                  if (userTotals[uid] !== undefined) {
                      userTotals[uid] += costPerPerson;
                  }
              });
          }
      });

      // Aplica taxa de serviço proporcionalmente
      if (serviceFeePercent > 0) {
          Object.keys(userTotals).forEach(uid => {
              userTotals[uid] = userTotals[uid] * (1 + (serviceFeePercent/100));
          });
      }

      // Retorna splits apenas para quem tem valor > 0
      return users
        .map(u => ({
            userId: u.id,
            amount: Number((userTotals[u.id] || 0).toFixed(2)),
            manualValue: 0
        }))
        .filter(s => s.amount > 0);
  }

  // Lógica padrão para outros modos
  if (total <= 0 || participantIds.length === 0) return [];

  const participants = users.filter(u => participantIds.includes(u.id));
  let splits: Split[] = participants.map(u => ({
    userId: u.id,
    amount: 0,
    manualValue: values[u.id] || 0
  }));

  if (mode === 'equal') {
    const rawAmount = total / participants.length;
    const baseAmount = Math.floor(rawAmount * 100) / 100;
    let remainder = Math.round((total - (baseAmount * participants.length)) * 100) / 100;

    splits = splits.map(s => {
      let add = 0;
      if (remainder > 0.001) {
        add = 0.01;
        remainder -= 0.01;
      }
      return { ...s, amount: baseAmount + add };
    });

  } else if (mode === 'percentage') {
    let currentTotal = 0;
    splits = splits.map(s => {
      const percent = values[s.userId] || 0;
      const amount = Math.floor((total * (percent / 100)) * 100) / 100;
      currentTotal += amount;
      return { ...s, amount };
    });
    
    let diff = total - currentTotal;
    if (Math.abs(diff) > 0.001 && splits.length > 0) {
      splits[0].amount += diff;
    }

  } else if (mode === 'shares') {
    const totalShares = splits.reduce((acc, s) => acc + (values[s.userId] || 1), 0);
    if (totalShares === 0) return splits;

    const unitValue = total / totalShares;
    let currentTotal = 0;

    splits = splits.map(s => {
      const share = values[s.userId] || 1;
      const amount = Math.floor((unitValue * share) * 100) / 100;
      currentTotal += amount;
      return { ...s, amount, manualValue: share };
    });

    let diff = total - currentTotal;
    let i = 0;
    while (diff > 0.001 && i < splits.length) {
      splits[i].amount += 0.01;
      diff -= 0.01;
      i++;
    }

  } else if (mode === 'exact') {
    splits = splits.map(s => ({
      ...s,
      amount: values[s.userId] || 0
    }));
  }

  return splits.map(s => ({ ...s, amount: Number(s.amount.toFixed(2)) }));
};
