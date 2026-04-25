import { create } from 'zustand';

export type AuthStatus = 'unknown' | 'logged_out' | 'logged_in';

interface AuthState {
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  setStatus: (status) => set({ status }),
}));
