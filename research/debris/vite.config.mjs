import {defineConfig} from 'vite'
import {fileURLToPath} from 'node:url'
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'./',worker:{format:'es'},publicDir:false,server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'},build:{outDir:fileURLToPath(new URL('../../work/debris-proof/dist',import.meta.url)),emptyOutDir:true,target:'es2022'}})
