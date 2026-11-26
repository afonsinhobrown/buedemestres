import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { unregisterPushToken } from './push';
import { getDeviceId } from './deviceId';

interface AuthState {
  session: Session | null;
  user: User | null;
  providerProfile: any | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  loadProfile: () => Promise<void>;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function ensureProvider(userId: string, fullName: string, email?: string | null): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    await supabase.from('profiles').insert({
      id: userId,
      full_name: fullName,
      email: email || null,
      role: 'provider',
    });
  } else if (profile.role !== 'provider') {
    return false;
  }

  const { data: provider } = await supabase
    .from('provider_profiles')
    .select('*')
    .eq('profile_id', userId)
    .maybeSingle();

  if (!provider) {
    const slug = `mestre-${userId.slice(0, 8)}`;
      await supabase.from('provider_profiles').insert({
        profile_id: userId,
        slug,
        business_name: fullName,
        primary_category_id: 2,
        is_published: true,
        is_available: true,
        trial_started_at: new Date().toISOString(),
        trial_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

  const categoryId = Number(provider?.primary_category_id) || 2;
  await supabase.from('provider_categories').upsert(
    { provider_id: userId, category_id: categoryId },
    { onConflict: 'provider_id,category_id', ignoreDuplicates: true }
  );

  return true;
}

async function ensureReferral(userId: string, code: string | null | undefined) {
  const referralCode = String(code || '').trim().toUpperCase();
  if (!referralCode) return;

  const { data: referrer } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', referralCode)
    .maybeSingle();

  if (!referrer?.id || referrer.id === userId) return;

  await supabase
    .from('referrals')
    .upsert(
      { referrer_id: referrer.id, referred_id: userId },
      { onConflict: 'referred_id', ignoreDuplicates: true }
    );

  await supabase.from('profiles').update({ referred_by: referrer.id }).eq('id', userId);
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
  providerProfile: null,
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
        set({ providerProfile: null });
        return;
      }
      const fullName = String(
        authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Mestre'
      );
      const isProvider = await ensureProvider(authUser.id, fullName, authUser.email);
      if (!isProvider) {
        set({ providerProfile: null });
        return;
      }
      await ensureReferral(authUser.id, authUser.user_metadata?.referral_code);
      await ensureTermsAcceptance(authUser.id, authUser.user_metadata);
      const { data: provider } = await supabase
        .from('provider_profiles')
        .select('*, categories:primary_category_id(id, name, slug)')
        .eq('profile_id', authUser.id)
        .maybeSingle();
      set({ providerProfile: provider || null });
    } catch (e) {
      console.warn('Erro ao carregar perfil do mestre:', e);
      set({ providerProfile: null });
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
    try {
      const providerId = get().providerProfile?.profile_id;
      if (providerId) {
        const deviceId = await getDeviceId();
        await supabase.rpc('provider_release_device', {
          p_provider: providerId,
          p_device_id: deviceId,
        });
      }
    } catch (e) {
      console.warn('Erro ao libertar dispositivo:', e);
    }
    await unregisterPushToken();
    await supabase.auth.signOut();
    set({ session: null, user: null, providerProfile: null });
  },
}));
