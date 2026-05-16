import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';

interface StoreState {
  user: User | null;
  session: Session | null;
  factoryId: string | null;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setFactoryId: (factoryId: string | null) => void;
}

export const useStore = create<StoreState>((set) => ({
  user: null,
  session: null,
  factoryId: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setFactoryId: (factoryId) => set({ factoryId }),
}));