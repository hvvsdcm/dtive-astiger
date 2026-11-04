# 진행 상황

계획: `docs/PLAN.md` (슬라이스 S1~S9, ⑫ 절).

## 사용자 결정

- 결제: 무통장입금만 (2026-11-04). PG 연동 설계하지 않음.
- 배포: 화면은 Cloudflare Workers(정적 파일, `main` push 시 GitHub Actions 배포), DB는 Supabase 무료 플랜 + Actions 주간 암호화 백업·주 2회 멈춤 방지, 한도에 가까워지면 Pro (2026-11-04). 계정 연결 전이라 아직 배포 안 됨.
- 브랜드 표기: `DTIVE & ASTIGER` / 디티브 아시티거 (기본값).

## 계획에서 바뀐 것

- 로컬 dev 포트 5174 고정 (5173은 다른 프로젝트). auth site_url도 5174.
- 인증 메일 링크는 `token_hash` 방식 (PKCE 5분 만료 문제 회피).
- CSP: `style-src-attr 'unsafe-inline'` 허용 (카카오 우편번호 위젯 크기 지정 때문). zod는 `jitless`.
- 1차 카테고리 이름 영문 (WOMEN/MEN/ACCESSORIES), 하위는 한글.
- 회원가입에 필수 "만 14세 이상입니다" 추가. `handle_new_user`가 `age_confirmed`도 요구하고 `profiles.age_confirmed_at`에 기록 (마이그레이션 0008).
- 상단 메뉴의 룩북 라벨은 항상 `Lookbook` (카테고리 이름 언어에 따라 바꾸지 않음). 모바일 메뉴 대문자 자간은 영문 라벨에만.
- CSP: http 오리진(개발 서버, 로컬 Supabase 대상 빌드)에서는 `http://postcode.map.*` 프레임도 허용. https 운영 빌드는 그대로.
- E2E(`npm run e2e`)는 로컬 DB에 `docker exec … psql`로 테스트 계정을 만들고 정리. `layout.spec`이 390·1440px에서 가로 넘침·라운드·그림자·포커스 링을 검사 (`E2E_SCREENSHOTS_DIR` 지정 시 스크린샷 저장).
- 보안 보강 0009: 관리자 전용 데이터(`admin_note`, 이벤트 note·actor_id, `updated_by`)는 고객·anon이 못 읽음, 관리자는 `admin_get_order`로 읽음. `create_order` 고객별 한도(입금 대기 3건, 1시간 10건). 마케팅 동의 시각은 서버가 기록. 감사 로그에 주문 개인정보·탈퇴 해시를 남기지 않음.
- 보안 보강 0010: Storage 목록 조회는 관리자만. 홈 섹션 링크는 DB·프론트 모두 내부 경로만. 재고는 `admin_set_stock`(낙관적 잠금, `STOCK_CHANGED`)으로만 변경. 이메일 링크 타입을 경로별로 제한하고 다른 계정 세션이 있으면 전환 확인. 프레임 안에서는 렌더하지 않음. 빌드가 비공개 키를 거부. 워크플로 권한 최소화·SHA 고정.
- 관리자 2단계 인증(TOTP) 필수 (0011): `is_admin()`은 `aal2` 세션만 참, 라우팅용 `is_admin_member()` 추가. 관리자 첫 로그인은 `/admin/mfa/setup`(QR·키·코드), 이후 `/admin/mfa`(코드). 관리자 페이지 이동마다 `requireAdmin` 재확인, 관리자 함수 `FORBIDDEN`이면 코드 화면으로. E2E는 TOTP를 계산해 등록·검증하고 끝나면 factor 삭제. 고객 MFA 없음.

## 슬라이스

| 슬라이스                    | 상태 |
| --------------------------- | ---- |
| S1 스캐폴드·토큰·UI 키트    | 완료 |
| S2 Supabase 스키마·RLS·시드 | 완료 |
| S3 인증·마이페이지          | 완료 |
| S4 카탈로그                 | 완료 |
| S5 장바구니·체크아웃        | 완료 |
| S6 어드민 상품·카테고리     | 완료 |
| S7 어드민 주문·회원·설정    | 완료 |
| S8 법무 콘텐츠·문서·CI      | 완료 |
| S9 E2E·최종 점검            | 완료 |
| 보안 리뷰·보강              | 완료 |
| 관리자 TOTP                 | 완료 |
