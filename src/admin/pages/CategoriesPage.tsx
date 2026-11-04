import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { imageUrl } from '@/lib/images';
import { qk } from '@/lib/queryKeys';
import {
  adminCategoriesKey,
  adminErrorMessage,
  deleteCategory,
  fetchAdminCategories,
  fetchCategoryImpact,
  removeOwnedImages,
  reorderCategories,
  saveCategory,
  type CategoryImpact,
  type CategoryRow,
  type ImageItem,
} from '../api';
import { DataTable, type Column } from '../components/DataTable';
import { ImageUploader } from '../components/ImageUploader';
import {
  categorySchema,
  slugify,
  suggestSlug,
  type CategoryFormInput,
  type CategoryValues,
} from '../schemas';

type TreeRow = CategoryRow & { depth: 0 | 1; siblings: CategoryRow[] };

/** Roots in sort order, each followed by its children. Children of a missing parent show as roots. */
function flattenTree(categories: CategoryRow[]): TreeRow[] {
  const ids = new Set(categories.map((c) => c.id));
  const roots = categories.filter((c) => c.parent_id === null || !ids.has(c.parent_id));
  return roots.flatMap((root) => {
    const children = categories.filter((c) => c.parent_id === root.id);
    return [
      { ...root, depth: 0 as const, siblings: roots },
      ...children.map((child) => ({ ...child, depth: 1 as const, siblings: children })),
    ];
  });
}

type EditTarget = { category: CategoryRow | null; parentId: string | null };

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: adminCategoriesKey, queryFn: fetchAdminCategories });
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [removing, setRemoving] = useState<{
    category: CategoryRow;
    impact: CategoryImpact;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: adminCategoriesKey }),
      queryClient.invalidateQueries({ queryKey: qk.categories }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
    ]);
  }

  async function move(row: TreeRow, offset: -1 | 1) {
    const order = [...row.siblings];
    const from = order.findIndex((c) => c.id === row.id);
    const to = from + offset;
    const item = order[from];
    if (!item || to < 0 || to >= order.length) return;
    order.splice(from, 1);
    order.splice(to, 0, item);
    setBusy(true);
    try {
      await reorderCategories(order.map((c) => ({ id: c.id, sort: c.sort })));
      await refresh();
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function askRemove(category: CategoryRow) {
    try {
      setRemoving({ category, impact: await fetchCategoryImpact(category.id) });
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteCategory(removing.category);
      setRemoving(null);
      toast('삭제했습니다');
      await refresh();
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  const rows = categories.data ? flattenTree(categories.data) : undefined;
  const roots = rows?.filter((row) => row.depth === 0) ?? [];

  const columns: Column<TreeRow>[] = [
    {
      key: 'image',
      header: <span className="sr-only">이미지</span>,
      className: 'w-14',
      cell: (row) =>
        row.image_path ? (
          <img
            src={imageUrl(row.image_path, 'm')}
            alt=""
            loading="lazy"
            className="h-[53px] w-10 max-w-none bg-surface object-cover"
          />
        ) : (
          <div className="h-[53px] w-10 bg-surface" />
        ),
    },
    {
      key: 'name',
      header: '이름',
      className: 'min-w-48',
      cell: (row) => (
        <span className={cn('flex flex-col', row.depth === 1 && 'pl-6')}>
          <span className={row.depth === 0 ? 'font-medium' : undefined}>{row.name}</span>
          <span className="text-2xs text-ink-muted">{row.slug}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      cell: (row) =>
        row.is_active ? <Badge tone="success">표시</Badge> : <Badge tone="muted">숨김</Badge>,
    },
    {
      key: 'order',
      header: '순서',
      className: 'w-24',
      cell: (row) => {
        const index = row.siblings.findIndex((c) => c.id === row.id);
        return (
          <span className="flex">
            <button
              type="button"
              onClick={() => void move(row, -1)}
              disabled={busy || index === 0}
              aria-label={`${row.name} 위로`}
              className="inline-flex size-9 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={ArrowUp} size={16} />
            </button>
            <button
              type="button"
              onClick={() => void move(row, 1)}
              disabled={busy || index === row.siblings.length - 1}
              aria-label={`${row.name} 아래로`}
              className="inline-flex size-9 items-center justify-center disabled:opacity-40"
            >
              <Icon icon={ArrowDown} size={16} />
            </button>
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">작업</span>,
      className: 'text-right',
      cell: (row) => (
        <span className="flex justify-end gap-4 text-sm">
          {row.depth === 0 ? (
            <button
              type="button"
              onClick={() => setEditing({ category: null, parentId: row.id })}
              className="whitespace-nowrap underline-offset-4 hover:underline"
            >
              하위 추가
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing({ category: row, parentId: row.parent_id })}
            className="whitespace-nowrap underline-offset-4 hover:underline"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => void askRemove(row)}
            className="whitespace-nowrap text-danger underline-offset-4 hover:underline"
          >
            삭제
          </button>
        </span>
      ),
    },
  ];

  const impactLines = removing
    ? [
        removing.impact.children > 0
          ? `하위 카테고리 ${removing.impact.children}개는 최상위로 이동합니다.`
          : null,
        removing.impact.products > 0
          ? `상품 ${removing.impact.products}개는 미분류가 됩니다.`
          : null,
        removing.impact.sections > 0
          ? `홈 섹션 ${removing.impact.sections}개에서 연결이 해제됩니다.`
          : null,
      ].filter((line): line is string => line !== null)
    : [];

  return (
    <>
      <title>{pageTitle('카테고리 관리')}</title>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-lg font-medium">카테고리</h1>
        <Button size="sm" onClick={() => setEditing({ category: null, parentId: null })}>
          카테고리 추가
        </Button>
      </div>

      <DataTable
        label="카테고리"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={categories.isPending}
        error={categories.isError}
        onRetry={() => void categories.refetch()}
      />

      {editing ? (
        <CategoryDialog
          target={editing}
          roots={roots}
          siblings={categories.data?.filter((c) => c.parent_id === editing.parentId) ?? []}
          hasChildren={
            editing.category !== null &&
            (categories.data ?? []).some((c) => c.parent_id === editing.category?.id)
          }
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            toast('저장했습니다');
            await refresh();
          }}
        />
      ) : null}

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `'${removing.category.name}' 삭제` : ''}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setRemoving(null)}>
              취소
            </Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void confirmRemove()}>
              삭제
            </Button>
          </>
        }
      >
        {impactLines.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {impactLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          '연결된 항목이 없습니다.'
        )}
      </Dialog>
    </>
  );
}

function CategoryDialog({
  target,
  roots,
  siblings,
  hasChildren,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  roots: CategoryRow[];
  siblings: CategoryRow[];
  hasChildren: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { category } = target;
  const isNew = category === null;
  const [categoryId] = useState(() => category?.id ?? crypto.randomUUID());
  const [images, setImages] = useState<ImageItem[]>(() =>
    category?.image_path
      ? [{ id: category.id, storagePath: category.image_path, alt: '', sort: 0 }]
      : [],
  );
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    getFieldState,
    formState: { errors },
  } = useForm<CategoryFormInput, unknown, CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      parentId: target.parentId ?? '',
      isActive: category?.is_active ?? true,
    },
  });

  // New categories follow the name until the slug is edited by hand.
  const followName = () => isNew && !getFieldState('slug').isDirty;

  function cancel() {
    // Drop uploads that were never saved to the category.
    const unsaved = images.filter((image) => !image.id).map((image) => image.storagePath);
    if (unsaved.length > 0) void removeOwnedImages(unsaved, categoryId).catch(() => undefined);
    onClose();
  }

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    try {
      await saveCategory({
        id: categoryId,
        isNew,
        values,
        imagePath: images[0]?.storagePath ?? null,
        previousImagePath: category?.image_path ?? null,
        sort: Math.max(-1, ...siblings.map((c) => c.sort)) + 1,
      });
      await onSaved();
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog
      open
      onClose={cancel}
      title={isNew ? '카테고리 추가' : '카테고리 수정'}
      className="max-w-[560px]"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={cancel}>
            취소
          </Button>
          <Button type="submit" form="category-form" size="sm" loading={saving}>
            저장
          </Button>
        </>
      }
    >
      <form
        id="category-form"
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-5"
      >
        <Field id="category-name" label="이름" required error={errors.name?.message}>
          <Input
            id="category-name"
            invalid={!!errors.name}
            {...register('name', {
              onChange: (event: { target: { value: string } }) => {
                if (followName()) setValue('slug', slugify(event.target.value));
              },
              onBlur: () => {
                if (followName() && !getValues('slug')) {
                  setValue('slug', suggestSlug(getValues('name'), 'category'));
                }
              },
            })}
          />
        </Field>
        <Field id="category-slug" label="슬러그" required error={errors.slug?.message}>
          <Input
            id="category-slug"
            invalid={!!errors.slug}
            autoCapitalize="none"
            spellCheck={false}
            {...register('slug')}
          />
        </Field>
        <Field id="category-parent" label="상위 카테고리">
          <Select id="category-parent" {...register('parentId')}>
            <option value="">없음</option>
            {roots
              .filter((root) => !hasChildren && root.id !== categoryId)
              .map((root) => (
                <option key={root.id} value={root.id}>
                  {root.name}
                </option>
              ))}
          </Select>
        </Field>
        <Checkbox id="category-active" label="스토어에 표시" {...register('isActive')} />
        <div className="flex flex-col gap-2">
          <span className="text-xs">대표 이미지</span>
          <div className="w-1/2 sm:w-1/3">
            <ImageUploader
              bucket="products"
              ownerId={categoryId}
              value={images}
              onChange={setImages}
              max={1}
              withAlt={false}
              label="대표 이미지"
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
