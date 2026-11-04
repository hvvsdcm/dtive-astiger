import { useOutletContext } from 'react-router';

export type AccountOutletContext = {
  /**
   * Signs out on purpose (logout, account deletion) and goes to `to`. Without it the layout would
   * treat the lost session as an expiry and send the user to the login page.
   */
  leave: (to: string) => Promise<void>;
};

export function useAccountOutlet(): AccountOutletContext {
  return useOutletContext<AccountOutletContext>();
}
