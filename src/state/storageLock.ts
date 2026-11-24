export async function withStorageLock<T>(name: string, commit: () => T): Promise<T> {
  if (!navigator.locks) return commit();

  let acquired = false;
  try {
    return await navigator.locks.request(name, () => {
      acquired = true;
      return commit();
    });
  } catch (error) {
    if (acquired) throw error;
    return commit();
  }
}
