import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<UserProfile | null>;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  initialized: false,

  setSession: (session) => {
    set({ session, user: session?.user || null });
    get().loadProfile();
  },

  loadProfile: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser?.id) {
        set({ profile: null });
        return null;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const fullName = String(
          authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Cliente'
        );
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({ id: authUser.id, full_name: fullName, role: 'client' })
          .select('*')
          .single();
        if (createError) throw createError;
        const prof: UserProfile = {
          id: created.id,
          full_name: created.full_name || fullName,
          phone: created.phone || null,
          avatar_url: created.avatar_url || null,
          role: created.role || 'client',
        };
        set({ profile: prof });
        return prof;
      }

      const prof: UserProfile = {
        id: data.id,
        full_name: data.full_name || 'Cliente',
        phone: data.phone || null,
        avatar_url: data.avatar_url || null,
        role: data.role || 'client',
      };
      set({ profile: prof });
      return prof;
    } catch (e) {
      console.warn('Erro ao carregar perfil:', e);
      set({ profile: null });
      return null;
    }
  },

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    set({ session, user: session?.user || null, initialized: true });
    await get().loadProfile();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user || null });
      await get().loadProfile();
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
