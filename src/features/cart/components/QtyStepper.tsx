import { Minus, Plus } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';

export type QtyStepperProps = {
  value: number;
  max: number;
  onChange: (value: number) => void;
  /** Names the item for screen readers ("수량, {label}"). */
  label: string;
};

const stepButton =
  'inline-flex size-8 items-center justify-center transition-colors hover:bg-surface disabled:pointer-events-none disabled:opacity-40';

/** 1..max quantity control (max = min(10, stock)). */
export function QtyStepper({ value, max, onChange, label }: QtyStepperProps) {
  return (
    <div
      role="group"
      aria-label={`수량, ${label}`}
      className="inline-flex items-center border border-line"
    >
      <button
        type="button"
        className={stepButton}
        aria-label="수량 줄이기"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Icon icon={Minus} size={14} />
      </button>
      <output aria-live="polite" className="w-8 text-center text-sm tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={stepButton}
        aria-label="수량 늘리기"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Icon icon={Plus} size={14} />
      </button>
    </div>
  );
}
