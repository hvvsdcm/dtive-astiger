import { business } from './business';

export type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
};

/** `<title>` text: "{page} | DTIVE & ASTIGER", or the brand alone for the home page. */
export function pageTitle(page?: string): string {
  return page ? `${page} | ${business.brandName}` : business.brandName;
}

/**
 * Primary navigation used until the catalog slice feeds category data into the header.
 * Keep the first level at six items or fewer.
 */
export const fallbackNav: NavItem[] = [
  { label: 'Women', href: '/shop/women' },
  { label: 'Men', href: '/shop/men' },
  { label: 'Accessories', href: '/shop/accessories' },
  { label: 'Lookbook', href: '/lookbook' },
];

export const footerNav = {
  info: [
    { label: '이용약관', href: '/terms' },
    { label: '개인정보처리방침', href: '/privacy' },
    { label: 'FAQ', href: '/faq' },
    { label: '배송·교환·반품', href: '/shipping' },
  ],
} as const;
