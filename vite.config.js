import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/sitn-product-search.ts',
      name: 'SitnProductSearch',
      fileName: (format) => `sitn-product-search.${format}.js`
    },
  }
});