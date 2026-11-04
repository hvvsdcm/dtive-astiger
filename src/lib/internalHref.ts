/**
 * Path inside this app ("/shop/women", "/lookbook?season=aw26"). Other origins ("//x", "/\x",
 * "https:"), schemes ("javascript:"), backslashes, whitespace (browsers drop tabs and newlines, so
 * "/<TAB>/x" would become "//x") and control characters are rejected. The database enforces the
 * same rule on home_sections (supabase/migrations/0010_app_hardening.sql).
 */
export function isInternalHref(value: string): boolean {
  return /^\/(?![/\\])[^\s\\\p{Cc}]*$/u.test(value);
}
