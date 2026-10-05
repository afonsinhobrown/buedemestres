import { create } from 'zustand';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from './firebase';

interface AuthState {
  user: User | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  initialize: async () => {
    onAuthStateChanged(auth, (user) => {
      set({ user, initialized: true });
    });
  },
  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null });
  },
}));
