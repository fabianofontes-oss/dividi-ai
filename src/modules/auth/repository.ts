import { supabase } from '../../lib/supabase';
import { User, ProfileDb, ProfileDbSchema } from './types';
import { Session } from '@supabase/supabase-js';

export const authRepository = {
  async getCurrentSession(): Promise<Session | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  async getProfile(userId: string): Promise<ProfileDb | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data ? ProfileDbSchema.parse(data) : null;
  },

  async createProfile(profile: Partial<ProfileDb>): Promise<ProfileDb> {
    const { data, error } = await supabase
      .from('profiles')
      .insert(profile)
      .select()
      .single();

    if (error) throw error;
    return ProfileDbSchema.parse(data);
  },

  async updateProfile(userId: string, updates: Partial<ProfileDb>): Promise<ProfileDb> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return ProfileDbSchema.parse(data);
  },

  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};

export const mapProfileToUser = (profile: ProfileDb): User => ({
  id: profile.id,
  name: profile.name || 'Sem nome',
  email: profile.email || undefined,
  avatar: profile.avatar || undefined,
  paymentHandles: profile.payment_handles || [],
});
