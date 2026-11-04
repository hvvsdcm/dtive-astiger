/**
 * Kakao (formerly Daum) postcode search, loaded on demand from the vendor CDN. No API key. The
 * script and iframe origins are allowed in the CSP (vite.config.ts). Namespace and CDN moved from
 * `daum` / t1.daumcdn.net to `kakao` / t1.kakaocdn.net in 2026; `daum.Postcode` remains an alias.
 * Guide: https://postcode.map.kakao.com/guide
 */

const SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

/** Fields of the `oncomplete` payload this app uses. */
type PostcodeResult = {
  zonecode: string;
  address: string;
  roadAddress: string;
  jibunAddress: string;
  userSelectedType: 'R' | 'J';
  bname: string;
  buildingName: string;
  apartment: 'Y' | 'N';
};

export type SelectedAddress = { postalCode: string; address1: string };

type PostcodeOptions = {
  oncomplete: (data: PostcodeResult) => void;
  width?: string | number;
  height?: string | number;
};
type PostcodeConstructor = new (options: PostcodeOptions) => {
  embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void;
};
type PostcodeGlobal = { Postcode?: PostcodeConstructor };

declare global {
  interface Window {
    kakao?: PostcodeGlobal;
    daum?: PostcodeGlobal;
  }
}

let loading: Promise<PostcodeConstructor> | null = null;

function loadedConstructor(): PostcodeConstructor | undefined {
  return window.kakao?.Postcode ?? window.daum?.Postcode;
}

function loadPostcode(): Promise<PostcodeConstructor> {
  const ready = loadedConstructor();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<PostcodeConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const Postcode = loadedConstructor();
      if (Postcode) resolve(Postcode);
      else reject(new Error('postcode API unavailable'));
    };
    script.onerror = () => reject(new Error('postcode script failed to load'));
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = null; // allow a retry
    throw error;
  });
  return loading;
}

/**
 * Road address (or the lot address when the user picked one), with the legal-dong and building
 * name appended the way the official guide recommends for road addresses.
 */
function toSelectedAddress(data: PostcodeResult): SelectedAddress {
  if (data.userSelectedType === 'J') {
    return { postalCode: data.zonecode, address1: data.jibunAddress || data.address };
  }
  const extras = [
    /[동로가]$/.test(data.bname) ? data.bname : '',
    data.apartment === 'Y' ? data.buildingName : '',
  ].filter(Boolean);
  const road = data.roadAddress || data.address;
  return {
    postalCode: data.zonecode,
    address1: extras.length > 0 ? `${road} (${extras.join(', ')})` : road,
  };
}

/**
 * Renders the search UI into `element`; calls `onSelect` once an address is picked. Nothing is
 * embedded when `signal` aborts before the script has loaded (React ref cleanup).
 */
export async function embedPostcode(
  element: HTMLElement,
  onSelect: (address: SelectedAddress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const Postcode = await loadPostcode();
  if (signal?.aborted) return;
  new Postcode({
    oncomplete: (data) => onSelect(toSelectedAddress(data)),
    width: '100%',
    height: '100%',
  }).embed(element, { autoClose: false });
}
