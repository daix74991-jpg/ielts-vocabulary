const fs=require('node:fs');
require('esbuild').buildSync({entryPoints:['sync-client-entry.mjs'],bundle:true,format:'esm',platform:'browser',minify:true,outfile:fs.existsSync('dist/index.html')?'dist/supabase-client.js':'supabase-client.js'});
