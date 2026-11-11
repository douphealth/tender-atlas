import { cp, rm, mkdir, stat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
for (const file of ['index.html', 'assets/app.js', 'assets/styles.css']) await stat(join(root,'public',file));

// Fail the release at build time if a new stylesheet/script reference was
// introduced without checking its source file into Git.
for (const page of ['index.html', 'methodology.html']) {
  const html = await readFile(join(root,'public',page),'utf8');
  const referenced = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)(?:[?#][^"]*)?"/g)]
    .map(match => match[1]);
  if (!referenced.length) throw new Error(`${page} has no local assets`);
  for (const asset of referenced) await stat(join(root,'public',asset.slice(1)));
}

await rm(join(root,'dist'),{recursive:true,force:true});
await mkdir(join(root,'dist'),{recursive:true});
await cp(join(root,'public'),join(root,'dist'),{recursive:true});
console.log('Static Pages build completed: dist/');
