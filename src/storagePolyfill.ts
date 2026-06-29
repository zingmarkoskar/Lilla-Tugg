if (!window.storage) {
  window.storage = {
    async get(key: string) {
      const value = localStorage.getItem(key);
      return value !== null ? { value } : null;
    },
    async set(key: string, value: string) {
      localStorage.setItem(key, value);
      return true;
    },
  };
}
