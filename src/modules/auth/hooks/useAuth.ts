import { useState, useEffect } from 'react';
import { User } from '../types';
import { authActions } from '../actions';
import { authRepository } from '../repository';

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        const user = await authActions.getCurrentUser();
        setCurrentUser(user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar autenticação');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = authRepository.onAuthStateChange(async (session) => {
      if (!session) {
        setCurrentUser(null);
        return;
      }

      try {
        const user = await authActions.getCurrentUser();
        setCurrentUser(user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao atualizar autenticação');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const result = await authActions.login(email, password);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setCurrentUser(result.user);
    return true;
  };

  const signup = async (email: string, password: string, name: string) => {
    setError(null);
    const result = await authActions.signup(email, password, name);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setCurrentUser(result.user);
    return true;
  };

  const logout = async () => {
    setError(null);
    try {
      await authActions.logout();
      setCurrentUser(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer logout');
      return false;
    }
  };

  const updateUser = async (user: User) => {
    setError(null);
    const result = await authActions.updateUser(user);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setCurrentUser(result.user);
    return true;
  };

  return {
    currentUser,
    isLoading,
    error,
    login,
    signup,
    logout,
    updateUser,
  };
};
