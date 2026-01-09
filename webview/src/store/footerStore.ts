import { create } from "zustand";

interface FooterState {
  showFooter: boolean;
  toggleFooter: () => void;
}

export const useFooterStore = create<FooterState>((set) => ({
  showFooter: false,
  toggleFooter: (): void => {
    set((state) => ({ showFooter: !state.showFooter }));
  },
}));
