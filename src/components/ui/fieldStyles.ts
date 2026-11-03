/** Shared look of text-like controls (Input, Select, Textarea). */
export const controlClass =
  'block w-full border bg-white px-3 text-md text-ink transition-colors outline-none focus:border-ink focus-visible:outline-none disabled:bg-surface disabled:text-ink-muted md:text-base';

export const controlBorder = (invalid: boolean | undefined) =>
  invalid ? 'border-danger' : 'border-field';
