# DTIVE & ASTIGER

디티브 아시티거 의류 쇼핑몰. React 정적 사이트(SPA)와 Supabase(회원 인증·데이터베이스·이미지 저장)로 동작하며, 결제는 무통장입금만 받습니다. 스토어, 회원가입·마이페이지, 관리자 페이지, 이용약관·개인정보처리방침이 들어 있고 GitHub Pages 배포 워크플로가 준비되어 있습니다(배포는 보류).

## 필요한 도구

- Node.js 22.22 이상 (`.nvmrc`)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) 3.x
- Docker 호환 런타임 하나: Docker Desktop, OrbStack, colima (`supabase start`가 사용)

## 로컬 실행

```sh
npm ci
supabase start                # 첫 실행은 몇 분. 마이그레이션·시드 데이터·시드 이미지까지 올라감
cp .env.example .env.local    # VITE_SUPABASE_ANON_KEY= 뒤에 `supabase status -o env`의 ANON_KEY 값을 붙여 넣기
npm run dev                   # http://127.0.0.1:5174
```

시드 계정: 관리자 `admin@example.com` / `Admin1234!`, 고객 `customer@example.com` / `Customer1234!`. 가입·비밀번호 재설정 메일은 실제로 나가지 않고 Mailpit(http://127.0.0.1:54324)에 쌓입니다. 관리자 페이지는 `/admin`.

## 명령

| 명령                              | 하는 일                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                     | 개발 서버                                                    |
| `npm run build`                   | 타입 검사 후 `dist/`에 배포용 빌드                           |
| `npm run preview`                 | 빌드 결과를 로컬에서 확인 (http://localhost:4173)            |
| `npm run typecheck`               | TypeScript 검사                                              |
| `npm run lint` / `npm run format` | ESLint / Prettier 검사                                       |
| `npm test`                        | 단위 테스트 (Vitest)                                         |
| `npm run test:db`                 | 데이터베이스 권한·함수 테스트 (pgTAP, `supabase start` 필요) |
| `npm run e2e`                     | 브라우저 시나리오 테스트 (Playwright)                        |
| `npm run gen:types`               | 로컬 DB에서 `src/types/database.ts` 재생성                   |
| `npm run favicons`                | `brand/logo-source.png`에서 파비콘 재생성                    |

커밋 전: `npm run typecheck && npm run lint && npm run format && npm test && npm run build`.

## 문서

- [docs/HANDOVER.md](docs/HANDOVER.md): 구조, 운영 시작 체크리스트(Supabase 클라우드 설정, 사업자 정보), 일상 운영, 백업, 라이선스
- [docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md): 관리자 페이지 사용법 (개발 지식 없이 읽는 문서)
- [docs/DEPLOY.md](docs/DEPLOY.md): GitHub Pages 배포
- [docs/SECURITY.md](docs/SECURITY.md): 보안 구조와 점검 목록
- [docs/PLAN.md](docs/PLAN.md): 처음 설계 문서 (스키마·화면·계약 전체)
- [AGENTS.md](AGENTS.md): 코드 규칙 요약
