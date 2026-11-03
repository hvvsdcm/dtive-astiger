import type { LucideIcon, LucideProps } from 'lucide-react';

export type IconProps = Omit<LucideProps, 'ref'> & { icon: LucideIcon };

/** lucide icon with the house defaults (20px, stroke 1.5). Decorative unless given aria-label. */
export function Icon({ icon: Glyph, size = 20, strokeWidth = 1.5, ...props }: IconProps) {
  const labelled = props['aria-label'] !== undefined;
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      aria-hidden={labelled ? undefined : true}
      focusable="false"
      {...props}
    />
  );
}
