import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Direct SQL on the local Supabase database (superuser, through `docker exec … psql`). Used only to
 * create confirmed test accounts and to remove everything a spec created. Never point this at a
 * hosted project.
 */
const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(
  readFileSync(new URL('../../supabase/config.toml', import.meta.url), 'utf8'),
)?.[1];
const container = process.env.E2E_DB_CONTAINER ?? `supabase_db_${projectId}`;

export function sql(query: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-AtqX',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: query, encoding: 'utf8' },
  ).trim();
}

/** Single-quoted SQL literal. */
export const lit = (value: string) => `'${value.replaceAll("'", "''")}'`;

export type TestUser = { id: string; email: string; password: string; name: string };

/** A confirmed customer account with all required consents, like the seed accounts. */
export function createUser(name = 'E2E 고객'): TestUser {
  const id = randomUUID();
  const user = { id, email: `e2e-${id.slice(0, 8)}@example.com`, password: 'E2eTest1234!', name };
  const meta = JSON.stringify({
    name,
    phone: '01055556666',
    terms_agreed: true,
    privacy_agreed: true,
    age_confirmed: true,
    marketing_agreed: false,
  });
  sql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', ${lit(id)}, 'authenticated', 'authenticated',
      ${lit(user.email)}, extensions.crypt(${lit(user.password)}, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', ${lit(meta)}, now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), ${lit(id)}, ${lit(id)}, 'email',
            jsonb_build_object('sub', ${lit(id)}, 'email', ${lit(user.email)}, 'email_verified', true),
            now(), now(), now());
  `);
  return user;
}

/** Puts back the stock of the user's open orders, deletes the orders and then the account. */
export function deleteUserByEmail(email: string): void {
  sql(`
    select public.restore_order_stock(o.id)
      from public.orders o join auth.users u on u.id = o.user_id
     where u.email = ${lit(email)} and o.status not in ('cancelled', 'refunded');
    delete from public.orders o using auth.users u where u.id = o.user_id and u.email = ${lit(email)};
    delete from auth.users where email = ${lit(email)};
  `);
}

/** Highest audit log id; rows above it were written by the running spec. */
export const auditMark = () => Number(sql('select coalesce(max(id), 0) from public.audit_logs'));

export function purgeAuditSince(mark: number): void {
  sql(`delete from public.audit_logs where id > ${Number(mark)}`);
}
