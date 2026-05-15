// usePresence is disabled — the user_presence table does not exist.
// Keeping the hook as a no-op so existing imports don't break.

export const usePresence = () => {
  return { updatePresence: async (_isOnline: boolean) => {} };
};
