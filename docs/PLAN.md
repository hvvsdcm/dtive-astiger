# DTIVE & ASTIGER 의류 쇼핑몰 구현 계획

작성일 2026-11-04 · 대상 폴더 `/Users/hvsdcm1/Developer/dtive-astiger` (빈 git repo, `brand/logo-source.png`만 존재, `brand/logo.svg`는 메인이 potrace로 만들어 둔다고 가정)

---

## ① 목표

사용자 원문:

> "나는 깔끔하고 모던한 의류 쇼핑몰 웹사이트를 만드려고 해. 요즘 잘나가는 브랜드 웹사이트를 참고해서, 최대한 AI 티 안나게 만들어줘. 실제로 사용할거고, 배포는 깃헙 통해서 할건데 이건 깃헙 페이지스니까 일단 보류하고 실제 운영할거니까 보안까지 신경써서. 어드민 페이지도 만들고. 회원가입등도 다 구축해놔. 다른사람한테 넘길거야. 로고는 이거(첨부). "디티브 아시티거" 이게 메인인데 니가 디자인 따라서 영어로 해도 돼"

메인 추가 지시(우선): **결제는 무통장입금만.** PortOne 등 PG 연동·웹훅·결제 엣지함수는 설계하지 않는다. 무통장입금 흐름(주문 생성 → 입금 계좌·기한 안내 → 관리자 입금확인 → 배송, 기한 경과 시 자동 취소·재고 복구)만 남기고, 계좌정보는 관리자 설정에서 바꿀 수 있어야 한다.

산출물: 정적 SPA(Vite+React+TS) + Supabase(Auth/Postgres+RLS/Storage) 쇼핑몰. 스토어·회원·어드민·법무 페이지·인계 문서·Pages 워크플로(파일만). 키 없이 로컬(`supabase start`)에서 끝까지 동작.

---

## ② 결정과 근거

### 2.1 디자인 레퍼런스 (2026-11-04 실제 확인)

| 사이트 | 확인한 것 | 가져오는 규칙 |
|---|---|---|
| **LEMAIRE** lemaire.fr (Shopify) | 서체 `BrownStd`(산세리프) + `GaramondPremrPro`(세리프 포인트), 색 `#000`/`#fff` 외 거의 없음, rgba(0,0,0,.5) 보조 텍스트. 메가메뉴: 상위 카테고리 → 하위 리스트 + 이미지 1장. PDP: 이미지 세로 스택 + 우측 고정 정보, `Description / Details / Care` 아코디언. 카트는 드로어("Your cart is empty / Continue shopping"). 홈: 풀블리드 이미지 1장 + 제목 + "DISCOVER" 링크, 그 아래 2~3분할 이미지 푸시 | 흑백 2색 + 세리프 포인트 1종, PDP 스택형 갤러리 + sticky 정보, 아코디언 3개, 카트 드로어, 홈 섹션 구조(hero → split → collection) |
| **Our Legacy** ourlegacy.com (Next.js) | `Neue Haas Unica` 단일 산세리프, 본문 `13px`, 색 `#121110` on `#FFFFFC`, `border-radius: 0` 일관, 보조 배경 `#f5f5f5`/`#eeeeee`, 강조 `#FE5000`은 세일 등 극소수. 홈은 이미지 카드 + 한 줄 텍스트 링크 | 잉크 `#121110`, 오프화이트 바탕, 라운드 0, 작은 본문 사이즈, 카드에 테두리·그림자 없음 |
| **TOTEME** toteme-studio.com (fetch 차단 → 검색 결과·캐시로 확인) | 내비 "New In / Ready-to-wear / Outerwear / Denim / Knitwear / Shirts / Accessories / Tailoring / About", 홈 카피는 "First access", "Shop Shoes"처럼 명사형 2~3단어 | 메뉴 라벨을 명사형으로, CTA는 2~3단어, 설명문 없음 |
| **LOW CLASSIC** lowclassic.com (Cafe24, 국내) | 상단 메뉴 4개(Our Classic / Journal / Store / Info)로 극단적 절제, 풀블리드 룩북 이미지, 푸터 About Us / Terms&Conditions / Privacy Policy / Help + 사업자정보 | 국내 전자상거래 푸터 구성, 메뉴 수 제한(1차 메뉴 ≤ 6) |

버리는 것: 그라데이션, 둥근 카드+그림자, 보라색, 이모지, 스크롤 애니메이션, "Elevate your style"류 카피, 서브타이틀/안내문 반복.

### 2.2 라이트/다크

**라이트 기본, 푸터만 블랙.** 이유: (1) 레퍼런스 4곳 모두 라이트—의류 사진은 흰 배경 스튜디오 컷이 대부분이라 다크 배경에서 카드가 "떠" 보임, (2) 로고 원본(검정 배경+아이스블루)은 푸터를 `#0A0A0A` 배경 + `#D9E6F5` 로고로 그대로 재현해 브랜드 톤을 살림(대비 15.6:1), (3) DESIGN.md의 "제품 요구가 다른 경우 그 요구를 따른다" 조항 적용. 어드민도 라이트(스토어와 같은 토큰, 밀도만 높임).

### 2.3 브랜드 영문 표기

로고는 `DTIVE 8 ASTIGER`로 읽히며 작은 "8"이 앰퍼샌드 자리에 있음. 한글명 "디티브 아시티거"에는 8/&가 없으므로 8은 장식.
- 텍스트 표기(타이틀 태그, 푸터, 이메일, 문서): **`DTIVE & ASTIGER`**
- 워드마크: `brand/logo.svg` (CSS mask로 currentColor 적용)
- 식별자/슬러그/저장소: `dtive-astiger`
- 대안 `DTIVE8ASTIGER`는 ⑦ 열린 결정.

### 2.4 기술 스택 (2026-11-04 npm latest 확인)

| 영역 | 선택 | 버전 | 근거 |
|---|---|---|---|
| 빌드 | Vite + @vitejs/plugin-react | 8.3 / 6.2 | 확정 |
| UI | React / react-dom | 19.3 | react-router 8 최소 19.2.7 |
| 라우터 | `react-router` (data mode, `createBrowserRouter`) | 8.5 | 로더로 인증/어드민 가드, lazy route로 어드민 청크 분리. node 22.22+ 필요(로컬 26, CI 22) |
| 스타일 | Tailwind CSS + @tailwindcss/vite | 4.3 | `@theme`에 토큰을 CSS 변수로 선언 → 디자인 토큰 한 곳 |
| 서버 상태 | @tanstack/react-query | 5.105 | 캐시/로딩/에러 상태 일관 |
| 클라이언트 상태 | zustand (persist) | 5.0 | 장바구니·드로어 열림 상태만 |
| 폼/검증 | react-hook-form + @hookform/resolvers + zod | 7.91 / 7.0 / 4.6 | |
| Supabase | @supabase/supabase-js / supabase CLI | 2.118 / 3.0 | 확정 |
| 아이콘 | lucide-react | 1.67 | ISC 라이선스, stroke 1.5 고정 |
| 폰트 | `pretendard`(npm, OFL) / `@fontsource-variable/bodoni-moda`(OFL) | 1.3.9 / 5.3 | 라이선스 확인: github.com/orioncactus/pretendard/blob/main/LICENSE (OFL 1.1), fonts.google.com/specimen/Bodoni+Moda/license (OFL 1.1) |
| 주소 검색 | Daum 우편번호 서비스 스크립트 (키 불필요) | — | 국내 쇼핑몰 표준. `react-daum-postcode` 대신 직접 로드(의존성 최소) |
| TypeScript | typescript | **~5.9.3 고정** | latest 7.0.2는 Go 네이티브 재작성 초기 메이저. 인계 안정성 우선. ⑦ 열린 결정 |
| 린트/포맷 | eslint 10 + typescript-eslint 8 + eslint-plugin-react-hooks 7 + prettier 3 | | |
| 테스트 | vitest 5 + @testing-library/react 16 + jsdom 30; pgTAP(`supabase test db`); @playwright/test 1.64 | | |
| 이미지 처리(스크립트) | sharp 0.35 | | 파비콘 크롭·시드 이미지 리사이즈(그리지 않음, 가공만) |

패키지 매니저 npm(package-lock 커밋). Edge Function은 **사용하지 않음**(결제 PG 제거로 서버 비밀키가 필요한 작업이 없음; 모든 서버 로직은 Postgres `security definer` 함수 + RLS).

### 2.5 백엔드 설계 결정

- **관리자 판별: 별도 `public.admins` 테이블 + `is_admin()` security definer 함수.** `profiles.role`은 본인 행 업데이트 권한과 섞여 권한상승 위험. `app_metadata`는 토큰 재발급 전까지 반영 안 되고 로컬 시드가 번거로움. `admins`는 API로 쓰기 불가(정책 없음) → SQL/대시보드로만 지정. UI 가드는 편의, RLS가 실제 방어.
- **주문 생성은 RPC `create_order`(security definer)** 에서 가격·재고를 서버가 재계산. 클라이언트는 `variant_id, quantity`만 보냄. 재고 차감은 `select … for update` 후 `update … where stock >= qty`.
- **입금 기한 만료는 pg_cron 10분 주기 + 어드민 수동 버튼** 이중화(호스팅에서 pg_cron 미활성 시에도 운영 가능).
- **장바구니는 localStorage(zustand persist)만.** 서버 동기화 테이블 없음 → RLS 면적 축소. 결제 직전 서버가 재검증하므로 안전.
- **회원 전용 주문**(비회원 주문 없음). ⑦ 열린 결정.
- **탈퇴: RPC `delete_my_account`** — 진행 중 주문 있으면 거부, 주소록·위시 삭제, 주문은 `user_id=null`로 끊되 수령인 정보는 전자상거래법 보존(계약·대금 5년) 근거로 유지, `auth.users` 삭제(profiles cascade).
- **이미지 리사이즈는 클라이언트(canvas)에서** 2,000px(`.webp`) + 800px(`_m.webp`) 두 벌 업로드. Supabase 이미지 변환은 유료 플랜이라 의존하지 않음.
- **FAQ·약관·개인정보처리방침은 코드 내 정적 콘텐츠**(`src/content/*.ts`)에 사업자 설정값을 치환. 어드민 편집 대상 아님(법무 문구는 개발자/법무가 커밋으로 관리).

---

## ③ 디자인 시스템 (S1에서 `src/styles/tokens.css`로 고정)

### 3.1 색 토큰 (대비는 WCAG 계산값)

```css
@theme {
  --color-bg: #FBFBF9;          /* 페이지 배경 */
  --color-surface: #F2F2EF;     /* 섹션 구분·입력 비활성·어드민 사이드바 */
  --color-ink: #121110;         /* 본문·버튼 배경 (bg 대비 18.2:1) */
  --color-ink-muted: #6B6A66;   /* 보조 텍스트·플레이스홀더 (5.2:1) */
  --color-line: #E3E2DD;        /* 헤어라인 */
  --color-line-strong: #121110; /* 포커스·선택 테두리 */
  --color-ice: #D9E6F5;         /* 로고 색. 다크 배경 위 로고/선택 표시에만 */
  --color-ice-ink: #4B6480;     /* 라이트 배경에서 아이스블루 계열 텍스트가 필요할 때 (5.9:1) */
  --color-danger: #B3261E;      /* 오류·품절 (6.3:1) */
  --color-success: #2E6B3F;     /* 입금확인·배송완료 (6.2:1) */
  --color-footer: #0A0A0A;      /* 푸터 배경 */
  --color-footer-muted: #9A9A94;/* 푸터 사업자정보 (7.0:1 on footer) */
  --color-overlay: rgb(0 0 0 / 0.32);
}
```
규칙: 강조색은 `ice`(다크 위)와 `ink`(라이트 위) 둘뿐. 세일가 표기는 `ink` + 정가 취소선 `ink-muted`. 보라·그라데이션 금지. `border-radius` 전역 0 (`--radius-*` 토큰 없음, 토글/체크박스도 사각).

### 3.2 서체

```css
--font-sans: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--font-display: "Bodoni Moda Variable", "Bodoni Moda", "Times New Roman", serif;
```
- 로드: `import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"`, `import "@fontsource-variable/bodoni-moda"`. 둘 다 self-host(CSP `font-src 'self'`).
- `display`는 **카테고리/룩북/섹션 제목, 홈 히어로 제목, 404 숫자**에만. 상품명·가격·버튼·어드민은 전부 `sans`.
- 굵기: 400, 500만. 합계 금액만 600. 영문 대문자 라벨 `letter-spacing: .06em`, 한글은 0.

타입 스케일(px/line-height):

| 토큰 | 크기 | 용도 |
|---|---|---|
| `text-2xs` | 11/16 | 푸터 사업자정보, 테이블 보조 |
| `text-xs` | 12/16 | 라벨, 대문자 내비 보조, 뱃지 |
| `text-sm` | 13/20 | 상품 카드 이름·가격, 어드민 본문, 내비 |
| `text-base` | 14/22 | 본문 기본 |
| `text-md` | 16/24 | PDP 상품명, 폼 입력값, 모바일 버튼 |
| `text-lg` | 20/28 | h3, 어드민 페이지 제목 |
| `text-xl` | 28/34 (display 500) | h2 섹션 제목 |
| `text-2xl` | 40/44 (display 500) | h1 카테고리 제목 |
| `text-hero` | 64/64 데스크톱, 40/44 모바일 (display 500) | 홈 히어로 |

### 3.3 간격·그리드·브레이크포인트

- 4px 베이스: 4, 8, 12, 16, 24, 32, 48, 64, 96 (Tailwind 기본 스케일 그대로, 홀수 금지).
- 페이지 가터: `px-4`(<768) / `px-6`(768–1279) / `px-10`(≥1280). 최대폭: 스토어 풀블리드(제한 없음), 텍스트 페이지 720px, 체크아웃·마이페이지 960px, 어드민 1280px.
- 브레이크포인트 Tailwind 기본(sm 640 / md 768 / lg 1024 / xl 1280).
- 상품 그리드: 2열(<768) / 3열(768–1279) / 4열(≥1280). `column-gap: 8px`, `row-gap: 32px`. 카드 이미지 비율 3:4 고정(`aspect-[3/4] object-cover`).
- 섹션 사이 간격 64(모바일) / 96(데스크톱).
- z-index: header 40, 메가메뉴 41, 드로어 50, 다이얼로그 60, 토스트 70.

### 3.4 레이아웃 구조

**헤더** (`components/layout/Header.tsx`): 높이 64(≥1024) / 56(모바일). 3열: 좌 1차 메뉴(≤6개: 카테고리 루트 + "Lookbook"), 중앙 로고(높이 36/30, CSS mask `currentColor`), 우 아이콘(검색·계정·위시·장바구니(count 뱃지는 숫자만)). 배경 `bg` + 하단 헤어라인. **홈에서만** 히어로 위 투명(글자색 흰색) → 스크롤 1px 이상 시 `bg`로 전환(200ms). 모바일: 좌 햄버거, 중앙 로고, 우 검색·장바구니. 메가메뉴(데스크톱 hover/포커스 150ms 지연 열림): 해당 루트의 하위 카테고리 1열 + 대표 이미지 1장(해당 카테고리 `image_path`). 모바일 메뉴: 전체화면 패널, 1차 → 아코디언으로 2차.

**푸터** (`Footer.tsx`): 배경 `footer`, 로고 `ice` 높이 120(모바일 80). 3열: 고객센터(이메일·운영시간·1:1 문의 메일 링크), 안내(이용약관·개인정보처리방침·FAQ·배송/교환/반품), SNS(설정 파일의 인스타그램 등 존재하는 것만). 하단 `text-2xs footer-muted`: 상호 · 대표 · 사업자등록번호 · 통신판매업신고번호 · 주소 · 전화 · 이메일 · 개인정보보호책임자 · © 연도. 값은 전부 `src/config/business.ts`.

**상품 카드** (`features/catalog/components/ProductCard.tsx`): 이미지(1번) → hover 시 2번 이미지로 crossfade 400ms(2번 없으면 유지). 이미지 하단 좌측에 데스크톱 hover 시 사이즈 칩 행(재고 있는 사이즈만, 품절은 취소선) 표시 → 클릭 즉시 담기(토스트 "장바구니에 담았습니다" + 드로어 열지 않음). 아래 텍스트: 이름(`text-sm`, 1줄 말줄임), 가격(`text-sm`), 세일 시 정가 취소선 선행. 품절(모든 variant stock 0)은 이름 옆 "품절" `ink-muted`. 테두리·그림자·라운드 없음. 위시 하트는 카드 우상단, hover 시만(모바일 상시) 표시, 로그인 안 했으면 로그인으로.

**PDP** (`features/catalog/pages/ProductPage.tsx`): ≥1024: 좌 60% 이미지 세로 스택(각 3:4, 간격 8), 우 40% `sticky top-[64px]` 정보 패널: 이름(`text-md`) · 가격 · 색상 선택(색상명 텍스트 버튼, 선택은 밑줄) · 사이즈 버튼(44px 정사각, 품절 취소선+disabled) · "장바구니 담기" 풀폭 primary · 위시 토글 · 아코디언 3개(상세 / 소재·세탁 / 배송·교환·반품(설정 파일 문구)). <1024: 이미지 가로 스와이프(scroll-snap) + 우하단 `1/5` 카운터, 정보 아래, 하단 sticky 바(가격 + 담기 버튼). 사이즈 미선택 상태로 담기 클릭 → 사이즈 영역 `danger` 테두리 + 메시지 "사이즈를 선택하세요"(필요한 설명만).

**장바구니 드로어** (`features/cart/components/CartDrawer.tsx`): 우측 420px(모바일 100%), 오버레이. 헤더 "장바구니 (n)" + 닫기. 라인: 썸네일 80×107, 이름, 색상/사이즈, 수량 스테퍼(1~10, 재고 한도), 삭제(텍스트 "삭제"), 라인 합계. 푸터: 상품 합계, 배송비(설정값, 무료 임계치 미만이면 "n원 더 담으면 무료배송"—데이터 기반이라 허용), "주문하기" primary → `/checkout`. 비어 있으면 "장바구니가 비어 있습니다" + "쇼핑 계속하기" 링크만.

**버튼** (`components/ui/Button.tsx`): `variant: 'primary'|'secondary'|'ghost'|'danger'`, `size: 'md'(44px)|'sm'(36px)`, `loading`. primary: `bg-ink text-white hover:bg-[#2A2A28]`, secondary: `border border-ink bg-transparent hover:bg-surface`, ghost: 텍스트+밑줄(`underline-offset-4`), danger: `border-danger text-danger`. disabled 40% 투명. 포커스: `outline: 2px solid var(--color-ink); outline-offset: 2px`.

**입력** (`Input/Select/Textarea/Checkbox/Radio`): 높이 44, `border border-[#C9C8C3]`, 포커스 `border-ink`(글로우 없음), 라벨 위 `text-xs`, 오류 `text-xs text-danger` 아래, 라운드 0. 체크박스 16px 사각, 체크 시 `bg-ink` + 흰 체크(lucide `Check`).

**모션**: 색/테두리 200ms, 드로어·메뉴 300ms `cubic-bezier(.2,.8,.2,1)`, 이미지 crossfade 400ms, 토스트 등장 200ms. 스크롤 트리거·패럴랙스·호버 확대 금지. `@media (prefers-reduced-motion: reduce)`에서 transition 0.

**아이콘**: lucide-react, `size=20 strokeWidth=1.5` 기본값을 `components/ui/Icon.tsx` 래퍼로 고정. 아이콘 단독 버튼은 `aria-label` 필수.

**상태 컴포넌트**: `Skeleton`(카드/텍스트 박스, `bg-surface`), `EmptyState({title, action?})`(한 문장 + 링크 1개), `ErrorState({onRetry})`("불러오지 못했습니다" + 다시 시도), `Spinner`. 리스트는 스켈레톤, 버튼은 `loading`로 표시.

---

## ④ 라우트/화면 목록

`basename = import.meta.env.BASE_URL`. 모든 페이지 `<title>`은 `"{페이지} | DTIVE & ASTIGER"`.

### 4.1 스토어

| 경로 | 파일 (`src/features/...`) | 데이터 | loading / empty / error |
|---|---|---|---|
| `/` | `catalog/pages/HomePage.tsx` | `home_sections` active + 각 collection 섹션의 상품(최대 8) | 섹션별 스켈레톤 / 섹션 0개면 전체상품 그리드 폴백 / ErrorState |
| `/shop` | `catalog/pages/CategoryPage.tsx` (전체) | products active, 필터(사이즈·색상·정렬: 최신/가격↑/가격↓), 24개씩 "더 보기" | 카드 스켈레톤 8개 / "해당하는 상품이 없습니다" + 필터 초기화 / ErrorState |
| `/shop/:categorySlug` | 동일 컴포넌트 | 카테고리(+하위) 상품 | 카테고리 없으면 404 |
| `/products/:slug` | `catalog/pages/ProductPage.tsx` | product + images + variants | 스켈레톤(이미지 박스+텍스트) / 없거나 draft면 404 / ErrorState |
| `/search?q=` | `catalog/pages/SearchPage.tsx` | `name/description ilike` | q 비면 입력 안내 없이 빈 그리드 / "'q'에 대한 결과가 없습니다" |
| `/lookbook` | `catalog/pages/LookbookPage.tsx` | `home_sections` kind=lookbook 전부 | 없으면 404 아님, EmptyState |
| `/checkout` | `checkout/pages/CheckoutPage.tsx` | 로그인 필수(loader), 주소록, settings | 장바구니 비면 `/`로 redirect / 제출 중 버튼 loading / RPC 에러 메시지 매핑 |
| `/orders/:orderId/complete` | `checkout/pages/OrderCompletePage.tsx` | order(본인) | 본인 아니면 404 |
| `/login`, `/signup`, `/forgot-password`, `/auth/reset`, `/auth/confirmed` | `auth/pages/*` | — | 폼 제출 loading, 에러 인라인. 로그인 상태면 `/account`로 |
| `/account` | `account/pages/AccountLayout.tsx` (좌 탭: 주문내역·위시리스트·주소록·회원정보) → index는 주문내역 | | |
| `/account/orders`, `/account/orders/:orderId` | `account/pages/OrdersPage.tsx`, `OrderDetailPage.tsx` | 본인 orders | "주문 내역이 없습니다" |
| `/account/wishlist` | `account/pages/WishlistPage.tsx` | wishlist join products | "위시리스트가 비어 있습니다" |
| `/account/addresses` | `account/pages/AddressesPage.tsx` | addresses CRUD, 기본 지정 | "저장된 주소가 없습니다" + "주소 추가" |
| `/account/profile` | `account/pages/ProfilePage.tsx` | 이름/전화/마케팅 동의 수정, 이메일 변경, 비밀번호 변경, 회원탈퇴(확인 다이얼로그: 비밀번호 재입력 → `delete_my_account`) | 진행 주문 있으면 탈퇴 버튼 disabled + 사유 1줄 |
| `/terms`, `/privacy`, `/faq`, `/shipping` | `content/pages/*` | 정적 | — |
| `*` | `NotFoundPage.tsx` | display "404" + "홈으로" | — |

### 4.2 어드민 (`/admin/*`, lazy chunk, loader `requireAdmin`)

| 경로 | 파일 (`src/admin/pages/...`) | 기능 |
|---|---|---|
| `/admin` | `DashboardPage.tsx` | `admin_dashboard_stats()`: 입금대기/입금확인/준비중/배송중 건수, 오늘 주문, 30일 매출(paid 이후 상태 합), 재고 ≤3 variant 목록, "만료 주문 정리" 버튼(`expire_unpaid_orders`) |
| `/admin/products` | `ProductsPage.tsx` | 테이블(썸네일·이름·카테고리·가격·총재고·상태·수정일), 검색, 상태 필터, "상품 추가" |
| `/admin/products/new`, `/admin/products/:id` | `ProductEditPage.tsx` | 기본정보 폼(이름·슬러그 자동생성/수정·카테고리·가격·정가·설명·소재·세탁·상태·추천), 이미지 업로더(드래그 정렬, 색상 태그, alt, 삭제), 옵션 그리드(색상×사이즈 → variant 행: SKU·재고·가격차·활성), 저장·삭제(archived 전환; 주문에 연결된 상품은 물리 삭제 금지) |
| `/admin/categories` | `CategoriesPage.tsx` | 트리(2단계) 추가·이름/슬러그·정렬(위/아래 버튼)·활성·대표 이미지 |
| `/admin/orders` | `OrdersPage.tsx` | 탭(전체/입금대기/입금확인/준비중/배송중/배송완료/취소/환불), 기간·주문번호·수령인 검색, 취소요청 뱃지 |
| `/admin/orders/:id` | `OrderDetailPage.tsx` | 주문 정보·품목·수령인·입금자명·기한·이벤트 타임라인. 행동: **입금 확인**(pending→paid), 준비중, 송장 입력(택배사 select + 번호 → shipped), 배송완료, 취소(pending/paid/preparing → cancelled, 재고 복구; paid 이후면 메모 필수 "환불 계좌/금액"), 환불 완료(cancelled(paid 이후)→refunded), 관리자 메모 |
| `/admin/customers` | `CustomersPage.tsx` | profiles 목록(이름·이메일·전화·가입일·주문수), 검색, 상세 드로어(주문 목록 링크). 관리자 지정 UI 없음(SQL만) |
| `/admin/home` | `HomeSectionsPage.tsx` | 섹션 목록 정렬·활성·추가/수정(kind별 폼: hero/split/collection/lookbook), 이미지 업로드(banners 버킷), 미리보기 링크 |
| `/admin/settings` | `SettingsPage.tsx` | 배송비·무료배송 임계치·**입금 계좌(은행/계좌번호/예금주)**·입금 기한(시간), 저장. 하단 감사 로그 최근 200건 테이블 |

공통 상태: 테이블 로딩 스켈레톤 행 5개, 빈 결과 "결과가 없습니다", 저장 성공 토스트 "저장했습니다", 실패 토스트에 서버 메시지.

---

## ⑤ 디렉터리 구조

```
dtive-astiger/
  AGENTS.md                      # 저장소 규칙(짧게): 토큰만 사용, 라운드 0, 설명문 금지, RLS 필수, 커밋 전 체크 명령
  README.md                      # 인계 문서 진입점 (⑨)
  docs/ HANDOVER.md SUPABASE_SETUP.md DEPLOY.md SECURITY.md OPERATIONS.md
  .github/workflows/pages.yml    # workflow_dispatch만 (push 트리거 없음)
  .env.example  .nvmrc(22)  package.json  vite.config.ts  tsconfig.json  eslint.config.js  .prettierrc
  index.html                     # CSP meta, lang="ko"
  public/ favicon.ico favicon-32.png apple-touch-icon.png robots.txt
  brand/ logo-source.png logo.svg
  scripts/ make-favicons.mjs fetch-seed-images.mjs
  src/
    main.tsx  app/router.tsx  app/providers.tsx  app/guards.ts  app/errors.ts
    config/ business.ts env.ts site.ts
    styles/ tokens.css base.css
    assets/ logo.svg
    lib/ supabase.ts queryClient.ts format.ts images.ts imageResize.ts daumPostcode.ts rpcErrors.ts
    types/ database.ts(생성) domain.ts
    components/ui/ Button Input Select Textarea Checkbox Radio Field Dialog Drawer Toast Skeleton EmptyState ErrorState Spinner Icon Accordion Tabs Table Pagination Badge
    components/layout/ Header MegaMenu MobileMenu Footer SearchOverlay StoreLayout
    content/ terms.ts privacy.ts faq.ts shipping.ts
    features/
      auth/ session.tsx api.ts schemas.ts pages/{LoginPage,SignupPage,ForgotPasswordPage,ResetPasswordPage,ConfirmedPage}.tsx
      catalog/ api.ts hooks.ts components/{ProductCard,ProductGrid,FilterBar,ImageGallery,VariantPicker,HomeSection}.tsx pages/{HomePage,CategoryPage,ProductPage,SearchPage,LookbookPage}.tsx
      cart/ store.ts selectors.ts components/{CartDrawer,CartLine,QtyStepper}.tsx
      checkout/ api.ts schemas.ts pages/{CheckoutPage,OrderCompletePage}.tsx components/{AddressForm,OrderSummary,BankTransferInfo}.tsx
      account/ api.ts schemas.ts pages/{AccountLayout,OrdersPage,OrderDetailPage,WishlistPage,AddressesPage,ProfilePage}.tsx
      content/pages/{TermsPage,PrivacyPage,FaqPage,ShippingPage}.tsx
    admin/
      AdminLayout.tsx  api.ts  schemas.ts
      components/{DataTable,ImageUploader,VariantGrid,StatusBadge,OrderTimeline}.tsx
      pages/{DashboardPage,ProductsPage,ProductEditPage,CategoriesPage,OrdersPage,OrderDetailPage,CustomersPage,HomeSectionsPage,SettingsPage}.tsx
  supabase/
    config.toml  seed.sql
    migrations/ 0001_extensions.sql 0002_types.sql 0003_tables.sql 0004_functions.sql 0005_rls.sql 0006_storage.sql 0007_triggers_cron.sql
    templates/ confirmation.html recovery.html email_change.html
    seed-assets/ products/… banners/… CREDITS.md
    tests/ 01_rls_catalog.sql 02_rls_orders.sql 03_create_order.sql 04_cancel_expire.sql 05_admin_funcs.sql 06_account.sql
  e2e/ shop.spec.ts admin.spec.ts playwright.config.ts
```

---

## ⑥ Supabase 스키마 (S2가 그대로 구현)

### 6.1 확장·enum (`0001`, `0002`)

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_cron;  -- 로컬 OK. 호스팅은 Dashboard > Database > Extensions에서 활성 (문서화)

create type public.order_status as enum ('pending_payment','paid','preparing','shipped','delivered','cancelled','refunded');
create type public.product_status as enum ('draft','active','archived');
create type public.home_section_kind as enum ('hero','split','collection','lookbook');
```

### 6.2 테이블 (`0003`) — 컬럼 전부

**profiles**
```sql
id uuid primary key references auth.users(id) on delete cascade,
email text not null,
name text not null check (char_length(name) between 1 and 40),
phone text check (phone is null or phone ~ '^01[0-9]{8,9}$'),
terms_agreed_at timestamptz not null,
privacy_agreed_at timestamptz not null,
marketing_agreed_at timestamptz,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```
컬럼 권한: `revoke update on public.profiles from authenticated; grant update (name, phone, marketing_agreed_at) on public.profiles to authenticated;` (email·동의 시각은 트리거만 수정)

**admins**: `user_id uuid primary key references auth.users(id) on delete cascade, created_at timestamptz default now(), note text`

**categories**: `id uuid pk default gen_random_uuid(), slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), name text not null, parent_id uuid references categories(id) on delete set null, image_path text, sort int not null default 0, is_active boolean not null default true, created_at, updated_at`. 인덱스 `(parent_id, sort)`.

**products**: `id uuid pk, slug text unique not null (동일 check), name text not null, description text not null default '', material text not null default '', care text not null default '', price integer not null check (price >= 0), compare_at_price integer check (compare_at_price is null or compare_at_price > price), category_id uuid references categories(id) on delete set null, status product_status not null default 'draft', is_featured boolean not null default false, published_at timestamptz, created_at, updated_at`. 인덱스: `(status, created_at desc)`, `(category_id)`, `gin (name gin_trgm_ops)`, `gin (description gin_trgm_ops)`.

**product_images**: `id uuid pk, product_id uuid not null references products(id) on delete cascade, storage_path text not null, alt text not null default '', color text, sort int not null default 0, created_at`. 인덱스 `(product_id, sort)`. `storage_path` 형식 `products/{product_id}/{uuid}.webp` (800px 판은 `…_m.webp`, 경로는 저장 안 하고 규칙으로 파생).

**product_variants**: `id uuid pk, product_id uuid not null references products(id) on delete cascade, sku text not null unique, color text not null default '', size text not null default '', stock integer not null default 0 check (stock >= 0), price_delta integer not null default 0, sort int not null default 0, is_active boolean not null default true, created_at, updated_at, unique (product_id, color, size)`.

**addresses**: `id uuid pk, user_id uuid not null references profiles(id) on delete cascade, label text not null default '', recipient text not null, phone text not null check (phone ~ '^01[0-9]{8,9}$'), postal_code text not null check (postal_code ~ '^[0-9]{5}$'), address1 text not null, address2 text not null default '', is_default boolean not null default false, created_at, updated_at`. `create unique index addresses_one_default on addresses(user_id) where is_default;` 트리거 `ensure_single_default_address`(insert/update에서 is_default=true면 같은 user의 다른 행 false).

**wishlist_items**: `user_id uuid references profiles(id) on delete cascade, product_id uuid references products(id) on delete cascade, created_at, primary key (user_id, product_id)`.

**orders**
```sql
id uuid primary key default gen_random_uuid(),
order_no text not null unique,                       -- 'YYYYMMDD-XXXXXX' (Crockford base32 6자)
user_id uuid references profiles(id) on delete set null,
status order_status not null default 'pending_payment',
payment_method text not null default 'bank_transfer' check (payment_method = 'bank_transfer'),
subtotal integer not null check (subtotal >= 0),
shipping_fee integer not null check (shipping_fee >= 0),
total integer not null check (total = subtotal + shipping_fee),
recipient text not null, phone text not null, postal_code text not null, address1 text not null, address2 text not null default '',
memo text not null default '' check (char_length(memo) <= 200),
depositor_name text not null check (char_length(depositor_name) between 1 and 20),
bank_name text not null, bank_account text not null, bank_holder text not null,   -- 주문 시점 설정 스냅샷
payment_due_at timestamptz not null,
paid_at timestamptz, shipped_at timestamptz, delivered_at timestamptz, cancelled_at timestamptz, refunded_at timestamptz,
cancel_reason text, cancel_requested_at timestamptz,
carrier text, tracking_no text,
admin_note text not null default '',
created_at timestamptz not null default now(), updated_at timestamptz not null default now()
```
인덱스: `(user_id, created_at desc)`, `(status, created_at desc)`, `(status, payment_due_at) where status = 'pending_payment'`, `(created_at desc)`.

**order_items**: `id uuid pk, order_id uuid not null references orders(id) on delete cascade, product_id uuid references products(id) on delete set null, variant_id uuid references product_variants(id) on delete set null, product_name text not null, variant_label text not null, sku text not null, unit_price integer not null check (unit_price >= 0), quantity integer not null check (quantity between 1 and 10), image_path text, line_total integer generated always as (unit_price * quantity) stored`. 인덱스 `(order_id)`.

**order_events**: `id bigint generated always as identity pk, order_id uuid not null references orders(id) on delete cascade, actor_id uuid, from_status order_status, to_status order_status not null, note text not null default '', created_at timestamptz default now()`. 인덱스 `(order_id, created_at)`.

**site_settings** (단일 행): `id smallint primary key default 1 check (id = 1), shipping_fee integer not null default 3000, free_shipping_threshold integer check (free_shipping_threshold is null or free_shipping_threshold > 0) default 100000, bank_name text not null default '', bank_account text not null default '', bank_holder text not null default '', payment_due_hours integer not null default 48 check (payment_due_hours between 1 and 168), updated_at, updated_by uuid`. 시드에서 1행 삽입.

**home_sections**: `id uuid pk, kind home_section_kind not null, title text not null default '', link_label text not null default '', link_href text not null default '', image_path text, image_path_2 text, category_id uuid references categories(id) on delete set null, product_ids uuid[] not null default '{}', items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'), sort int not null default 0, is_active boolean not null default true, created_at, updated_at`. `items` 원소: `{ "image_path": string, "caption": string, "href": string }` (lookbook 전용).

**audit_logs**: `id bigint identity pk, actor_id uuid, action text not null check (action in ('INSERT','UPDATE','DELETE','ACCOUNT_DELETED')), table_name text not null, row_id text not null, before jsonb, after jsonb, created_at timestamptz default now()`. 인덱스 `(created_at desc)`.

모든 `updated_at` 보유 테이블에 `before update` 트리거 `set_updated_at()`.

### 6.3 함수 (`0004`) — 시그니처 고정

모든 함수 `language plpgsql`(is_admin은 sql) `security definer set search_path = public`; 생성 직후 `revoke all on function … from public;` 후 필요한 롤에만 `grant execute`.

| 함수 | grant | 동작 |
|---|---|---|
| `is_admin() returns boolean` (sql, stable) | anon, authenticated | `exists(select 1 from admins where user_id = auth.uid())` |
| `handle_new_user()` trigger (auth.users after insert) | — | `raw_user_meta_data`에서 `name`, `phone`, `terms_agreed`, `privacy_agreed`, `marketing_agreed` 읽음. `terms_agreed`·`privacy_agreed`가 `true`가 아니면 `raise exception 'TERMS_REQUIRED'` → 가입 실패. profiles insert (email = new.email). |
| `handle_user_email_update()` trigger (auth.users after update of email) | — | profiles.email 동기화 |
| `set_updated_at()` | — | |
| `log_audit()` trigger (products, product_variants, product_images, categories, orders, site_settings, home_sections after I/U/D) | — | actor `auth.uid()`, before/after `to_jsonb`; orders는 수령인·연락처·주소·메모·입금자명·취소 사유·`admin_note`를 빼고 기록, 그 값만 바뀐 경우 `after.redacted_changed`에 항목 이름만(0009) |
| `generate_order_no() returns text` | 내부 | `to_char(now() at time zone 'Asia/Seoul','YYYYMMDD') || '-' || 6자 base32`; `create_order` 안에서 unique 충돌 시 최대 5회 재시도 |
| `create_order(p_items jsonb, p_address jsonb, p_memo text, p_depositor_name text) returns jsonb` | authenticated | 아래 6.4 |
| `cancel_my_order(p_order_id uuid, p_reason text) returns void` | authenticated | 본인 주문만. `pending_payment` → `cancelled` + 재고 복구 + 이벤트. `paid`/`preparing` → `cancel_requested_at = now(), cancel_reason = p_reason`(상태 불변) + 이벤트(note '취소 요청'). 그 외 `raise 'CANNOT_CANCEL'` |
| `restore_order_stock(p_order_id uuid) returns void` | 내부(revoke all) | order_items 순회 `update product_variants set stock = stock + quantity where id = variant_id` |
| `expire_unpaid_orders() returns integer` | authenticated(내부에서 `is_admin()` 검사) + cron | `status='pending_payment' and payment_due_at < now()` → `cancelled`, `cancelled_at=now()`, `cancel_reason='입금 기한 만료'`, 재고 복구, 이벤트(actor null). 처리 건수 반환. pg_cron은 postgres 롤로 실행하므로 `is_admin()` 검사는 `auth.uid() is null or is_admin()` 형태(JWT 없는 호출은 cron) |
| `admin_update_order_status(p_order_id uuid, p_status order_status, p_note text) returns void` | authenticated(내부 `is_admin()` 아니면 `raise 'FORBIDDEN'`) | 전이표(6.5) 검증, 타임스탬프 세팅, cancelled/refunded 전이 시 재고 복구(재고는 **한 번만**: cancelled에서 복구했으면 refunded에서 중복 복구 금지 → cancelled에서만 복구), 이벤트 기록 |
| `admin_set_tracking(p_order_id uuid, p_carrier text, p_tracking_no text) returns void` | authenticated(admin) | `paid`/`preparing` → `shipped`, `shipped_at=now()`; 이미 shipped면 송장만 수정 |
| `reorder_product_images(p_product_id uuid, p_image_ids uuid[]) returns void` | authenticated(admin) | 배열 순서대로 sort 0..n 갱신 |
| `admin_dashboard_stats() returns jsonb` | authenticated(admin) | `{ counts: {pending_payment, paid, preparing, shipped}, today_orders, revenue_30d, low_stock: [{variant_id, product_name, sku, stock}] (stock<=3, 20개) , expired_pending: n }` |
| `delete_my_account() returns void` | authenticated | 6.6 |

### 6.4 `create_order` 상세

입력 `p_items`: `[{ "variant_id": uuid, "quantity": int }]` (1~50개, quantity 1~10, variant 중복 불가). `p_address`: `{ recipient, phone, postal_code, address1, address2 }` (서버에서 addresses와 같은 check 적용; `address_id`를 받지 않고 **값을 받음** — 클라이언트가 주소록에서 고른 값을 그대로 전달, 서버는 형식만 검증).

```
1. v_user := auth.uid(); null이면 raise 'AUTH_REQUIRED'
2. 입력 형식 검증 실패 → raise 'INVALID_INPUT'
3. select v.id, v.stock, v.price_delta, v.sku, v.color, v.size, p.id, p.name, p.price, p.status, v.is_active
   from product_variants v join products p on p.id = v.product_id
   where v.id = any(ids) for update of v            -- 잠금 순서: id 정렬
   - 행 수 ≠ 요청 수 또는 p.status <> 'active' 또는 not v.is_active → raise 'ITEM_UNAVAILABLE' (detail = variant_id)
   - stock < quantity → raise 'OUT_OF_STOCK' (detail = variant_id)
4. unit_price = p.price + v.price_delta; subtotal = Σ unit_price*qty
5. settings := select * from site_settings where id = 1;
   bank_account = '' 이면 raise 'BANK_NOT_CONFIGURED'
   shipping_fee = case when free_shipping_threshold is not null and subtotal >= free_shipping_threshold then 0 else shipping_fee end
6. insert orders (order_no = generate_order_no() 재시도, status 'pending_payment', bank 스냅샷, payment_due_at = now() + payment_due_hours * interval '1 hour', …)
7. insert order_items (image_path = product_images sort 최소 1장, color 일치 우선)
8. update product_variants set stock = stock - qty where id = … and stock >= qty; (row count 확인, 0이면 raise 'OUT_OF_STOCK')
9. insert order_events (null → pending_payment, actor v_user)
10. return jsonb_build_object('order_id', id, 'order_no', order_no, 'total', total, 'payment_due_at', payment_due_at,
      'bank', jsonb_build_object('bank_name', …, 'bank_account', …, 'bank_holder', …))
```
오류는 `raise exception using message = '<CODE>', detail = <variant_id or ''>, errcode = 'P0001'`. 클라이언트 `src/lib/rpcErrors.ts`가 `message`로 한국어 매핑:
`AUTH_REQUIRED`→"로그인이 필요합니다", `OUT_OF_STOCK`→"재고가 부족한 상품이 있습니다", `ITEM_UNAVAILABLE`→"판매 중이 아닌 상품이 있습니다", `BANK_NOT_CONFIGURED`→"현재 주문을 받을 수 없습니다", `CANNOT_CANCEL`→"취소할 수 없는 주문입니다", `ACTIVE_ORDERS`→"진행 중인 주문이 있어 탈퇴할 수 없습니다", `FORBIDDEN`→"권한이 없습니다", `INVALID_INPUT`→"입력값을 확인하세요", `TOO_MANY_PENDING`(입금 대기 3건 이상)·`TOO_MANY_ORDERS`(최근 1시간 10건 이상)는 `create_order`의 고객별 한도(0009).

### 6.5 주문 상태 전이표 (서버가 진실, UI는 같은 표를 `src/types/domain.ts`의 `ORDER_TRANSITIONS`로 복제)

| from → to | 누가 | 부수 효과 |
|---|---|---|
| pending_payment → paid | admin("입금 확인") | `paid_at` |
| pending_payment → cancelled | 고객(`cancel_my_order`) / admin / cron 만료 | 재고 복구, `cancelled_at` |
| paid → preparing | admin | |
| paid, preparing → shipped | admin(`admin_set_tracking`) | `shipped_at`, carrier/tracking 필수 |
| shipped → delivered | admin | `delivered_at` |
| paid, preparing → cancelled | admin(메모 필수: 환불 계좌·금액) | 재고 복구, `cancelled_at` |
| cancelled(이전에 paid_at 존재) → refunded | admin("환불 완료") | `refunded_at`, 재고 복구 **안 함** |
| 그 외 | — | `raise 'INVALID_TRANSITION'` |

상태 라벨: 입금 대기 / 입금 확인 / 상품 준비중 / 배송중 / 배송 완료 / 취소 / 환불 완료.

### 6.6 `delete_my_account`

```
1. v_user := auth.uid() (null → AUTH_REQUIRED)
2. exists orders where user_id = v_user and status in ('pending_payment','paid','preparing','shipped') → raise 'ACTIVE_ORDERS'
3. delete addresses, wishlist_items where user_id = v_user
4. update orders set user_id = null where user_id = v_user      -- 주문·수령인 정보는 전자상거래법 보존(5년) 근거로 유지, 계정 연결만 해제
5. insert audit_logs (actor v_user, 'ACCOUNT_DELETED', 'profiles', v_user::text, before null, after null)      -- 0009: 이메일·이름 해시도 남기지 않음
6. delete from auth.users where id = v_user      -- profiles cascade
```
클라이언트는 성공 후 `supabase.auth.signOut()` + `/`로. (호스팅 Supabase에서 `postgres` 소유 security definer 함수의 `auth.users` delete는 동작. 안 될 경우 대비: SUPABASE_SETUP.md에 "Dashboard에서 수동 삭제" 절차 병기.)

### 6.7 RLS (`0005`) — 테이블별 정책 문장

모든 테이블 `enable row level security` + `force row level security`(테이블 소유자도 정책 적용; 함수는 definer로 우회).

| 테이블 | select | insert | update | delete |
|---|---|---|---|---|
| profiles | `id = auth.uid() or is_admin()` | 없음(트리거) | `id = auth.uid()` (컬럼 grant로 제한) | 없음(RPC) |
| admins | `user_id = auth.uid()` | 없음 | 없음 | 없음 |
| categories | `is_active or is_admin()` (anon 포함) | `is_admin()` | `is_admin()` | `is_admin()` |
| products | `status = 'active' or is_admin()` | `is_admin()` | `is_admin()` | `is_admin()` |
| product_images, product_variants | `is_admin() or exists(select 1 from products p where p.id = product_id and p.status = 'active')` | `is_admin()` | `is_admin()` | `is_admin()` |
| addresses | `user_id = auth.uid()` | `user_id = auth.uid()` (with check) | 동일 | 동일 |
| wishlist_items | `user_id = auth.uid()` | with check 동일 | 없음 | `user_id = auth.uid()` |
| orders | `user_id = auth.uid() or is_admin()` | 없음(RPC) | `is_admin()` (admin_note, carrier, tracking_no 직접 수정용; 상태는 RPC) | 없음 |
| order_items | `is_admin() or exists(select 1 from orders o where o.id = order_id and o.user_id = auth.uid())` | 없음 | 없음 | 없음 |
| order_events | 동일 | 없음 | 없음 | 없음 |
| site_settings | `true` (anon 포함; 배송비 표시용. 계좌는 주문 완료 화면에서 주문 스냅샷을 쓰므로 노출돼도 무방) | 없음 | `is_admin()` | 없음 |
| home_sections | `is_active or is_admin()` | `is_admin()` | `is_admin()` | `is_admin()` |
| audit_logs | `is_admin()` | 없음(트리거 definer) | 없음 | 없음 |

`orders`의 admin update는 `status` 컬럼 변경을 막기 위해 컬럼 grant: `grant update (admin_note, carrier, tracking_no) on orders to authenticated` (나머지 컬럼은 함수만). 읽기도 컬럼 grant(0009): `orders.admin_note`, `order_events.actor_id`·`note`, `site_settings.updated_by`는 API 역할이 select 불가 — 관리자는 `admin_get_order(p_order_id) returns jsonb`(주문+items+events+customer)로 읽음. `profiles.marketing_agreed_at`은 트리거 `stamp_marketing_consent`가 now()/기존 값으로 고정.

### 6.8 Storage (`0006`)

config.toml:
```toml
[storage.buckets.products]
public = true
file_size_limit = "5MiB"
allowed_mime_types = ["image/webp", "image/jpeg", "image/png"]
objects_path = "./seed-assets/products"

[storage.buckets.banners]
public = true
file_size_limit = "8MiB"
allowed_mime_types = ["image/webp", "image/jpeg", "image/png"]
objects_path = "./seed-assets/banners"
```
마이그레이션에서도 `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) … on conflict do nothing`(호스팅용). `storage.objects` 정책: select `bucket_id in ('products','banners')` (public), insert/update/delete `is_admin() and bucket_id in (…)`. 경로 규칙 강제: with check `name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(_m)?\.webp$'`.

### 6.9 cron (`0007`)

```sql
select cron.schedule('expire-unpaid-orders', '*/10 * * * *', $$select public.expire_unpaid_orders()$$);
```
호스팅에서 pg_cron 미활성이면 마이그레이션 실패 → `do $$ begin if exists (select 1 from pg_extension where extname='pg_cron') then … end if; end $$;` 로 감싸고 문서에 활성 절차.

### 6.10 config.toml 핵심 (supabase/ui-library 템플릿 125–166행 키 기준)

```toml
[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173/**", "http://127.0.0.1:5173/**"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
minimum_password_length = 8
password_requirements = "letters_digits"
enable_signup = true
enable_anonymous_sign_ins = false
[auth.rate_limit]
email_sent = 30            # 로컬 Mailpit 전용. 호스팅 기본 2/h → 커스텀 SMTP 설정 후 상향 (문서)
sign_in_sign_ups = 30
token_verifications = 30
token_refresh = 150
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true
secure_password_change = true
max_frequency = "1m0s"
otp_expiry = 3600
[auth.email.template.confirmation]  subject = "[DTIVE & ASTIGER] 이메일 주소를 확인해 주세요"  content_path = "./supabase/templates/confirmation.html"
[auth.email.template.recovery]      subject = "[DTIVE & ASTIGER] 비밀번호 재설정"            content_path = "./supabase/templates/recovery.html"
[auth.email.template.email_change]  subject = "[DTIVE & ASTIGER] 이메일 변경 확인"           content_path = "./supabase/templates/email_change.html"
[db.seed]
enabled = true
sql_paths = ["./seed.sql"]
```

### 6.11 seed.sql

- `auth.users` 2명(`crypt()`로 비밀번호, `email_confirmed_at = now()`, `raw_user_meta_data`에 동의 플래그): `admin@example.com / Admin1234!`, `customer@example.com / Customer1234!` → 트리거로 profiles 생성. `admins`에 admin 삽입.
- `site_settings` 1행: 배송비 3000, 무료 100000, 은행 "국민은행", 계좌 "000000-00-000000", 예금주 "디티브아시티거", 기한 48.
- categories 2단계: `women`(아우터·니트·셔츠·팬츠·드레스), `men`(아우터·니트·셔츠·팬츠), `accessories`(가방·벨트).
- products 16개(각 카테고리 2개 이상), 각 이미지 2~3장, variants 색상 1~2 × 사이즈 S/M/L(일부 품절 0, 일부 저재고 2). 가격 59,000~489,000. 설명은 소재·핏·치수 중심(마케팅 카피 금지).
- home_sections: hero 1, split 1, collection 2(women/men), lookbook 1(items 4).
- 이미지: `scripts/fetch-seed-images.mjs`가 `scripts/seed-images.json`(Unsplash photo id, 작가, URL)을 읽어 `https://images.unsplash.com/photo-<id>?w=2000&fm=webp&q=85`로 내려받고 sharp로 2000/800px 두 벌을 `supabase/seed-assets/products/{product_id}/{uuid}.webp`로 저장. `CREDITS.md`에 출처·Unsplash License 명시. 워커가 unsplash.com에서 실제 의류 사진 id를 골라 json에 기록(코드로 이미지 생성 금지). seed-assets는 git 커밋(총 20MB 이하 유지).

---

## ⑦ 프론트 핵심 계약 (슬라이스 간 인터페이스)

```ts
// src/config/business.ts — 사용자가 채우는 유일한 사업자 정보 파일
export const business = {
  brandName: 'DTIVE & ASTIGER', brandNameKo: '디티브 아시티거',
  companyName: '', ceo: '', bizNo: '', mailOrderNo: '', address: '', phone: '', email: '',
  privacyOfficer: { name: '', email: '' },
  customerService: { hours: '평일 10:00–17:00', email: '' },
  social: { instagram: '' },
  shippingPolicy: '…', returnPolicy: '…',  // PDP 아코디언·/shipping
} as const;

// src/config/env.ts
export const env = { supabaseUrl: string, supabaseAnonKey: string, basePath: string, siteUrl: string }; // zod로 import.meta.env 검증, 누락 시 throw

// src/lib/supabase.ts
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

// src/lib/images.ts
export function imageUrl(storagePath: string | null, size: 'm' | 'l' = 'l'): string; // `${supabaseUrl}/storage/v1/object/public/${path}`, size 'm'이면 `.webp`→`_m.webp`; null이면 투명 placeholder data URL이 아니라 '' 반환 + 컴포넌트가 bg-surface 박스 표시
export function storageKey(bucket: 'products'|'banners', ownerId: string, size: 'm'|'l'): string; // `${ownerId}/${crypto.randomUUID()}${size==='m'?'_m':''}.webp`

// src/lib/format.ts
export const formatKRW = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export const formatDate = (iso: string) => 'YYYY.MM.DD'; export const formatDateTime = (iso) => 'YYYY.MM.DD HH:mm' (Asia/Seoul)

// src/features/auth/session.tsx
export function SessionProvider({children}); export function useSession(): { session: Session | null; user: User | null; isAdmin: boolean; loading: boolean };
// src/app/guards.ts (react-router loaders)
export async function requireAuth({ request }): Promise<Session>   // 없으면 redirect(`/login?next=${pathname}`)
export async function requireAdmin(): Promise<void>                 // rpc('is_admin') false면 redirect('/')

// src/features/cart/store.ts (zustand persist key 'da.cart.v1')
export type CartLine = { variantId: string; productId: string; slug: string; name: string; color: string; size: string; unitPrice: number; imagePath: string | null; quantity: number; stock: number };
export type CartState = { lines: CartLine[]; isOpen: boolean;
  add(line: Omit<CartLine,'quantity'>, qty?: number): void;  // 같은 variantId면 합산, min(10, stock) 캡
  setQty(variantId: string, qty: number): void; remove(variantId: string): void; clear(): void; open(): void; close(): void };
export const selectSubtotal = (s: CartState) => number; export const selectCount = (s) => number;

// src/features/checkout/api.ts
export type CreateOrderInput = { items: { variant_id: string; quantity: number }[]; address: { recipient; phone; postal_code; address1; address2 }; memo: string; depositor_name: string };
export type CreateOrderResult = { order_id: string; order_no: string; total: number; payment_due_at: string; bank: { bank_name; bank_account; bank_holder } };
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult>; // supabase.rpc('create_order', {p_items, p_address, p_memo, p_depositor_name})

// src/types/domain.ts
export type OrderStatus = Database['public']['Enums']['order_status'];
export const ORDER_STATUS_LABEL: Record<OrderStatus, string>;
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]>; // 6.5 표
export const CARRIERS = [{ code: 'cj', name: 'CJ대한통운', trackUrl: (no) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${no}` }, { code: 'lotte', … }, { code: 'hanjin', … }, { code: 'post', … }, { code: 'logen', … }];

// react-query 키 (src/lib/queryKeys.ts)
qk.categories, qk.products(filters), qk.product(slug), qk.homeSections, qk.settings, qk.wishlist(userId), qk.orders(userId), qk.order(id), qk.addresses(userId),
qk.admin.products(filters), qk.admin.product(id), qk.admin.orders(filters), qk.admin.order(id), qk.admin.customers(q), qk.admin.sections, qk.admin.stats, qk.admin.audit
```

주요 zod 스키마(`features/*/schemas.ts`):
- `signupSchema`: email, password(`min(8)`, `/[A-Za-z]/`, `/[0-9]/`), passwordConfirm(일치), name(1–40), phone(하이픈 제거 후 `^01[0-9]{8,9}$`, optional), `termsAgreed: z.literal(true)`, `privacyAgreed: z.literal(true)`, `marketingAgreed: z.boolean()`.
- `addressSchema`: recipient(1–40), phone, postalCode(`^\d{5}$`), address1(1–120), address2(0–120), label(0–20), isDefault.
- `checkoutSchema`: `{ addressId?: uuid } | newAddress`, memo(≤200), depositorName(1–20, 기본값 이름), `agree: z.literal(true)`(구매조건 확인 1개 체크만).
- 어드민 `productSchema`, `variantRowSchema`, `categorySchema`, `sectionSchema(kind별 discriminatedUnion)`, `settingsSchema`(계좌번호 `^[0-9-]{6,30}$`).

회원가입 호출: `supabase.auth.signUp({ email, password, options: { data: { name, phone, terms_agreed: true, privacy_agreed: true, marketing_agreed }, emailRedirectTo: `${env.siteUrl}${env.basePath}auth/confirmed` } })`. 비밀번호 재설정: `resetPasswordForEmail(email, { redirectTo: `${siteUrl}${basePath}auth/reset` })` → `/auth/reset`에서 `onAuthStateChange` `PASSWORD_RECOVERY` 수신 후 `updateUser({ password })`.

---

## ⑧ 보안 체크리스트 (SECURITY.md에 그대로 수록, S9에서 항목별 확인)

1. **비밀키 없음**: 클라이언트 번들엔 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`(publishable)만. `service_role`·DB 비밀번호는 어떤 파일에도 없음. `.env*`는 `.gitignore`, `.env.example`만 커밋. 확인: `grep -r "service_role\|eyJ" dist/` 결과 anon 키만.
2. **RLS 전 테이블** `enable + force`. 확인: pgTAP `tests/01,02`에서 anon/타 사용자 접근 0행. `supabase db lint`(advisor) 경고 0.
3. **가격·재고 조작 방지**: 클라이언트는 `variant_id, quantity`만 전송, 금액 서버 계산(`create_order`). orders/order_items insert 정책 없음. 확인: pgTAP `03`.
4. **IDOR**: 주문/주소/위시 조회는 `auth.uid()` 정책; 라우트 `/orders/:id/complete`·`/account/orders/:id`는 본인 아니면 0행 → 404 처리. 어드민 함수는 전부 내부 `is_admin()` 재검사(UI 가드 신뢰 안 함).
5. **권한 상승 차단**: `admins` 쓰기 정책 없음; `profiles` 업데이트 컬럼 grant 3개; `orders` 컬럼 grant 3개; 상태 전이는 함수만. 어드민 지정은 SQL(문서).
6. **XSS**: React 기본 이스케이프. `dangerouslySetInnerHTML` 사용 금지(eslint `react/no-danger` error). 상품 설명은 plain text + 줄바꿈만(`whitespace-pre-line`). 외부 링크 `rel="noopener noreferrer"`.
7. **CSP(meta, Pages는 헤더 불가)** `index.html`:
   `default-src 'self'; script-src 'self' https://t1.daumcdn.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co http://127.0.0.1:54321 https://images.unsplash.com; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321; frame-src https://postcode.map.daum.net; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`.
   로컬 호스트는 `vite.config.ts`의 `transformIndexHtml`로 dev에서만 삽입. `frame-ancestors`는 meta 미지원(문서에 명시). `unsafe-inline` style은 Tailwind 런타임 없음이라 제거 가능하면 제거(워커가 빌드 후 콘솔 CSP 위반 0건 확인).
8. **인증 설정**: 비밀번호 8자+영문+숫자(서버 `password_requirements`, 클라 zod 동일), 이메일 인증 필수, 비밀번호 변경 시 재인증(`secure_password_change`), refresh token rotation, rate limit 6.10 값. 호스팅: Dashboard에서 "Leaked password protection(HIBP)" ON, 커스텀 SMTP 등록(문서).
9. **어드민 라우트**: `requireAdmin` loader + lazy chunk(스토어 번들에 어드민 코드 미포함) — 그러나 방어는 RLS/함수. 어드민 계정 MFA(TOTP)는 ⑩ 열린 결정.
10. **업로드**: 버킷 `allowed_mime_types`·`file_size_limit` + 경로 정규식 with check + 어드민만 쓰기. 클라이언트는 `file.type` 화이트리스트, 10MB 초과 거부, canvas 재인코딩(webp)으로 메타데이터·악성 페이로드 제거.
11. **세션/리다이렉트**: PKCE, `additional_redirect_urls`에 Pages URL 정확히 등록(와일드카드 최소). `next` 파라미터는 같은 origin 상대 경로만 허용(`/`로 시작, `//` 금지).
12. **감사 로그**: 상품·주문·설정·섹션 변경, 계정 삭제 기록. 어드민 설정 페이지에서 열람.
13. **개인정보**: 탈퇴 시 프로필·주소·위시 삭제, 주문 스냅샷은 법정 보존(개인정보처리방침에 명시). 로그·에러 토스트에 이메일/전화 미출력.
14. **의존성**: `npm audit --omit=dev` high 0, `npm outdated` 기록, lockfile 커밋, GitHub Dependabot 설정 파일(`.github/dependabot.yml`, 주 1회).
15. **헤더 대체**: Pages가 못 주는 `X-Frame-Options` 등은 문서에 한계 명시; 커스텀 도메인+Cloudflare 전환 시 헤더 추가 가이드(DEPLOY.md).

---

## ⑨ 인계 문서 목차 & Pages 워크플로

**README.md**: 프로젝트 소개 1문단 · 요구 도구(node 22, supabase CLI 3, colima/docker) · 로컬 실행 5줄(`npm ci` → `supabase start` → `cp .env.example .env.local`(start 출력의 URL/anon 키) → `npm run dev` → 시드 계정) · 스크립트 표(`dev build preview typecheck lint test test:db e2e gen:types`) · 문서 링크.

**docs/HANDOVER.md**: 구조 설명(디렉터리·데이터 흐름·주문 상태 전이표) · 디자인 토큰 수정법 · 사업자 정보 채우기(`src/config/business.ts`, `src/content/*`) · 로고 교체 · 폰트 라이선스 · 시드 이미지 출처·교체.

**docs/SUPABASE_SETUP.md**: 클라우드 프로젝트 생성 → `supabase link` → `supabase db push` → 확장(pg_cron) 활성 → Auth 설정(Site URL, Redirect URLs, 이메일 템플릿, SMTP, 비밀번호 정책, HIBP) → Storage 버킷 확인 → **첫 관리자 지정 SQL**(`insert into public.admins(user_id) select id from auth.users where email = '…';`) → `site_settings` 계좌 입력(어드민 UI) → 타입 재생성 `supabase gen types typescript --linked > src/types/database.ts`.

**docs/DEPLOY.md**: GitHub Pages 절차(보류 상태 명시): 저장소 Settings → Pages → Source "GitHub Actions"; Variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE_PATH`(`/<repo>/` 또는 커스텀 도메인 `/`), `VITE_SITE_URL`; 워크플로 수동 실행(`workflow_dispatch`); Supabase Redirect URL 등록; 커스텀 도메인·HTTPS; 한계(헤더 불가, 404 상태코드).

**docs/OPERATIONS.md**: 일일 운영(입금 확인 → 준비중 → 송장 → 배송완료), 취소/환불 절차(계좌 환불은 수동 이체 후 "환불 완료"), 재고·품절, 홈 섹션 교체, 만료 주문 정리, 회원 문의 대응, 백업(`supabase db dump`).

**docs/SECURITY.md**: ⑧ 그대로 + 사고 대응(키 유출 시 anon 키 회전·RLS 재점검).

**.github/workflows/pages.yml** 개요:
```yaml
name: Deploy to GitHub Pages
on: { workflow_dispatch: {} }          # 보류: push 트리거 없음
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build: ubuntu-latest → actions/checkout@v5 → actions/setup-node@v5 (node 22, cache npm) → npm ci → npm run typecheck && npm run lint && npm test
         → npm run build (env: VITE_* from vars) → cp dist/index.html dist/404.html → actions/upload-pages-artifact@v4 (path dist)
  deploy: needs build, environment github-pages → actions/deploy-pages@v4
```
(액션 메이저 버전은 S8 워커가 marketplace에서 당일 최신 확인 후 고정.)

---

## ⑩ 예외·엣지

- 동시 주문으로 재고 경합: `for update` + `stock >= qty` 조건 update. 실패 시 전체 롤백(함수 단일 트랜잭션).
- 장바구니에 담은 뒤 가격/재고 변경: 체크아웃 진입 시 `product_variants` 재조회로 라인 갱신(가격 바뀌면 라인에 "가격이 변경되었습니다" 1줄, 품절이면 라인 `danger` + 주문 버튼 disabled).
- 주문 완료 페이지 새로고침/재방문: `/orders/:id/complete`는 DB에서 읽음(스냅샷 계좌·기한 표시). 장바구니 clear는 RPC 성공 직후.
- 입금 기한 만료 직전 관리자가 입금 확인: `admin_update_order_status`가 `pending_payment` 상태만 확인하므로 만료 cron과 경합 시 먼저 커밋된 쪽이 이기고 다른 쪽은 `INVALID_TRANSITION`. 어드민 UI는 에러 토스트 후 재조회.
- 탈퇴 사용자의 주문: 어드민 주문 상세에 "탈퇴 회원" 표기(`user_id null`), 고객 정보는 스냅샷 사용.
- 상품 archived/draft 전환 시 장바구니·위시에 남은 항목: 카탈로그 조회 0행 → 위시 페이지는 join 결과 없는 항목 숨김, 체크아웃은 `ITEM_UNAVAILABLE`.
- 이미지 없는 상품: 카드·PDP에 `bg-surface` 박스(텍스트 없음).
- 카테고리 삭제: 하위·상품은 `set null` → "미분류"는 `/shop` 전체에만 노출. 어드민 삭제 확인 다이얼로그에 영향 건수 표시.
- 세션 만료 중 체크아웃 제출: RPC `AUTH_REQUIRED` → 로그인으로 `next=/checkout`.
- 비밀번호 재설정 링크 만료: `/auth/reset`에서 `PASSWORD_RECOVERY` 이벤트 없이 3초 경과 시 "링크가 만료되었습니다" + 재요청 링크.
- 이메일 미인증 로그인 시도: Supabase 에러 `email_not_confirmed` → "이메일 인증 후 로그인할 수 있습니다" + 재전송 버튼(`auth.resend`).
- 모바일 Safari 100vh: 드로어 `h-dvh`.
- 접근성: 드로어/다이얼로그 포커스 트랩·ESC·`aria-modal`, 메가메뉴 키보드 열기, 이미지 alt는 `product_images.alt`(비면 상품명), 색/아이콘 단독 상태 전달 금지(품절은 텍스트).

---

## ⑪ 검증 (명령과 통과 기준)

`package.json` scripts (S1 고정):
```
dev: vite | build: tsc -b && vite build | preview: vite preview | typecheck: tsc -b --noEmit
lint: eslint . | format: prettier --check . | test: vitest run | test:db: supabase test db | e2e: playwright test
gen:types: supabase gen types typescript --local > src/types/database.ts
```

| 검사 | 통과 기준 |
|---|---|
| `npm run typecheck && npm run lint && npm run format` | 오류 0 |
| `npm test` | 전부 통과 (cart store, format, schemas, ORDER_TRANSITIONS, rpcErrors, Button/Input 렌더) |
| `supabase start && supabase db reset` | 마이그레이션·시드 오류 0, 스토리지 시드 업로드 확인 |
| `npm run test:db` | pgTAP 전부 통과 |
| `supabase db lint` | ERROR 0 |
| `npm run build && npm run preview` | 빌드 성공, 콘솔 CSP 위반 0, 어드민 청크 분리(`dist/assets/admin-*.js`) |
| `npm run e2e` (로컬 Supabase 대상) | `shop.spec`: 로그인 → 카테고리 → PDP 사이즈 선택 → 드로어 → 체크아웃(주소 입력) → 주문 완료(계좌·기한 표시) → 마이페이지 "입금 대기". `admin.spec`: 관리자 로그인 → 주문 상세 "입금 확인" → 고객 주문 "입금 확인" 표시; 상품 생성(이미지 1장 업로드) → 스토어 노출 |
| 화면 확인(워커 수동, Playwright 스크린샷 `e2e/__screenshots__`) | 390×844(모바일)·1440×900(데스크톱)에서 홈/카테고리/PDP/드로어/체크아웃/주문완료/어드민 주문상세. 가로 넘침 없음, 포커스 링 보임, 서브타이틀·안내문 없음 |

---

## ⑫ 작업 조각 (슬라이스)

동시 실행 ≤3. 각 조각은 "맡은 파일" 밖을 건드리지 않는다. 검증은 조각 끝에 1회.

### 실행 순서
```
Wave 1: S1 (스캐폴드+토큰+UI) ‖ S2 (Supabase 스키마)
Wave 2: S3 (인증+계정) ‖ S4 (카탈로그)
Wave 3: S5 (장바구니+체크아웃+주문내역) ‖ S6 (어드민 셸+상품+카테고리)
Wave 4: S7 (어드민 주문/회원/홈/설정) ‖ S8 (법무 콘텐츠+문서+CI)
Wave 5: S9 (E2E+최종 점검)
```

### S1 스캐폴드 · 디자인 토큰 · UI 키트 · 레이아웃 셸
- **맡은 파일**: 루트 설정 전부(package.json, vite.config.ts, tsconfig*, eslint/prettier, index.html, .env.example, .nvmrc, .gitignore, AGENTS.md), `public/`, `scripts/make-favicons.mjs`, `src/main.tsx`, `src/app/*`(router는 라우트 껍데기 + NotFound만), `src/config/*`, `src/styles/*`, `src/assets/logo.svg`(brand/logo.svg 복사), `src/lib/{supabase,queryClient,format,images,rpcErrors,queryKeys}.ts`, `src/types/domain.ts`(enum 문자열 리터럴로 선작성; S2 생성 타입과 S3에서 연결), `src/components/ui/*`, `src/components/layout/*`(Header/Footer/MobileMenu/StoreLayout — 메뉴 데이터는 props로 받는 정적 셸, MegaMenu는 S4), `src/features/cart/store.ts`(계약 그대로; 드로어 UI는 S5), vitest 설정 + `src/**/*.test.ts` (format, cart store, Button).
- **건드리지 않는 것**: `supabase/`, `src/features/*`(cart/store.ts 제외), `src/admin/`.
- **계약**: ③ 토큰·컴포넌트 props, ⑦ env/supabase/images/format/cart store 시그니처. `src/types/database.ts`는 S2 결과물을 import하므로 S1에서는 `Database` 타입을 `src/types/database.ts`에 **임시 빈 선언**으로 두지 말고, `supabase.ts`가 `Database`를 import하되 파일은 S2가 생성 → S1 검증은 `tsc`에서 해당 import만 `// @ts-expect-error`가 아닌 **`src/types/database.ts` 빈 `export type Database = any` 스텁** 생성으로 통과시키고, 스텁임을 파일 머리 주석에 표기. S2가 덮어씀.
- 파비콘: `scripts/make-favicons.mjs`가 sharp로 `brand/logo-source.png`의 큰 "8"(원본 1704×923 기준 약 x 1180–1505, y 60–495; 워커가 결과 PNG를 열어 확인 후 좌표 조정) 크롭 → 배경 `#0A0A0A` 유지한 512/180/32 PNG + ico. 코드로 그리지 않음.
- **검증**: `npm run typecheck && npm run lint && npm test && npm run build`; `npm run dev`로 헤더·푸터·404 페이지 390/1440 폭 렌더 확인, 폰트 2종 로드, CSP 위반 0.

### S2 Supabase 스키마 · RLS · 함수 · 시드 · pgTAP
- **맡은 파일**: `supabase/**`(config.toml, migrations, seed.sql, templates, seed-assets, tests), `scripts/fetch-seed-images.mjs`, `scripts/seed-images.json`, `src/types/database.ts`(gen:types 산출물 커밋).
- **건드리지 않는 것**: `src/` 나머지.
- **계약**: ⑥ 전체(테이블·함수 시그니처·오류 코드·전이표·버킷 경로 규칙). `supabase/tests`는 pgTAP(`begin; select plan(n); … select * from finish(); rollback;`), 역할 전환은 `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'`.
- **검증**: `supabase start && supabase db reset` 오류 0; `supabase test db` 전부 통과(최소: anon이 draft 상품 0행, 타 사용자 주문 0행, create_order 재고 차감·무료배송 계산·OUT_OF_STOCK·ITEM_UNAVAILABLE, cancel_my_order 재고 복구, expire_unpaid_orders 만료 처리, 비관리자 admin 함수 FORBIDDEN, profiles email 컬럼 update 거부, 약관 미동의 가입 실패, delete_my_account 진행주문 거부/성공 시 orders.user_id null); `supabase db lint` ERROR 0; Studio(54323)에서 버킷에 시드 이미지 존재.

### S3 인증 · 세션 · 마이페이지(주문 제외)
- **맡은 파일**: `src/features/auth/**`, `src/features/account/**`(OrdersPage/OrderDetailPage는 **S5**가 작성하므로 제외; AccountLayout 탭에 링크만), `src/app/guards.ts`, `src/app/router.tsx`의 auth/account 라우트 추가, `src/lib/daumPostcode.ts`, `src/components/layout/Header.tsx`의 계정 아이콘 동작(로그인 여부에 따라 `/login`·`/account`).
- **의존**: S1, S2.
- **계약**: ⑦ `useSession`, `requireAuth`, `requireAdmin`, zod 스키마. 주소 폼 컴포넌트 `features/checkout/components/AddressForm.tsx`는 S5와 공유 → **S3가 `src/features/account/components/AddressForm.tsx`에 작성**하고 S5가 import (props: `{ defaultValues?, onSubmit(values: AddressInput), submitLabel }`).
- **검증**: 로컬 Supabase에서 가입(약관 체크 없이 제출 불가, Mailpit http://localhost:54324 에서 인증 메일 링크 클릭 → `/auth/confirmed`) → 로그인 → 회원정보 수정 → 주소 2개 추가·기본 변경·삭제 → 비밀번호 재설정 메일 → 탈퇴(시드 customer는 주문 없음) 성공 후 로그인 불가. `npm run typecheck && npm run lint && npm test` 통과(schemas 테스트 추가).

### S4 카탈로그 (홈·카테고리·PDP·검색·룩북·위시)
- **맡은 파일**: `src/features/catalog/**`, `src/components/layout/{MegaMenu,SearchOverlay}.tsx` + Header에 메뉴 데이터 연결(categories 쿼리), `src/features/account/pages/WishlistPage.tsx`, 라우터 카탈로그 라우트.
- **의존**: S1, S2. (S3와 병렬; 위시 토글은 `useSession()` 계약만 사용—S3가 늦으면 S1 셸의 `SessionProvider` 자리에 임시 없음 → **S4는 `useSession`을 import하되 S3 완료 전 검증은 로그아웃 상태 경로만**.)
- **계약**: ProductCard props `{ product: ProductCardData, onQuickAdd?(variantId) }`, `ProductCardData = { id, slug, name, price, compareAtPrice, images: {path, color, sort}[], variants: {id, color, size, stock, isActive, priceDelta}[] }`. 담기는 `useCart().add(...)` 사용. 필터는 URL search params(`?size=M&color=Black&sort=price_asc`).
- **검증**: 시드 데이터로 홈 섹션 4종 렌더, 카테고리 필터·정렬·더 보기, PDP 색상/사이즈 선택·품절 표시·담기(토스트), 검색 결과/없음, 룩북, 위시 토글(로그인 시). 390/1440 스크린샷, hover 2번째 이미지 전환 확인. typecheck/lint/test.

### S5 장바구니 드로어 · 체크아웃(무통장) · 주문완료 · 내 주문
- **맡은 파일**: `src/features/cart/components/**`, `src/features/checkout/**`, `src/features/account/pages/{OrdersPage,OrderDetailPage}.tsx`, Header 장바구니 아이콘→드로어 연결, 라우터 해당 라우트.
- **의존**: S3(세션·AddressForm), S4(카드 담기).
- **계약**: ⑦ `createOrder`, `rpcErrors`. 체크아웃 진입 시 variants 재조회로 라인 보정(⑩). 주문완료 화면: 주문번호, 입금 계좌(은행·계좌·예금주 복사 버튼), 입금 금액, 기한(`YYYY.MM.DD HH:mm까지`), 입금자명, 배송지, 품목. 내 주문 상세: 상태 타임라인(order_events), 송장(택배사 추적 링크), 취소 버튼(pending) / 취소 요청 버튼(paid·preparing, 사유 입력).
- **검증**: 담기 → 드로어 수량/삭제 → 체크아웃(주소록 선택/새 주소, 입금자명, 동의) → 주문 완료 → 마이페이지 주문 목록·상세 → 취소(재고 복구는 Studio에서 확인). 품절 variant를 시드로 만들어 `OUT_OF_STOCK` 메시지 확인. 비로그인 `/checkout` → 로그인 리다이렉트 후 복귀. 스크린샷 390/1440. 단위 테스트: 체크아웃 스키마, 배송비 계산 표시 로직.

### S6 어드민 셸 · 대시보드 뼈대 · 상품 · 카테고리
- **맡은 파일**: `src/admin/AdminLayout.tsx`, `src/admin/api.ts`(상품·카테고리·이미지 부분), `src/admin/schemas.ts`, `src/admin/components/{DataTable,ImageUploader,VariantGrid,StatusBadge}.tsx`, `src/admin/pages/{DashboardPage(통계 호출만),ProductsPage,ProductEditPage,CategoriesPage}.tsx`, `src/lib/imageResize.ts`, 라우터 `/admin` lazy 라우트.
- **의존**: S2, S3(`requireAdmin`). S5와 병렬.
- **계약**: `ImageUploader` props `{ bucket: 'products'|'banners', ownerId: string, value: {id?, storagePath, alt, color?, sort}[], onChange }` — 업로드 시 `imageResize(file, 2000)`·`(file, 800)` 두 벌을 `storageKey()` 규칙으로 올림, 삭제 시 두 객체 모두 `remove`. S7의 홈 섹션 편집도 이 컴포넌트를 쓴다. 상품 저장은 `products` upsert → `product_variants` upsert/delete → `product_images` upsert → `reorder_product_images` 순, 실패 시 토스트(부분 저장 가능성 문서화; 단일 트랜잭션 RPC는 범위 밖).
- **검증**: 관리자 로그인 → `/admin` 진입(비관리자는 `/`로), 카테고리 추가/정렬, 상품 생성(이미지 2장 업로드·정렬·색상 태그, 색상×사이즈 variant 6행, 재고), 상태 active → 스토어 노출 확인, archived → 미노출. 업로드 MIME 거부(pdf) 확인. typecheck/lint.

### S7 어드민 주문 · 회원 · 홈 섹션 · 설정 · 대시보드 완성
- **맡은 파일**: `src/admin/pages/{OrdersPage,OrderDetailPage,CustomersPage,HomeSectionsPage,SettingsPage,DashboardPage}.tsx`, `src/admin/components/OrderTimeline.tsx`, `src/admin/api.ts`(주문·회원·섹션·설정·감사 부분 추가).
- **의존**: S5(주문 데이터 존재), S6(셸·업로더).
- **계약**: 상태 변경은 `admin_update_order_status`·`admin_set_tracking`만 호출; 버튼 노출은 `ORDER_TRANSITIONS`. 설정 저장은 `site_settings` update(id=1). 대시보드 "만료 주문 정리" → `expire_unpaid_orders` 결과 건수 토스트.
- **검증**: 주문 탭 필터·검색, 상세에서 입금 확인 → 준비중 → 송장(택배사·번호) → 배송완료; 다른 주문 취소(메모 필수) → 환불 완료; 잘못된 전이 버튼 미노출. 회원 목록·검색. 홈 섹션 4종 생성·정렬·활성 토글 → 홈 반영. 설정에서 계좌 변경 → 새 주문 완료 화면에 반영, 기존 주문은 스냅샷 유지. 감사 로그 표에 위 변경 기록. 스크린샷 1440 + 390(주문 상세).

### S8 법무·콘텐츠 · 인계 문서 · CI 워크플로 · 의존성 점검
- **맡은 파일**: `src/content/**`, `src/features/content/**`, 라우터 콘텐츠 라우트, Footer 링크 연결, `README.md`, `docs/**`, `.github/workflows/pages.yml`, `.github/dependabot.yml`, `.env.example` 최종, `supabase/templates/*.html` 문구 검수.
- **의존**: S7과 병렬 가능(문서는 ⑥⑦⑧ 계약 기준으로 작성, S7 완료 후 스크린샷·절차 최종 확인 1회).
- **내용**: 이용약관(전자상거래 표준약관 구조: 목적·정의·약관 효력·서비스·구매신청·결제(무통장입금·입금기한·자동취소)·배송·청약철회(7일)·환불·개인정보·분쟁)·개인정보처리방침(수집항목: 이메일·이름·전화·주소, 보유기간: 탈퇴 시 파기 단 거래기록 5년, 처리위탁: Supabase(해외 이전 명시), 책임자)·FAQ(배송/교환반품/입금/회원)·배송안내. 모든 가변값은 `business.ts` 치환, 빈 값이면 `[사업자 정보 입력 필요]`로 눈에 띄게.
- **검증**: `npm audit --omit=dev` high 0(있으면 업그레이드 후 재검), `npm run build` 성공, 문서 내 명령을 새 셸에서 순서대로 실행해 재현(README 로컬 실행 5줄). 워크플로 YAML은 `actionlint`(npx) 통과(실행은 하지 않음).

### S9 E2E · 최종 점검
- **맡은 파일**: `e2e/**`, `playwright.config.ts`, 발견한 결함의 최소 수정(어느 파일이든, 단 계약 변경 금지), `docs/HANDOVER.md`의 "알려진 제한" 절.
- **의존**: 전부.
- **검증**: ⑪ 표 전부 실행. 접근성 스모크(`@axe-core/playwright`로 홈/PDP/체크아웃/어드민 주문 critical 0). 모바일/데스크톱 스크린샷 비교로 ③ 규칙 위반(라운드, 그림자, 설명문) 탐지 후 수정. `git status` 깨끗, 스캐폴드 잔재(스텁 주석, 샘플 코드) 제거.

---

## ⑬ 사용자에게 물어야 할 결정 (기본값으로 진행)

1. **비회원 주문** — 기본: 없음(회원 전용). 허용하려면 `orders.user_id null + guest_email + 조회용 토큰` 추가 설계 필요.
2. **브랜드 텍스트 표기** — 기본: `DTIVE & ASTIGER`. 대안 `DTIVE8ASTIGER`(로고 그대로).
3. **TypeScript 7.0(네이티브) vs 5.9** — 기본: 5.9.3 고정(인계 안정성). 7.0은 인계자가 올릴 수 있게 문서에 메모.
4. **어드민 계정 TOTP MFA** — 기본: 미구현(문서에 권장 절차). 구현 시 S3에 `/account/security` + `requireAdmin`에 `aal2` 검사 추가(+1 슬라이스 분량).
5. **주문 확인 이메일 발송** — 기본: 없음(마이페이지·어드민에서 확인). 필요 시 Resend 등 + Edge Function이 추가되며 서버 비밀키 관리가 생김.
6. **상품 검색 범위** — 기본: 이름·설명 ilike(pg_trgm). 초성/형태소 검색은 범위 밖.
7. **시드 이미지** — 기본: Unsplash 실제 사진(출처 기록), 운영 전 실제 상품 사진으로 교체 전제.
