import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
});
