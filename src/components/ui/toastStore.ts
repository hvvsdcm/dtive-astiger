import { create } from 'zustand';

export type ToastTone = 'default' | 'error';
export type ToastItem = { id: number; message: string; tone: ToastTone };

const DURATION_MS = 3000;
let nextId = 1;

export const useToastStore = create<{
  items: ToastItem[];
  dismiss: (id: number) => void;
}>()((set) => ({
  items: [],
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
}));

/** Shows a short message at the bottom of the screen for 3 seconds. Never include emails/phones. */
export function toast(message: string, tone: ToastTone = 'default') {
  const id = nextId++;
  useToastStore.setState((state) => ({ items: [...state.items.slice(-2), { id, message, tone }] }));
  window.setTimeout(() => useToastStore.getState().dismiss(id), DURATION_MS);
}
