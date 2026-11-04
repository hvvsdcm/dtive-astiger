# 배포 (Cloudflare Workers)

화면(`dist/`)은 Cloudflare Workers의 정적 파일 호스팅(Worker 코드 없음, `wrangler.jsonc`)에, 데이터는 Supabase에 둡니다. 배포는 GitHub Actions(`.github/workflows/deploy.yml`)로만 합니다. 로컬 `.env.local`은 로컬 Supabase 값이라 이 컴퓨터에서 직접 배포하지 않습니다. 배포 전에 [HANDOVER 2장 운영 시작 체크리스트](HANDOVER.md#2-운영-시작-체크리스트)의 Supabase 설정을 먼저 끝내세요.

Cloudflare 무료 플랜으로 충분합니다(정적 파일 요청은 플랜과 관계없이 무료·무제한).

## 1. Cloudflare 계정과 API 토큰

1. https://dash.cloudflare.com 에서 계정을 만들고 **Workers & Pages** 화면을 한 번 엽니다. 이때 정해지는 `<계정 서브도메인>.workers.dev`가 기본 주소에 들어갑니다(Workers & Pages 개요 화면 오른쪽 Subdomain에서 확인·변경).
2. 오른쪽 위 프로필 → **My Profile → API Tokens → Create Token** → **Edit Cloudflare Workers** 템플릿 → Account Resources에 이 계정, Zone Resources는 All zones(또는 쓸 도메인) → Create. 토큰은 한 번만 보이니 바로 2절 Secrets에 넣습니다.
3. **Account ID**: Workers & Pages 개요 화면 오른쪽, 또는 계정 홈의 계정 이름 옆 메뉴 → Copy account ID.

## 2. GitHub 저장소 설정

저장소 `hvvsdcm/dtive-astiger`(비공개) → Settings → Secrets and variables → Actions.

**Secrets** 탭:

| 이름                    | 값                |
| ----------------------- | ----------------- |
| `CLOUDFLARE_API_TOKEN`  | 1절에서 만든 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | 1절의 Account ID  |

**Variables** 탭(모두 브라우저에 공개되는 값이라 Secrets가 아니라 Variables):

| 변수                     | 값                                     | 예                                                                                  |
| ------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase Project URL                   | `https://abcd1234.supabase.co`                                                      |
| `VITE_SUPABASE_ANON_KEY` | Publishable key(또는 legacy `anon` 키) | `sb_publishable_…`                                                                  |
| `VITE_BASE_PATH`         | 사이트가 열리는 경로. 앞뒤 `/` 필수    | `/` (비워 두면 `/`)                                                                 |
| `VITE_SITE_URL`          | 사이트 origin, 끝에 `/` 없음           | `https://dtive-astiger.<계정 서브도메인>.workers.dev` · `https://dtive-astiger.com` |

`service_role`/`secret` 키는 절대 넣지 마세요. 빌드는 값이 빠졌거나, `VITE_SUPABASE_ANON_KEY`가 `sb_secret_…` 키이거나 `role`이 `anon`이 아닌 JWT(`service_role` 키 등)이면 실패합니다(`src/config/publicKey.ts`, `vite.config.ts`). 주소·경로 형식은 앱이 시작할 때 `src/config/env.ts`가 검사하고, 틀리면 화면 대신 콘솔 오류가 납니다.

## 3. 실행

`main`에 push하면 자동으로 배포됩니다. 손으로 돌리려면 Actions → **Deploy to Cloudflare** → Run workflow. `VITE_SUPABASE_URL` 변수가 없으면 배포 작업은 실패가 아니라 건너뜀(skipped)으로 끝납니다.

1. `npm ci` → `typecheck` → `lint` → `test` (하나라도 실패하면 배포하지 않음)
2. 위 변수로 `npm run build`
3. `npx wrangler deploy`로 `dist/`를 올림. 로그 끝에 사이트 주소(`https://dtive-astiger.<계정 서브도메인>.workers.dev`)가 나옵니다.

`/shop/women` 같은 주소로 바로 들어와도 앱이 200 상태로 열립니다(`wrangler.jsonc`의 `not_found_handling`). 이전 배포로 되돌리려면 Cloudflare 대시보드 → Workers & Pages → `dtive-astiger` → Deployments에서 이전 버전을 고릅니다.

## 4. Supabase 인증 주소

배포 주소가 정해지면 Supabase Dashboard → Authentication → URL Configuration에 넣습니다. `<사이트>` = `VITE_SITE_URL` + `VITE_BASE_PATH`.

- Site URL: `<사이트>` (예: `https://dtive-astiger.<계정 서브도메인>.workers.dev/`, `https://dtive-astiger.com/`)
- Redirect URLs (정확한 주소로 세 개):
  - `<사이트>auth/confirmed` — 가입 인증
  - `<사이트>auth/reset` — 비밀번호 재설정
  - `<사이트>account/profile` — 이메일 변경 확인

주소를 바꾸면(예: 기본 주소 → 커스텀 도메인) 변수와 이 목록을 함께 바꾸고 워크플로를 다시 실행하세요. 맞지 않으면 인증 메일 링크가 Site URL 첫 화면으로만 열립니다.

## 5. 커스텀 도메인

1. 도메인의 DNS를 Cloudflare로 옮깁니다(Cloudflare에서 도메인 추가 → 등록 업체에서 네임서버를 Cloudflare 것으로 변경). Custom Domain은 Cloudflare DNS를 쓰는 도메인만 됩니다.
2. Workers & Pages → `dtive-astiger` → Settings → **Domains & Routes** → Add → **Custom Domain**에 `dtive-astiger.com`(필요하면 `www.dtive-astiger.com`도) 입력. DNS 레코드와 인증서는 Cloudflare가 만듭니다.
3. `VITE_SITE_URL`=`https://<도메인>`으로 바꾸고(`VITE_BASE_PATH`는 `/` 그대로) 4절 주소 갱신 후 재배포.
4. 도메인으로 운영을 시작하면 workers.dev 주소가 검색 결과에 나오지 않도록 `public/_headers` 끝에 아래를 추가해도 됩니다.
   ```
   https://dtive-astiger.:subdomain.workers.dev/*
     X-Robots-Tag: noindex
   ```

## 6. 보안 헤더

`public/_headers`는 빌드 때 `dist/`로 복사되고, Cloudflare가 모든 응답에 그 헤더를 붙입니다(파일 자체는 공개되지 않음).

- `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`: 다른 사이트가 이 사이트를 프레임에 넣지 못하게 함(클릭재킹 방지). 전체 CSP는 `<meta>` 태그에 있고(`vite.config.ts`가 빌드 때 생성), `<meta>`로는 `frame-ancestors`를 넣을 수 없어 헤더에는 이것만 둡니다. 두 정책이 모두 적용됩니다. 앱도 프레임 안에서는 실행하지 않습니다(`src/app/frameGuard.ts`).
- `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`
- `/assets/*`: 파일 이름에 내용 해시가 들어간 빌드 결과라 1년 캐시(`immutable`). 나머지(`index.html` 등)는 Cloudflare 기본값(매번 확인)이라 새 배포가 바로 보입니다.

`robots.txt`는 도메인 루트(`/robots.txt`)에서 제공됩니다. 새 외부 출처가 필요하면 `vite.config.ts`의 CSP에 추가합니다.

## 7. 백업·멈춤 방지

Supabase 무료 플랜은 요청이 7일 동안 없으면 프로젝트를 일시 정지하고, 자동 백업을 제공하지 않습니다. `.github/workflows/supabase-maintenance.yml`이 이 둘을 맡습니다.

- **멈춤 방지(keepalive)**: 월·목 12:23(한국 시간)에 공개 데이터 한 줄을 읽습니다. 2절의 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY` 변수를 그대로 씁니다.
- **백업(backup)**: 일요일 03:41에 roles·schema·data를 받아(`supabase db dump`), 빈 로컬 DB에 복원해 보고, 암호화해서 Actions 아티팩트로 90일 보관합니다. 암호화되지 않은 파일은 실행 서버 밖으로 나가지 않습니다(고객 이메일·주소·비밀번호 해시 포함).

Actions → **Supabase maintenance** → Run workflow로 둘 다 바로 실행할 수 있습니다. 아래 Secrets가 없으면 백업 작업은 실패 없이 건너뜁니다.

| Secret              | 값                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_DB_URL`   | Dashboard → **Connect** → **Session pooler**의 URI, `[YOUR-PASSWORD]` 자리에 DB 비밀번호. GitHub 실행 서버는 IPv4만 되어 Direct connection(`db.<ref>.supabase.co`)은 안 됩니다 |
| `BACKUP_PASSPHRASE` | 백업 암호화용 긴 임의 문구. 비밀번호 관리자에 따로 보관하세요. **잃어버리면 백업을 열 수 없습니다**                                                                            |

**복원**

1. Actions → 해당 실행 → Artifacts에서 `supabase-backup-<날짜>`를 내려받아 압축을 풉니다.
2. 복호화·풀기:
   ```sh
   gpg -o backup.tar.gz -d supabase-backup-<날짜>.tar.gz.gpg   # BACKUP_PASSPHRASE 입력
   tar xzf backup.tar.gz                                        # roles.sql, schema.sql, data.sql
   ```
3. 새 프로젝트(또는 비운 프로젝트)에 [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)의 복원 명령(`psql --single-transaction … --file roles.sql --file schema.sql … --file data.sql`)으로 넣습니다.
4. 다 쓴 평문 파일은 지웁니다.

**Storage 사진은 이 백업에 들어가지 않습니다.** 상품·배너 원본 사진은 따로 보관하세요(업로드 때 줄인 WebP만 Storage에 있음).

## 8. Pro 플랜으로 옮길 때

Supabase Pro(월 $25)는 매일 자동 백업, 일시 정지 없음, DB 8GB, 파일 저장 100GB입니다. 다음 중 하나면 옮기세요.

- DB 사용량이 500MB(무료 한도)에 가까워질 때 (Dashboard → Reports 또는 Usage)
- 사진(Storage)이 1GB(무료 한도)에 가까워질 때
- 실제 매출이 생겨 주간 백업 사이의 데이터 손실이 감당되지 않을 때

옮긴 뒤에도 워크플로는 그대로 둬도 되고, 백업이 겹치면 `SUPABASE_DB_URL` Secret을 지워 백업만 끌 수 있습니다.
