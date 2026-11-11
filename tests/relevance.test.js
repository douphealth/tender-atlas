import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreRelevance,daysToListedDeadline} from '../public/assets/workbench.js';
const base={title:'Cloud application development and security',buyer:'Ministry of Digital Services',country:'GRC',cpv:['72200000','72000000'],deadline:'2026-11-30'};
test('country-only relevance cannot be misrepresented as an exceptional 100/100 match',()=>{
 const score=scoreRelevance(base,{countries:['GRC'],keywords:[],cpvCodes:[]});
 assert.equal(score.score,20);assert.match(score.note,/not|unverified/i);
});
test('full evidence stacks keywords, exact CPV and market transparently',()=>{
 const score=scoreRelevance(base,{countries:['GRC'],keywords:['cloud','security'],cpvCodes:['72200000']});
 assert.equal(score.score,100);assert.equal(score.evidence.cpv,'exact');assert.match(score.reasons,/Exact CPV match/);
});
test('unobserved requirements produce no imagined fit',()=>{
 const score=scoreRelevance(base,{countries:['DEU'],keywords:['road construction'],cpvCodes:['45233120']});
 assert.equal(score.score,0);assert.match(score.reasons,/No direct matches/);
});
test('related CPV family matches less than exact code',()=>{
 const related=scoreRelevance({...base,cpv:['72212340']},{countries:[],keywords:[],cpvCodes:['72212345']});
 const exact=scoreRelevance({...base,cpv:['72212345']},{countries:[],keywords:[],cpvCodes:['72212345']});
 assert.ok(related.score<exact.score);
});
test('time-to-deadline derives solely from publisher date fields, not open status',()=>{
 assert.equal(daysToListedDeadline(base,'2026-11-11'),19);
 assert.equal(daysToListedDeadline({...base,deadline:null},'2026-11-11'),null);
 assert.equal(daysToListedDeadline({...base,deadline:'2026-11-01'},'2026-11-11'),-10);
});
