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
      const userId = session?.user?.id || '11111111-1111-1111-1111-111111111111';
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data && !error) {
        const prof: UserProfile = {
          id: data.id,
          full_name: data.full_name || 'Cliente 1',
          phone: data.phone || '+258 84 000 0001',
          avatar_url: data.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          role: data.role || 'client'
        };
        set({ profile: prof });
        return prof;
      }
    } catch (e) {
      console.warn('Erro ao carregar perfil:', e);
    }

    const fallback: UserProfile = {
      id: '11111111-1111-1111-1111-111111111111',
      full_name: 'Cliente 1',
      phone: '+258 84 000 0001',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      role: 'client'
    };
    set({ profile: fallback });
    return fallback;
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
