import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { imageUrl } from '@/lib/images';
import { qk } from '@/lib/queryKeys';
import { HOME_SECTION_KINDS, PRODUCT_STATUS_LABEL, type HomeSectionKind } from '@/types/domain';
import {
  adminCategoriesKey,
  adminErrorMessage,
  deleteSection,
  fetchAdminCategories,
  fetchAdminSections,
  fetchPickedProducts,
  lookbookItems,
  removeOwnedImages,
  reorderSections,
  saveSection,
  searchPickableProducts,
  sectionImagePaths,
  setSectionActive,
  type CategoryRow,
  type HomeSectionRow,
  type ImageItem,
  type PickedProduct,
} from '../api';
import { DataTable, denseControlClass } from '../components/DataTable';
import { ImageUploader } from '../components/ImageUploader';
import {
  COLLECTION_MAX_PRODUCTS,
  LOOKBOOK_MAX_ITEMS,
  sectionSchema,
  type SectionInput,
} from '../schemas';

const KIND_LABEL: Record<HomeSectionKind, string> = {
  hero: '메인 배너',
  split: '2단 배너',
  collection: '상품 모음',
  lookbook: '룩북',
};

const IMAGE_MAX: Record<HomeSectionKind, number> = {
  hero: 1,
  split: 2,
  collection: 0,
  lookbook: LOOKBOOK_MAX_ITEMS,
};

/** "부모 / 자식" labels in tree order for the collection category select. */
function categoryOptions(categories: CategoryRow[]): { id: string; label: string }[] {
  const roots = categories.filter((c) => c.parent_id === null);
  return roots.flatMap((root) => [
    { id: root.id, label: root.name },
    ...categories
      .filter((c) => c.parent_id === root.id)
      .map((child) => ({ id: child.id, label: `${root.name} / ${child.name}` })),
  ]);
}

function SectionPreview({
  section,
  categories,
}: {
  section: HomeSectionRow;
  categories: CategoryRow[] | undefined;
}) {
  if (section.kind === 'collection') {
    const category = categories?.find((c) => c.id === section.category_id);
    return (
      <span className="text-ink-muted">
        {section.product_ids.length
          ? `상품 ${section.product_ids.length}개`
          : (category?.name ?? '카테고리 없음')}
      </span>
    );
  }
  const paths = sectionImagePaths(section).slice(0, 4);
  if (paths.length === 0) return <span className="text-ink-muted">이미지 없음</span>;
  return (
    <span className="flex gap-1">
      {paths.map((path) => (
        <img
          key={path}
          src={imageUrl(path, 'm')}
          alt=""
          loading="lazy"
          className="h-12 w-9 max-w-none bg-surface object-cover"
        />
      ))}
    </span>
  );
}

type EditTarget = { section: HomeSectionRow | null };

export function HomeSectionsPage() {
  const queryClient = useQueryClient();
  const sections = useQuery({ queryKey: qk.admin.sections, queryFn: fetchAdminSections });
  const categories = useQuery({ queryKey: adminCategoriesKey, queryFn: fetchAdminCategories });
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [deleting, setDeleting] = useState<HomeSectionRow | null>(null);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.admin.sections }),
      queryClient.invalidateQueries({ queryKey: qk.homeSections }),
    ]);

  const reorder = useMutation({
    mutationFn: reorderSections,
    onSettled: refresh,
    onError: (error) => toast(adminErrorMessage(error), 'error'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setSectionActive(id, active),
    onSuccess: () => toast('저장했습니다'),
    onError: (error) => toast(adminErrorMessage(error), 'error'),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: deleteSection,
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
      toast('삭제했습니다');
    },
    onError: (error) => toast(adminErrorMessage(error), 'error'),
  });

  const rows = sections.data ?? [];

  function move(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    reorder.mutate(next.map(({ id, sort }) => ({ id, sort })));
  }

  return (
    <>
      <title>{pageTitle('홈 화면')}</title>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-lg font-medium">홈 화면</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
          >
            홈 보기
            <Icon icon={ExternalLink} size={14} />
          </Link>
          <Button size="sm" onClick={() => setEditing({ section: null })}>
            <Icon icon={Plus} size={16} />
            섹션 추가
          </Button>
        </div>
      </div>

      <DataTable<HomeSectionRow>
        label="홈 섹션"
        rows={sections.data}
        rowKey={(row) => row.id}
        loading={sections.isPending}
        error={sections.isError}
        onRetry={() => void sections.refetch()}
        emptyText="섹션이 없습니다"
        columns={[
          {
            key: 'order',
            header: <span className="sr-only">순서</span>,
            className: 'w-20',
            cell: (row) => {
              const index = rows.indexOf(row);
              return (
                <span className="flex">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorder.isPending}
                    aria-label={`${row.title || KIND_LABEL[row.kind]} 위로`}
                    className="inline-flex size-9 items-center justify-center disabled:opacity-30"
                  >
                    <Icon icon={ArrowUp} size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1 || reorder.isPending}
                    aria-label={`${row.title || KIND_LABEL[row.kind]} 아래로`}
                    className="inline-flex size-9 items-center justify-center disabled:opacity-30"
                  >
                    <Icon icon={ArrowDown} size={16} />
                  </button>
                </span>
              );
            },
          },
          {
            key: 'title',
            header: '제목',
            className: 'min-w-48',
            cell: (row) => (
              <button
                type="button"
                onClick={() => setEditing({ section: row })}
                className="flex flex-col text-left hover:underline"
              >
                <span>{row.title || <span className="text-ink-muted">제목 없음</span>}</span>
                <span className="text-2xs text-ink-muted">{KIND_LABEL[row.kind]}</span>
              </button>
            ),
          },
          {
            key: 'content',
            header: '내용',
            cell: (row) => <SectionPreview section={row} categories={categories.data} />,
          },
          {
            key: 'active',
            header: '표시',
            className: 'w-28',
            cell: (row) => (
              <Checkbox
                id={`section-active-${row.id}`}
                label={row.is_active ? '표시' : '숨김'}
                checked={row.is_active}
                disabled={toggle.isPending}
                onChange={(event) => toggle.mutate({ id: row.id, active: event.target.checked })}
              />
            ),
          },
          {
            key: 'actions',
            header: <span className="sr-only">관리</span>,
            className: 'w-28 text-right',
            cell: (row) => (
              <span className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ section: row })}>
                  수정
                </Button>
                <button
                  type="button"
                  onClick={() => setDeleting(row)}
                  aria-label={`${row.title || KIND_LABEL[row.kind]} 삭제`}
                  className="inline-flex size-9 items-center justify-center hover:text-danger"
                >
                  <Icon icon={Trash2} size={16} />
                </button>
              </span>
            ),
          },
        ]}
      />

      {editing ? (
        <SectionDialog
          section={editing.section}
          categories={categories.data ?? []}
          nextSort={Math.max(-1, ...rows.map((row) => row.sort)) + 1}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await refresh();
            setEditing(null);
            toast('저장했습니다');
          }}
        />
      ) : null}

      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="섹션 삭제"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleting(null)}>
              닫기
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting)}
            >
              삭제
            </Button>
          </>
        }
      >
        {deleting ? `${deleting.title || KIND_LABEL[deleting.kind]} 섹션을 삭제할까요?` : null}
      </Dialog>
    </>
  );
}

type LookMeta = { caption: string; href: string };

function SectionDialog({
  section,
  categories,
  nextSort,
  onClose,
  onSaved,
}: {
  section: HomeSectionRow | null;
  categories: CategoryRow[];
  nextSort: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  const isNew = section === null;
  const [sectionId] = useState(() => section?.id ?? crypto.randomUUID());
  const [kind, setKind] = useState<HomeSectionKind>(section?.kind ?? 'hero');
  const [title, setTitle] = useState(section?.title ?? '');
  const [linkLabel, setLinkLabel] = useState(section?.link_label ?? '');
  const [linkHref, setLinkHref] = useState(section?.link_href ?? '');
  const [isActive, setIsActive] = useState(section?.is_active ?? true);
  const [categoryId, setCategoryId] = useState(section?.category_id ?? '');
  const [productIds, setProductIds] = useState<string[]>(section?.product_ids ?? []);
  // Stored images carry the section id so ImageUploader leaves their files alone until saved.
  const [images, setImages] = useState<ImageItem[]>(() => {
    if (!section) return [];
    const paths =
      section.kind === 'lookbook'
        ? lookbookItems(section).map((item) => item.imagePath)
        : [section.image_path, section.image_path_2].filter((p): p is string => Boolean(p));
    return paths.map((storagePath, sort) => ({ id: section.id, storagePath, alt: '', sort }));
  });
  const [looks, setLooks] = useState<Record<string, LookMeta>>(() =>
    Object.fromEntries(
      (section ? lookbookItems(section) : []).map((item) => [
        item.imagePath,
        { caption: item.caption, href: item.href },
      ]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const unsavedUploads = (keep: string[] = []) =>
    images
      .filter((image) => !image.id && !keep.includes(image.storagePath))
      .map((i) => i.storagePath);

  function cancel() {
    const unsaved = unsavedUploads();
    if (unsaved.length) void removeOwnedImages(unsaved, sectionId).catch(() => undefined);
    onClose();
  }

  function buildInput(): SectionInput {
    const base = { title, linkLabel, linkHref };
    const paths = images.map((image) => image.storagePath);
    switch (kind) {
      case 'hero':
        return { kind, ...base, imagePath: paths[0] ?? '' };
      case 'split':
        return { kind, ...base, imagePath: paths[0] ?? '', imagePath2: paths[1] ?? null };
      case 'collection':
        return { kind, ...base, categoryId, productIds };
      case 'lookbook':
        return {
          kind,
          ...base,
          items: paths.map((imagePath) => ({
            imagePath,
            caption: looks[imagePath]?.caption ?? '',
            href: looks[imagePath]?.href ?? '',
          })),
        };
    }
  }

  async function submit() {
    const parsed = sectionSchema.safeParse(buildInput());
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveSection({
        id: sectionId,
        isNew,
        values: parsed.data,
        isActive,
        sort: nextSort,
        previousPaths: section ? sectionImagePaths(section) : [],
      });
      // Uploads made here that the saved kind does not use (e.g. after switching kinds).
      const used = sectionImagePaths({
        image_path: 'imagePath' in parsed.data ? parsed.data.imagePath : null,
        image_path_2: 'imagePath2' in parsed.data ? parsed.data.imagePath2 : null,
        items:
          parsed.data.kind === 'lookbook'
            ? parsed.data.items.map((item) => ({
                image_path: item.imagePath,
                caption: '',
                href: '',
              }))
            : [],
      });
      const orphans = unsavedUploads(used);
      if (orphans.length) void removeOwnedImages(orphans, sectionId).catch(() => undefined);
      await onSaved();
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  const max = IMAGE_MAX[kind];

  return (
    <Dialog
      open
      onClose={cancel}
      title={isNew ? '섹션 추가' : '섹션 수정'}
      className="max-w-[720px]"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={cancel}>
            취소
          </Button>
          <Button size="sm" loading={saving} onClick={() => void submit()}>
            저장
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field id={`${id}-kind`} label="종류">
          <Select
            id={`${id}-kind`}
            value={kind}
            disabled={!isNew}
            onChange={(event) => {
              setKind(event.target.value as HomeSectionKind);
              setErrors({});
            }}
          >
            {HOME_SECTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${id}-title`} label="제목" error={errors.title}>
          <Input
            id={`${id}-title`}
            value={title}
            maxLength={80}
            invalid={Boolean(errors.title)}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[1fr_2fr]">
          <Field id={`${id}-label`} label="링크 문구" error={errors.linkLabel}>
            <Input
              id={`${id}-label`}
              value={linkLabel}
              maxLength={30}
              invalid={Boolean(errors.linkLabel)}
              onChange={(event) => setLinkLabel(event.target.value)}
            />
          </Field>
          <Field id={`${id}-href`} label="링크 경로" error={errors.linkHref}>
            <Input
              id={`${id}-href`}
              value={linkHref}
              maxLength={200}
              placeholder="/shop/women"
              autoCapitalize="none"
              spellCheck={false}
              invalid={Boolean(errors.linkHref)}
              onChange={(event) => setLinkHref(event.target.value)}
            />
          </Field>
        </div>

        {kind === 'collection' ? (
          <>
            <Field id={`${id}-category`} label="카테고리" error={errors.categoryId}>
              <Select
                id={`${id}-category`}
                value={categoryId}
                invalid={Boolean(errors.categoryId)}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">선택 안 함</option>
                {categoryOptions(categories).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
            <ProductPicker value={productIds} onChange={setProductIds} error={errors.productIds} />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-xs">
              이미지{' '}
              <span className="text-ink-muted tabular-nums">
                {images.length}/{max}
              </span>
            </span>
            <div className={kind === 'hero' ? 'w-1/2 sm:w-1/3' : undefined}>
              <ImageUploader
                bucket="banners"
                ownerId={sectionId}
                value={images}
                onChange={setImages}
                max={max}
                withAlt={false}
                label="섹션 이미지"
              />
            </div>
            {errors.imagePath || errors.items ? (
              <p role="alert" className="text-xs text-danger">
                {errors.imagePath ?? errors.items}
              </p>
            ) : null}
          </div>
        )}

        {kind === 'lookbook' && images.length > 0 ? (
          <ol className="flex flex-col gap-3">
            {images.map((image, index) => {
              const meta = looks[image.storagePath] ?? { caption: '', href: '' };
              const update = (patch: Partial<LookMeta>) =>
                setLooks((all) => ({ ...all, [image.storagePath]: { ...meta, ...patch } }));
              const hrefError = errors[`items.${index}.href`];
              const captionError = errors[`items.${index}.caption`];
              return (
                <li key={image.storagePath} className="grid grid-cols-[24px_1fr_1fr] gap-2">
                  <span className="pt-2 text-xs text-ink-muted tabular-nums">{index + 1}</span>
                  <div className="flex flex-col gap-1">
                    <input
                      value={meta.caption}
                      maxLength={80}
                      placeholder="캡션"
                      aria-label={`${index + 1}번 캡션`}
                      aria-invalid={Boolean(captionError) || undefined}
                      onChange={(event) => update({ caption: event.target.value })}
                      className={denseControlClass}
                    />
                    {captionError ? <p className="text-xs text-danger">{captionError}</p> : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      value={meta.href}
                      maxLength={200}
                      placeholder="/shop/…"
                      aria-label={`${index + 1}번 링크 경로`}
                      aria-invalid={Boolean(hrefError) || undefined}
                      autoCapitalize="none"
                      spellCheck={false}
                      onChange={(event) => update({ href: event.target.value })}
                      className={denseControlClass}
                    />
                    {hrefError ? <p className="text-xs text-danger">{hrefError}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : null}

        <Checkbox
          id={`${id}-active`}
          label="홈에 표시"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
      </div>
    </Dialog>
  );
}

function ProductPicker({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [known, setKnown] = useState<Record<string, PickedProduct>>({});

  const initial = useQuery({
    queryKey: qk.admin.pickedProducts(value),
    queryFn: () => fetchPickedProducts(value),
    enabled: value.some((productId) => !known[productId]),
  });
  const results = useQuery({
    queryKey: qk.admin.productPicker(term),
    queryFn: () => searchPickableProducts(term),
    placeholderData: keepPreviousData,
  });

  const lookup = (productId: string) =>
    known[productId] ?? initial.data?.find((p) => p.id === productId);

  function add(product: PickedProduct) {
    if (value.includes(product.id) || value.length >= COLLECTION_MAX_PRODUCTS) return;
    setKnown((all) => ({ ...all, [product.id]: product }));
    onChange([...value, product.id]);
  }

  function move(index: number, offset: number) {
    const next = [...value];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(index + offset, 0, item);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs">
        상품 지정{' '}
        <span className="text-ink-muted tabular-nums">
          {value.length}/{COLLECTION_MAX_PRODUCTS}
        </span>
      </span>
      {value.length ? (
        <ol className="flex flex-col divide-y divide-line border-y border-line">
          {value.map((productId, index) => {
            const product = lookup(productId);
            return (
              <li key={productId} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 text-xs text-ink-muted tabular-nums">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate">{product?.name ?? '…'}</span>
                {product && product.status !== 'active' ? (
                  <Badge tone="muted">{PRODUCT_STATUS_LABEL[product.status]}</Badge>
                ) : null}
                <span className="flex">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`${index + 1}번 상품 위로`}
                    className="inline-flex size-8 items-center justify-center disabled:opacity-30"
                  >
                    <Icon icon={ArrowUp} size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label={`${index + 1}번 상품 아래로`}
                    className="inline-flex size-8 items-center justify-center disabled:opacity-30"
                  >
                    <Icon icon={ArrowDown} size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((v) => v !== productId))}
                    aria-label={`${index + 1}번 상품 빼기`}
                    className="inline-flex size-8 items-center justify-center hover:text-danger"
                  >
                    <Icon icon={Trash2} size={16} />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <input
          id={`${id}-search`}
          type="search"
          value={search}
          placeholder="상품 검색"
          aria-label="상품 검색"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              setTerm(search.trim());
            }
          }}
          className={denseControlClass}
        />
        <Button size="sm" variant="secondary" onClick={() => setTerm(search.trim())}>
          검색
        </Button>
      </div>
      <ul className="flex max-h-56 flex-col overflow-y-auto">
        {(results.data ?? []).map((product) => {
          const picked = value.includes(product.id);
          return (
            <li key={product.id}>
              <button
                type="button"
                disabled={picked || value.length >= COLLECTION_MAX_PRODUCTS}
                onClick={() => add(product)}
                className="flex w-full items-center gap-3 px-1 py-1.5 text-left text-sm hover:bg-surface disabled:opacity-40"
              >
                {product.imagePath ? (
                  <img
                    src={imageUrl(product.imagePath, 'm')}
                    alt=""
                    loading="lazy"
                    className="h-10 w-[30px] max-w-none bg-surface object-cover"
                  />
                ) : (
                  <span className="h-10 w-[30px] bg-surface" />
                )}
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                {product.status !== 'active' ? (
                  <Badge tone="muted">{PRODUCT_STATUS_LABEL[product.status]}</Badge>
                ) : null}
                {picked ? <span className="text-xs text-ink-muted">추가됨</span> : null}
              </button>
            </li>
          );
        })}
        {results.data?.length === 0 ? (
          <li className="py-3 text-sm text-ink-muted">결과가 없습니다</li>
        ) : null}
      </ul>
    </div>
  );
}
