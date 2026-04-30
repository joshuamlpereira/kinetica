// Draft state for the 3-step registration flow. Lives only in memory,
// never written to disk — the user is mid-registration and there's no
// account yet to persist anything against. `reset()` is called when
// the flow ends (success or abandon) so re-entry starts clean.

import { create } from 'zustand';

export type EscrowMode = 'icloud' | 'zk';

export type RegistrationDraft = {
  email: string;
  passphrase: string;
  escrowMode: EscrowMode | null;
};

const empty = (): RegistrationDraft => ({ email: '', passphrase: '', escrowMode: null });

interface State {
  draft: RegistrationDraft;
  setEmail: (email: string) => void;
  setPassphrase: (passphrase: string) => void;
  setEscrow: (mode: EscrowMode) => void;
  reset: () => void;
}

export const useRegistrationDraft = create<State>((set) => ({
  draft: empty(),
  setEmail: (email) => set((s) => ({ draft: { ...s.draft, email } })),
  setPassphrase: (passphrase) => set((s) => ({ draft: { ...s.draft, passphrase } })),
  setEscrow: (escrowMode) => set((s) => ({ draft: { ...s.draft, escrowMode } })),
  reset: () => set({ draft: empty() }),
}));
