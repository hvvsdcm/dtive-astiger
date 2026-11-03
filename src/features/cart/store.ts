import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const MAX_LINE_QTY = 10;

export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  color: string;
  size: string;
  unitPrice: number;
  imagePath: string | null;
  quantity: number;
  stock: number;
};

export type CartState = {
  lines: CartLine[];
  isOpen: boolean;
  /** Adds a line, merging with an existing line of the same variant; capped at min(10, stock). */
  add(line: Omit<CartLine, 'quantity'>, qty?: number): void;
  /** Sets a line quantity, clamped to 1..min(10, stock). */
  setQty(variantId: string, qty: number): void;
  remove(variantId: string): void;
  clear(): void;
  open(): void;
  close(): void;
};

const clampQty = (qty: number, stock: number) =>
  Math.max(1, Math.min(MAX_LINE_QTY, stock, Math.floor(qty)));

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      add: (line, qty = 1) =>
        set((state) => {
          if (line.stock < 1 || qty < 1) return state;
          const existing = state.lines.find((l) => l.variantId === line.variantId);
          if (!existing) {
            return { lines: [...state.lines, { ...line, quantity: clampQty(qty, line.stock) }] };
          }
          return {
            lines: state.lines.map((l) =>
              l.variantId === line.variantId
                ? { ...l, ...line, quantity: clampQty(existing.quantity + qty, line.stock) }
                : l,
            ),
          };
        }),
      setQty: (variantId, qty) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.variantId === variantId ? { ...l, quantity: clampQty(qty, l.stock) } : l,
          ),
        })),
      remove: (variantId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'da.cart.v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

export const selectSubtotal = (s: CartState) =>
  s.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

export const selectCount = (s: CartState) => s.lines.reduce((sum, line) => sum + line.quantity, 0);
