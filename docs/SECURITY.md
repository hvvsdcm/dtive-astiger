# 보안

이 사이트는 서버 코드 없이 브라우저가 Supabase에 직접 접속합니다. 그래서 **브라우저에 있는 것은 전부 공개된 것**으로 보고, 실제 방어는 데이터베이스(RLS·함수·권한)에 둡니다.

## 절대 규칙

- **`service_role`/`secret` 키는 이 저장소, `VITE_*` 변수, GitHub 변수, 브라우저 어디에도 넣지 않습니다.** 이 키는 RLS를 무시하므로 노출되면 모든 회원·주문 정보가 열립니다. 이 프로젝트는 그 키가 필요한 기능이 없습니다(Edge Function 없음). DB 비밀번호도 마찬가지입니다.
- 사이트에 들어가는 키는 Project URL과 Publishable(또는 legacy `anon`) 키 둘뿐입니다. 이 키는 공개돼도 되도록 설계되어 있고, 권한은 RLS가 막습니다.
- `.env.local` 등 `.env*` 파일은 커밋하지 않습니다(`.env.example`만 예외).
- 관리자 지정은 SQL로만 합니다([HANDOVER 2.2](HANDOVER.md#22-supabase-클라우드-프로젝트) 11단계).

## 점검 목록

계획서(PLAN ⑧) 항목과 실제 구현 위치입니다. 변경 후·분기마다 확인하세요.

| #   | 항목                                                                                                                                                   | 구현 위치                                                                                                         | 확인 방법                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | 비밀키 없음: 번들에는 URL과 anon/publishable 키만                                                                                                      | `src/config/env.ts`(허용 변수 4개), `.gitignore`                                                                  | `npm run build` 후 `dist/`에서 `eyJ`로 시작하는 토큰을 찾아 가운데 부분을 디코딩하면 `"role":"anon"`만 나와야 함 |
| 2   | 모든 테이블 RLS `enable` + `force`                                                                                                                     | `supabase/migrations/0005_rls.sql`                                                                                | `npm run test:db`(01·02), Dashboard → Advisors → Security 경고 0                                                 |
| 3   | 가격·재고 조작 방지: 클라이언트는 상품 옵션 id와 수량만 보내고 금액은 서버가 계산                                                                      | `create_order` (`0004_functions.sql`), orders/order_items insert 정책 없음                                        | `test:db` 03                                                                                                     |
| 4   | 남의 주문·주소 열람 차단(IDOR)                                                                                                                         | RLS `user_id = auth.uid()`, 관리자 함수 내부 `is_admin()` 재검사                                                  | `test:db` 02·05, 다른 계정으로 `/account/orders/<id>` 접속 시 404                                                |
| 5   | 권한 상승 차단: `admins` 쓰기 정책 없음, `profiles`는 이름·전화·마케팅 동의 컬럼만, `orders`는 메모·택배사·송장 컬럼만 직접 수정 가능, 상태는 함수로만 | `0005_rls.sql`의 컬럼 `grant`, `admin_update_order_status`·`admin_set_tracking`                                   | `test:db` 05·06                                                                                                  |
| 6   | XSS: React 기본 이스케이프, `dangerouslySetInnerHTML` 금지, 상품 설명은 일반 텍스트, 외부 링크 `rel="noopener noreferrer"`                             | `eslint.config.js`(`dom-no-dangerously-set-innerhtml` error)                                                      | `npm run lint`                                                                                                   |
| 7   | CSP (`<meta>`)                                                                                                                                         | `vite.config.ts`의 `contentSecurityPolicy()`, `index.html`의 `%APP_CSP%`                                          | 빌드 후 `npm run preview`에서 콘솔 CSP 위반 0                                                                    |
| 8   | 인증: 비밀번호 8자 이상+영문+숫자, 이메일 인증 필수, 비밀번호 변경 시 재인증, refresh token rotation, 요청 한도                                        | `supabase/config.toml` `[auth]`(로컬), 운영은 Dashboard(HANDOVER 2.2) / 클라이언트 `src/features/auth/schemas.ts` | 약한 비밀번호 가입 거부, 미인증 로그인 거부                                                                      |
| 9   | 관리자 화면: `requireAdmin` 로더 + 별도 청크(스토어 번들에 관리자 코드 없음). 화면 가드는 편의, 방어는 RLS·함수                                        | `src/app/guards.ts`, `src/app/router.tsx`                                                                         | 일반 회원으로 `/admin` → `/`로 이동, `dist/assets`에 관리자 페이지가 별도 파일                                   |
| 10  | 업로드: 버킷 MIME·용량 제한, 경로 정규식, 관리자만 쓰기, 클라이언트에서 형식·10MB 검사 후 canvas로 WebP 재인코딩(메타데이터 제거)                      | `0006_storage.sql`, `src/lib/imageResize.ts`                                                                      | 관리자 화면에서 PDF 업로드 거부                                                                                  |
| 11  | 세션·리다이렉트: PKCE, 인증 메일은 `token_hash` 방식, Redirect URL 정확히 등록, 로그인 후 이동(`next`)은 같은 사이트 상대 경로만                       | `src/lib/supabase.ts`, `supabase/templates/*.html`, `safeNext()` (`src/app/guards.ts`)                            | `/login?next=//evil.example` 로그인 후 `/account`로 이동                                                         |
| 12  | 감사 로그: 상품·옵션·이미지·카테고리·주문·설정·홈 섹션 변경과 회원 탈퇴 기록                                                                           | `log_audit()` 트리거(`0004`·`0007`), `delete_my_account`                                                          | 관리자 → 설정 하단 변경 기록                                                                                     |
| 13  | 개인정보: 탈퇴 시 프로필·주소록·위시리스트 삭제, 주문은 계정 연결만 끊고 법정 기간 보관, 토스트·로그에 이메일·전화 미출력                              | `delete_my_account`, `src/lib/rpcErrors.ts`                                                                       | `test:db` 06, 개인정보처리방침과 일치 여부                                                                       |
| 14  | 의존성: `npm audit --omit=dev` high 0, lockfile 커밋, Dependabot 주 1회                                                                                | `package-lock.json`, `.github/dependabot.yml`                                                                     | `npm audit --omit=dev`                                                                                           |
| 15  | 헤더 한계: Pages는 `X-Frame-Options` 등 헤더 불가                                                                                                      | [DEPLOY 7절](DEPLOY.md#7-한계와-대안)                                                                             | —                                                                                                                |

### CSP: 계획에서 바뀐 부분과 이유

| 지시어                      | 계획                                | 실제                                                    | 이유                                                                               |
| --------------------------- | ----------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `script-src`                | `'self' https://t1.daumcdn.net`     | `'self' https://t1.kakaocdn.net https://t1.daumcdn.net` | 우편번호 스크립트 도메인이 kakaocdn으로 옮겨감(두 도메인 모두 서비스 중)           |
| `style-src`                 | `'self' 'unsafe-inline'`            | `'self'` + `style-src-attr 'unsafe-inline'`             | `<style>` 삽입은 막고, 카카오 우편번호 위젯이 크기 지정에 쓰는 `style` 속성만 허용 |
| `frame-src`                 | `https://postcode.map.daum.net`     | `+ https://postcode.map.kakao.com`                      | 우편번호 화면 도메인 변경                                                          |
| Supabase 주소               | `https://*.supabase.co` + 로컬 고정 | `VITE_SUPABASE_URL`의 origin 하나                       | 와일드카드 대신 실제 프로젝트만 허용                                               |
| `upgrade-insecure-requests` | 항상                                | Supabase가 https일 때만                                 | 로컬(http) 미리보기가 깨지지 않게                                                  |
| 개발 서버                   | —                                   | 고정 nonce, http 우편번호 frame 추가                    | 개발 서버 전용. 빌드 결과에는 없음                                                 |

새 외부 서비스를 붙이면 `vite.config.ts`의 해당 지시어에 그 origin만 추가하세요. `img-src`의 `https://images.unsplash.com`은 사진을 Storage에 옮긴 뒤로는 필요 없으니 운영 전에 빼도 됩니다. `frame-ancestors`는 `<meta>`에서 동작하지 않습니다(DEPLOY 7절).

### 의존성 점검 기록

2026-11-04: `npm audit --omit=dev` 취약점 0. 개발 도구(eslint 계열의 minimatch)에 moderate 1건이 있으나 배포 번들에 포함되지 않고, 자동 수정은 typescript-eslint를 크게 낮추는 변경이라 적용하지 않음. `npm outdated`: `@hookform/resolvers` 7.0.1 → 7.0.2(패치), `typescript` 5.9.3(의도적 고정, latest 7.0.2).

## 관리자 계정 보호 (권장)

- 관리자 계정은 긴 고유 비밀번호 + 비밀번호 관리자 사용, 공용 PC에서 로그인하지 않기, 관리자 수 최소화.
- **2단계 인증(TOTP)**: 지금 화면에는 없습니다. Supabase Auth는 TOTP MFA를 지원하므로 붙이려면 ① 마이페이지에 등록 화면(`supabase.auth.mfa.enroll` → QR → `challenge`/`verify`) ② `requireAdmin`에서 `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`이 `aal2`가 아니면 인증 화면으로 보내기 ③ 데이터베이스 쪽도 막으려면 `is_admin()`에 `(auth.jwt() ->> 'aal') = 'aal2'` 조건 추가 순서로 작업합니다. ③까지 해야 화면을 우회한 요청도 막힙니다.
- Supabase Dashboard 계정 자체(조직 소유자)에도 2단계 인증을 켜세요. 이 계정이 털리면 모든 것이 열립니다.

## 사고 대응

- **anon/publishable 키 노출**: 공개용 키라 노출 자체는 문제가 아니지만 남용이 의심되면 Dashboard → Project Settings → API Keys에서 새 키를 만들고 GitHub 변수 교체 → 재배포 → 옛 키 폐기.
- **secret/service_role 키 노출**: 즉시 키 회전(legacy JWT 키라면 JWT secret 회전, 모든 세션 무효화), Auth·DB 로그에서 이상 접근 확인, 개인정보 유출이 의심되면 개인정보보호법에 따라 정보주체 통지와 신고(1천 명 이상이거나 해킹 등 외부 공격이면 72시간 안에 개인정보보호위원회·KISA 신고)를 검토합니다.
- **관리자 계정 탈취 의심**: `delete from public.admins where user_id = …`로 즉시 권한 제거 → Dashboard → Authentication에서 해당 사용자 로그아웃/비밀번호 재설정 → 관리자 → 설정의 변경 기록에서 무엇이 바뀌었는지 확인.
- 사고 뒤에는 위 점검 목록 2·4·5번(RLS·권한)을 다시 확인하세요.
