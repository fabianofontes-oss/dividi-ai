import { useState, useEffect } from 'react';
import { Group, CreateGroupInput, UpdateGroupInput } from '../types';
import { groupsActions } from '../actions';

export const useGroups = (userId: string | null) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = async () => {
    if (!userId) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await groupsActions.getGroupsByUser(userId);
    
    if (result.error) {
      setError(result.error);
      setGroups([]);
    } else {
      setGroups(result.groups);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadGroups();
  }, [userId]);

  const createGroup = async (input: CreateGroupInput): Promise<string | null> => {
    if (!userId) {
      setError('Usuário não autenticado');
      return null;
    }

    setError(null);
    const result = await groupsActions.createGroup(input, userId);

    if (result.error) {
      setError(result.error);
      return null;
    }

    await loadGroups();
    return result.groupId;
  };

  const updateGroup = async (input: UpdateGroupInput): Promise<boolean> => {
    if (!userId) {
      setError('Usuário não autenticado');
      return false;
    }

    setError(null);
    const result = await groupsActions.updateGroup(input, userId);

    if (result.error) {
      setError(result.error);
      return false;
    }

    await loadGroups();
    return true;
  };

  const removeMember = async (groupId: string, memberId: string): Promise<boolean> => {
    if (!userId) {
      setError('Usuário não autenticado');
      return false;
    }

    setError(null);
    const result = await groupsActions.removeMember(groupId, memberId, userId);

    if (result.error) {
      setError(result.error);
      return false;
    }

    await loadGroups();
    return true;
  };

  return {
    groups,
    isLoading,
    error,
    createGroup,
    updateGroup,
    removeMember,
    refresh: loadGroups,
  };
};
