import { describe, expect, it } from 'vitest';
import { publicKeyProblem } from './publicKey';

const jwt = (claims: object) =>
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_')}.sig`;

describe('publicKeyProblem', () => {
  it('accepts publishable keys and anon JWTs', () => {
    expect(publicKeyProblem('sb_publishable_abc123_DEF')).toBeNull();
    expect(publicKeyProblem(jwt({ iss: 'supabase', role: 'anon', exp: 1983812996 }))).toBeNull();
  });

  it('rejects secret keys, non-anon JWTs and anything else', () => {
    expect(publicKeyProblem('sb_secret_abc123')).toMatch(/secret/);
    expect(publicKeyProblem(jwt({ role: 'service_role' }))).toMatch(/service_role/);
    expect(publicKeyProblem(jwt({ role: 'authenticated' }))).toMatch(/authenticated/);
    expect(publicKeyProblem(jwt({ ref: 'x' }))).toMatch(/unknown/);
    expect(publicKeyProblem('eyJnot-a-jwt')).toMatch(/unknown/);
    expect(publicKeyProblem('sb_publishable_')).not.toBeNull();
    expect(publicKeyProblem('')).not.toBeNull();
    expect(publicKeyProblem('some-random-key-of-length-30')).not.toBeNull();
  });
});
