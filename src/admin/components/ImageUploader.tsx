import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { cn } from '@/components/ui/cn';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/toastStore';
import { imageUrl, type StorageBucket } from '@/lib/images';
import { ACCEPTED_IMAGE_TYPES, imageFileError } from '@/lib/imageResize';
import { removeOwnedImages, uploadImage, type ImageItem } from '../api';
import { denseControlClass } from './DataTable';

export type ImageUploaderProps = {
  bucket: StorageBucket;
  /** Folder for new uploads (product/category/section id): "<bucket>/<ownerId>/<uuid>.webp". */
  ownerId: string;
  value: ImageItem[];
  onChange: (next: ImageItem[]) => void;
  /** Colour tag choices (the product's colours). Omit to hide the colour tag. */
  colorOptions?: string[];
  /** Most images allowed (1 for a single cover image). */
  max?: number;
  /** Show the alt text field (off where the owning record has no alt column). */
  withAlt?: boolean;
  /** Accessible name of the image list. */
  label?: string;
};

function uploadErrorMessage(error: unknown): string {
  const { status, code } = (error ?? {}) as { status?: unknown; code?: unknown };
  if (status === 415 || code === 'InvalidMimeType') return 'JPG, PNG, WEBP 파일만 올릴 수 있습니다';
  if (status === 413 || code === 'EntityTooLarge') return '파일이 너무 큽니다';
  if (error instanceof Error && error.name === 'InvalidStateError')
    return '이미지를 읽지 못했습니다';
  return '업로드하지 못했습니다';
}

const withSort = (items: ImageItem[]) => items.map((item, sort) => ({ ...item, sort }));

/**
 * Uploads 2000px + 800px WebP renditions per file, orders images by drag or arrow buttons, edits
 * alt text and colour tags. Deleting an image this instance uploaded and that has no `id` yet
 * removes both files at once; deleting an already saved image only drops it from `value` — the
 * owner removes its files after saving (removeOwnedImages), so an unsaved edit never breaks a
 * stored record.
 */
export function ImageUploader({
  bucket,
  ownerId,
  value,
  onChange,
  colorOptions,
  max = 20,
  withAlt = true,
  label = '이미지',
}: ImageUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadedHereRef = useRef(new Set<string>());
  const latestRef = useRef(value);
  const [pending, setPending] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false);

  useEffect(() => {
    latestRef.current = value;
  }, [value]);

  const room = max - value.length - pending;

  async function addFiles(files: File[]) {
    const accepted: File[] = [];
    for (const file of files) {
      const error = imageFileError(file);
      if (error) toast(error, 'error');
      else accepted.push(file);
    }
    const batch = accepted.slice(0, Math.max(0, room));
    if (batch.length < accepted.length) toast(`최대 ${max}장까지 올릴 수 있습니다`, 'error');
    if (batch.length === 0) return;

    setPending((n) => n + batch.length);
    for (const file of batch) {
      try {
        const storagePath = await uploadImage(bucket, ownerId, file);
        uploadedHereRef.current.add(storagePath);
        const next = [...latestRef.current, { storagePath, alt: '', color: null, sort: 0 }];
        latestRef.current = withSort(next);
        onChange(latestRef.current);
      } catch (error) {
        toast(uploadErrorMessage(error), 'error');
      } finally {
        setPending((n) => n - 1);
      }
    }
  }

  function update(index: number, patch: Partial<ImageItem>) {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onChange(withSort(next));
  }

  function remove(index: number) {
    const item = value[index];
    if (!item) return;
    onChange(withSort(value.filter((_, i) => i !== index)));
    if (!item.id && uploadedHereRef.current.has(item.storagePath)) {
      uploadedHereRef.current.delete(item.storagePath);
      void removeOwnedImages([item.storagePath], ownerId).catch(() => undefined);
    }
  }

  function onListDragOver(event: DragEvent) {
    if (dragIndex !== null) {
      event.preventDefault();
      return;
    }
    if (event.dataTransfer.types.includes('Files') && room > 0) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setFileOver(true);
    }
  }

  function onListDrop(event: DragEvent) {
    setFileOver(false);
    if (dragIndex !== null || event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    void addFiles([...event.dataTransfer.files]);
  }

  return (
    <div
      onDragOver={onListDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFileOver(false);
      }}
      onDrop={onListDrop}
      className={cn('outline-offset-4', fileOver && 'outline-2 outline-ink outline-dashed')}
    >
      <ul
        aria-label={label}
        className={cn(
          'grid gap-3',
          max === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
        )}
      >
        {value.map((item, index) => (
          <li
            key={item.storagePath}
            draggable
            onDragStart={(event) => {
              setDragIndex(index);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', String(index));
            }}
            onDragEnd={() => setDragIndex(null)}
            onDrop={(event) => {
              if (dragIndex === null) return;
              event.preventDefault();
              event.stopPropagation();
              move(dragIndex, index);
              setDragIndex(null);
            }}
            className={cn('flex flex-col gap-2', dragIndex === index && 'opacity-40')}
          >
            <div className="relative aspect-[3/4] cursor-grab overflow-hidden bg-surface active:cursor-grabbing">
              <img
                src={imageUrl(item.storagePath, 'm')}
                alt={item.alt}
                draggable={false}
                className="size-full object-cover"
              />
              <span className="absolute top-0 left-0 bg-bg px-2 text-xs leading-6">
                {index + 1}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={index === 0}
                  aria-label={`${index + 1}번 이미지 앞으로`}
                  className="inline-flex size-9 items-center justify-center disabled:opacity-40"
                >
                  <Icon icon={ArrowLeft} size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={index === value.length - 1}
                  aria-label={`${index + 1}번 이미지 뒤로`}
                  className="inline-flex size-9 items-center justify-center disabled:opacity-40"
                >
                  <Icon icon={ArrowRight} size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`${index + 1}번 이미지 삭제`}
                className="inline-flex size-9 items-center justify-center hover:text-danger"
              >
                <Icon icon={Trash2} size={16} />
              </button>
            </div>
            {withAlt ? (
              <input
                value={item.alt}
                onChange={(event) => update(index, { alt: event.target.value })}
                maxLength={200}
                placeholder="대체 텍스트"
                aria-label={`${index + 1}번 이미지 대체 텍스트`}
                className={denseControlClass}
              />
            ) : null}
            {colorOptions ? (
              <select
                value={item.color ?? ''}
                onChange={(event) => update(index, { color: event.target.value || null })}
                aria-label={`${index + 1}번 이미지 색상`}
                className={denseControlClass}
              >
                <option value="">색상 없음</option>
                {colorOptions.filter(Boolean).map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
                {item.color && !colorOptions.includes(item.color) ? (
                  <option value={item.color}>{item.color}</option>
                ) : null}
              </select>
            ) : null}
          </li>
        ))}
        {Array.from({ length: pending }, (_, index) => (
          <li
            key={`pending-${index}`}
            className="flex aspect-[3/4] items-center justify-center bg-surface"
          >
            <Spinner size={20} label="업로드 중" />
          </li>
        ))}
        {room > 0 ? (
          <li>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              multiple={max > 1}
              className="peer sr-only"
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                if (inputRef.current) inputRef.current.value = '';
                void addFiles(files);
              }}
            />
            <label
              htmlFor={inputId}
              className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-field text-sm text-ink-muted transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink hover:border-ink hover:text-ink"
            >
              <Icon icon={ImagePlus} />
              이미지 추가
            </label>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
