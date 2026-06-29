/// <reference types="vite/client" />

declare module "*.png" {
  const src: string;
  export default src;
}

interface Window {
  storage: {
    get: (key: string, shared: boolean) => Promise<{ value: string } | null>;
    set: (key: string, value: string, shared: boolean) => Promise<boolean>;
  };
}
