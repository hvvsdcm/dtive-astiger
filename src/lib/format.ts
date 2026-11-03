const SEOUL = 'Asia/Seoul';

const dateParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: SEOUL,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function seoulParts(iso: string) {
  const parts = Object.fromEntries(
    dateParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute', string>;
}

/** 129000 → "129,000원" */
export const formatKRW = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** ISO timestamp → "YYYY.MM.DD" in Asia/Seoul */
export const formatDate = (iso: string) => {
  const p = seoulParts(iso);
  return `${p.year}.${p.month}.${p.day}`;
};

/** ISO timestamp → "YYYY.MM.DD HH:mm" in Asia/Seoul */
export const formatDateTime = (iso: string) => {
  const p = seoulParts(iso);
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
};
