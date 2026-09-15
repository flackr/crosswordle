import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Ensures asset paths are generated relative to the index.html
  base: './',

  build: {
    sourcemap: true,
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
