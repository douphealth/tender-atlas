export function signalMatch(notice,profile){
  const keywords=Array.isArray(profile.keywords)?profile.keywords.filter(x=>typeof x==='string'&&x.trim().length>=3).slice(0,20):[];
  const cpvs=Array.isArray(profile.cpvCodes)?profile.cpvCodes.filter(x=>/^\d{8}$/.test(x)).slice(0,30):[];
  const countries=Array.isArray(profile.countries)?profile.countries:[];
  if(!keywords.length&&!cpvs.length&&!countries.length)return null;
  let evidence=[],score=0,weight=0;
  if(keywords.length){const text=`${notice.title||''} ${notice.buyer||''}`.toLocaleLowerCase();const hits=keywords.filter(k=>text.includes(k.toLocaleLowerCase()));score+=Math.min(55,(hits.length/Math.max(1,Math.min(keywords.length,4)))*55);weight+=55;if(hits.length)evidence.push(`Keyword matches: ${hits.slice(0,4).join(', ')}`);}
  if(cpvs.length){const hits=(notice.cpv||[]).filter(c=>cpvs.some(code=>c.startsWith(code.slice(0,Math.min(8,code.length)))));score+=hits.length?35:0;weight+=35;if(hits.length)evidence.push(`Matching CPV: ${hits.slice(0,3).join(', ')}`);}
  if(countries.length){score+=countries.includes(notice.country)?10:0;weight+=10;if(countries.includes(notice.country))evidence.push('Country preference matches');}
  const relevance=weight?Math.round(score/weight*100):0;
  return {relevance,evidence,method:'Transparent keyword/CPV/country matching; not an eligibility decision or win probability',eligibility:'not_checked'};
}
