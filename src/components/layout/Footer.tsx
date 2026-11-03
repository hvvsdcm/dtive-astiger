import { Link } from 'react-router';
import { business } from '@/config/business';
import { footerNav } from '@/config/site';
import { Logo } from '@/components/ui/Logo';

const copyrightYear = new Date().getFullYear();
const columnTitle = 'label-caps mb-4 text-xs text-footer-muted';
const linkClass = 'text-sm text-white underline-offset-4 hover:underline';

export function Footer() {
  const csEmail = business.customerService.email || business.email;
  const social = [{ label: 'Instagram', href: business.social.instagram }].filter(
    (item) => item.href !== '',
  );

  const legal = [
    business.companyName && `상호 ${business.companyName}`,
    business.ceo && `대표 ${business.ceo}`,
    business.bizNo && `사업자등록번호 ${business.bizNo}`,
    business.mailOrderNo && `통신판매업신고번호 ${business.mailOrderNo}`,
    business.address && `주소 ${business.address}`,
    business.phone && `전화 ${business.phone}`,
    business.email && `이메일 ${business.email}`,
    business.privacyOfficer.name && `개인정보보호책임자 ${business.privacyOfficer.name}`,
  ].filter(Boolean);

  return (
    <footer data-theme="dark" className="bg-footer text-white">
      <div className="grid gap-12 px-gutter pt-16 pb-10 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pt-24">
        <Link to="/" className="w-fit text-ice">
          <Logo className="h-20 lg:h-[120px]" />
        </Link>

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:gap-x-16">
          <section>
            <h2 className={columnTitle}>Customer Service</h2>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="text-footer-muted">{business.customerService.hours}</li>
              {csEmail ? (
                <li>
                  <a href={`mailto:${csEmail}`} className={linkClass}>
                    1:1 문의
                  </a>
                </li>
              ) : null}
            </ul>
          </section>

          <section>
            <h2 className={columnTitle}>Information</h2>
            <ul className="flex flex-col gap-2">
              {footerNav.info.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className={linkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {social.length > 0 ? (
            <section>
              <h2 className={columnTitle}>Social</h2>
              <ul className="flex flex-col gap-2">
                {social.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkClass}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10 px-gutter py-6">
        <p className="text-2xs text-footer-muted">
          {[...legal, `© ${copyrightYear} ${business.brandName}`].join(' · ')}
        </p>
      </div>
    </footer>
  );
}
