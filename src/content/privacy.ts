import { business } from '@/config/business';
import { CS_EMAIL, filled } from './shared';
import type { LegalDocument } from './types';

/**
 * 개인정보처리방침 (개인정보 보호법 제30조, 개인정보보호위원회 작성지침 항목 순서). Describes what the
 * code actually collects; update it together with any new form field. Legal review is required
 * before launch (docs/HANDOVER.md).
 */
export function privacyDocument(): LegalDocument {
  const company = filled(business.companyName);
  const effective = filled(business.policyEffectiveDate);
  const mailCompany = filled(business.mailService.company);

  return {
    title: '개인정보처리방침',
    effectiveDate: effective,
    sections: [
      {
        id: 'intro',
        title: '개요',
        blocks: [
          `${company}(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 지키며, ${business.brandName} 온라인 스토어(이하 "몰") 이용자의 개인정보를 다음과 같이 처리합니다.`,
        ],
      },
      {
        id: 'purpose',
        title: '1. 처리 목적',
        blocks: [
          {
            ordered: true,
            list: [
              '회원 관리: 가입 의사 확인, 본인 식별, 부정 이용 방지, 탈퇴 처리',
              '주문 처리: 주문 접수, 입금 확인, 상품 배송, 취소·교환·반품·환불',
              '고객 문의 응대와 분쟁 처리',
              '마케팅 정보 수신에 동의한 회원에 한하여 신상품·이벤트 안내',
            ],
          },
        ],
      },
      {
        id: 'items',
        title: '2. 처리하는 개인정보 항목',
        blocks: [
          {
            table: {
              head: ['구분', '항목'],
              rows: [
                ['회원가입(필수)', '이메일, 비밀번호, 이름, 이용약관·개인정보 수집 동의 일시'],
                ['회원가입(선택)', '휴대전화번호, 마케팅 정보 수신 동의 일시'],
                ['주문', '수령인 이름, 휴대전화번호, 우편번호, 주소, 배송 메모, 입금자명'],
                ['주소록 저장', '배송지 이름, 수령인 이름, 휴대전화번호, 우편번호, 주소'],
                ['취소·반품 환불', '환불받을 은행, 계좌번호, 예금주'],
                ['자동 생성', 'IP 주소, 접속 일시, 브라우저 정보(로그인 및 인증 기록)'],
              ],
            },
          },
          '비밀번호는 복호화할 수 없는 방식으로 암호화되어 저장되며, 회사도 알 수 없습니다.',
        ],
      },
      {
        id: 'retention',
        title: '3. 처리 및 보유 기간',
        blocks: [
          '회원 정보는 회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 보존해야 하는 정보는 아래 기간 동안 보관합니다. 탈퇴한 회원의 주문 기록은 회원 계정과의 연결을 끊은 상태로 보관합니다.',
          {
            table: {
              head: ['보존 정보', '기간', '근거'],
              rows: [
                ['계약 또는 청약철회 등에 관한 기록', '5년', '전자상거래법'],
                ['대금결제 및 재화 등의 공급에 관한 기록', '5년', '전자상거래법'],
                ['소비자의 불만 또는 분쟁 처리에 관한 기록', '3년', '전자상거래법'],
                ['웹사이트 방문 기록(로그인 기록)', '3개월', '통신비밀보호법'],
              ],
            },
          },
        ],
      },
      {
        id: 'destruction',
        title: '4. 파기 절차와 방법',
        blocks: [
          '보유 기간이 끝났거나 처리 목적을 달성한 개인정보는 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 방법으로 삭제하며, 종이 문서는 분쇄하거나 소각합니다.',
        ],
      },
      {
        id: 'third-party',
        title: '5. 제3자 제공',
        blocks: [
          '회사는 이용자의 개인정보를 1항의 처리 목적 범위에서만 처리하며, 이용자의 동의나 법률의 특별한 규정이 있는 경우를 제외하고는 제3자에게 제공하지 않습니다.',
        ],
      },
      {
        id: 'outsourcing',
        title: '6. 처리 위탁',
        blocks: [
          '회사는 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁합니다. 위탁 계약 시 개인정보가 안전하게 관리되도록 필요한 사항을 정하고 수탁자를 감독합니다.',
          {
            table: {
              head: ['수탁자', '위탁 업무'],
              rows: [
                ['Supabase Pte. Ltd., Supabase, Inc.', '회원 인증, 회원·주문 정보 저장'],
                [mailCompany, '가입 인증·비밀번호 재설정 메일 발송'],
                [filled(business.courier), '상품 배송'],
                [filled(business.hostingProvider), '웹사이트 호스팅'],
              ],
            },
          },
        ],
      },
      {
        id: 'overseas',
        title: '7. 국외 이전',
        blocks: [
          '회사는 「개인정보 보호법」 제28조의8 제1항 제3호에 따라, 회원과의 계약 이행에 필요한 처리 위탁·보관을 위해 다음과 같이 개인정보를 국외로 이전합니다. 이전은 서비스를 이용할 때 암호화된 네트워크를 통해 수시로 이루어집니다.',
          {
            table: {
              head: ['이전받는 자(연락처)', '국가', '항목', '목적', '보유 기간'],
              rows: [
                [
                  'Supabase Pte. Ltd., Supabase, Inc.\n(privacy@supabase.io)',
                  `데이터 저장: ${filled(business.dataRegion)}\n운영·기술 지원: 싱가포르, 미국`,
                  '2항의 전체 항목',
                  '회원 인증, 데이터 저장',
                  '3항의 보유 기간',
                ],
                [
                  mailCompany,
                  filled(business.mailService.country),
                  '이메일 주소',
                  '인증 메일 발송',
                  '위탁 계약 종료 시까지',
                ],
                [
                  filled(business.hostingProvider),
                  '미국',
                  'IP 주소, 접속 기록',
                  '웹사이트 제공',
                  '수탁자 정책에 따름',
                ],
              ],
            },
          },
          '국외 이전을 원하지 않으면 회원가입과 주문을 하지 않거나 회원 탈퇴를 할 수 있습니다. 이 경우 몰에서 상품을 구매할 수 없습니다.',
        ],
      },
      {
        id: 'rights',
        title: '8. 정보주체의 권리와 행사 방법',
        blocks: [
          {
            ordered: true,
            list: [
              '이용자는 언제든지 자신의 개인정보 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.',
              '회원정보는 마이페이지 > 회원정보에서 직접 확인·수정하고, 같은 화면에서 탈퇴할 수 있습니다. 주소록은 마이페이지 > 주소록에서 삭제할 수 있습니다.',
              `그 밖의 요구는 개인정보 보호책임자에게 이메일로 할 수 있으며, 회사는 10일 이내에 조치하고 결과를 알립니다.`,
              '법령에서 보존을 정한 정보는 삭제를 요구할 수 없습니다.',
            ],
          },
        ],
      },
      {
        id: 'security',
        title: '9. 안전성 확보 조치',
        blocks: [
          {
            list: [
              '비밀번호 단방향 암호화 저장',
              '모든 통신 구간 암호화(HTTPS)',
              '데이터베이스 행 단위 접근 통제: 회원은 자신의 정보만, 관리자로 지정된 계정만 주문·회원 정보에 접근',
              '관리자 작업(상품·주문·설정 변경, 회원 탈퇴) 기록 보관',
              '개인정보 취급자 최소화',
            ],
          },
        ],
      },
      {
        id: 'cookies',
        title: '10. 자동 수집 장치',
        blocks: [
          '몰은 쿠키를 사용하지 않으며, 광고·방문 분석 도구를 설치하지 않습니다. 로그인 상태와 장바구니는 이용자 브라우저의 로컬 저장소에 저장됩니다. 로그인 상태는 로그아웃하면, 장바구니는 브라우저 설정에서 사이트 데이터를 삭제하면 지워집니다.',
          '주소 검색에는 카카오 우편번호 서비스를 사용하며, 검색할 때 입력한 검색어가 카카오에 전송됩니다.',
        ],
      },
      {
        id: 'marketing',
        title: '11. 마케팅 정보 수신 동의와 철회',
        blocks: [
          '마케팅 정보 수신 동의는 선택 사항이며, 동의하지 않아도 회원가입과 구매를 할 수 있습니다. 동의는 마이페이지 > 회원정보에서 언제든지 철회할 수 있습니다.',
        ],
      },
      {
        id: 'children',
        title: '12. 만 14세 미만 아동',
        blocks: ['회사는 만 14세 미만 아동의 회원가입을 받지 않습니다.'],
      },
      {
        id: 'officer',
        title: '13. 개인정보 보호책임자',
        blocks: [
          {
            list: [
              `성명: ${filled(business.privacyOfficer.name)}`,
              `이메일: ${filled(business.privacyOfficer.email)}`,
              `전화: ${filled(business.phone)}`,
              `고객센터: ${CS_EMAIL}`,
            ],
          },
        ],
      },
      {
        id: 'remedy',
        title: '14. 권익침해 구제 방법',
        blocks: [
          '개인정보 침해에 대한 신고나 상담은 아래 기관에 문의할 수 있습니다.',
          {
            list: [
              '개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)',
              '개인정보침해신고센터: 118 (privacy.kisa.or.kr)',
              '대검찰청: 1301 (www.spo.go.kr)',
              '경찰청: 182 (ecrm.police.go.kr)',
            ],
          },
        ],
      },
      {
        id: 'changes',
        title: '15. 처리방침의 변경',
        blocks: [
          `이 개인정보처리방침은 ${effective}부터 적용됩니다. 내용이 바뀌는 경우 시행 7일 전부터 몰에 공지합니다.`,
        ],
      },
    ],
  };
}
