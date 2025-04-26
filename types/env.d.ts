// types/env.d.ts
declare namespace NodeJS {
    interface ProcessEnv {
      MISSKEY_BASE_URL: string;
      MISSKEY_TOKEN: string;
    }
  }