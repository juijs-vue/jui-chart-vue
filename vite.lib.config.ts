import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Library build: produces dist-lib/{jui-chart-vue.umd.js,jui-chart-vue.es.js,style.css}.
// UMD is the format www.jui-vue.io's play/chart demos actually consume (plain <script> tag,
// global `window.JuiChartVue`, same pattern the old per-type-component build used) - no
// `vite-plugin-dts` here since a plain-JS consumer has no use for declaration files; type-checking
// still runs via `tsc -p tsconfig.lib.json --noEmit` in the `build:lib` script before this bundles.
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  // `Chart.vue`'s default icon font path is built from `import.meta.env.BASE_URL` (this value),
  // resolved at build time - without it, that default is bare `/fonts/...`, which 404s (not in
  // www.jui-vue.io's asset allowlist, and the wrong path regardless). This bundle is actually
  // deployed at `lib/jui-chart-vue/`, with `fonts/*` copied there by hand from this project's own
  // `public/fonts/` (see this project's own deploy notes) - matching that real path here makes
  // the default resolve to `/lib/jui-chart-vue/fonts/...`, where those files actually live.
  base: '/lib/jui-chart-vue/',
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: new URL('src/index.ts', import.meta.url).pathname,
      name: 'JuiChartVue',
      fileName: (format) => `jui-chart-vue.${format}.js`,
      formats: ['umd', 'es'],
    },
    rollupOptions: {
      // jui-graph-ts external too, not just vue: this package's own registerBrush/registerWidget/
      // etc calls (setup.ts's side-effect imports) mutate jui-graph-ts's own module-level registry
      // object - bundling a private copy of jui-graph-ts in here would give consumers who ALSO
      // import jui-graph-ts directly (e.g. to register their own custom brush/widget types, or to
      // use its Core/util exports) a SEPARATE registry instance from the one this package's own
      // <Chart>/Builder actually reads from, so anything registered through the consumer's copy
      // would silently never be found - confirmed as a real bug (not just a theoretical hazard):
      // www.jui-vue.io's gallery/gps and gallery/svgpen demos register their own custom widgets
      // this way, and calling registerWidget from a fresh `jui-graph-ts` import (correctly, per its
      // own public API) had zero effect until this package started sharing the same instance.
      external: ['vue', 'jui-graph-ts'],
      output: {
        exports: 'named',
        globals: { vue: 'Vue', 'jui-graph-ts': 'JuiGraphTs' },
        assetFileNames: (asset) => (asset.names?.[0]?.endsWith('.css') ? 'style.css' : 'assets/[name][extname]'),
      },
    },
  },
})
