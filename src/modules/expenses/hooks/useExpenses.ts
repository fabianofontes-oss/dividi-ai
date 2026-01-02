import { useState, useEffect } from 'react';
import { Expense, CreateExpenseInput, UpdateExpenseInput } from '../types';
import { expensesActions } from '../actions';

export const useExpenses = (groupIds: string[]) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExpenses = async () => {
    if (groupIds.length === 0) {
      setExpenses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await expensesActions.getExpensesByGroupIds(groupIds);

    if (result.error) {
      setError(result.error);
      setExpenses([]);
    } else {
      setExpenses(result.expenses);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, [JSON.stringify(groupIds)]);

  const createExpense = async (
    input: CreateExpenseInput,
    currentUserId: string,
    receiptBlob?: Blob
  ): Promise<string | null> => {
    setError(null);
    const result = await expensesActions.createExpense(input, currentUserId, receiptBlob);

    if (result.error) {
      setError(result.error);
      return null;
    }

    await loadExpenses();
    return result.expenseId;
  };

  const updateExpense = async (
    input: UpdateExpenseInput,
    currentUserId: string
  ): Promise<boolean> => {
    setError(null);
    const result = await expensesActions.updateExpense(input, currentUserId);

    if (result.error) {
      setError(result.error);
      return false;
    }

    await loadExpenses();
    return true;
  };

  const deleteExpense = async (
    expenseId: string,
    currentUserId: string
  ): Promise<boolean> => {
    setError(null);
    const result = await expensesActions.deleteExpense(expenseId, currentUserId);

    if (result.error) {
      setError(result.error);
      return false;
    }

    await loadExpenses();
    return true;
  };

  return {
    expenses,
    isLoading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    refresh: loadExpenses,
  };
};
