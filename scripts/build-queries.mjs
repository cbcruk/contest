// Bundles the page-side query helper into a single IIFE. The main process
// reads the output as a string and evaluates it inside the page.
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

await build({
  entryPoints: [path.join(root, 'src/page/queries.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: path.join(root, 'dist/page/queries.js'),
})
