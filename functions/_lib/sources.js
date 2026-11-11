/**
 * Procurement source adapters.
 * Every item is derived from an official publisher; missing fields stay null.
 * Publication ≠ currently open bidding. Client must not infer eligibility.
 */
import { HttpError, limitStr } from './http.js';

const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
const GREEK_URL = 'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice';
const UK_URL = 'https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages';
const SAM_URL = 'https://api.sam.gov/opportunities/v2/search';
const SOURCE_TIMEOUT_MS = 10000;
const UK_SCAN_PAGES = 3;
const PAGE_SIZE = 20;
const COUNTRY_NAMES = {
  GRC:'Greece',DEU:'Germany',FRA:'France',ITA:'Italy',ESP:'Spain',PRT:'Portugal',
  NLD:'Netherlands',BEL:'Belgium',AUT:'Austria',SWE:'Sweden',FIN:'Finland',
  DNK:'Denmark',POL:'Poland',IRL:'Ireland',CYP:'Cyprus',MLT:'Malta',ROU:'Romania',
  BGR:'Bulgaria',CZE:'Czechia',SVK:'Slovakia',SVN:'Slovenia',HRV:'Croatia',
  HUN:'Hungary',EST:'Estonia',LVA:'Latvia',LTU:'Lithuania',LUX:'Luxembourg',
  GBR:'United Kingdom',USA:'United States',
};
const EU_COUNTRIES = new Set(Object.keys(COUNTRY_NAMES).filter(c=>!['GBR','USA'].includes(c)));
export const countries = COUNTRY_NAMES;
export const sources = Object.freeze({
  ted:{name:'EU · TED',publisher:'Publications Office of the European Union',url:'https://ted.europa.eu/',mode:'search'},
  khmdhs:{name:'Greece · ΚΗΜΔΗΣ',publisher:'Ελληνική Δημοκρατία',url:'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/help',mode:'search'},
  uk:{name:'UK · Find a Tender',publisher:'UK Cabinet Office',url:'https://www.find-tender.service.gov.uk/',mode:'bounded-feed'},
  sam:{name:'USA · SAM.gov',publisher:'US General Services Administration',url:'https://sam.gov/',mode:'key-required'},
});

export function validateSearch(input={}) {
  const q=limitStr(input.q,80).replace(/[\u0000-\u001f\u007f]/g,'').trim();
  const country=limitStr(input.country,3).toUpperCase();
  if(country&&!COUNTRY_NAMES[country])throw new HttpError(400,'Unsupported country');
  const source=limitStr(input.source,16)||'all';
  if(!['all',...Object.keys(sources)].includes(source))throw new HttpError(400,'Unsupported source');
  const days=Math.min(90,Math.max(7,Number.parseInt(input.days,10)||30));
  const page=Math.min(10,Math.max(1,Number.parseInt(input.page,10)||1));
  return {q,country,source,days,page};
}

function first(v) {
  if(v==null)return null;
  if(typeof v==='string'||typeof v==='number')return String(v);
  if(Array.isArray(v))return v.map(first).find(Boolean)||null;
  if(typeof v==='object'){
    for(const k of ['eng','en','ell','el','value','name','amount']){
      if(Object.prototype.hasOwnProperty.call(v,k)){const f=first(v[k]);if(f)return f;}
    }
    return Object.values(v).map(first).find(Boolean)||null;
  }
  return null;
}
function iso(v){
  const s=first(v);
  if(!s)return null;
  const m=String(s).match(/(?:^|[^\d])(\d{4})-(\d{2})-(\d{2})(?!\d)/);
  const date=m?m[0]:/^\d{8}$/.test(s)?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`:null;
  if(!date)return null;
  const d=new Date(date+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date?date:null;
}
function money(v){
  const s=first(v);
  const n=typeof v==='number'?v:s==null?NaN:Number(String(s).replace(/,/g,''));
  return Number.isFinite(n)&&n>=0?n:null;
}
function codes(v){
  const a=Array.isArray(v)?v:v?[v]:[];
  return [...new Set(a.map(x=>(x&&typeof x==='object'&&!Array.isArray(x))?(x.key||x.id||x.code||first(x)):first(x))
    .filter(Boolean).flatMap(x=>String(x).match(/\b\d{8}(?:-\d)?\b/g)||[]).map(x=>x.slice(0,8)))].slice(0,20);
}
const today=()=>new Date().toISOString().slice(0,10);
const daysAgo=(days)=>new Date(Date.now()-days*86400000).toISOString().slice(0,10);
const dateCode=s=>s.replaceAll('-','');
const utcDateToUs=s=>{const [y,m,d]=s.split('-');return `${m}/${d}/${y}`;};
function deadlineState(d,cancelled=false){return cancelled?'cancelled':d&&d<today()?'expired':d?'deadline-listed':'unverified';}
function sourceLink(url,hostname){try{let p=new URL(url);return p.protocol==='https:'&&(p.hostname===hostname||p.hostname.endsWith('.'+hostname))?p.href:null;}catch{return null;}}

async function remote(url,init={},fetchFn=fetch){
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),SOURCE_TIMEOUT_MS);
  try{
    const r=await fetchFn(url,{...init,signal:ctl.signal,headers:{accept:'application/json',...(init.headers||{})}});
    if(!r.ok)throw new HttpError(502,`Official source returned HTTP ${r.status}`);
    return await r.json();
  }catch(e){if(e.name==='AbortError')throw new HttpError(504,'Official source timed out');throw e;}
  finally{clearTimeout(timer);}
}

export function normalizeTed(n){
  const id=first(n['publication-number']);
  if(!id||!/^\d{1,9}-\d{4}$/.test(id))return null;
  const deadline=iso(n.deadline||n['deadline-receipt-tender']||n['deadline-receipt-request']);
  const country=first(n['buyer-country'])||'';
  return {
    id:`ted:${id}`,source:'ted',sourceLabel:sources.ted.name,reference:id,
    title:first(n['notice-title'])||first(n['title-proc'])||'Untitled notice',
    buyer:first(n['buyer-name'])||'Buyer not stated',country,countryName:COUNTRY_NAMES[country]||country||'Not specified',
    published:iso(n['publication-date']),deadline,
    budget:money(n['total-value']),currency:first(n['total-value-cur'])||'EUR',cpv:codes(n['classification-cpv']),
    status:deadlineState(deadline),url:`https://ted.europa.eu/en/notice/-/detail/${id}`,
    noticeType:first(n['notice-type']),provenance:sources.ted.publisher,
    coverage:'Published competitive notices; eligibility and deadlines require source review',
    updatedAt:new Date().toISOString(),amended:false,sourceDetailUrl:null,
  };
}
export async function searchTed(p,fetchFn=fetch){
  if(p.country&&!EU_COUNTRIES.has(p.country))return {items:[],total:0,coverage:'EU-covered markets only',nextPage:false};
  // Only procurement announcements, not awards. This is still not proof bidding is open.
  const filters=[`publication-date>=${dateCode(daysAgo(p.days))}`,
    'notice-type IN (cn-standard cn-social cn-desg qu-sy pin-cfc-standard pin-cfc-social)'];
  if(p.country)filters.push(`buyer-country=${p.country}`);
  if(p.q){
    const safe=p.q.replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();
    if(safe)filters.push(`FT ~ ("${safe}")`);
  }
  const payload={query:filters.join(' AND ')+' SORT BY publication-date DESC',
    fields:['publication-number','notice-title','buyer-name','buyer-country','publication-date',
      'classification-cpv','total-value','total-value-cur','deadline','notice-type','title-proc'],
    page:p.page,limit:PAGE_SIZE,scope:'ALL',paginationMode:'PAGE_NUMBER'};
  const r=await remote(TED_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)},fetchFn);
  if(!Array.isArray(r.notices))throw new HttpError(502,'TED returned an unexpected format');
  const total=Number.isFinite(Number(r.totalNoticeCount))?Number(r.totalNoticeCount):null;
  return {items:r.notices.map(normalizeTed).filter(Boolean),total,
    coverage:'Recent published competitive notices; not a live eligibility check',
    nextPage:total!=null?p.page*PAGE_SIZE<Math.min(total,15000):r.notices.length===PAGE_SIZE,
    pagesScanned:1,exhaustive:false};
}

export function normalizeKhmdhs(n){
  const id=first(n.referenceNumber);
  if(!id||!/^[A-Za-z0-9-]{6,35}$/.test(id))return null;
  const deadline=iso(n.finalSubmissionDate);
  const rawcpv=Array.isArray(n.objectDetails)?n.objectDetails.flatMap(x=>x.cpvs||[]):[];
  return {
    id:`khmdhs:${id}`,source:'khmdhs',sourceLabel:sources.khmdhs.name,reference:id,
    title:first(n.title)||'Χωρίς τίτλο',buyer:first(n.organization)||'Δεν αναφέρεται',
    country:'GRC',countryName:'Greece',published:iso(n.submissionDate||n.publishedDate||n.signedDate),
    deadline,budget:money(n.budget??n.totalCostWithoutVAT),currency:'EUR',cpv:codes(rawcpv),
    status:deadlineState(deadline,Boolean(n.cancelled)),
    url:`https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice/attachment/${encodeURIComponent(id)}`,
    sourceDetailUrl:sourceLink(n.biddingWebsite,'eprocurement.gov.gr'),
    noticeType:first(n.noticeType),provenance:sources.khmdhs.publisher,
    coverage:'Greek public notices; publisher updates the open-data register daily',
    updatedAt:iso(n.lastUpdateDate)||new Date().toISOString(),amended:Boolean(n.amendPreviousNotice||n.amendsNoticeRefNo?.length),
  };
}
export async function searchKhmdhs(p,fetchFn=fetch){
  if(p.country&&p.country!=='GRC')return {items:[],total:0,coverage:'Greece only',nextPage:false};
  const criteria={dateFrom:daysAgo(p.days),dateTo:today()};
  if(p.q)criteria.title=p.q.slice(0,80);
  const r=await remote(`${GREEK_URL}?page=${p.page-1}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(criteria)},fetchFn);
  if(!Array.isArray(r.content))throw new HttpError(502,'ΚΗΜΔΗΣ returned an unexpected format');
  return {items:r.content.map(normalizeKhmdhs).filter(Boolean),total:Number.isFinite(Number(r.totalElements))?Number(r.totalElements):null,
    coverage:'Greek public notices; includes amended, cancelled and expired entries',nextPage:!r.last,pagesScanned:1,exhaustive:!!r.last};
}

export function normalizeUk(release){
  const ocid=first(release.ocid),id=first(release.id);
  if(!ocid||!id)return null;
  const t=release.tender||{},deadline=iso(t.tenderPeriod?.endDate);
  const buyerParty=Array.isArray(release.parties)?release.parties.find(x=>x.roles?.includes('buyer')):null;
  const cpvs=Array.isArray(t.items)?t.items.flatMap(x=>(x.additionalClassifications||[]).map(y=>y.id).concat(x.classification?.id||[])):[];
  const noticeRef=(id.match(/\d{6}-\d{4}/)||[])[0];
  return {
    id:`uk:${id}`,source:'uk',sourceLabel:sources.uk.name,reference:id,
    title:first(t.title)||'Untitled procurement',buyer:first(buyerParty?.name)||first(release.buyer?.name)||'Buyer not stated',
    country:'GBR',countryName:'United Kingdom',published:iso(release.date),deadline,
    budget:money(t.value?.amount),currency:first(t.value?.currency)||'GBP',cpv:codes(cpvs),
    status:deadlineState(deadline,t.status==='cancelled'),
    url:noticeRef?`https://www.find-tender.service.gov.uk/Notice/${noticeRef}`:sources.uk.url,
    noticeType:(release.tag||[]).join(', '),provenance:sources.uk.publisher,
    coverage:'Bounded sample of recent tender releases, not full UK search coverage',
    updatedAt:new Date().toISOString(),amended:Array.isArray(release.tag)&&release.tag.includes('tenderAmendment'),sourceDetailUrl:null,
  };
}
function validUkNext(url){
  try{const u=new URL(url,UK_URL);return u.protocol==='https:'&&u.hostname==='www.find-tender.service.gov.uk'&&u.pathname==='/api/1.0/ocdsReleasePackages'?u.href:null;}
  catch{return null;}
}
export async function searchUk(p,fetchFn=fetch){
  if(p.country&&p.country!=='GBR')return {items:[],total:0,coverage:'UK only',nextPage:false};
  // A bounded scan keeps cost predictable and makes incomplete coverage explicit.
  // UK cursor links may point to older releases; never follow off-domain URLs.
  let next=`${UK_URL}?updatedFrom=${encodeURIComponent(daysAgo(Math.min(p.days,30))+'T00:00:00')}&limit=50`;
  const seen=new Map();let scanned=0,hasMore=false;
  while(next&&scanned<(p.q?UK_SCAN_PAGES:2)&&seen.size<40){
    const r=await remote(next,{},fetchFn);
    if(!Array.isArray(r.releases))throw new HttpError(502,'UK source returned an unexpected format');
    scanned++;
    for(const record of r.releases){
      if((record.tag||[]).some(x=>x==='award'||x==='contract'||x==='contractUpdate'||x==='awardUpdate'))continue;
      const notice=normalizeUk(record);
      if(!notice)continue;
      if(p.q&&!`${notice.title} ${notice.buyer} ${notice.cpv.join(' ')}`.toLocaleLowerCase().includes(p.q.toLocaleLowerCase()))continue;
      seen.set(notice.id,notice);
    }
    next=validUkNext(r.links?.next);
  }
  hasMore=Boolean(next);
  // UK is a recent-release scan, not arbitrary-result pagination.
  return {items:[...seen.values()],total:null,pagesScanned:scanned,
    coverage:`Latest ${scanned} UK release page${scanned===1?'':'s'} scanned; ${hasMore?'more releases exist':'pagination ended'}; not exhaustive search`,
    nextPage:false,exhaustive:!hasMore};
}

export function normalizeSam(n){
  const id=first(n.noticeId);
  if(!id||!/^[-a-zA-Z0-9]{8,80}$/.test(id))return null;
  const deadline=iso(n.reponseDeadLine||n.responseDeadLine);
  const posted=iso(n.postedDate);
  const type=first(n.type)||'';
  const archived=String(n.active).toLowerCase()==='no';
  return {
    id:`sam:${id}`,source:'sam',sourceLabel:sources.sam.name,reference:first(n.solicitationNumber)||id,
    title:first(n.title)||'Untitled opportunity',buyer:first(n.fullParentPathName)||'Agency not stated',
    country:'USA',countryName:'United States',published:posted,deadline,budget:null,currency:'USD',cpv:[],
    naics:first(n.naicsCode)||null,noticeType:type,status:archived?'archived':deadlineState(deadline),
    url:'https://sam.gov/search/?index=opp',provenance:sources.sam.publisher,
    coverage:'Latest SAM.gov published opportunity versions (API-key access required)',updatedAt:new Date().toISOString(),
    amended:false,sourceDetailUrl:null,
  };
}
export async function searchSam(p,fetchFn=fetch,apiKey=''){
  if(p.country&&p.country!=='USA')return {items:[],total:0,coverage:'United States only',nextPage:false};
  if(!apiKey)throw new HttpError(503,'SAM.gov requires a server-side API key; source not enabled');
  const dateFrom=utcDateToUs(daysAgo(p.days)),dateTo=utcDateToUs(today());
  const query=new URLSearchParams({api_key:apiKey,postedFrom:dateFrom,postedTo:dateTo,limit:String(PAGE_SIZE),offset:String((p.page-1)*PAGE_SIZE)});
  // No unbounded text mining: the source supports server-side title filtering.
  if(p.q)query.set('title',p.q);
  const r=await remote(`${SAM_URL}?${query.toString()}`,{},fetchFn);
  if(!Array.isArray(r.opportunitiesData))throw new HttpError(502,'SAM.gov returned an unexpected format');
  const total=Number.isFinite(Number(r.totalRecords))?Number(r.totalRecords):null;
  return {items:r.opportunitiesData.filter(n=>!['Award Notice'].includes(n.type)).map(normalizeSam).filter(Boolean),total,
    coverage:'Latest published SAM.gov opportunities; response date and eligibility must be verified',
    nextPage:total!=null?p.page*PAGE_SIZE<total:r.opportunitiesData.length===PAGE_SIZE,pagesScanned:1,exhaustive:false};
}

export async function searchSources(input,fetchFn=fetch,options={}){
  const p=validateSearch(input),samEnabled=Boolean(options.samApiKey);
  const selected=p.source==='all'
    ?p.country==='GRC'?['ted','khmdhs']
    :p.country==='GBR'?['uk']
    :p.country==='USA'?(samEnabled?['sam']:[])
    :p.country?['ted']
    :['ted','khmdhs','uk',...(samEnabled?['sam']:[])]
    :[p.source];
  if(!selected.length)return {items:[],sourceMeta:[],sourceErrors:[],partial:false,shown:0,queriedAt:new Date().toISOString(),
    coverage:'No enabled official feed for this market',disclaimer:'SAM.gov US search requires a configured API key.'};
  const map={ted:searchTed,khmdhs:searchKhmdhs,uk:searchUk,sam:(args,ff)=>searchSam(args,ff,options.samApiKey)};
  const settled=await Promise.allSettled(selected.map(s=>map[s](p,fetchFn)));
  const sourceErrors=[],sourceMeta=[],items=[];
  settled.forEach((r,i)=>{
    const source=selected[i];
    if(r.status==='fulfilled'){
      items.push(...r.value.items);
      sourceMeta.push({source,count:r.value.items.length,total:r.value.total,coverage:r.value.coverage,
        nextPage:r.value.nextPage,pagesScanned:r.value.pagesScanned||1,exhaustive:r.value.exhaustive===true});
    }else{
      const reason=r.reason instanceof HttpError?r.reason.message:'Source temporarily unavailable';
      sourceErrors.push({source,reason});
    }
  });
  if(settled.every(r=>r.status==='rejected'))throw new HttpError(502,'All official sources are currently unavailable');
  const unique=new Map();
  for(const n of items){
    // A release can be republished, retain latest record by its stable publisher ID.
    if(!unique.has(n.id)||String(n.updatedAt||'')>String(unique.get(n.id)?.updatedAt||''))unique.set(n.id,n);
  }
  const sorted=[...unique.values()].sort((a,b)=>(b.published||'').localeCompare(a.published||''));
  return {items:sorted,sourceMeta,sourceErrors,partial:sourceErrors.length>0,shown:sorted.length,
    queriedAt:new Date().toISOString(),disclaimer:'Discovery only. Publication is not proof that bidding remains open; verify every source document, amendment, eligibility and deadline.'};
}
