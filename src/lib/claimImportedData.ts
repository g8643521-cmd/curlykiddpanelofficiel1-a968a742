import { supabase } from '@/lib/supabase';

let claimPromise: Promise<void> | null = null;
let claimedUserId: string | null = null;

export async function claimImportedDataForCurrentUser(userId?: string) {
  const activeUserId = userId ?? (await supabase.auth.getSession()).data.session?.user.id;

  if (!activeUserId || claimedUserId === activeUserId) {
    return;
  }

  if (!claimPromise) {
    claimPromise = supabase.functions
      .invoke('claim-imported-data', { body: {} })
      .then(({ error }) => {
        if (error) {
          throw error;
        }

        claimedUserId = activeUserId;
      })
      .catch((error) => {
        console.error('claim-imported-data invoke failed:', error);
      })
      .finally(() => {
        claimPromise = null;
      });
  }

  await claimPromise;
}
