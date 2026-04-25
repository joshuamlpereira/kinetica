import { create } from 'zustand';

interface SessionState {
  activeWorkoutId: string | null;
  setActiveWorkoutId: (id: string | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeWorkoutId: null,
  setActiveWorkoutId: (id) => set({ activeWorkoutId: id }),
}));
