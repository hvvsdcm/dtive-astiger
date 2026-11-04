import { useQuery } from '@tanstack/react-query';
import { authRedirectUrl } from '@/features/auth/api';
import { useSession } from '@/features/auth/session';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/types/domain';
import type { Tables } from '@/types/database';
import type { AddressFormInput, AddressInput, ProfileValues } from './schemas';

export type Profile = Tables<'profiles'>;
export type Address = Tables<'addresses'>;

/** Orders in these states block account deletion (delete_my_account raises ACTIVE_ORDERS). */
const ACTIVE_ORDER_STATUSES: OrderStatus[] = ['pending_payment', 'paid', 'preparing', 'shipped'];

/* ---------------------------------------------------------------- profile */

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: qk.profile(user?.id),
    queryFn: () => fetchProfile(user!.id),
    enabled: Boolean(user),
  });
}

export async function updateProfile(profile: Profile, values: ProfileValues): Promise<void> {
  // Keep the original consent time while consent is unchanged; record a new one when given again.
  const marketingAgreedAt = values.marketingAgreed
    ? (profile.marketing_agreed_at ?? new Date().toISOString())
    : null;
  const { error } = await supabase
    .from('profiles')
    .update({ name: values.name, phone: values.phone, marketing_agreed_at: marketingAgreedAt })
    .eq('id', profile.id);
  if (error) throw error;
}

/** Sends confirmation links (to the old and new address); the email changes once both are opened. */
export async function changeEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: authRedirectUrl('account/profile') },
  );
  if (error) throw error;
}

/** Re-checks the current password by signing in again (also refreshes the session for secure_password_change). */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return true;
  if (error.code === 'invalid_credentials') return false;
  throw error;
}

async function countActiveOrders(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ACTIVE_ORDER_STATUSES);
  if (error) throw error;
  return count ?? 0;
}

export function useActiveOrderCount() {
  const { user } = useSession();
  return useQuery({
    // Under qk.orders so order mutations (prefix invalidation) refresh it.
    queryKey: [...qk.orders(user?.id), 'activeCount'],
    queryFn: () => countActiveOrders(user!.id),
    enabled: Boolean(user),
  });
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}

/* -------------------------------------------------------------- addresses */

export async function fetchAddresses(userId: string): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export function useAddresses() {
  const { user } = useSession();
  return useQuery({
    queryKey: qk.addresses(user?.id),
    queryFn: () => fetchAddresses(user!.id),
    enabled: Boolean(user),
  });
}

function toRow(values: AddressInput) {
  return {
    label: values.label,
    recipient: values.recipient,
    phone: values.phone,
    postal_code: values.postalCode,
    address1: values.address1,
    address2: values.address2,
    is_default: values.isDefault,
  };
}

/** Form values for editing a saved address (AddressForm `defaultValues`). */
export function toAddressFormInput(address: Address): AddressFormInput {
  return {
    label: address.label,
    recipient: address.recipient,
    phone: address.phone,
    postalCode: address.postal_code,
    address1: address.address1,
    address2: address.address2,
    isDefault: address.is_default,
  };
}

/** The first saved address becomes the default; a trigger clears the previous default. */
export async function createAddress(
  userId: string,
  values: AddressInput,
  isFirst: boolean,
): Promise<Address> {
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...toRow(values), is_default: values.isDefault || isFirst, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAddress(id: string, values: AddressInput): Promise<void> {
  const { error } = await supabase.from('addresses').update(toRow(values)).eq('id', id);
  if (error) throw error;
}

export async function setDefaultAddress(id: string): Promise<void> {
  const { error } = await supabase.from('addresses').update({ is_default: true }).eq('id', id);
  if (error) throw error;
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) throw error;
}
