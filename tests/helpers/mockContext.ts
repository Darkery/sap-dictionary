export function makeMockContext(extensionPath = '/nonexistent') {
  const store = new Map<string, unknown>();
  return {
    extensionPath,
    globalState: {
      get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
      update: async (key: string, value: unknown): Promise<void> => {
        if (value === undefined) store.delete(key);
        else store.set(key, value);
      },
    },
  };
}
