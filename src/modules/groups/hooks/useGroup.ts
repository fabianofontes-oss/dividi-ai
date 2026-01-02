import { useState, useEffect } from 'react';
import { Group } from '../types';
import { groupsActions } from '../actions';

export const useGroup = (groupId: string | null, userId: string | null) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroup = async () => {
    if (!groupId || !userId) {
      setGroup(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await groupsActions.getGroupById(groupId, userId);

    if (result.error) {
      setError(result.error);
      setGroup(null);
    } else {
      setGroup(result.group);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadGroup();
  }, [groupId, userId]);

  return {
    group,
    isLoading,
    error,
    refresh: loadGroup,
  };
};
