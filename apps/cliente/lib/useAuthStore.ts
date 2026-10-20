import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { unregisterPushToken } from './push';

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

async function ensureTermsAcceptance(userId: string, metadata: any) {
  const versionId = Number(metadata?.terms_version_id);
  if (!Number.isFinite(versionId) || versionId <= 0) return;
  await supabase.from('terms_acceptances').upsert(
    {
      profile_id: userId,
      terms_version_id: versionId,
      email_opt_in: Boolean(metadata?.email_opt_in),
    },
    { onConflict: 'profile_id,terms_version_id', ignoreDuplicates: true }
  );
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
          .insert({ id: authUser.id, full_name: fullName, email: authUser.email || null, role: 'client' })
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
        await ensureTermsAcceptance(authUser.id, authUser.user_metadata);
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
      await ensureTermsAcceptance(authUser.id, authUser.user_metadata);
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
    await unregisterPushToken();
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
