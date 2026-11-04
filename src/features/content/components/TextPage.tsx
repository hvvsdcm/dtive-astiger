import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/components/ui/cn';
import { pageTitle } from '@/config/site';
import { MISSING } from '@/content/shared';
import type { Block } from '@/content/types';

/** Plain text with the missing-business-detail marker highlighted. */
export function Rich({ text }: { text: string }) {
  const at = text.indexOf(MISSING);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-danger">{MISSING}</span>
      <Rich text={text.slice(at + MISSING.length)} />
    </>
  );
}

/** 720px text column with a title, optional effective date and an anchor table of contents. */
export function TextPage({
  title,
  effectiveDate,
  toc,
  children,
}: {
  title: string;
  effectiveDate?: string;
  toc: { id: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <article className="px-gutter py-16 lg:py-24">
      <div className="mx-auto max-w-[720px]">
        <title>{pageTitle(title)}</title>
        <h1 className="text-lg font-medium">{title}</h1>
        {effectiveDate ? (
          <p className="mt-2 text-xs text-ink-muted">
            시행일 <Rich text={effectiveDate} />
          </p>
        ) : null}

        <nav aria-label="목차" className="mt-10 border-y border-line py-6">
          <ol className="gap-x-8 text-sm sm:columns-2">
            {toc.map((entry) => (
              <li key={entry.id} className="mb-2 break-inside-avoid last:mb-0">
                <Link
                  to={`#${entry.id}`}
                  className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  {entry.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 flex flex-col gap-12">{children}</div>
      </div>
    </article>
  );
}

/** One heading + body, offset so the sticky header does not cover it when jumped to. */
export function TextSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="mb-4 text-base font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-3 text-sm whitespace-pre-line">
      {blocks.map((block) => {
        if (typeof block === 'string') {
          return (
            <p key={block}>
              <Rich text={block} />
            </p>
          );
        }
        if ('list' in block) {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List
              key={block.list.join()}
              className={cn(
                'flex flex-col gap-2 pl-5',
                block.ordered ? 'list-decimal' : 'list-disc',
              )}
            >
              {block.list.map((item) => (
                <li key={item} className="pl-1">
                  <Rich text={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <div key={block.table.head.join()} className="w-full overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-xs">
              <thead className="border-b border-ink">
                <tr>
                  {block.table.head.map((cell) => (
                    <th key={cell} scope="col" className="px-2 py-2 font-medium text-ink-muted">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.table.rows.map((row) => (
                  <tr key={row.join()} className="border-b border-line">
                    {block.table.head.map((column, columnIndex) => (
                      <td key={column} className="px-2 py-3 align-top">
                        <Rich text={row[columnIndex] ?? ''} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
