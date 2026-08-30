import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Ensures asset paths are generated relative to the index.html,
  // which is often safer for static deployments unless you use custom routing.
  base: './',

  build: {
    // 'dist' is the default output directory, but making it explicit
    // here ensures clarity for your Cloudflare Pages configuration.
    outDir: 'dist',
  },

  plugins: [
    viteStaticCopy({
      targets: [
        // This copies the contents of src/lang to dist/src/lang
        {
          src: 'src/lang',
          dest: ''
        },
        // This copies the contents of src/puzzles to dist/src/puzzles
        {
          src: 'src/puzzles',
          dest: ''
        },
        {
          src: 'sw.js',
          dest: '' // An empty string drops it at the root of 'dist'
        },
        {
          src: 'third_party',
          dest: ''
        }
      ]
    })
  ]
});
