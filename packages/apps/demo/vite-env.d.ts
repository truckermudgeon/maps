/// <reference types="vite/client" />

interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_TILE_ROOT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
