import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig(({command})=>({
  root:fileURLToPath(new URL('.',import.meta.url)),
  base:'./',
  publicDir:'../public',
  envDir:'..',
  plugins:[react(),{name:'development-csp',transformIndexHtml:html=>command==='serve'?html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/,''):html}],
  resolve:{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}},
  build:{outDir:'../dist-github',emptyOutDir:true,sourcemap:false},
  server:{host:'0.0.0.0'},
}));
