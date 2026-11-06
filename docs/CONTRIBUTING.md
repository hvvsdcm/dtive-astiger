# 수정 가이드

비공개 저장소에 초대받아 코드를 고치는 공동 작업자용 문서입니다. 구조와 운영은 [HANDOVER](HANDOVER.md), 로컬 실행과 명령 목록은 [README](../README.md), 코드 규칙의 기준은 [AGENTS.md](../AGENTS.md)입니다. 이 문서는 "무엇을 고치려면 어디를 건드리는지"만 다룹니다.

## 1. 시작하기

1. GitHub 초대 메일의 링크(또는 https://github.com/hvvsdcm/dtive-astiger/invitations)에서 초대를 수락합니다.
2. 저장소를 받습니다.
   ```sh
   git clone https://github.com/hvvsdcm/dtive-astiger.git
   cd dtive-astiger
   ```
3. [README의 로컬 실행](../README.md#로컬-실행) 순서대로 띄웁니다. 시드 계정도 README에 있습니다.

- 로컬 작업에는 클라우드 키가 필요 없습니다. `.env.local`에는 `supabase start`가 만든 로컬 주소와 로컬 anon 키만 들어갑니다.
- `.env.local`은 커밋하지 않습니다(`.gitignore`가 `.env.example` 말고 모두 막음).
- 시드 관리자로 `/admin`에 처음 들어가면 인증 앱(TOTP) 등록 화면이 나옵니다. 휴대폰 인증 앱으로 등록하면 됩니다. `supabase db reset`을 하면 등록이 지워져 다시 등록합니다.

## 2. 작업 흐름

**`main`에 push하면 바로 운영 사이트에 배포됩니다**(`.github/workflows/deploy.yml`, [DEPLOY 3절](DEPLOY.md#3-실행)). 그래서 `main`에 직접 push하지 않고 브랜치와 PR로 작업합니다.

1. 최신 `main`에서 브랜치를 만듭니다.
   ```sh
   git switch main && git pull
   git switch -c <짧은-이름>          # 예: product-fit-note
   ```
2. 고치고, 커밋 전 검사를 돌립니다.
   ```sh
   npm run typecheck && npm run lint && npm run format && npm test && npm run build
   npm run test:db    # supabase/ 아래를 바꿨을 때
   npm run e2e        # 로그인·주문·관리자 흐름을 바꿨을 때
   ```
   `npm run format`은 검사만 합니다. 고치려면 `npx prettier --write <파일>`.
3. 커밋하고 브랜치를 올립니다.
   ```sh
   git push -u origin <짧은-이름>
   ```
4. PR을 엽니다(`gh pr create` 또는 GitHub 화면). 저장소 주인이 확인하고 `main`에 합치면 배포됩니다.

- **PR에서는 자동 검사가 돌지 않습니다.** 워크플로는 `main` push 배포(`deploy.yml`)와 Supabase 정기 작업(`supabase-maintenance.yml`)뿐입니다. 위 검사를 로컬에서 통과시킨 뒤 PR을 여세요. 배포 워크플로는 typecheck·lint·test가 실패하면 배포를 멈추지만, 그때는 이미 `main`에 들어간 뒤입니다.
- 커밋 메시지는 영어 명령형 한 줄입니다. 대문자로 시작하고 마침표·접두어(`feat:` 등) 없이, 바꾼 것을 쉼표로 나열합니다. 예: `Add cart drawer, bank-transfer checkout, order pages` (`git log --oneline` 참고).
- `.github/workflows/`는 저장소 Secrets를 다루므로 고치지 말고, 필요하면 PR 설명에 적어 주인에게 맡깁니다([SECURITY 절대 규칙](SECURITY.md#절대-규칙)).
- 스키마를 바꾼 PR은 운영 DB 반영(`supabase db push`)을 주인이 합니다. PR 설명에 새 마이그레이션 파일 이름을 적어 주세요.

## 3. 무엇을 고치려면 어디를

### 색·글꼴·크기

- 파일: `src/styles/tokens.css` 하나. 색·글자 크기·글꼴·움직임은 여기 선언된 것만 클래스로 쓸 수 있습니다.
- 새 색이 필요하면 `--color-<이름>`을 추가하고 `bg-<이름>`·`text-<이름>`으로 씁니다. 컴포넌트에 `#hex`나 임의 값(`text-[#…]`)을 넣지 않습니다.
- 글꼴 파일은 npm 패키지로 `src/main.tsx`에서 불러옵니다. 바꾸려면 패키지와 `--font-sans`·`--font-display`를 함께 바꿉니다.
- 검사: `npm run build` 후 화면 확인. `e2e/layout.spec.ts`가 둥근 모서리·그림자·가로 넘침을 검사합니다(`npm run e2e`).

### 화면 문구·약관·FAQ

- 이용약관 `src/content/terms.ts`, 개인정보처리방침 `src/content/privacy.ts`, FAQ `src/content/faq.ts`, 배송 안내 `src/content/shipping.ts`, 공통 문장 `src/content/shared.ts`.
- 배송비·입금 기한 같은 숫자는 관리자 설정 값이 들어가므로 문장에 숫자를 직접 쓰지 않습니다.
- 그 밖의 화면 문구는 각 화면 파일(`src/features/<기능>/pages/*.tsx`, `src/admin/pages/*.tsx`)에 있습니다.
- 검사: `npm test` (`src/content/content.test.ts`가 문구 생성을 확인).

### 사업자 정보

- 파일: `src/config/business.ts` 하나. 항목별 쓰이는 곳은 [HANDOVER 2.1](HANDOVER.md#21-사업자-정보-입력).
- 검사: `npm test`, 푸터와 `/terms`·`/privacy`에서 빨간 `[사업자 정보 입력 필요]`가 사라졌는지 확인.

### 메뉴·푸터 링크

- 상단 메뉴는 코드가 아니라 데이터입니다. 관리자 → 카테고리에서 활성 최상위 카테고리가 메뉴가 됩니다(`src/features/catalog/hooks.ts`의 `useStoreNav`).
- `src/config/site.ts`의 `fallbackNav`는 카테고리를 못 불러왔을 때만 쓰는 메뉴입니다.
- 푸터 링크: `src/config/site.ts`의 `footerNav`. 렌더링은 `src/components/layout/Footer.tsx`.

### 새 페이지 추가 (스토어)

1. `src/features/<기능>/pages/<이름>Page.tsx`를 만들고, 컴포넌트 안에 `<title>{pageTitle('이름')}</title>`을 넣습니다(`pageTitle`은 `src/config/site.ts`).
2. 같은 기능의 `src/features/<기능>/routes.tsx` 배열에 `{ path: '…', element: <…Page /> }`를 추가합니다. 새 기능 폴더면 `routes.tsx`를 만들고 `src/app/router.tsx`의 `storeRoutes`에 펼쳐 넣습니다.
3. 로그인이 필요하면 `loader: requireAuth`(`src/app/guards.ts`)를 붙입니다. `src/features/account/routes.tsx`가 예시입니다.
4. 링크가 필요하면 `src/config/site.ts`의 `footerNav`에 추가합니다.

- 스토어 페이지는 바로 import합니다. `lazy`는 관리자 페이지에만 씁니다(스토어 번들에 관리자 코드를 넣지 않기 위해).
- 검사: `npm run typecheck && npm test`, 흐름이 바뀌면 `npm run e2e`.

### 공용 UI 컴포넌트

- 위치: `src/components/ui/`. 버튼 `Button.tsx`, 입력 `Input.tsx`·`Field.tsx`·`Select.tsx`, 표 `Table.tsx`, 빈 화면 `EmptyState.tsx` 등. 새로 만들기 전에 여기서 찾습니다.
- 아이콘: lucide-react 아이콘을 `Icon.tsx`로 감싸서 씁니다(`<Icon icon={X} />`). 아이콘만 있는 버튼에는 `aria-label`을 붙입니다.
- 로고: `Logo.tsx`(글자색을 따라감).
- 모달·옆 패널: `Dialog.tsx`·`Drawer.tsx`(브라우저 기본 `<dialog>`).
- 알림: `toastStore.ts`의 `toast('저장했습니다')`, 오류는 `toast(메시지, 'error')`.
- 클래스 합치기: `cn.ts`의 `cn()`은 이어 붙이기만 하므로 서로 충돌하는 클래스를 같이 넘기지 않습니다.
- 검사: `npm test` (`src/components/ui/Button.test.tsx` 참고해 테스트 추가 가능).

### 데이터 읽기·쓰기 추가

1. 조회·변경 함수는 기능 폴더의 `api.ts`(`src/features/<기능>/api.ts`, 관리자는 `src/admin/api.ts`)에 둡니다. Supabase 클라이언트는 `src/lib/supabase.ts`의 `supabase`만 씁니다.
2. 조회 키는 `src/lib/queryKeys.ts`의 `qk`에 추가하고, 화면에서는 React Query(`useQuery`·`useMutation`)로 부릅니다. 예시: `src/features/checkout/api.ts`의 `settingsQuery`.
3. 변경 후에는 관련 키를 `invalidateQueries`로 새로 고칩니다. 예시: `src/features/account/pages/AddressesPage.tsx`.
4. 오류는 `src/lib/rpcErrors.ts`의 `rpcErrorMessage(error)`로 바꿔 보여 줍니다(관리자 화면은 `adminErrorMessage`). DB 함수가 새 오류 코드를 던지면 `RPC_ERROR_MESSAGES`에 한국어 문구를 추가하고 `src/lib/rpcErrors.test.ts`도 고칩니다.
5. 입력 검증은 기능 폴더의 `schemas.ts`(zod)에 둡니다.

- `select`에는 필요한 컬럼만 적습니다(예: `src/features/catalog/api.ts`의 `DETAIL_COLUMNS`).
- 검사: `npm run typecheck && npm test`.

### 관리자 화면 추가

1. `src/admin/pages/<이름>Page.tsx`를 만듭니다.
2. `src/app/router.tsx`의 `adminPages`에 `lazy: async () => ({ Component: (await import('@/admin/pages/<이름>Page')).<이름>Page })` 형식으로 추가합니다.
3. 왼쪽 메뉴는 `src/admin/AdminLayout.tsx`의 `NAV`에 추가합니다.

- `/admin`은 `requireAdmin` 로더가 막지만 화면 편의일 뿐입니다. 실제 권한은 DB의 `is_admin()`이 판단하고, 인증 앱(TOTP) 2단계를 마친 관리자 세션(`aal2`)만 참입니다(`supabase/migrations/0011_admin_mfa.sql`). 새 관리자 데이터는 RLS 정책이나 함수 안에서 `is_admin()`을 확인해야 합니다.
- 검사: `npm run typecheck && npm test`, `npm run e2e`(`e2e/admin.spec.ts`가 TOTP 로그인까지 자동 처리).

### DB 스키마 변경: "상품에 새 칸 추가" 예

예: 상품에 `fit_note`(핏 안내) 글자 칸을 추가합니다.

1. 새 마이그레이션을 만듭니다. **이미 있는 `supabase/migrations/*.sql`은 절대 고치지 않습니다**(운영 DB에 이미 적용됨).
   ```sh
   supabase migration new product_fit_note
   ```
2. 생긴 파일에 변경을 적습니다. `alter table public.products add column fit_note text not null default '';` 같은 식입니다.
   - 권한도 같은 파일에서 정합니다. `products`는 누구나 읽는 표라서 새 컬럼도 공개됩니다. 관리자만 볼 값이면 `0009_private_columns_order_limits.sql`처럼 컬럼 단위 `grant`로 숨깁니다.
   - 새 표를 만들면 `enable row level security`와 `force row level security`, 정책, `grant`를 모두 넣습니다(`0005_rls.sql` 참고).
3. 로컬 DB를 처음부터 다시 만듭니다(로컬 데이터는 시드로 초기화됨).
   ```sh
   supabase db reset
   ```
4. `supabase/tests/`에 pgTAP 테스트를 추가합니다(새 번호 파일, 기존 파일 형식 참고). 손님이 못 써야 하는 값이면 그 거부도 테스트합니다.
   ```sh
   npm run test:db
   ```
5. 타입을 다시 만듭니다. `src/types/database.ts`는 손으로 고치지 않습니다.
   ```sh
   npm run gen:types
   ```
6. 화면을 고칩니다.
   - 관리자 입력: `src/admin/schemas.ts`의 `productSchema`, `src/admin/api.ts`의 `productRow`, `src/admin/pages/ProductEditPage.tsx`의 입력 칸.
   - 스토어 표시: `src/features/catalog/api.ts`의 `DETAIL_COLUMNS`, `src/features/catalog/pages/ProductPage.tsx`.
   - 검증 테스트: `src/admin/schemas.test.ts`.
7. 커밋 전 검사 + `npm run test:db` + `npm run e2e`를 돌리고 PR을 엽니다.
8. 운영 반영은 저장소 주인이 `supabase db push`로 합니다([HANDOVER 2.2](HANDOVER.md#22-supabase-클라우드-프로젝트)). 화면 배포(`main` 합치기)보다 먼저 해야 새 화면이 없는 컬럼을 찾지 않습니다.

### 가격·재고·주문 상태 로직

- 가격 계산, 재고 차감·복구, 주문 상태 변경은 **DB의 `security definer` 함수 안에서만** 합니다(`create_order`, `cancel_my_order`, `admin_update_order_status`, `admin_set_stock` 등). 화면에서 계산한 금액을 DB에 쓰지 않습니다.
- 함수를 바꿀 때는 새 마이그레이션에 `create or replace function`으로 다시 정의하고, 기존 함수처럼 `set search_path = ''`, `revoke`/`grant execute`, 오류는 `raise exception using message = '<코드>'`를 지킵니다.
- 주문 상태 전이표는 두 곳에 있습니다. DB `admin_update_order_status`와 화면 `src/types/domain.ts`의 `ORDER_TRANSITIONS`. **한쪽을 바꾸면 다른 쪽도 같이 바꾸고**, `src/types/domain.test.ts`와 `supabase/tests/05_admin_funcs.sql`도 고칩니다. 표는 [HANDOVER 주문 상태 전이](HANDOVER.md#주문-상태-전이).
- 장바구니 금액 미리보기(`src/features/checkout/pricing.ts`)는 표시용입니다. 실제 금액은 `create_order`가 정합니다.
- 검사: `npm run test:db && npm test`.

### 외부 서비스·스크립트 추가

- 다른 사이트의 스크립트·이미지·API·프레임을 쓰려면 `vite.config.ts`의 `contentSecurityPolicy()`에 그 출처를 추가합니다. 빠지면 브라우저가 막습니다(개발자 도구 콘솔에 CSP 오류).
- 응답 헤더(캐시·프레임 금지 등)는 `public/_headers`입니다.
- 브라우저에 들어가는 키는 공개됩니다. 비밀키가 필요한 서비스는 이 구조(서버 없음)에서 붙일 수 없으니 주인과 먼저 상의합니다.
- 외부 링크는 `rel="noopener noreferrer"`를 붙입니다.
- 검사: `npm run build && npm run preview`로 빌드 결과에서 동작 확인(개발 서버와 CSP가 조금 다름).

### 로고·파비콘·이미지

- 로고: `brand/logo.svg`를 바꾸고 `src/assets/logo.svg`에 복사합니다. 색은 CSS가 입힙니다.
- 파비콘: `brand/logo-source.png`를 바꾼 뒤 `npm run favicons`. 그림이 바뀌면 `scripts/make-favicons.mjs`의 `CROP` 값을 맞춥니다.
- 상품·배너 사진은 코드가 아니라 관리자 화면에서 올립니다. 로컬 시드 사진은 `supabase/seed-assets/`이고 출처는 `supabase/seed-assets/CREDITS.md`에 적습니다.
- **이미지를 코드로 그리지 않습니다**(SVG 경로 직접 작성, canvas 그림 등). 라이선스가 확인된 사진과 브랜드 파일만 쓰고, 출처를 [HANDOVER 5장](HANDOVER.md#5-라이선스출처)에 추가합니다.

### 인증 메일 템플릿

- 파일: `supabase/templates/confirmation.html`, `recovery.html`, `email_change.html`. 링크 부분(`{{ .RedirectTo }}?token_hash=…`)은 건드리지 않습니다.
- 로컬은 `supabase/config.toml`이 이 파일을 읽습니다. `supabase stop && supabase start` 후 가입·재설정을 해 보고 Mailpit(http://127.0.0.1:54324)에서 확인합니다.
- 운영은 Dashboard에 직접 붙여 넣습니다([HANDOVER 2.2](HANDOVER.md#22-supabase-클라우드-프로젝트) 9단계). 주인에게 PR 설명으로 알려 주세요.

## 4. 꼭 지킬 규칙

기준은 [AGENTS.md](../AGENTS.md)이고, 아래는 자주 어기는 것만 모았습니다.

- **디자인**: 모서리는 둥글게 하지 않음(radius 0). 그림자·그라데이션·이모지·스크롤 애니메이션·호버 확대 없음. 색·크기·글꼴은 `tokens.css`에 있는 것만.
- **문구**: 부제·설명 문단·홍보 문구를 붙이지 않음. 라벨은 짧은 명사, 빈 화면·오류는 한 문장 + 링크 최대 하나.
- **코드**: `dangerouslySetInnerHTML` 금지(lint 오류). 페이지마다 `pageTitle()`. 서버 데이터는 React Query + `qk`. 사용자에게 보이는 오류는 `rpcErrorMessage()`(DB 원문, 이메일·전화번호를 토스트에 띄우지 않음).
- **DB**: `src/types/database.ts`는 손으로 고치지 않음(`npm run gen:types`). 기존 마이그레이션 수정 금지. 모든 표에 RLS `enable` + `force`.
- **키·배포**: `service_role`/`secret` 키를 어디에도 넣지 않음. `.env.local` 커밋 금지. 내 컴퓨터에서 직접 배포하지 않음(`.env.local`이 있는 컴퓨터에서 `wrangler deploy` 금지, 배포는 `deploy.yml`만).
- **Supabase CLI**: `supabase config push` 금지(로컬 설정이 운영을 덮어씀). `supabase db push --include-seed` 금지(공개된 비밀번호의 시드 관리자가 운영에 들어감).

## 5. AI 코딩 도구로 고칠 때

저장소 루트의 `AGENTS.md`가 AI 코딩 도구(Codex, Claude Code, Cursor 등)가 읽는 규칙 파일입니다. 작업을 맡길 때 "AGENTS.md 규칙을 따르고, 끝나면 커밋 전 검사 명령을 돌려 통과시켜"라고 함께 요청하세요. 결과는 위 2절 흐름대로 브랜치와 PR로 올리고, 마이그레이션·`.github/`·`vite.config.ts` 변경은 직접 읽고 확인한 뒤 올립니다.

## 6. 막힐 때

| 증상                                                                                                      | 원인·해결                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase start`가 Docker에 연결하지 못함                                                                 | Docker 호환 런타임(Docker Desktop, OrbStack, colima)을 먼저 켭니다.                                                                                                               |
| 화면이 하얗고 콘솔에 `Invalid environment (see .env.example)`                                             | `.env.local`이 없거나 `VITE_SUPABASE_ANON_KEY`가 비어 있음. `supabase status -o env`의 `ANON_KEY` 값을 넣고 개발 서버를 다시 켭니다.                                              |
| `npm run build`가 `VITE_SUPABASE_URL is required to build` 또는 `VITE_SUPABASE_ANON_KEY must be …`로 실패 | 로컬 빌드도 `.env.local`을 읽습니다. README 로컬 실행 3단계(키 붙여 넣기까지)를 합니다.                                                                                           |
| `npm run dev`가 포트 5174 사용 중으로 실패                                                                | 다른 개발 서버를 끕니다. 포트는 고정입니다(`vite.config.ts`의 `strictPort`). 인증 메일 링크가 `supabase/config.toml`의 `site_url`(5174)로 오기 때문에 바꾸지 않습니다.            |
| `npm run gen:types`·`npm run test:db` 실패                                                                | 둘 다 로컬 DB(`supabase start`)가 떠 있어야 합니다.                                                                                                                               |
| `npm run e2e`가 `docker exec` 단계에서 실패                                                               | 테스트 계정을 `supabase_db_dtive-astiger` 컨테이너로 만듭니다(`e2e/support/db.ts`). `supabase start` 상태인지 확인하고, 컨테이너 이름이 다르면 `E2E_DB_CONTAINER`로 지정합니다.   |
| 새 외부 이미지·스크립트가 안 뜸                                                                           | CSP에 출처가 없음. `vite.config.ts`의 `contentSecurityPolicy()`에 추가합니다.                                                                                                     |
| `/admin`에 들어가면 인증 앱 등록 화면이 다시 나옴                                                         | `supabase db reset`이 로컬 DB를 새로 만들면서 등록도 지웠습니다. 다시 등록합니다. 열린 관리자 화면이 코드 입력 화면으로 넘어가면 2단계 확인이 풀린 세션이니 코드를 다시 넣습니다. |
| 마이그레이션을 추가했는데 화면에 반영 안 됨                                                               | `supabase db reset`과 `npm run gen:types`를 했는지 확인합니다.                                                                                                                    |
