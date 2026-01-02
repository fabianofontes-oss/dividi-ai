import { authRepository, mapProfileToUser } from './repository';
import { LoginCredentialsSchema, SignupCredentialsSchema, User, UserSchema } from './types';
import { ZodError } from 'zod';

export const authActions = {
  async login(email: string, password: string): Promise<{ user: User; error: null } | { user: null; error: string }> {
    try {
      const credentials = LoginCredentialsSchema.parse({ email, password });
      
      const authData = await authRepository.signInWithEmail(credentials.email, credentials.password);
      
      if (!authData.user) {
        return { user: null, error: 'Falha ao autenticar' };
      }

      let profile = await authRepository.getProfile(authData.user.id);

      if (!profile) {
        profile = await authRepository.createProfile({
          id: authData.user.id,
          email: authData.user.email,
          name: authData.user.email?.split('@')[0] || 'Usuário',
          payment_handles: [],
        });
      }

      const user = mapProfileToUser(profile);
      return { user, error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { user: null, error: error.issues[0].message };
      }
      if (error instanceof Error) {
        return { user: null, error: error.message };
      }
      return { user: null, error: 'Erro ao fazer login' };
    }
  },

  async signup(email: string, password: string, name: string): Promise<{ user: User; error: null } | { user: null; error: string }> {
    try {
      const credentials = SignupCredentialsSchema.parse({ email, password, name });
      
      const authData = await authRepository.signUpWithEmail(credentials.email, credentials.password);
      
      if (!authData.user) {
        return { user: null, error: 'Falha ao criar conta' };
      }

      const profile = await authRepository.createProfile({
        id: authData.user.id,
        email: authData.user.email,
        name: credentials.name,
        payment_handles: [],
      });

      const user = mapProfileToUser(profile);
      return { user, error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { user: null, error: error.issues[0].message };
      }
      if (error instanceof Error) {
        return { user: null, error: error.message };
      }
      return { user: null, error: 'Erro ao criar conta' };
    }
  },

  async logout(): Promise<void> {
    await authRepository.signOut();
  },

  async getCurrentUser(): Promise<User | null> {
    const session = await authRepository.getCurrentSession();
    if (!session?.user) return null;

    const profile = await authRepository.getProfile(session.user.id);
    if (!profile) return null;

    return mapProfileToUser(profile);
  },

  async updateUser(user: User): Promise<{ user: User; error: null } | { user: null; error: string }> {
    try {
      const validatedUser = UserSchema.parse(user);
      
      const profile = await authRepository.updateProfile(validatedUser.id, {
        name: validatedUser.name,
        email: validatedUser.email,
        payment_handles: validatedUser.paymentHandles,
      });

      return { user: mapProfileToUser(profile), error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { user: null, error: error.issues[0].message };
      }
      if (error instanceof Error) {
        return { user: null, error: error.message };
      }
      return { user: null, error: 'Erro ao atualizar perfil' };
    }
  },
};
