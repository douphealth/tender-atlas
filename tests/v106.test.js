import test from 'node:test';
import assert from 'node:assert/strict';
import app,{VERSION,cpvMatches,formatCpvWithCheckDigit,mapSamType,buildCitedDossier,makeIcs} from '../public/_worker.js';

test('Version and app-shell backend work without external credentials',async()=>{
 assert.equal(VERSION,'10.6.0');
 const r=await app.fetch(new Request('https://tender-atlas.pages.dev/api/health'),{},{});
 assert.equal(r.status,200);
 const a=await r.json();
 assert.equal(a.ok,true);
 for(const k of ['cloudAccounts','subscriptions','automaticEmails','aiGeneratedAssessments']) assert.equal(a.features[k],false);
});

test('Sector CPV family and exact matches are distinguishable',()=>{
 assert.equal(cpvMatches('72262000','72000000','family'),true);
 assert.equal(cpvMatches('72262000','72000000','exact'),false);
 assert.equal(cpvMatches('12345678','72000000'),false);
});

test('Greek CPV check digits are validated',()=>{
 assert.equal(formatCpvWithCheckDigit('34327200'),'34327200-7');
 assert.equal(formatCpvWithCheckDigit('34327200-0'),null);
});

test('Calendar endpoint rejects invalid dates and sanitizes line injection',async()=>{
 const bad=makeIcs(new URL('https://example.com/api/ics?deadline=2026-02-30'));
 assert.equal(bad.status,400);
 const good=makeIcs(new URL('https://example.com/api/ics?deadline=2026-11-30&title=Test%0AX-HOST%3A1&url=https%3A%2F%2Fexample.com%2Fnotice'));
 assert.equal(good.status,200);
 const text=await good.text();
 assert.match(text,/SUMMARY:Tender Deadline/);
 assert.doesNotMatch(text,/\r\nX-HOST/);
});

test('Dossiers never claim verified evidence or eligibility from user-supplied metadata',()=>{
 const r=buildCitedDossier({title:'Unverified',source:'ted',stage:'competition',status:'active'});
 assert.equal(r.sourceVerified,false);
 assert.equal(r.assessmentType,'unverified-metadata-summary');
 assert.equal(r.verifiedEligibility,'unknown');
});

test('Unsupported backend paths return 404 rather than pretending accounts or billing exist',async()=>{
 const r=await app.fetch(new Request('https://example.com/api/auth/me'),{},{});
 assert.equal(r.status,404);
});

test('Static pages delegate to the Cloudflare ASSETS binding',async()=>{
 let called=false;
 const result=await app.fetch(new Request('https://example.com/methodology.html'),{ASSETS:{fetch:async(req)=>{called=true;return new Response('ok')}}},{});
 assert.equal(called,true);
 assert.equal(await result.text(),'ok');
});
