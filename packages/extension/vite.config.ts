import { defineConfig, build } from 'vite'
import { resolve } from 'path'
import preact from '@preact/preset-vite'

const aliasConfig = {
  'chromium-bidi/lib/cjs/bidiMapper/BidiMapper.js': resolve(
    __dirname,
    'stubs/chromium-bidi.js'
  ),
  ws: resolve(__dirname, 'stubs/ws.js'),
  '@puppeteer/browsers': resolve(__dirname, 'stubs/browsers.js'),
}

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/popup.tsx'),
      output: {
        entryFileNames: 'popup.js',
        assetFileNames: '[name][extname]',
        format: 'es',
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: aliasConfig,
  },
  plugins: [
    preact(),
    {
      name: 'build-background',
      closeBundle: async () => {
        await build({
          configFile: false,
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, 'src/background.ts'),
              formats: ['es'],
              fileName: () => 'background.js',
            },
          },
        })
      },
    },
  ],
})
