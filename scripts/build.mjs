import { cp, rm, mkdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
for (const file of ['index.html', '_worker.js', 'assets/app.js', 'assets/styles.css']) await stat(join(root,'public',file));
for (const page of ['index.html', 'methodology.html', 'privacy.html']) {
  const html = await readFile(join(root,'public',page),'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g)].map(m=>m[1]);
  if (!refs.length) throw new Error(`${page} has no local asset references`);
  for (const asset of refs) await stat(join(root,'public',asset.slice(1)));
}
await rm(join(root,'dist'),{recursive:true,force:true});
await mkdir(join(root,'dist'),{recursive:true});
await cp(join(root,'public'),join(root,'dist'),{recursive:true});
console.log('TenderAtlas v10.6 Cloudflare Pages build complete: dist/');
