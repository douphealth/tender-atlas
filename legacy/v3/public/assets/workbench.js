/** TenderAtlas workbench: analytics of the fetched sample only, never market-wide claims. */
export const PIPELINE_STAGES = Object.freeze(['review','qualified','bid','pass']);
export function summarizeEvidence(items=[]) {
  const n=items.length;
  const count=(test)=>items.reduce((sum,item)=>sum+(test(item)?1:0),0);
  const ratio=(num)=>n?Math.round(num*100/n):0;
  return {total:n,
    deadlines:count(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.deadline||'')),
    values:count(x=>x.budget!=null&&Number.isFinite(Number(x.budget))&&Number(x.budget)>=0),
    cpv:count(x=>Array.isArray(x.cpv)&&x.cpv.length>0),
    sources:new Set(items.map(x=>x.source).filter(Boolean)).size,
    markets:new Set(items.map(x=>x.country).filter(Boolean)).size,
    ratio
  };
}
export function publicationSeries(items=[],days=7,now=new Date()){
  const day=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  const buckets=[];
  for(let i=days-1;i>=0;i--){const d=new Date(day);d.setUTCDate(d.getUTCDate()-i);const date=d.toISOString().slice(0,10);buckets.push({date,count:items.filter(x=>x.published===date).length});}
  return buckets;
}
export function topBuyers(items=[],limit=5){
  const map=new Map();for(const n of items){if(!n.buyer||n.buyer==='Buyer not stated'||n.buyer==='Δεν αναφέρεται')continue;const key=String(n.buyer).trim();map.set(key,(map.get(key)||0)+1)}
  return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([name,count])=>({name,count}));
}
export function readStages(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  const out={};for(const [id,stage] of Object.entries(raw).slice(0,100)){if(typeof id==='string'&&id.length<220&&PIPELINE_STAGES.includes(stage))out[id]=stage;}
  return out;
}
export function pipelineCounts(saved=[],stages={}){
  const counts={all:saved.length,review:0,qualified:0,bid:0,pass:0};
  for(const n of saved){const stage=PIPELINE_STAGES.includes(stages[n.noticeId])?stages[n.noticeId]:'review';counts[stage]++;}
  return counts;
}
export function normalizeLocalProfile(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const clean=(v,max)=>String(v||'').trim().slice(0,max);
  const strings=(v,max,count=20)=>Array.isArray(v)?[...new Set(v.filter(x=>typeof x==='string').map(x=>clean(x,max)).filter(Boolean))].slice(0,count):[];
  const keywords=strings(input.keywords,50,20);
  const cpvCodes=strings(input.cpvCodes,8,20).filter(x=>/^\d{8}$/.test(x));
  const countries=strings(input.countries,3,32).map(x=>x.toUpperCase()).filter(x=>/^[A-Z]{3}$/.test(x));
  const name=clean(input.name,90),description=clean(input.description,1000);
  if(!name&&!description&&!keywords.length&&!cpvCodes.length&&!countries.length)return null;
  return {name,description,keywords,cpvCodes,countries};
}

/**
 * Conservative, explainable relevance evidence from publisher fields.
 * Fixed weights deliberately prevent a country-only match from scoring 100/100.
 * Not an eligibility test, award prediction or AI-generated requirement assessment.
 */
export function scoreRelevance(notice, profile) {
  if (!notice || !profile) return null;
  const keywords = [...new Set((profile.keywords||[]).filter(x=>typeof x==='string')
    .map(x=>x.trim().toLocaleLowerCase()).filter(x=>x.length>2))].slice(0,20);
  const cpvs = (profile.cpvCodes||[]).filter(x=>/^\d{8}$/.test(x)).slice(0,20);
  const markets = (profile.countries||[]).filter(x=>/^[A-Z]{3}$/.test(x));
  if (!keywords.length && !cpvs.length && !markets.length) return null;
  const description = `${notice.title||''} ${notice.buyer||''}`.toLocaleLowerCase();
  const matchedKeywords = keywords.filter(k=>description.includes(k));
  const noticeCpvs = Array.isArray(notice.cpv)?notice.cpv:[];
  const exactCpv = cpvs.some(c=>noticeCpvs.includes(c));
  const familyCpv = !exactCpv&&cpvs.some(c=>noticeCpvs.some(n=>/^\d{8}$/.test(n)&&c.slice(0,5)===n.slice(0,5)));
  const marketMatch = markets.includes(notice.country);
  let score = 0;const reasons=[];
  if(matchedKeywords.length){score+=Math.min(45,45*matchedKeywords.length/Math.min(Math.max(1,keywords.length),4));reasons.push(`Keywords: ${matchedKeywords.slice(0,2).join(', ')}`);}
  if(exactCpv){score+=35;reasons.push('Exact CPV match');}
  else if(familyCpv){score+=20;reasons.push('Related CPV family');}
  if(markets.length&&marketMatch){score+=20;reasons.push('Target market');}
  const rounded=Math.max(0,Math.min(100,Math.round(score)));
  return {score:rounded,reasons:reasons.join(' · ')||'No direct matches in the available source fields',
    evidence:{keywords:matchedKeywords.length,cpv:exactCpv?'exact':familyCpv?'related':'none',market:marketMatch},
    note:'Source-field relevance only; bidding eligibility and current status are unverified.'};
}

export function daysToListedDeadline(notice,today=new Date().toISOString().slice(0,10)){
  const deadline=notice?.deadline;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(deadline||'')||!/^\d{4}-\d{2}-\d{2}$/.test(today))return null;
  const date=Date.parse(deadline+'T00:00:00Z'),now=Date.parse(today+'T00:00:00Z');
  return Number.isFinite(date)&&Number.isFinite(now)?Math.round((date-now)/86400000):null;
}
