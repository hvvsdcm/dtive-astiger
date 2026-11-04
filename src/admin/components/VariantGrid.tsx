import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/components/ui/cn';
import { buildRows, type VariantGridValue, type VariantRowInput } from '../schemas';
import { DataTable, denseControlClass, type Column } from './DataTable';

function OptionList({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [text, setText] = useState('');

  function add() {
    const added = text
      .split(',')
      .map((part) => part.trim().slice(0, 20))
      .filter((part) => part && !values.includes(part));
    if (added.length > 0) onChange([...values, ...new Set(added)]);
    setText('');
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            add();
          }}
          placeholder={placeholder}
          className={denseControlClass}
        />
        <Button variant="secondary" size="sm" onClick={add} disabled={!text.trim()}>
          추가
        </Button>
      </div>
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex h-8 items-center border border-line pl-3 text-sm"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={`${value} 삭제`}
                className="inline-flex size-8 items-center justify-center text-ink-muted hover:text-ink"
              >
                <Icon icon={X} size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Colour and size lists that expand into one variant row per combination (SKU, stock, price
 * difference, on sale). Removing a colour or size removes its rows.
 */
export function VariantGrid({
  value,
  onChange,
  skuBase,
  errors = {},
}: {
  value: VariantGridValue;
  onChange: (next: VariantGridValue) => void;
  /** Product slug, used for the default SKU of new rows. */
  skuBase: string;
  /** Messages keyed `${rowIndex}.${field}`. */
  errors?: Record<string, string>;
}) {
  const setOptions = (colors: string[], sizes: string[]) =>
    onChange({ colors, sizes, rows: buildRows(colors, sizes, value.rows, skuBase) });

  const updateRow = (id: string, patch: Partial<VariantRowInput>) =>
    onChange({
      ...value,
      rows: value.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });

  const indexOf = new Map(value.rows.map((row, index) => [row.id, index]));

  function cellInput(row: VariantRowInput, field: 'sku' | 'stock' | 'priceDelta', label: string) {
    const error = errors[`${indexOf.get(row.id)}.${field}`];
    return (
      <div className="flex flex-col gap-1">
        <input
          value={row[field]}
          onChange={(event) => updateRow(row.id, { [field]: event.target.value })}
          inputMode={field === 'sku' ? undefined : 'numeric'}
          aria-label={`${row.color || '기본'} ${row.size} ${label}`}
          aria-invalid={error ? true : undefined}
          className={cn(denseControlClass, field !== 'sku' && 'text-right')}
        />
        {error ? <span className="text-2xs text-danger">{error}</span> : null}
      </div>
    );
  }

  const columns: Column<VariantRowInput>[] = [
    { key: 'color', header: '색상', cell: (row) => row.color || '—', className: 'w-24' },
    { key: 'size', header: '사이즈', cell: (row) => row.size || '—', className: 'w-20' },
    {
      key: 'sku',
      header: 'SKU',
      cell: (row) => cellInput(row, 'sku', 'SKU'),
      className: 'min-w-48',
    },
    {
      key: 'stock',
      header: '재고',
      cell: (row) => cellInput(row, 'stock', '재고'),
      className: 'w-24',
    },
    {
      key: 'priceDelta',
      header: '가격 차이',
      cell: (row) => cellInput(row, 'priceDelta', '가격 차이'),
      className: 'w-28',
    },
    {
      key: 'isActive',
      header: '판매',
      className: 'w-16',
      cell: (row) => (
        <Checkbox
          id={`variant-active-${row.id}`}
          checked={row.isActive}
          onChange={(event) => updateRow(row.id, { isActive: event.target.checked })}
          label={<span className="sr-only">{`${row.color || '기본'} ${row.size} 판매`}</span>}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <OptionList
          label="색상"
          placeholder="Black, Ivory"
          values={value.colors}
          onChange={(colors) => setOptions(colors, value.sizes)}
        />
        <OptionList
          label="사이즈"
          placeholder="S, M, L"
          values={value.sizes}
          onChange={(sizes) => setOptions(value.colors, sizes)}
        />
      </div>
      <DataTable label="옵션" columns={columns} rows={value.rows} rowKey={(row) => row.id} />
    </div>
  );
}
