# 인계 문서

DTIVE & ASTIGER 쇼핑몰을 넘겨받은 사람이 혼자 운영·수정할 수 있도록 정리한 문서입니다. 로컬 실행은 [README](../README.md), 관리자 화면 사용법은 [ADMIN-GUIDE](ADMIN-GUIDE.md), 배포는 [DEPLOY](DEPLOY.md), 보안은 [SECURITY](SECURITY.md)를 보세요.

## 1. 구조

### 한눈에

- **화면**: Vite + React 19 + TypeScript + Tailwind CSS 4로 만든 정적 사이트(SPA). 빌드하면 `dist/`에 HTML·JS·CSS만 남고, 어디든 정적 호스팅에 올릴 수 있습니다(예정: GitHub Pages).
- **서버**: 별도 서버 없음. Supabase가 회원 인증(Auth), 데이터베이스(Postgres), 이미지 저장(Storage)을 맡습니다. 가격 계산·재고 차감·주문 상태 변경 같은 중요한 처리는 전부 데이터베이스 함수(`security definer`) 안에서 일어나고, 화면은 그 함수를 호출만 합니다.
- **권한**: 모든 테이블에 행 단위 보안(RLS)이 걸려 있어 고객은 자기 데이터만, 관리자(`public.admins`에 등록된 계정)만 전체 데이터를 봅니다. 화면의 관리자 확인은 편의일 뿐 실제 방어는 데이터베이스입니다.
- **결제**: 무통장입금만. PG(카드 결제) 연동, 결제 웹훅, Edge Function은 없습니다.

### 디렉터리

```
src/
  app/            라우터(router.tsx), 로그인·관리자 가드(guards.ts), 404
  config/         business.ts(사업자 정보) · env.ts(환경 변수 검증) · site.ts(메뉴·페이지 제목)
  content/        이용약관·개인정보처리방침·FAQ·배송 안내 문구
  styles/         tokens.css(색·글꼴·크기의 유일한 출처) · base.css
  components/ui/  버튼·입력·다이얼로그 등 공용 UI
  components/layout/  헤더·푸터·메가메뉴·모바일 메뉴
  features/       catalog(홈·카테고리·상품·검색·룩북) · cart · checkout · account · auth · content
  admin/          관리자 페이지 (별도 청크로 분리, 스토어 번들에 안 들어감)
  lib/            supabase 클라이언트, 금액·날짜 형식, 이미지 경로, 오류 메시지 변환
  types/database.ts  DB에서 생성한 타입 (직접 수정 금지, `npm run gen:types`)
supabase/
  migrations/     0001~0007: 확장, enum, 테이블, 함수, RLS, 스토리지, 트리거·cron
  seed.sql        로컬 전용 시드(계정 2개, 상품 16개, 홈 섹션). 운영 DB에 넣지 않음
  seed-assets/    로컬 시드 이미지 + CREDITS.md(사진 출처)
  templates/      가입 인증·비밀번호 재설정·이메일 변경 메일 HTML
  tests/          pgTAP 테스트 (`npm run test:db`)
scripts/          파비콘 생성, 시드 이미지 내려받기
brand/            로고 원본(logo-source.png)과 벡터(logo.svg)
.github/          Pages 배포 워크플로(수동 실행), Dependabot
```

### 주문 흐름

1. 고객이 장바구니에서 주문하면 `create_order` 함수가 가격·재고를 다시 계산하고, 재고를 차감하고, 그 시점의 입금 계좌를 주문에 복사해 둡니다(나중에 계좌를 바꿔도 기존 주문 안내는 그대로).
2. 주문 완료 화면과 마이페이지에 계좌·금액·입금 기한이 표시됩니다.
3. 관리자가 통장을 확인하고 "입금 확인"을 누릅니다.
4. 기한까지 입금이 없으면 10분마다 도는 `expire_unpaid_orders`(pg_cron)가 주문을 취소하고 재고를 되돌립니다. 관리자 대시보드의 "만료 주문 정리" 버튼도 같은 일을 합니다.

### 주문 상태 전이

| 현재 → 다음                      | 누가                              | 함께 일어나는 일          |
| -------------------------------- | --------------------------------- | ------------------------- |
| 입금 대기 → 입금 확인            | 관리자                            | 입금 시각 기록            |
| 입금 대기 → 취소                 | 고객 / 관리자 / 자동 만료         | 재고 복구                 |
| 입금 확인 → 상품 준비중          | 관리자                            |                           |
| 입금 확인·상품 준비중 → 배송중   | 관리자(송장 입력)                 | 택배사·송장번호 필수      |
| 배송중 → 배송 완료               | 관리자                            |                           |
| 입금 확인·상품 준비중 → 취소     | 관리자(메모 필수: 환불 계좌·금액) | 재고 복구                 |
| 취소(입금된 적 있음) → 환불 완료 | 관리자                            | 재고는 다시 복구하지 않음 |

이 표는 데이터베이스(`admin_update_order_status`)가 강제하고, 화면은 `src/types/domain.ts`의 `ORDER_TRANSITIONS`로 같은 표를 따라 버튼을 보여 줍니다. 고객은 입금 후 발송 전 주문에 "취소 요청"(사유 필수, 1회)만 할 수 있고, 관리자가 확인 후 취소합니다.

## 2. 운영 시작 체크리스트

순서대로 진행하세요. 체크가 끝나기 전에는 실제 주문을 받지 마세요.

### 2.1 사업자 정보 입력

`src/config/business.ts` 하나만 고치면 푸터·약관·개인정보처리방침·배송 안내에 모두 반영됩니다.

| 항목                                                                                                                     | 쓰이는 곳                                     |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `companyName` 상호, `ceo` 대표자, `bizNo` 사업자등록번호, `mailOrderNo` 통신판매업 신고번호, `address`, `phone`, `email` | 푸터(전자상거래법 표시 의무), 약관            |
| `privacyOfficer` 개인정보 보호책임자 이름·이메일                                                                         | 푸터, 개인정보처리방침                        |
| `customerService` 운영시간·문의 이메일 (비우면 `email` 사용)                                                             | 푸터 "1:1 문의", FAQ, 약관                    |
| `hostingProvider`                                                                                                        | 푸터, 개인정보처리방침(위탁·국외 이전)        |
| `dataRegion` Supabase 프로젝트 리전 (예: `대한민국(서울)`)                                                               | 개인정보처리방침(국외 이전)                   |
| `mailService` 인증 메일을 보내는 SMTP 업체·국가                                                                          | 개인정보처리방침(위탁·국외 이전)              |
| `courier` 계약 택배사, `returnAddress` 반품 주소                                                                         | 배송·교환·반품 안내, 개인정보처리방침         |
| `policyEffectiveDate` 약관·방침 시행일                                                                                   | 이용약관, 개인정보처리방침                    |
| `shippingPolicy`, `returnPolicy`                                                                                         | 상품 상세 "배송·교환·반품", 배송 안내 첫 문단 |

- 값이 비어 있으면 푸터에서는 그 항목이 숨겨지고, 약관·방침에서는 빨간 `[사업자 정보 입력 필요]`로 보입니다. **운영 전 전부 채워야 합니다.** 사업자등록번호를 넣으면 푸터에 공정거래위원회 "사업자정보확인" 링크가 자동으로 붙습니다.
- 배송비·무료배송 기준·입금 기한은 코드가 아니라 관리자 **설정** 화면 값이 약관·FAQ·배송 안내에 자동으로 들어갑니다.
- **이용약관(`src/content/terms.ts`)과 개인정보처리방침(`src/content/privacy.ts`)은 공정거래위원회 표준약관과 개인정보보호위원회 작성지침 구조를 따른 초안입니다. 운영 전에 반드시 법무 검토를 받으세요.** 특히 확인할 것: 청약철회 제한 범위, 현금영수증 발급(의류 소매는 현금영수증 의무발행업종일 수 있음 — 세무사 확인), 국외 이전 항목, 만 14세 미만 가입 제한 방식(지금은 가입 화면의 필수 체크 "만 14세 이상입니다"로 본인 확인만 받고, DB 트리거가 이 체크 없는 가입을 거부함 — 생년월일·본인인증은 하지 않음).
- 문구를 바꾸면 `npm test`(문구 생성 테스트)도 함께 돌리세요. 새 입력 항목을 추가하면 개인정보처리방침의 "처리하는 개인정보 항목"도 같이 고쳐야 합니다.

### 2.2 Supabase 클라우드 프로젝트

1. https://supabase.com 에서 조직·프로젝트 생성. 리전은 **Northeast Asia (Seoul)** 권장(국내 고객 응답 속도). DB 비밀번호는 비밀번호 관리자에 보관하고 저장소에 넣지 마세요. 실제 운영은 백업이 있는 유료 플랜을 권장합니다.
2. 로컬에서 연결하고 스키마 올리기:
   ```sh
   supabase login
   supabase link --project-ref <프로젝트 ref>      # Dashboard URL의 /project/<ref>
   supabase db push                                 # supabase/migrations 만 적용
   ```
   `db push`는 `seed.sql`을 올리지 않습니다. **`--include-seed`를 쓰지 마세요.** 시드에는 공개된 비밀번호의 관리자 계정과 예시 상품·계좌가 들어 있습니다.
3. **기본 설정 행**: 마이그레이션이 `site_settings` 기본 행을 만듭니다(배송비 3,000원, 무료배송 100,000원 이상, 입금 기한 48시간, **입금 계좌는 빈 값**). 계좌는 12단계에서 입력합니다.
4. **pg_cron**: Dashboard → Database → Extensions에서 `pg_cron`을 켠 다음, SQL Editor에서 실행합니다(마이그레이션은 pg_cron이 없으면 예약을 건너뜀).
   ```sql
   select cron.schedule('expire-unpaid-orders', '*/10 * * * *', $$select public.expire_unpaid_orders()$$);
   select jobname, schedule from cron.job;   -- expire-unpaid-orders 가 보이면 완료
   ```
   pg_cron을 켤 수 없어도 운영은 가능합니다. 대신 관리자 대시보드의 "만료 주문 정리"를 하루 몇 번 누르세요.
5. **Storage**: Dashboard → Storage에 `products`, `banners` 버킷(공개)이 있는지 확인합니다. 마이그레이션이 만들며, 비어 있는 게 정상입니다(시드 이미지는 로컬 전용).
6. **Authentication → URL Configuration**
   - Site URL: 실제 사이트 주소 (예: `https://dtive-astiger.com` 또는 `https://<계정>.github.io/<저장소>`)
   - Redirect URLs: `auth/confirmed`, `auth/reset`, `account/profile` 세 주소를 사이트 주소 기준으로 정확히 추가(와일드카드 최소화). 값 예시는 [DEPLOY](DEPLOY.md#5-supabase-인증-주소).
7. **Authentication → Sign In / Providers → Email**: Confirm email 켜기, Secure password change 켜기, 비밀번호 최소 8자 + 영문·숫자 필수(로컬 `supabase/config.toml`과 같게). Pro 플랜이면 Leaked password protection도 켜기. 봇 가입·메일 폭탄·비밀번호 대입을 막는 CAPTCHA(Cloudflare Turnstile)는 프론트 코드 작업이 먼저 필요합니다. 순서는 [SECURITY의 봇 방지 CAPTCHA](SECURITY.md#봇-방지-captcha-운영-전-권장)를 따르세요(코드 배포 전에 Dashboard에서 켜면 로그인·가입이 모두 막힘).
8. **SMTP (필수)**: Supabase 기본 메일 발송은 **프로젝트 팀원 주소로만 보내고 시간당 발송 수도 매우 적어서** 실제 고객은 가입 인증 메일을 받지 못합니다. Authentication → Emails → SMTP Settings에 외부 SMTP(Resend, Amazon SES, Postmark, 네이버 웍스 메일 등)를 등록하고, 보내는 주소는 사이트 도메인으로 하세요(도메인 SPF·DKIM 설정 포함). 등록 후 Authentication → Rate Limits에서 시간당 메일 한도를 필요에 맞게 올립니다. 사용한 업체는 `business.mailService`에 적습니다.
9. **메일 템플릿**: Authentication → Emails → Templates에서 세 개를 교체합니다. 본문은 `supabase/templates/*.html` 내용을 그대로 붙여 넣고, 제목은 아래와 같이 합니다. 링크는 `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=…` 형식이어야 하니 HTML을 고칠 때 이 부분은 건드리지 마세요.

   | 템플릿               | 파일                | 제목                                            |
   | -------------------- | ------------------- | ----------------------------------------------- |
   | Confirm signup       | `confirmation.html` | `[DTIVE & ASTIGER] 이메일 주소를 확인해 주세요` |
   | Reset password       | `recovery.html`     | `[DTIVE & ASTIGER] 비밀번호 재설정`             |
   | Change email address | `email_change.html` | `[DTIVE & ASTIGER] 이메일 변경 확인`            |

   `supabase config push`는 로컬 주소(127.0.0.1)가 든 `config.toml` 전체를 운영에 덮어쓰므로 쓰지 마세요.

10. **API 키**: Project Settings → API Keys의 **Publishable key**(또는 Legacy의 `anon` 키)와 Project URL만 사이트에 넣습니다. `secret`/`service_role` 키는 어디에도 넣지 마세요([SECURITY](SECURITY.md)).
11. **첫 관리자 지정**: 사이트에서 관리자로 쓸 계정을 일반 회원가입(이메일 인증까지)으로 만든 뒤 SQL Editor에서 실행합니다. 관리자 지정·해제는 화면에서 할 수 없고 SQL로만 합니다.
    ```sql
    insert into public.admins (user_id, note)
    select id, '대표' from auth.users where email = 'owner@your-domain.com';
    -- 해제: delete from public.admins where user_id = (select id from auth.users where email = '…');
    ```
    관리자 계정에는 긴 고유 비밀번호를 쓰고, 관리자 수는 최소로 유지하세요.
12. **입금 계좌 입력(필수)**: 관리자 로그인 → `/admin/settings`에서 은행·계좌번호·예금주를 입력하고 입금 기한·배송비·무료배송 기준을 확인해 저장. 계좌가 비어 있으면 모든 주문이 `BANK_NOT_CONFIGURED`("현재 주문을 받을 수 없습니다")로 막힙니다.
13. **타입 재생성**(스키마를 바꾼 경우만): `supabase gen types typescript --linked > src/types/database.ts`
14. 배포: [DEPLOY](DEPLOY.md).
15. 실제 주문 1건으로 끝까지 확인: 가입 메일 수신 → 주문 → 입금 확인 → 송장 → 배송 완료, 다른 주문 취소 → 환불 완료.

### 2.3 운영 전 마지막 점검

- 시드 데이터·`example.com` 계정이 운영 DB에 없는지 (`select email from auth.users;`)
- 상품 사진이 실제 상품 사진으로 교체되었는지 (시드 사진은 Unsplash 예시)
- 푸터에 사업자 정보가 모두 보이는지, 약관·방침에 빨간 `[사업자 정보 입력 필요]`가 없는지
- 법무 검토 반영 여부

## 3. 일상 운영

화면별 자세한 사용법은 [ADMIN-GUIDE](ADMIN-GUIDE.md)에 있습니다.

### 매일

1. **입금 확인**: 통장 내역과 관리자 → 주문 → "입금 대기" 탭을 대조(입금자명·금액). 맞으면 주문 상세에서 "입금 확인".
2. **발송**: "입금 확인" 주문을 포장하며 "상품 준비중"으로 바꾸고, 송장이 나오면 택배사·송장번호를 입력(→ 배송중). 고객 주문 상세에 조회 링크가 생깁니다. 택배사는 목록에서 고르세요(조회 링크가 택배사 코드로 만들어짐).
3. **배송 완료**: 택배 조회로 도착이 확인되면 "배송 완료".
4. **취소 요청**: 주문 목록의 "취소 요청" 표시를 확인. 발송 전이면 주문 상세에서 "주문 취소"(메모에 환불 계좌·금액, 고객 비공개), 은행 이체 후 "환불 완료".
5. **문의 메일**: `customerService.email`로 오는 교환·반품·배송지 변경·현금영수증 요청 처리.

### 교환·반품

화면에 반품 신청 기능은 없고 이메일로 받습니다. 상품이 도착하면 확인 후 3영업일 안에 환불 이체하고, 주문 상세 관리자 메모(고객 비공개)에 처리 내용을 남기세요. 이미 "배송 완료"인 주문은 상태를 바꿀 수 없으므로(전이표 참고) 반품 환불은 메모로 기록합니다. 재고는 상품 화면에서 직접 되돌립니다.

### 상품 등록

관리자 → 상품 → "상품 추가": 이름·카테고리·가격·설명·소재·세탁 입력 → 이미지 업로드(JPEG/PNG/WebP, 10MB 이하, 자동으로 2000px·800px WebP로 변환) → 색상×사이즈 옵션과 재고 → 상태 "판매중"으로 저장. 주문된 적 있는 상품은 삭제할 수 없고 "보관"으로 바꿉니다. 상품 저장은 여러 단계로 나뉘어 있어 중간에 네트워크가 끊기면 일부만 저장될 수 있으니, 오류가 나면 다시 열어 확인 후 저장하세요.

### 백업

- 유료 플랜은 Supabase가 매일 자동 백업합니다(Dashboard → Database → Backups). 무료 플랜은 직접 받아야 합니다.
- 직접 백업(월 1회 이상, 파일은 암호화된 곳에 보관 — 고객 개인정보 포함):
  ```sh
  supabase db dump --linked -f backup-schema.sql
  supabase db dump --linked --data-only -f backup-data.sql
  supabase db dump --linked --role-only -f backup-roles.sql
  ```
- 이미지(Storage)는 DB 백업에 들어가지 않습니다. Dashboard → Storage에서 내려받거나 S3 호환 접속으로 따로 보관하세요.

### 개인정보 보존·파기 (연 1회)

탈퇴 회원의 프로필·주소록·위시리스트는 즉시 삭제되고, 주문 기록은 전자상거래법에 따라 5년 보관됩니다. 5년이 지난 주문은 자동으로 지워지지 않으니 매년 SQL Editor에서 실행하세요(먼저 백업).

```sql
delete from public.orders where created_at < now() - interval '5 years';            -- 품목·이력 함께 삭제
delete from public.audit_logs where created_at < now() - interval '5 years';        -- 변경 기록(개인정보는 없음)
```

## 4. 고치는 법

- **색·글꼴·크기**: `src/styles/tokens.css`만 수정. 둥근 모서리·그림자·그라데이션은 일부러 없앴습니다([AGENTS.md](../AGENTS.md)).
- **메뉴**: 상단 메뉴는 활성 상태인 최상위 카테고리(최대 5개)와 룩북으로 자동 구성됩니다(관리자 → 카테고리). 푸터 링크는 `src/config/site.ts`.
- **로고**: `brand/logo.svg`를 바꾸고 `src/assets/logo.svg`에 복사(글자색은 CSS가 입힘). 파비콘은 `brand/logo-source.png`를 바꾼 뒤 `npm run favicons`.
- **약관·FAQ 문구**: `src/content/*.ts`. 화면 컴포넌트는 `src/features/content/`.
- **스키마 변경**: `supabase migration new <이름>`으로 새 파일을 만들고(기존 마이그레이션 수정 금지) 로컬에서 `supabase db reset`(로컬 DB 초기화) → `npm run test:db` → `npm run gen:types` → 운영은 `supabase db push`.
- **의존성**: Dependabot이 매주 PR을 엽니다(`.github/dependabot.yml`). 합치기 전에 커밋 전 검사 명령을 돌리세요. TypeScript는 인계 안정성 때문에 5.9로 고정했습니다(7.0은 새 네이티브 컴파일러라 별도 검토 후 올리기).

## 5. 라이선스·출처

| 항목                         | 라이선스                                                 | 출처                                                                  |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Pretendard (본문 글꼴)       | SIL Open Font License 1.1                                | https://github.com/orioncactus/pretendard/blob/main/LICENSE           |
| Bodoni Moda (제목 글꼴)      | SIL Open Font License 1.1                                | https://fonts.google.com/specimen/Bodoni+Moda/license                 |
| Lucide (아이콘)              | ISC                                                      | https://lucide.dev/license                                            |
| 시드 상품·배너 사진          | Unsplash License (상업적 사용 가능, 출처 표시 의무 없음) | [supabase/seed-assets/CREDITS.md](../supabase/seed-assets/CREDITS.md) |
| 카카오(다음) 우편번호 서비스 | 무료, 키 불필요                                          | https://postcode.map.kakao.com/guide                                  |
| 로고                         | 브랜드 소유                                              | `brand/`                                                              |

글꼴은 npm 패키지로 사이트에 함께 배포(self-host)되며 OFL은 상업적 사용과 웹 배포를 허용합니다. 시드 사진은 로컬 개발용 예시이므로 운영 전 실제 상품 사진으로 바꾸세요.

## 6. 알려진 제한

- **비회원 주문 없음**: 주문은 로그인한 회원만 할 수 있습니다(`/checkout`은 로그인 화면으로 보냄).
- **입금 확인은 수동**: 은행 API 연동이 없어 관리자가 통장을 보고 주문 상세에서 "입금 확인"을 누릅니다. 입금 기한이 지난 주문의 자동 취소는 pg_cron을 켠 경우에만 돕니다(2.2 참고).
- **주문 알림 메일 없음**: 사이트가 보내는 메일은 Supabase Auth의 가입 인증·비밀번호 재설정·이메일 변경뿐입니다. 주문 접수·입금 확인·발송 알림은 메일로 가지 않으므로 고객은 마이페이지에서, 관리자는 대시보드에서 확인합니다.
- **기본 SMTP로는 운영 불가**: Supabase 기본 메일은 팀원 주소로만, 시간당 소량만 보냅니다. 외부 SMTP 등록이 필수입니다(2.2의 8번).
- **관리자 MFA 없음**: 관리자도 이메일·비밀번호로만 로그인합니다(`supabase/config.toml`의 `[auth.mfa.totp]` 꺼짐). 관리자 비밀번호를 길고 고유하게 쓰고 관리자 수를 최소로 유지하세요.
- **상품 저장은 한 번에 묶이지 않음**: 상품 → 옵션 → 이미지 → 이미지 순서 정렬을 각각 따로 저장합니다. 중간에 실패하면 앞 단계까지만 저장되고, 편집 화면이 저장된 상태를 다시 불러옵니다. 오류 토스트가 뜨면 내용을 확인하고 다시 저장하세요.
- **이미지 변환 기능 미사용**: Supabase 이미지 변환(유료)을 쓰지 않고, 업로드할 때 브라우저가 2000px·800px WebP 두 벌로 줄여 올립니다. 원본 파일은 보관하지 않으니 원본은 따로 보관하세요.
- **시드 사진은 예시**: `supabase/seed-assets`의 Unsplash 사진은 로컬 개발용입니다. 운영 상품에는 실제 상품 사진을 올리세요.
- **주소 검색은 카카오 외부 서비스**: 카카오 우편번호 서비스가 안 열리면 주소를 입력할 수 없습니다(우편번호·기본 주소 칸은 검색 결과로만 채워짐).
- **검색은 단순 부분 일치**: 상품명·설명에 검색어가 그대로 들어 있는 상품만 찾습니다(오타·형태소 보정 없음).
- **현금영수증 자동 발급 없음**: FAQ 안내대로 고객 요청을 받아 홈택스 등에서 직접 발급합니다.
- **E2E 테스트는 로컬 전용**: `npm run e2e`는 `supabase start`로 띄운 로컬 DB에 `docker exec … psql`로 테스트 계정을 만들고 지웁니다. 운영 프로젝트를 대상으로 돌리지 마세요.
