import { create } from 'zustand';
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from './firebase';

interface AuthState {
  user: User | null;
  initialized: boolean;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user }),
  initialize: async () => {
    set({ user: auth.currentUser ?? null, initialized: true });
    onAuthStateChanged(auth, (user) => {
      set({ user });
    });
  },
  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null });
  },
}));
