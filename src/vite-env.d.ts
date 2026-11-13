/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_GOSSOKO_REVIEW_PREMODERATION?: string;
}

// MapLibre's CSP build (no blob: worker; the worker is a same-origin file). Same API as 'maplibre-gl'.
declare module 'maplibre-gl/dist/maplibre-gl-csp' {
  import * as maplibregl from 'maplibre-gl';
  export default maplibregl;
}
