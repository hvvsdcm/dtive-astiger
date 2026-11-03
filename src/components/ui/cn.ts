/** Joins class names, dropping falsy values. Later classes do not override earlier ones; avoid passing conflicting utilities. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
