import test from 'node:test';
import assert from 'node:assert/strict';
import {deadlineCategory,visibleItems,upcomingWithin,makeCsv,marketsInView} from '../public/assets/insights.js';
const rows=[
  {id:'a',country:'GRC',countryName:'Greece',source:'ted',title:'Example A',buyer:'Public Authority',published:'2026-11-08',deadline:'2026-12-15',budget:500,currency:'EUR',status:'deadline-listed',url:'https://ted.europa.eu'},
  {id:'b',country:'GBR',countryName:'United Kingdom',source:'uk',title:'Example B',buyer:'Public Authority',published:'2026-11-10',deadline:null,budget:null,currency:'GBP',status:'unverified',url:'https://www.find-tender.service.gov.uk'},
  {id:'c',country:'GRC',countryName:'Greece',source:'khmdhs',title:'=2+3',buyer:'+INJECTION',published:'2026-11-07',deadline:'2026-09-01',budget:1000,currency:'EUR',status:'expired',url:'https://cerpp.eprocurement.gov.gr'},
];
test('deadline labels never assert a contract is open',()=>{
  assert.equal(deadlineCategory(rows[0],'2026-11-11'),'upcoming');
  assert.equal(deadlineCategory(rows[1],'2026-11-11'),'unknown');
  assert.equal(deadlineCategory(rows[2],'2026-11-11'),'expired');
});
test('in-view filter and sort operate on retrieved rows only',()=>{
  assert.deepEqual(visibleItems(rows,{status:'upcoming'}).map(x=>x.id),['a']);
  assert.deepEqual(visibleItems(rows,{sort:'recent'}).map(x=>x.id),['b','a','c']);
  assert.deepEqual(visibleItems(rows,{sort:'value'}).map(x=>x.id),['c','a','b']);
  assert.equal(upcomingWithin(rows,45,'2026-11-11'),1);
});
test('CSV prevents formula injection in publisher-origin text',()=>{
  const csv=makeCsv(rows);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/"'=2\+3"/);
  assert.match(csv,/"'\+INJECTION"/);
  assert.ok(csv.includes('Official notice URL'));
});
test('market counts are computed from actual returned rows',()=>{
  assert.deepEqual(marketsInView(rows),[{name:'Greece',total:2},{name:'United Kingdom',total:1}]);
});
