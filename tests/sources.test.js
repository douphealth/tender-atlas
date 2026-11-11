import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTed,normalizeKhmdhs,normalizeUk,searchSources,searchTed,searchKhmdhs,validateSearch} from '../functions/_lib/sources.js';
const fakeTed={'publication-number':'123456-2026','notice-title':{eng:['Cybersecurity consulting services']},'buyer-name':{eng:['Public Agency']},'buyer-country':'GRC','publication-date':'2026-11-08+02:00','classification-cpv':['72000000'],'total-value':'250000','total-value-cur':'EUR','deadline':'2026-12-15Z','notice-type':'cn-standard'};
test('TED mapping prioritizes provenance, stable official URL and optional facts',()=>{const n=normalizeTed(fakeTed);assert.equal(n.id,'ted:123456-2026');assert.equal(n.title,'Cybersecurity consulting services');assert.equal(n.buyer,'Public Agency');assert.equal(n.deadline,'2026-12-15');assert.equal(n.url,'https://ted.europa.eu/en/notice/-/detail/123456-2026');assert.deepEqual(n.cpv,['72000000']);assert.equal(n.budget,250000);});
test('unknown facts never receive made-up deadline or budget',()=>{const n=normalizeTed({'publication-number':'777-2026'});assert.equal(n.budget,null);assert.equal(n.deadline,null);assert.equal(n.status,'unverified');assert.equal(n.countryName,'Not specified');});
test('Greek register mapping recognizes cancellations and ADAM source identifier',()=>{const n=normalizeKhmdhs({referenceNumber:'26PROC001234567',title:'Διαγωνισμός Πληροφορικής',organization:{value:'Δήμος'},cancelled:true,finalSubmissionDate:'2026-12-15T10:30:00',budget:15000,objectDetails:[{cpvs:[{key:'72000000-5'}]}]});assert.equal(n.status,'cancelled');assert.equal(n.source,'khmdhs');assert.equal(n.budget,15000);assert.deepEqual(n.cpv,['72000000']);assert.equal(n.reference,'26PROC001234567');});
test('UK mapping only links to trusted publisher and preserves missing values',()=>{const n=normalizeUk({ocid:'ocds-123',id:'123456-2026',date:'2026-11-08T09:00:00Z',tender:{title:'Digital services',value:{amount:120000,currency:'GBP'},tenderPeriod:{endDate:'2026-12-18'}},parties:[{roles:['buyer'],name:'Department of A'}]});assert.equal(n.url,'https://www.find-tender.service.gov.uk/Notice/123456-2026');assert.equal(n.buyer,'Department of A');assert.equal(n.budget,120000);});
test('reject invalid search and restrict EU country filters',async()=>{assert.throws(()=>validateSearch({country:'__'}),/Unsupported country/);let called=0;const out=await searchTed({country:'GBR',days:30,page:1,q:''},async()=>{called++;return null;});assert.equal(out.items.length,0);assert.equal(called,0);});
test('TED query escapes punctuation and uses documented fields only',async()=>{let payload;const fakeFetch=async(_u,init)=>{payload=JSON.parse(init.body);return Response.json({notices:[fakeTed],totalNoticeCount:1});};const x=await searchTed({country:'GRC',days:30,page:1,q:'AI " OR EXISTS'},fakeFetch);assert.equal(x.total,1);assert.match(payload.query,/buyer-country=GRC/);assert.doesNotMatch(payload.query, /" OR EXISTS"/);assert.deepEqual(payload.fields.includes('notice-title'),true);});
test('Greek API uses official /notice POST body and zero-indexed pages',async()=>{let url,body;const mock=async(u,init)=>{url=u;body=JSON.parse(init.body);return Response.json({content:[{referenceNumber:'25PROC123456',title:'IT service'}],totalElements:1,last:true});};const x=await searchKhmdhs({country:'GRC',days:30,page:2,q:'IT'},mock);assert.match(url,/notice\?page=1/);assert.equal(body.title,'IT');assert.equal(x.items[0].source,'khmdhs');});
test('one source failure returns partial real data, never dummy records',async()=>{const mock=async(u)=>{if(u.includes('ted.europa'))return Response.json({notices:[fakeTed],totalNoticeCount:1});throw Error('Upstream down');};const out=await searchSources({source:'all',days:30},mock);assert.equal(out.items.length,1);assert.equal(out.partial,true);assert.equal(out.sourceErrors.length,2);assert.equal(out.items[0].id,'ted:123456-2026');});
test('all-offline official sources return an error, not fabricated content',async()=>{await assert.rejects(searchSources({source:'all'},async()=>{throw Error('offline');}),/All official sources/);});
test('unsupported US-only request does not silently show EU or UK notices',async()=>{const out=await searchSources({country:'USA'},async()=>{throw Error('should not be called');});assert.equal(out.shown,0);});

test('official ΚΗΜΔΗΣ response preserves CPV key even when localized value exists and opens exact PDF',()=>{
  const n=normalizeKhmdhs({
    referenceNumber:'26PROC009217262',title:'Προκήρυξη λογισμικού',
    organization:{key:'100015981',value:'Υπουργείο'},
    objectDetails:[{cpvs:[{key:'33131600-3',value:'Ελληνική περιγραφή'}]}],
    lastUpdateDate:'2026-11-08T10:00:00',amendPreviousNotice:true,
    finalSubmissionDate:'2026-12-28T14:00:00',budget:123000,
    biddingWebsite:'https://nepps.eprocurement.gov.gr/',
  });
  assert.deepEqual(n.cpv,['33131600']);
  assert.equal(n.buyer,'Υπουργείο');
  assert.equal(n.amended,true);
  assert.equal(n.url,'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice/attachment/26PROC009217262');
  assert.equal(n.sourceDetailUrl,'https://nepps.eprocurement.gov.gr/');
  assert.equal(n.deadline,'2026-12-28');
});

test('TED search includes official competition notice types and correct page continuation',async()=>{
  let payload;
  const mocked=async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({notices:[fakeTed],totalNoticeCount:25});};
  const out=await searchTed({country:'',days:30,page:2,q:'cloud'},mocked);
  assert.match(payload.query,/notice-type IN \(cn-standard cn-social/);
  assert.match(payload.query,/FT ~ \("cloud"\)/);
  assert.equal(payload.page,2);
  assert.equal(out.nextPage,false);
  assert.equal(out.items.length,1);
});

test('UK OCDS scan follows official next-page cursor only, deduplicates and declares limited coverage',async()=>{
  const {searchUk}=await import('../functions/_lib/sources.js');
  let calls=0;
  const release={ocid:'ocds-h6vhtk-1234',id:'123456-2026',date:'2026-11-10',tag:['tender'],
    tender:{title:'Cloud security consulting',tenderPeriod:{endDate:'2026-12-20'},value:{amount:44000,currency:'GBP'}}};
  const fetchFn=async u=>{calls++;
    if(calls===1)return Response.json({releases:[release],links:{next:'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?cursor=abc'}});
    return Response.json({releases:[release],links:{}});
  };
  const result=await searchUk({country:'GBR',days:30,page:1,q:'Cloud'},fetchFn);
  assert.equal(calls,2);assert.equal(result.pagesScanned,2);assert.equal(result.items.length,1);
  assert.equal(result.exhaustive,false);
  assert.match(result.coverage,/not exhaustive search/);
});

test('UK scanner never fetches a next cursor from an untrusted hostname',async()=>{
  const {searchUk}=await import('../functions/_lib/sources.js');let calls=0;
  const fake=async()=>{calls++;return Response.json({releases:[],links:{next:'https://attacker.example/steal'}});};
  const r=await searchUk({country:'GBR',days:30,q:'',page:1},fake);
  assert.equal(calls,1);assert.equal(r.items.length,0);
});

test('SAM.gov stays off until a server key exists, never emits credentials in source metadata',async()=>{
  const {searchSam,normalizeSam}=await import('../functions/_lib/sources.js');
  await assert.rejects(searchSam({country:'USA',days:30,q:'',page:1},async()=>{throw Error('should not call');}),/API key/);
  let requested;
  const f=async url=>{requested=new URL(url);return Response.json({totalRecords:1,opportunitiesData:[{noticeId:'abc12345-1234-5678',title:'IT Operations',active:'Yes',postedDate:'2026-11-10',reponseDeadLine:'2026-12-20'}]});};
  const data=await searchSources({source:'sam',country:'USA',page:1,days:30},f,{samApiKey:'test-only-secret'});
  assert.equal(data.items.length,1);assert.equal(requested.hostname,'api.sam.gov');
  assert.equal(requested.searchParams.get('api_key'),'test-only-secret');
  assert.equal(data.items[0].budget,null);
  assert.ok(!JSON.stringify(data).includes('test-only-secret'));
  assert.equal(normalizeSam({noticeId:'abc12345',active:'No'}).status,'archived');
});

// A release scan may consume all available cursors without representing the entire UK market.
test('UK release coverage never implies exhaustive national search', async()=>{
  const {searchUk}=await import('../functions/_lib/sources.js');
  const fetchFn=async()=>Response.json({releases:[],links:{}});
  const result=await searchUk({country:'GBR',days:30,page:1,q:''},fetchFn);
  assert.equal(result.exhaustive,false);
  assert.match(result.coverage,/not exhaustive search/);
});

test('TED ISO parser handles date fields embedded in full timestamps and non-date prefixes',async()=>{
  const {normalizeTed}=await import('../functions/_lib/sources.js');
  const base={'publication-number':'12345-2026','notice-title':'Public tender','buyer-name':'Authority','buyer-country':'DEU'};
  const n=normalizeTed({...base,'publication-date':'Published: 2026-11-10','deadline':'2026-12-31T23:59:00Z'});
  assert.equal(n.published,'2026-11-10');assert.equal(n.deadline,'2026-12-31');
});
