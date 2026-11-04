/** A paragraph, a list, or a small table. Text is plain; `\n` becomes a line break. */
export type Block =
  string | { list: string[]; ordered?: boolean } | { table: { head: string[]; rows: string[][] } };

export type DocSection = { id: string; title: string; blocks: Block[] };

export type LegalDocument = {
  title: string;
  /** Shown under the title when set (terms, privacy). */
  effectiveDate?: string;
  sections: DocSection[];
};

export type FaqGroup = { id: string; title: string; items: { q: string; a: string }[] };

/** Values the admin edits in site_settings. `null` while unknown: texts fall back to wording without numbers. */
export type ShopRules = {
  shippingFee: number;
  freeShippingThreshold: number | null;
  paymentDueHours: number;
} | null;
