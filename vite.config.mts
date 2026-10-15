import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * The paper the app sits on — `colors.paper` in src/theme.ts. Repeated as a
 * literal because this file is loaded by Node before anything in src/ can be
 * imported, and importing src/theme.ts would drag react-native in with it.
 */
const PAPER = '#EAE5DC';

/**
 * The web target. react-native-web stands in for react-native, and the
 * extension order is what makes a `.web.ts` file win over its native twin —
 * the same rule Metro applies on Android.
 */
export default defineConfig({
  resolve: {
    // Exact match only. A bare-string alias is a *prefix* rewrite, so every
    // `react-native/Libraries/...` deep import inside react-native-gesture-
    // handler and react-native-safe-area-context would be sent to
    // `react-native-web/Libraries/...`, a tree that does not exist.
    alias: [{ find: /^react-native$/, replacement: 'react-native-web' }],
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
  },
  define: {
    global: 'window',
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  optimizeDeps: {
    // These three ship native-only files that import `react-native/Libraries/
    // ...` deep paths. The production build never requests them, but the dev
    // optimizer pre-bundles the whole package and chokes on the Flow source
    // behind those paths, so they are served as source instead.
    exclude: [
      'react-native-gesture-handler',
      'react-native-safe-area-context',
      'react-native-screens',
    ],
  },
  plugins: [
    react(),
    VitePWA({
      /*
       * `prompt`, not `autoUpdate`: a memo must never be reloaded out from
       * under a keystroke, and `autoUpdate` reloads the page the moment a new
       * worker takes over. Nothing in the app asks to update, so a new version
       * simply waits and takes effect the next time the app is fully closed —
       * the right trade for a personal app whose owner is also its developer.
       */
      registerType: 'prompt',
      // Registration lives in web/main.tsx; the plugin must not inject one.
      injectRegister: null,
      manifest: {
        name: '变位法典',
        short_name: '变位法典',
        description:
          'Carnet de conjugaison française — 手填的法语变位备忘录，查看为主、遮盖式自测为辅。',
        // The chrome and the notebook's own voice are French; the app's name is not.
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // The splash screen should dissolve into the app rather than flash.
        background_color: PAPER,
        theme_color: PAPER,
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // The shell, the fonts and the icons. Everything in `public/` lands in
        // dist as-is, so this one pattern covers it; the plugin additionally
        // lists the manifest and its icons, which duplicates five entries in
        // the generated precache list — harmless, and workbox keys them by URL.
        globPatterns: ['**/*.{js,css,html,ttf,ico,png,webmanifest}'],
        // There is no routing, but the app is reachable as `/?v=4` (and as any
        // future deep link), and workbox does not match a precached entry
        // across an unknown query string — so navigations to the root fall back
        // to the precached shell. The allowlist keeps every other path honest:
        // a wrong URL 404s both online and offline, instead of quietly
        // rendering the app for one of them.
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/$/],
      },
    }),
  ],
  build: { outDir: 'dist', emptyOutDir: true },
});
