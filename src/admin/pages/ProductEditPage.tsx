import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/toastStore';
import { pageTitle } from '@/config/site';
import { qk } from '@/lib/queryKeys';
import { rpcErrorCode, rpcErrorMessage } from '@/lib/rpcErrors';
import { PRODUCT_STATUSES, PRODUCT_STATUS_LABEL } from '@/types/domain';
import {
  adminCategoriesKey,
  adminErrorMessage,
  archiveProduct,
  countProductOrderItems,
  deleteProduct,
  fetchAdminCategories,
  fetchAdminProduct,
  removeOwnedImages,
  saveProduct,
  type AdminProduct,
  type CategoryRow,
  type ImageItem,
} from '../api';
import { ImageUploader } from '../components/ImageUploader';
import { StatusBadge } from '../components/StatusBadge';
import { VariantGrid } from '../components/VariantGrid';
import {
  optionsFromRows,
  productSchema,
  slugify,
  suggestSlug,
  validateVariantRows,
  type ProductFormInput,
  type ProductValues,
  type VariantGridValue,
} from '../schemas';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ProductEditPage() {
  const { id } = useParams();
  const validId = id !== undefined && UUID_PATTERN.test(id);
  const product = useQuery({
    queryKey: qk.admin.product(id ?? 'new'),
    queryFn: () => fetchAdminProduct(id ?? ''),
    enabled: validId,
  });
  const categories = useQuery({ queryKey: adminCategoriesKey, queryFn: fetchAdminCategories });
  const [reloads, setReloads] = useState(0);

  if ((id !== undefined && !validId) || product.data === null) {
    return (
      <>
        <title>{pageTitle('상품 관리')}</title>
        <EmptyState
          title="상품을 찾을 수 없습니다"
          action={{ label: '상품 목록', to: '/admin/products' }}
        />
      </>
    );
  }
  if (product.isError || categories.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void product.refetch();
          void categories.refetch();
        }}
      />
    );
  }
  if ((validId && product.isPending) || categories.isPending) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <ProductEditor
      // A fresh editor per stored version: after a save the refetched row resets every field.
      // `reloads` forces one after a stock conflict, where the product row itself is unchanged.
      key={product.data ? `${product.data.id}:${product.data.updated_at}:${reloads}` : 'new'}
      product={product.data ?? null}
      categories={categories.data}
      onReload={async () => {
        await product.refetch();
        setReloads((count) => count + 1);
      }}
    />
  );
}

function formDefaults(product: AdminProduct | null): ProductFormInput {
  return {
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    categoryId: product?.category_id ?? '',
    price: product ? String(product.price) : '',
    compareAtPrice: product?.compare_at_price != null ? String(product.compare_at_price) : '',
    description: product?.description ?? '',
    material: product?.material ?? '',
    care: product?.care ?? '',
    status: product?.status ?? 'draft',
    isFeatured: product?.is_featured ?? false,
  };
}

function variantDefaults(product: AdminProduct | null): VariantGridValue {
  const rows = (product?.variants ?? []).map((v) => ({
    id: v.id,
    color: v.color,
    size: v.size,
    sku: v.sku,
    stock: String(v.stock),
    priceDelta: String(v.price_delta),
    isActive: v.is_active,
  }));
  return { ...optionsFromRows(rows), rows };
}

function imageDefaults(product: AdminProduct | null): ImageItem[] {
  return (product?.images ?? []).map((image) => ({
    id: image.id,
    storagePath: image.storage_path,
    alt: image.alt,
    color: image.color,
    sort: image.sort,
  }));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="border-b border-line pb-2 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

type DeleteState = { orders: number } | null;

function ProductEditor({
  product,
  categories,
  onReload,
}: {
  product: AdminProduct | null;
  categories: CategoryRow[];
  onReload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = product === null;
  const [productId] = useState(() => product?.id ?? crypto.randomUUID());
  const [initialVariants] = useState(() => variantDefaults(product));
  const [initialImages] = useState(() => imageDefaults(product));
  const [variants, setVariants] = useState(initialVariants);
  const [images, setImages] = useState(initialImages);
  const [variantErrors, setVariantErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [stockConflict, setStockConflict] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    getFieldState,
    formState: { errors, isDirty },
  } = useForm<ProductFormInput, unknown, ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: formDefaults(product),
  });

  const slug = useWatch({ control, name: 'slug' });
  const dirty =
    isDirty ||
    JSON.stringify(variants) !== JSON.stringify(initialVariants) ||
    JSON.stringify(images) !== JSON.stringify(initialImages);

  // Read by the navigation blocker at navigation time; cleared right before leaving after a save.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const roots = categories.filter((c) => c.parent_id === null);

  async function refreshCaches() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
      queryClient.invalidateQueries({ queryKey: qk.admin.product(productId) }),
      queryClient.invalidateQueries({ queryKey: qk.admin.stats }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['product'] }),
      queryClient.invalidateQueries({ queryKey: qk.homeSections }),
    ]);
  }

  function checkVariants() {
    const result = validateVariantRows(variants.rows);
    setVariantErrors(result.ok ? {} : result.errors);
    return result;
  }

  async function save(values: ProductValues) {
    const checked = checkVariants();
    if (!checked.ok) {
      toast('옵션을 확인하세요', 'error');
      return;
    }
    const keptVariantIds = new Set(variants.rows.map((row) => row.id));
    const keptImageIds = new Set(images.map((image) => image.id));
    setSaving(true);
    try {
      await saveProduct({
        id: productId,
        isNew,
        publishedAt: product?.published_at ?? null,
        values,
        variants: checked.rows,
        stockRead: Object.fromEntries(
          initialVariants.rows.map((row) => [row.id, Number(row.stock)]),
        ),
        removedVariantIds: initialVariants.rows
          .map((row) => row.id)
          .filter((variantId) => !keptVariantIds.has(variantId)),
        images,
        removedImages: initialImages.filter((image) => !keptImageIds.has(image.id)),
      });
      dirtyRef.current = false;
      toast('저장했습니다');
      await refreshCaches();
      if (isNew) navigate(`/admin/products/${productId}`, { replace: true });
    } catch (error) {
      // Nothing was saved: let the admin reload the current stock instead of overwriting it.
      if (rpcErrorCode(error) === 'STOCK_CHANGED') {
        setStockConflict(rpcErrorMessage(error));
        return;
      }
      toast(adminErrorMessage(error), 'error');
      // Saving is several requests; show whatever was stored before the failure.
      if (isNew && (await fetchAdminProduct(productId).catch(() => null))) {
        dirtyRef.current = false;
        await refreshCaches();
        navigate(`/admin/products/${productId}`, { replace: true });
      } else if (!isNew) {
        await refreshCaches();
      }
    } finally {
      setSaving(false);
    }
  }

  function rejectInvalid() {
    checkVariants();
    toast('입력값을 확인하세요', 'error');
  }

  async function openDelete() {
    try {
      setDeleteState({ orders: await countProductOrderItems(productId) });
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    }
  }

  async function confirmDelete() {
    if (!deleteState || !product) return;
    setDeleting(true);
    try {
      if (deleteState.orders > 0) {
        await archiveProduct(productId);
        toast('보관으로 전환했습니다');
        setDeleteState(null);
        await refreshCaches();
      } else {
        await deleteProduct(
          productId,
          product.images.map((image) => image.storage_path),
        );
        dirtyRef.current = false;
        toast('삭제했습니다');
        await refreshCaches();
        navigate('/admin/products', { replace: true });
      }
    } catch (error) {
      toast(adminErrorMessage(error), 'error');
    } finally {
      setDeleting(false);
    }
  }

  function leaveWithoutSaving() {
    // Uploads that never made it into a product_images row would be orphaned.
    const unsaved = images.filter((image) => !image.id).map((image) => image.storagePath);
    if (unsaved.length > 0) void removeOwnedImages(unsaved, productId).catch(() => undefined);
    dirtyRef.current = false;
    blocker.proceed?.();
  }

  // New products follow the name until the slug is edited by hand.
  const followName = () => isNew && !getFieldState('slug').isDirty;
  const nameField = register('name', {
    onChange: (event: { target: { value: string } }) => {
      if (followName()) setValue('slug', slugify(event.target.value));
    },
    onBlur: () => {
      if (followName() && !getValues('slug')) {
        setValue('slug', suggestSlug(getValues('name'), 'item'));
      }
    },
  });

  const title = isNew ? '상품 추가' : (product?.name ?? '');
  const saveButton = (
    <Button type="submit" size="sm" loading={saving} disabled={deleting}>
      저장
    </Button>
  );

  return (
    <form onSubmit={(event) => void handleSubmit(save, rejectInvalid)(event)} noValidate>
      <title>{pageTitle(isNew ? '상품 추가' : '상품 수정')}</title>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/admin/products"
            aria-label="상품 목록"
            className="-ml-2 inline-flex size-9 shrink-0 items-center justify-center"
          >
            <Icon icon={ChevronLeft} />
          </Link>
          <h1 className="truncate text-lg font-medium">{title}</h1>
          {product ? <StatusBadge status={product.status} className="shrink-0" /> : null}
        </div>
        {saveButton}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-8 lg:order-last lg:self-start">
          <Field id="product-status" label="상태" error={errors.status?.message}>
            <Select id="product-status" {...register('status')}>
              {PRODUCT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PRODUCT_STATUS_LABEL[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Checkbox id="product-featured" label="추천 상품" {...register('isFeatured')} />
          {product?.status === 'active' ? (
            <Link
              to={`/products/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-4 hover:text-ink-muted"
            >
              스토어에서 보기
            </Link>
          ) : null}
          {product ? (
            <div className="border-t border-line pt-5">
              <Button variant="danger" size="sm" onClick={() => void openDelete()}>
                삭제
              </Button>
            </div>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-12">
          <Section title="기본 정보">
            <Field id="product-name" label="상품명" required error={errors.name?.message}>
              <Input id="product-name" invalid={!!errors.name} {...nameField} />
            </Field>
            <Field id="product-slug" label="슬러그" required error={errors.slug?.message}>
              <Input
                id="product-slug"
                invalid={!!errors.slug}
                autoCapitalize="none"
                spellCheck={false}
                {...register('slug')}
              />
            </Field>
            <Field id="product-category" label="카테고리">
              <Select id="product-category" {...register('categoryId')}>
                <option value="">미분류</option>
                {roots.map((root) => (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name}</option>
                    {categories
                      .filter((child) => child.parent_id === root.id)
                      .map((child) => (
                        <option key={child.id} value={child.id}>
                          {root.name} › {child.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="product-price" label="판매가 (원)" required error={errors.price?.message}>
                <Input
                  id="product-price"
                  inputMode="numeric"
                  invalid={!!errors.price}
                  {...register('price')}
                />
              </Field>
              <Field id="product-compare" label="정가 (원)" error={errors.compareAtPrice?.message}>
                <Input
                  id="product-compare"
                  inputMode="numeric"
                  invalid={!!errors.compareAtPrice}
                  {...register('compareAtPrice')}
                />
              </Field>
            </div>
            <Field id="product-description" label="상세 설명" error={errors.description?.message}>
              <Textarea
                id="product-description"
                rows={8}
                invalid={!!errors.description}
                {...register('description')}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="product-material" label="소재" error={errors.material?.message}>
                <Textarea
                  id="product-material"
                  rows={4}
                  invalid={!!errors.material}
                  {...register('material')}
                />
              </Field>
              <Field id="product-care" label="세탁" error={errors.care?.message}>
                <Textarea
                  id="product-care"
                  rows={4}
                  invalid={!!errors.care}
                  {...register('care')}
                />
              </Field>
            </div>
          </Section>

          <Section title="이미지">
            <ImageUploader
              bucket="products"
              ownerId={productId}
              value={images}
              onChange={setImages}
              colorOptions={variants.colors}
            />
          </Section>

          <Section title="옵션">
            <VariantGrid
              value={variants}
              onChange={setVariants}
              skuBase={slug}
              errors={variantErrors}
            />
          </Section>

          <div className="flex justify-end lg:hidden">{saveButton}</div>
        </div>
      </div>

      <Dialog
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title="저장하지 않고 나갈까요?"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => blocker.reset?.()}>
              계속 편집
            </Button>
            <Button size="sm" onClick={leaveWithoutSaving}>
              나가기
            </Button>
          </>
        }
      >
        변경 사항이 저장되지 않습니다.
      </Dialog>

      <Dialog
        open={stockConflict !== null}
        onClose={() => setStockConflict(null)}
        title="재고 변경"
        footer={
          <Button size="sm" onClick={() => void onReload()}>
            다시 불러오기
          </Button>
        }
      >
        {stockConflict}
      </Dialog>

      <Dialog
        open={deleteState !== null}
        onClose={() => setDeleteState(null)}
        title={
          deleteState && deleteState.orders > 0
            ? '주문 내역이 있는 상품입니다'
            : '상품을 삭제할까요?'
        }
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setDeleteState(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleteState && deleteState.orders > 0 ? '보관으로 전환' : '삭제'}
            </Button>
          </>
        }
      >
        {deleteState && deleteState.orders > 0
          ? `주문 ${deleteState.orders}건에 포함되어 삭제할 수 없습니다.`
          : '이미지와 옵션도 함께 삭제됩니다.'}
      </Dialog>
    </form>
  );
}
