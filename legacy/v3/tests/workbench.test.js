import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeEvidence,publicationSeries,topBuyers,readStages,pipelineCounts,normalizeLocalProfile} from '../public/assets/workbench.js';
test('completeness is based on returned items, missing data stays missing',()=>{
 const a=[{source:'ted',country:'GRC',deadline:'2026-11-18',budget:100,cpv:['72000000']},{source:'ted',country:'GRC',budget:null,cpv:[]}];const s=summarizeEvidence(a);
 assert.deepEqual([s.total,s.deadlines,s.values,s.cpv,s.sources,s.markets],[2,1,1,1,1,1]);assert.equal(s.ratio(s.values),50);
 assert.equal(summarizeEvidence([]).ratio(0),0);
});
test('publication trend includes days without publications, not fake forecasts',()=>{
 const days=publicationSeries([{published:'2026-11-09'},{published:'2026-11-09'},{published:'2026-11-07'}],4,new Date('2026-11-10T12:00:00Z'));
 assert.deepEqual(days.map(x=>x.count),[1,0,2,0]);
});
test('buyers derive directly from source values',()=>{
 assert.deepEqual(topBuyers([{buyer:'Authority A'},{buyer:'Authority B'},{buyer:'Authority A'},{buyer:'Buyer not stated'}]),[{name:'Authority A',count:2},{name:'Authority B',count:1}]);
});
test('guest stages enforce known finite state',()=>{
 assert.deepEqual(readStages({'ted:a':'bid','ted:b':'javascript:alert(1)'}),{'ted:a':'bid'});
 assert.deepEqual(pipelineCounts([{noticeId:'a'},{noticeId:'b'},{noticeId:'c'}],{a:'qualified',b:'pass'}),{all:3,review:1,qualified:1,bid:0,pass:1});
});
test('local profile clamps and validates stored user input',()=>{
 const p=normalizeLocalProfile({name:'  ACME ',description:'automation',keywords:[' software ','software',''],countries:['grc','xx'],cpvCodes:['72000000','notcode']});
 assert.equal(p.name,'ACME');assert.deepEqual(p.keywords,['software']);assert.deepEqual(p.countries,['GRC']);assert.deepEqual(p.cpvCodes,['72000000']);
 assert.equal(normalizeLocalProfile({}),null);
});

test('source-derived dashboard markup remains strict-CSP compatible', async()=>{
  const {readFile}=await import('node:fs/promises');
  const app=await readFile(new URL('../public/assets/app.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.equal(/\bstyle\s*=/.test(app),false,'Inline styles are blocked by the production CSP');
  assert.match(html,/atlas-v3\.css/);
  assert.doesNotMatch(html,/atlas-atelier\.css|atlas-workbench\.css/);
  assert.match(html,/id="focus-highlights"/);
  assert.match(html,/id="toggle-filters"/);
});
