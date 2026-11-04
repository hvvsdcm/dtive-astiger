# 배포 (GitHub Pages)

**현재 보류 상태입니다.** 워크플로 `.github/workflows/pages.yml`은 수동 실행(`workflow_dispatch`)만 있고, push해도 자동 배포되지 않습니다. 배포 전에 [HANDOVER 2장 운영 시작 체크리스트](HANDOVER.md#2-운영-시작-체크리스트)의 Supabase 설정을 먼저 끝내세요.

## 1. 저장소

GitHub에 저장소를 만들고 이 코드를 push합니다. 비공개 저장소에서 Pages를 쓰려면 GitHub 유료 플랜(Pro/Team 이상)이 필요합니다. `.env.local`은 `.gitignore`에 있어 올라가지 않습니다.

## 2. Pages 켜기

Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 선택합니다.

## 3. 저장소 변수

Settings → Secrets and variables → Actions → **Variables** 탭에 추가합니다(Secrets가 아니라 Variables: 모두 브라우저에 공개되는 값입니다).

| 변수                     | 값                                     | 예                                                       |
| ------------------------ | -------------------------------------- | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase Project URL                   | `https://abcd1234.supabase.co`                           |
| `VITE_SUPABASE_ANON_KEY` | Publishable key(또는 legacy `anon` 키) | `sb_publishable_…`                                       |
| `VITE_BASE_PATH`         | 사이트가 열리는 경로. 앞뒤 `/` 필수    | 커스텀 도메인: `/` · 기본 주소: `/<저장소 이름>/`        |
| `VITE_SITE_URL`          | 사이트 origin, 끝에 `/` 없음           | `https://dtive-astiger.com` · `https://<계정>.github.io` |

`service_role`/`secret` 키는 절대 넣지 마세요. 빌드는 값이 빠졌거나, `VITE_SUPABASE_ANON_KEY`가 `sb_secret_…` 키이거나 `role`이 `anon`이 아닌 JWT(`service_role` 키 등)이면 실패합니다(`src/config/publicKey.ts`, `vite.config.ts`). 주소·경로 형식은 앱이 시작할 때 `src/config/env.ts`가 검사하고, 틀리면 화면 대신 콘솔 오류가 납니다.

## 4. 실행

Actions → **Deploy to GitHub Pages** → Run workflow. 워크플로는 다음을 합니다.

1. `npm ci` → `typecheck` → `lint` → `test` (하나라도 실패하면 배포하지 않음)
2. 위 변수로 `npm run build`
3. `dist/index.html`을 `dist/404.html`로 복사(아래 "한계" 참고)
4. Pages에 업로드·배포. 완료 화면에 사이트 주소가 표시됩니다.

자동 배포로 바꾸려면 `on:`에 `push: { branches: [main] }`을 추가하면 됩니다(운영이 안정된 뒤 권장).

## 5. Supabase 인증 주소

배포 주소가 정해지면 Supabase Dashboard → Authentication → URL Configuration에 넣습니다. `<사이트>` = `VITE_SITE_URL` + `VITE_BASE_PATH`.

- Site URL: `<사이트>` (예: `https://dtive-astiger.com/`, `https://<계정>.github.io/<저장소>/`)
- Redirect URLs (정확한 주소로 세 개):
  - `<사이트>auth/confirmed` — 가입 인증
  - `<사이트>auth/reset` — 비밀번호 재설정
  - `<사이트>account/profile` — 이메일 변경 확인

주소를 바꾸면(예: 기본 주소 → 커스텀 도메인) 변수와 이 목록을 함께 바꾸고 워크플로를 다시 실행하세요. 맞지 않으면 인증 메일 링크가 Site URL 첫 화면으로만 열립니다.

## 6. 커스텀 도메인·HTTPS

1. Settings → Pages → Custom domain에 도메인 입력(예: `dtive-astiger.com`). Actions 배포에서는 `CNAME` 파일이 필요 없습니다.
2. 도메인 DNS 설정
   - 루트 도메인: A 레코드 `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (IPv6는 AAAA `2606:50c0:8000::153`~`2606:50c0:8003::153`)
   - `www`: CNAME `<계정>.github.io`
3. 계정 Settings → Pages에서 도메인 소유 확인(Verify)을 해 두면 다른 사람이 도메인을 가로채지 못합니다.
4. 인증서 발급 후 **Enforce HTTPS** 체크.
5. `VITE_BASE_PATH`=`/`, `VITE_SITE_URL`=`https://<도메인>`으로 바꾸고 5절 주소 갱신 후 재배포.
6. `business.hostingProvider`(푸터·개인정보처리방침)를 실제 호스팅 업체와 맞게 유지합니다.

## 7. 한계와 대안

- **HTTP 헤더를 설정할 수 없음**: Pages는 응답 헤더를 바꿀 수 없어 CSP를 `<meta>`로 넣었습니다(`vite.config.ts`가 빌드 때 생성). `<meta>` CSP는 `frame-ancestors`를 지원하지 않고, `X-Frame-Options`·`X-Content-Type-Options`·`Permissions-Policy`도 보낼 수 없습니다. 클릭재킹은 앱이 프레임 안에서 열리면 스스로 실행하지 않는 것으로 막지만(`src/app/frameGuard.ts`), 스크립트로 하는 방어라 헤더보다 약하니 헤더를 쓸 수 있으면 아래처럼 추가하세요.
- **404 상태 코드**: Pages에는 주소 재작성이 없어 `/shop/women` 같은 주소로 바로 들어오면 `404.html`(= 앱)이 404 상태로 응답합니다. 화면은 정상이지만 검색엔진은 404로 볼 수 있습니다.
- **robots.txt**: 도메인 루트에 있을 때만 읽힙니다. 기본 주소(`/<저장소>/`)로 운영하면 무시됩니다.

헤더가 필요해지면 Cloudflare를 씁니다.

- **Cloudflare Pages로 이전**: 빌드 명령 `npm run build`, 출력 `dist`, 같은 `VITE_*` 환경 변수. `404.html` 복사는 하지 않습니다(없으면 Cloudflare가 SPA로 처리). `public/_headers` 파일을 추가하면 모든 응답에 헤더가 붙습니다.
  ```
  /*
    Content-Security-Policy: frame-ancestors 'none'
    X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=()
  ```
  `<meta>` CSP는 그대로 두고, 헤더의 CSP에는 `frame-ancestors`만 넣습니다(두 정책이 모두 적용됨).
- **GitHub Pages 유지 + Cloudflare 프록시**: 커스텀 도메인 DNS를 Cloudflare에 두고 프록시(주황 구름)를 켠 뒤 Rules → Transform Rules → Modify Response Header로 위 헤더를 추가합니다. SSL/TLS 모드는 Full(strict).

이전하면 `business.hostingProvider`와 개인정보처리방침의 위탁·국외 이전 표를 함께 고치세요.
