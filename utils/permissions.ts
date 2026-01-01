import { Group, User } from '../types';

/**
 * Verifica se o usuário é admin ou owner do grupo
 * Por enquanto, considera que o primeiro membro (index 0) é o owner/criador
 * Em produção, isso deve vir do campo 'role' na tabela group_members
 */
export const isAdminOfGroup = (group: Group, userId: string | undefined): boolean => {
    if (!userId || !group.members || group.members.length === 0) return false;

    // O primeiro membro é sempre o criador (owner)
    const owner = group.members[0];
    return owner.id === userId;
};

/**
 * Verifica se o usuário é o criador da despesa ou admin do grupo
 */
export const canEditExpense = (expenseCreatorId: string, group: Group, userId: string | undefined): boolean => {
    if (!userId) return false;
    if (expenseCreatorId === userId) return true;
    return isAdminOfGroup(group, userId);
};
