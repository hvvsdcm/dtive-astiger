import { cn } from '@/components/ui/cn';
import type { ProductCardVariant } from '../model';

export type VariantPickerProps = {
  colors: string[];
  color: string | undefined;
  onColorChange: (color: string) => void;
  /** Variants of the selected colour in size order. */
  sizes: ProductCardVariant[];
  variantId: string | undefined;
  onVariantChange: (variantId: string) => void;
  /** "사이즈를 선택하세요" state after an add attempt without a size. */
  sizeError: boolean;
  sizeErrorId: string;
};

export function VariantPicker({
  colors,
  color,
  onColorChange,
  sizes,
  variantId,
  onVariantChange,
  sizeError,
  sizeErrorId,
}: VariantPickerProps) {
  const selectedSize = sizes.find((v) => v.id === variantId)?.size;

  return (
    <div className="flex flex-col gap-6">
      {colors.length && colors[0] ? (
        <div role="group" aria-label="색상">
          <p className="mb-2 text-xs text-ink-muted">색상</p>
          <div className="flex flex-wrap gap-x-4">
            {colors.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={color === value}
                onClick={() => onColorChange(value)}
                className={cn(
                  'h-8 text-sm underline-offset-4 hover:underline',
                  color === value && 'underline',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div role="group" aria-label="사이즈" aria-describedby={sizeError ? sizeErrorId : undefined}>
        <p className="mb-2 text-xs text-ink-muted">
          사이즈{selectedSize ? <span className="text-ink"> {selectedSize}</span> : null}
        </p>
        <div
          className={cn(
            'flex w-fit flex-wrap gap-2 outline-offset-4',
            sizeError && 'outline outline-1 outline-danger',
          )}
        >
          {sizes.map((variant) => {
            const out = variant.stock < 1;
            const selected = variant.id === variantId;
            return (
              <button
                key={variant.id}
                type="button"
                disabled={out}
                aria-pressed={selected}
                aria-label={out ? `${variant.size} 품절` : variant.size}
                onClick={() => onVariantChange(variant.id)}
                className={cn(
                  'h-11 min-w-11 border px-3 text-sm transition-colors',
                  out && 'border-line text-ink-muted line-through',
                  !out && selected && 'border-ink bg-ink text-white',
                  !out && !selected && 'border-line hover:border-ink',
                )}
              >
                {variant.size}
              </button>
            );
          })}
        </div>
        {sizeError ? (
          <p id={sizeErrorId} role="alert" className="mt-3 text-xs text-danger">
            사이즈를 선택하세요
          </p>
        ) : null}
      </div>
    </div>
  );
}
