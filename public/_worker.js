/** TenderAtlas Atlas OS v10.6 — Cloudflare Pages advanced-mode worker.
 * Official public sources only. The absence of an upstream field is not a license to infer it.
 */
export const VERSION = '10.6.0';
export const SOURCES = Object.freeze({
 ted:{label:'EU · TED',docs:'https://docs.ted.europa.eu/api/latest/search.html',region:'European procurement'},
 gr:{label:'GR · KIMDIS',docs:'https://cerpp.eprocurement.gov.gr/khmdhs-opendata/help',region:'Greece'},
 uk:{label:'UK · Find a Tender',docs:'https://www.find-tender.service.gov.uk/Developer/Documentation',region:'United Kingdom'},
 fr:{label:'FR · BOAMP',docs:'https://boamp-datadila.opendatasoft.com/explore/dataset/boamp/api/',region:'France'},
 wb:{label:'World Bank · Global',docs:'https://search.worldbank.org/api/v2/procnotices',region:'Global (170+ countries)',supportsCpv:false},
 sam:{label:'US · SAM.gov',docs:'https://open.gsa.gov/api/get-opportunities-public-api/',region:'United States',supportsCpv:false}
});
const TIMEOUT=8500, TTL=180, MAX_PAGE=4;

const CPV_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7];

export function cpvSignificantPrefix(cpv8){
 const s=String(cpv8||'').replace(/\D/g,'').slice(0,8);
 if(s.length<2)return '';
 const trimmed=s.replace(/0+$/,'');
 return trimmed.length>=2?trimmed:s.slice(0,2);
}
export function cpvMatches(noticeCpv,targetCpv,mode='family'){
 const n=String(noticeCpv||'').replace(/\D/g,'').slice(0,8);
 const t=String(targetCpv||'').replace(/\D/g,'').slice(0,8);
 if(!n||!t)return false;
 if(mode==='exact')return n===t;
 return n.startsWith(cpvSignificantPrefix(t));
}

export function computeCpvCheckDigit(eightDigits) {
  if (!/^\d{8}$/.test(eightDigits)) return null;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(eightDigits[i]) * CPV_WEIGHTS[i];
  return String(sum % 10);
}
export function formatCpvWithCheckDigit(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{8})(?:-(\d))?$/);
  if (!m) return null;
  const expected = computeCpvCheckDigit(m[1]);
  if (m[2] !== undefined && m[2] !== expected) return null;
  return `${m[1]}-${expected}`;
}

const ISO2_TO_ISO3 = Object.freeze({
  AF:'AFG',AL:'ALB',DZ:'DZA',AO:'AGO',AR:'ARG',AM:'ARM',AU:'AUS',AT:'AUT',AZ:'AZE',
  BD:'BGD',BY:'BLR',BE:'BEL',BJ:'BEN',BO:'BOL',BA:'BIH',BW:'BWA',BR:'BRA',BG:'BGR',
  BF:'BFA',BI:'BDI',KH:'KHM',CM:'CMR',CA:'CAN',TD:'TCD',CL:'CHL',CN:'CHN',CO:'COL',
  CD:'COD',CG:'COG',CR:'CRI',CI:'CIV',HR:'HRV',CY:'CYP',CZ:'CZE',DK:'DNK',DO:'DOM',
  EC:'ECU',EG:'EGY',SV:'SLV',EE:'EST',ET:'ETH',FI:'FIN',FR:'FRA',GE:'GEO',DE:'DEU',
  GH:'GHA',GR:'GRC',GT:'GTM',GN:'GIN',HT:'HTI',HN:'HND',HU:'HUN',IS:'ISL',IN:'IND',
  ID:'IDN',IQ:'IRQ',IE:'IRL',IL:'ISR',IT:'ITA',JM:'JAM',JP:'JPN',JO:'JOR',KZ:'KAZ',
  KE:'KEN',KR:'KOR',KW:'KWT',KG:'KGZ',LA:'LAO',LV:'LVA',LB:'LBN',LR:'LBR',LY:'LBY',
  LT:'LTU',LU:'LUX',MG:'MDG',MW:'MWI',MY:'MYS',ML:'MLI',MT:'MLT',MR:'MRT',MX:'MEX',
  MD:'MDA',MN:'MNG',ME:'MNE',MA:'MAR',MZ:'MOZ',MM:'MMR',NP:'NPL',NL:'NLD',NZ:'NZL',
  NI:'NIC',NE:'NER',NG:'NGA',MK:'MKD',NO:'NOR',OM:'OMN',PK:'PAK',PA:'PAN',PY:'PRY',
  PE:'PER',PH:'PHL',PL:'POL',PT:'PRT',QA:'QAT',RO:'ROU',RU:'RUS',RW:'RWA',SA:'SAU',
  SN:'SEN',RS:'SRB',SL:'SLE',SG:'SGP',SK:'SVK',SI:'SVN',SO:'SOM',ZA:'ZAF',SS:'SSD',
  ES:'ESP',LK:'LKA',SD:'SDN',SE:'SWE',CH:'CHE',TJ:'TJK',TZ:'TZA',TH:'THA',TG:'TGO',
  TN:'TUN',TR:'TUR',UG:'UGA',UA:'UKR',AE:'ARE',GB:'GBR',UK:'GBR',US:'USA',UY:'URY',
  UZ:'UZB',VE:'VEN',VN:'VNM',YE:'YEM',ZM:'ZMB',ZW:'ZWE'
});
export function normalizeCountry(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (!s) return null;
  if (/^[A-Z]{3}$/.test(s)) return s;
  if (/^[A-Z]{2}$/.test(s)) return ISO2_TO_ISO3[s] || null;
  return null;
}

const EMPTY='';
function text(x,max=300){
 if(x===null||x===undefined)return EMPTY;
 if(Array.isArray(x))return text(x[0],max);
 if(typeof x==='object')return text(x.eng??x.en??x.ell??x.el??x.value??x.name??Object.values(x)[0],max);
 return String(x).replace(/\s+/g,' ').trim().slice(0,max);
}
function amount(x){const v=Number(String(x??'').replace(/\s/g,''));return Number.isFinite(v)&&v>0?v:null;}
export function dateOnly(value){
 if(value===null||value===undefined)return null;
 if(Array.isArray(value)){const d=value.map(dateOnly).filter(Boolean).sort();return d[0]||null;}
 const s=text(value,90);let m=s.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})/);
 if(!m)return null;
 const y=+m[1],mo=+m[2],day=+m[3];
 const d=new Date(Date.UTC(y,mo-1,day));
 return d.getUTCFullYear()===y&&d.getUTCMonth()===mo-1&&d.getUTCDate()===day?`${m[1]}-${m[2]}-${m[3]}`:null;
}
export function cpvCodes(items){
 const out=[];function read(x){if(Array.isArray(x))return x.forEach(read);if(x&&typeof x==='object')return read(x.id??x.key??x.value??x.code??x.cpvs??'');let m=String(x??'').match(/\b\d{8}(?:-\d)?\b/g);if(m)out.push(...m);}
 read(items);return [...new Set(out)].slice(0,16);
}
function safeOfficialLink(value,hosts){try{const u=new URL(value);if(u.protocol==='https:'&&hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return u.href}catch{}return null;}
function pickLink(x){if(typeof x==='string')return x;if(!x||typeof x!=='object')return '';return x.ENG??x.eng??x.en??Object.values(x)[0]??'';}
function statusFrom(x,deadline){
 const st=String(x.status||'').toLowerCase();
 if(['awarded','cancelled','closed','inactive','disposal','deadline-passed'].includes(st))return st;
 if(deadline && deadline < new Date().toISOString().slice(0,10))return 'deadline-passed';
 return deadline?'deadline-listed':'unknown';
}

export function extractTimezone(raw){
 const s=String(raw||'').trim();
 if(!s)return null;
 if(/Z$/i.test(s))return 'UTC';
 const m=s.match(/([+-]\d{2}:?\d{2})$/);
 return m?`UTC${m[1]}`:null;
}

export function normalize(x){
 const deadline=dateOnly(x.deadline);
 return {id:text(x.id,180),noticeId:text(x.noticeId,120),source:text(x.source,10),title:text(x.title,420)||'Untitled notice',
  buyer:text(x.buyer,250)||null,country:normalizeCountry(x.country),
  publishedAt:dateOnly(x.publishedAt),updatedAt:dateOnly(x.updatedAt),deadlineAt:deadline,
  deadlineKind:['tender','request','unknown'].includes(x.deadlineKind)?x.deadlineKind:'unknown',
  deadlineBasis:x.deadlineBasis||null,deadlineRaw:x.deadline?text(x.deadline,64):null,deadlineTimezone:x.deadlineTimezone||extractTimezone(x.deadline),lots:Array.isArray(x.lots)?x.lots.slice(0,25):[],
  value:amount(x.value),currency:text(x.currency,3).toUpperCase()||null,
  cpv:cpvCodes(x.cpv),description:text(x.description,1300)||null,noticeType:text(x.noticeType,120)||null,
  procedure:text(x.procedure,90)||null,stage:['competition','planning','award','disposal','unknown'].includes(x.stage)?x.stage:'unknown',
  status:statusFrom(x,deadline),url:x.url||null,provenance:text(x.provenance,140)||null,
  documents:Array.isArray(x.documents)?x.documents.slice(0,8).filter(d=>d&&typeof d.url==='string'):[],
  buyerNullReason:x.buyerNullReason||null,fieldProvenance:x.fieldProvenance||null,provenanceDate:new Date().toISOString()};
}
function dayAgo(days){return new Date(Date.now()-days*86400000).toISOString().slice(0,10);}
async function remoteJSON(url,opt={}){
 const c=new AbortController(),timer=setTimeout(()=>c.abort(),TIMEOUT);
 try{
  const r=await fetch(url,{...opt,signal:c.signal,headers:{Accept:'application/json',...(opt.headers||{})}});
  if(!r.ok){const err=new Error(r.status===429?'Rate limited by publisher':`Publisher HTTP ${r.status}`);err.status=r.status;throw err;}
  const ct=r.headers.get('content-type')||'';if(!/json/i.test(ct))throw Error('Publisher returned non-JSON');
  return await r.json();
 }catch(e){if(e.name==='AbortError')throw Error('Publisher timed out');throw e;}finally{clearTimeout(timer)}
}
const TED_FIELDS=['publication-number','publication-date','notice-title','buyer-name','buyer-country','classification-cpv','deadline-receipt-tender-date-lot','deadline-receipt-request-date-lot','form-type','notice-type','estimated-value-proc','estimated-value-cur-proc','procedure-type'];
export function tedQuery({q='',country='',days=30,cpv=''}){
 const since=dayAgo(days).replaceAll('-','');const parts=[`publication-date >= ${since}`,'form-type = competition'];
 if(country&&/^[A-Z]{3}$/.test(country))parts.push(`buyer-country = ${country}`);
 if(cpv&&/^\d{8}(?:-\d)?$/.test(cpv))parts.push(`classification-cpv = ${cpv.slice(0,8)}`);
 const terms=(q.match(/[\p{L}\p{N}]+/gu)||[]).filter(t=>t.length>1).slice(0,6).map(t=>t.slice(0,35));
 if(terms.length)parts.push(terms.length===1?`FT ~ ${terms[0]}`:`FT ~ (${terms.join(' ')})`);
 return parts.join(' AND ');
}
export async function tedFeed(p){
 const limit=60,body={query:tedQuery(p),fields:TED_FIELDS,page:p.page,limit,scope:'ALL',paginationMode:'PAGE_NUMBER',checkQuerySyntax:false};
 const d=await remoteJSON('https://api.ted.europa.eu/v3/notices/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!Array.isArray(d.notices))throw Error('Unexpected TED response');
 const notices=d.notices.map(n=>{
  const id=text(n['publication-number']??n.ND,60);if(!/^\d{1,9}-\d{4}$/.test(id))return null;
  const tenderDeadline=n['deadline-receipt-tender-date-lot']??n['deadline-receipt-tender-date'];
  const requestDeadline=n['deadline-receipt-request-date-lot'];
  const link=safeOfficialLink(pickLink(n.links?.html),['ted.europa.eu'])||`https://ted.europa.eu/en/notice/-/detail/${id}`;
  return normalize({id:`ted:${id}`,noticeId:id,source:'ted',title:n['notice-title']??n.TI,
   buyer:n['buyer-name']??n.AA,country:n['buyer-country']??n.CY,publishedAt:n['publication-date']??n.PD,
   deadline:tenderDeadline??requestDeadline,deadlineKind:tenderDeadline?'tender':requestDeadline?'request':'unknown',
   deadlineBasis:Array.isArray(tenderDeadline)&&tenderDeadline.length>1?'Earliest date across disclosed tender lots':Array.isArray(requestDeadline)&&requestDeadline.length>1?'Earliest date across requests-to-participate lots':null,
   value:n['estimated-value-proc']??null,currency:n['estimated-value-cur-proc']??null,
   cpv:n['classification-cpv']??n.PC,noticeType:n['notice-type'],procedure:n['procedure-type'],stage:'competition',
   description:null,url:link,provenance:'TED Search API v3'});
 }).filter(Boolean);
 const total=Number(d.totalNoticeCount??d.total??0)||null;
 return {notices,hasMore:total!==null?(p.page*limit<total):notices.length===limit,total,partial:total!==null?p.page*limit<total:notices.length===limit,
  coverage:'TED competition notices; source-side keyword, date, CPV and buyer-country filters',searchMode:'official-index'};
}
export async function greekFeed(p){
 const body={dateFrom:dayAgo(p.days),dateTo:new Date().toISOString().slice(0,10)};
 const validCpv = p.cpv ? formatCpvWithCheckDigit(p.cpv) : (/^\d{8}(?:-\d)?$/.test(p.q) ? formatCpvWithCheckDigit(p.q) : null);
 if(validCpv)body.cpvItems=[validCpv];
 if(p.q && !/^\d{8}(?:-\d)?$/.test(p.q))body.title=p.q;
 const url=`https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice?page=${p.page-1}`;
 const d=await remoteJSON(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!Array.isArray(d.content))throw Error('Unexpected KIMDIS response');
 const notices=d.content.map(n=>{
  const id=text(n.referenceNumber??n.id,100);if(!id)return null;
  const doc=`https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice/attachment/${encodeURIComponent(id)}`;
  const country='GRC';
  return normalize({id:`gr:${id}`,noticeId:id,source:'gr',title:n.title||n.objectDetails?.[0]?.shortDescription,
   buyer:n.organization?.value??n.organizationName??n.organization,country,publishedAt:n.submissionDate??n.publishedDate??n.date,
   updatedAt:n.lastUpdateDate,deadline:n.finalSubmissionDate,deadlineKind:n.finalSubmissionDate?'tender':'unknown',
   value:n.totalCostWithoutVAT??n.totalCost??n.budget,currency:'EUR',cpv:(n.objectDetails||[]).flatMap(o=>o.cpvs||o.cpvItems||[]),
   description:n.objectDetails?.[0]?.shortDescription,noticeType:n.procedureType??n.noticeType,
   stage:'competition',status:n.cancelled||n.revoked?'cancelled':null,url:doc,documents:[{label:'KIMDIS official PDF',url:doc}],provenance:'KIMDIS Open Data API'});
 }).filter(Boolean);
 return {notices,hasMore:!d.last,total:Number.isFinite(Number(d.totalElements))?Number(d.totalElements):null,partial:!d.last,
  coverage:'Greek KIMDIS notice register; publisher title/CPV filter, not full document-text search',searchMode:body.cpvItems?'official-cpv':p.q?'official-title':'official-date'};
}
export async function ukFeed(p){
 const start=dayAgo(p.days)+'T00:00:00';const end=new Date().toISOString().slice(0,10)+'T23:59:59';
 const cursorUrl=p.ukCursor?safeOfficialLink(p.ukCursor,['find-tender.service.gov.uk']):null;
 let next=cursorUrl||`https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?${new URLSearchParams({updatedFrom:start,updatedTo:end,limit:'80'})}`;
 const maxLoops=cursorUrl?1:p.page;
 const allReleases=[];
 let done=0;
 while(next&&done<maxLoops){const d=await remoteJSON(next);if(!Array.isArray(d.releases))throw Error('Unexpected UK OCDS release package');
  allReleases.push(...d.releases);
  done++;const href=d.links?.next;next=safeOfficialLink(href,['find-tender.service.gov.uk']);
  if(next&&new URL(next).pathname!=='/api/1.0/ocdsReleasePackages')next=null;
 }
 const needle=p.q.toLocaleLowerCase();
 const groupedByOcid=new Map();
 for(const r of allReleases){
  const ocid=text(r.ocid||r.id,130);if(!ocid)continue;
  if(!groupedByOcid.has(ocid))groupedByOcid.set(ocid,[]);
  groupedByOcid.get(ocid).push(r);
 }
 const notices=[...groupedByOcid.entries()].map(([ocid,rels])=>{
  const sorted=[...rels].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const merged={ocid,id:ocid,publishedAt:sorted[0]?.date||null,updatedAt:sorted[sorted.length-1]?.date||null,
   title:null,buyer:null,deadline:null,value:null,currency:null,cpv:[],description:null,tags:[],tStatus:null,url:null};
  for(const r of sorted){
   const t=r.tender||{};
   const rId=text(r.id??ocid,130);
   if(t.title)merged.title=t.title;
   const b=r.buyer?.name||r.parties?.find(z=>z.roles?.includes('buyer'))?.name;
   if(b)merged.buyer=b;
   if(t.tenderPeriod?.endDate)merged.deadline=t.tenderPeriod.endDate;
   if(t.value?.amount!=null)merged.value=t.value.amount;
   if(t.value?.currency)merged.currency=t.value.currency;
   const relCpvs=(t.items||[]).flatMap(z=>[z.classification,...(z.additionalClassifications||[])]).filter(Boolean);
   if(relCpvs.length)merged.cpv=relCpvs;
   if(t.description)merged.description=t.description;
   if(Array.isArray(r.tag))merged.tags=r.tag;
   if(t.status)merged.tStatus=t.status;
   const noticeNumber=(rId.match(/\d{5,8}-\d{4}/)||[])[0];
   const docLink=noticeNumber?`https://www.find-tender.service.gov.uk/Notice/${noticeNumber}`:null;
   const fromDoc=(r.documents||[]).map(x=>safeOfficialLink(x?.url,['find-tender.service.gov.uk'])).find(Boolean);
   if(fromDoc||docLink)merged.url=fromDoc||docLink;
  }
  const tag=merged.tags;
  const stage=tag.some(x=>/award/i.test(x))?'award':tag.some(x=>/tender/i.test(x))?'competition':tag.some(x=>/planning/i.test(x))?'planning':'unknown';
  return normalize({id:`uk:${ocid}`,noticeId:ocid,source:'uk',title:merged.title||ocid,buyer:merged.buyer,
   country:'GBR',publishedAt:merged.publishedAt,updatedAt:merged.updatedAt,deadline:merged.deadline,deadlineKind:'tender',
   value:merged.value,currency:merged.currency,cpv:merged.cpv,
   description:merged.description,noticeType:tag.join(', '),stage,status:stage==='award'?'awarded':merged.tStatus==='cancelled'?'cancelled':null,
   url:merged.url||'https://www.find-tender.service.gov.uk/Search/Results',provenance:`UK Find a Tender OCDS compiled (${sorted.length} release${sorted.length>1?'s':''})`});
 }).filter(Boolean).filter(n=>!p.cpv||n.cpv.some(c=>cpvMatches(c,p.cpv,p.cpvMode||'family'))).filter(n=>!needle||`${n.title} ${n.buyer||''} ${n.description||''} ${n.cpv.join(' ')}`.toLocaleLowerCase().includes(needle));
 return {notices,hasMore:!!next,nextCursor:next||null,total:null,partial:true,coverage:'UK updated-release sample. Keywords searched only in fetched page; not a comprehensive national search.',searchMode:'bounded-local-sample'};
}


export function mapBoampStage(n){
 const hay=`${n?.nature||''} ${n?.nature_libelle||''} ${n?.type_avis||''} ${n?.etat||''}`.toLowerCase();
 if(/attribution|r[eé]sultat|award/.test(hay))return {stage:'award',status:'awarded'};
 if(/annul|sans suite|cancel/.test(hay))return {stage:'unknown',status:'cancelled'};
 if(/pr[eé]-?information|planning/.test(hay))return {stage:'planning',status:null};
 if(/appel|avis de march[eé]|concession|competition/.test(hay))return {stage:'competition',status:null};
 return {stage:'unknown',status:null};
}

export async function boampFeed(p){
 const since=dayAgo(p.days);
 const clauses=[`dateparution >= date'${since}'`];
 if(p.q)clauses.push(`search(objet, "${p.q.replace(/"/g,'')}")`);
 if(p.cpv)clauses.push(`search(code_cpv, "${p.cpv.slice(0,8)}")`);
 const qs=new URLSearchParams({where:clauses.join(' AND '),limit:'40',offset:String((p.page-1)*40),order_by:'dateparution DESC'});
 const d=await remoteJSON(`https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?${qs}`);
 if(!Array.isArray(d.results))throw Error('Unexpected BOAMP response');
 const notices=d.results.map(n=>{
  const id=text(n.idweb||n.id,80);if(!id)return null;
  const {stage,status}=mapBoampStage(n);
  const url=safeOfficialLink(n.url_avis,['boamp.fr'])||`https://www.boamp.fr/pages/avis/?q=idweb:"${encodeURIComponent(id)}"`;
  return normalize({id:`fr:${id}`,noticeId:id,source:'fr',title:n.objet||`BOAMP ${id}`,
   buyer:n.nomacheteur||null,buyerNullReason:n.nomacheteur?null:'Missing nomacheteur in BOAMP record',fieldProvenance:{buyer:'boamp:nomacheteur',stage:'boamp:nature'},country:'FRA',publishedAt:n.dateparution,
   deadline:n.datelimitereponse,deadlineKind:n.datelimitereponse?'tender':'unknown',
   value:n.montant,currency:'EUR',cpv:n.code_cpv?[n.code_cpv]:[],description:n.objet,
   noticeType:n.nature_libelle||n.type_marche||n.nature,procedure:n.procedure_libelle,stage,status,
   url,provenance:'France BOAMP Open Data API'});
 }).filter(Boolean);
 const total=Number(d.total_count)||null;
 return {notices,hasMore:total!==null?(p.page*40<total):notices.length===40,total,partial:notices.length===40,
  coverage:'French BOAMP official procurement register (OpenDataSoft v2.1)',searchMode:'official-index'};
}

export function unicodeTokens(s){
 return String(s||'').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
}

export function mapWorldBankStage(noticeType){
 const t=String(noticeType||'').toLowerCase();
 if(!t)return {stage:'unknown',status:null};
 if(/cancel/.test(t))return {stage:'unknown',status:'cancelled'};
 if(/award/.test(t))return {stage:'award',status:'awarded'};
 if(/general procurement|prior information|annual procurement|planning/.test(t))return {stage:'planning',status:null};
 if(/invitation for bids|request for proposals|expressions? of interest|eoi|shopping|tender|bid/.test(t))return {stage:'competition',status:null};
 return {stage:'unknown',status:null};
}
export async function worldBankFeed(p){
 const params=new URLSearchParams({format:'json',rows:'40',os:String((p.page-1)*40)});
 if(p.q)params.set('qterm',p.q.slice(0,80));
 const d=await remoteJSON(`https://search.worldbank.org/api/v2/procnotices?${params}`);
 const raw=d?.procnotices&&typeof d.procnotices==='object'?Object.values(d.procnotices):[];
 const minDate=dayAgo(p.days), maxDate=new Date().toISOString().slice(0,10);
 const qTokens=unicodeTokens(p.q).filter(t=>t.length>1);
 const notices=raw.filter(n=>n&&typeof n==='object'&&n.id).map(n=>{
  const id=text(n.id,80);
  const pubDate=dateOnly(n.noticedate);
  if(!pubDate||pubDate<minDate||pubDate>maxDate)return null;
  const title=text(n.notice_text||n.project_name,420)||`World Bank Notice ${id}`;
  const desc=n.project_name?`Project: ${n.project_name} (${n.notice_type||'Notice'})`:null;
  const buyer=text(n.borrower,250)||null;
  if(qTokens.length){
   const haySet=new Set(unicodeTokens(`${title} ${desc||''} ${buyer||''} ${n.bid_reference_no||''}`));
   if(!qTokens.every(tok=>haySet.has(tok)))return null;
  }
  const {stage,status}=mapWorldBankStage(n.notice_type);
  return normalize({id:`wb:${id}`,noticeId:n.bid_reference_no||id,source:'wb',
   title,buyer,buyerNullReason:buyer?null:'Missing borrower field in World Bank notice',
   fieldProvenance:{buyer:'worldbank:borrower',stage:'worldbank:notice_type'},
   country:n.countrycode,publishedAt:pubDate,deadline:n.submission_date,
   deadlineKind:n.submission_date?'tender':'unknown',value:null,currency:'USD',cpv:[],
   description:desc,noticeType:n.notice_type||'World Bank Procurement Notice',
   procedure:n.procurement_method_name,stage,status,
   url:`https://projects.worldbank.org/en/projects-operations/procurement-detail/${encodeURIComponent(id)}`,
   provenance:'World Bank Procurement Notices API v2'});
 }).filter(Boolean);
 const total=Number(d?.total)||null;
 return {notices,hasMore:total!==null?(p.page*40<total):raw.length===40,total,partial:raw.length===40,
  coverage:'World Bank-financed procurement notices (post-filtered by UTC date & keywords)',searchMode:'official-index-postfiltered'};
}
export function usDate(iso){
 const valid=dateOnly(iso);
 if(!valid)return null;
 const [y,m,d]=valid.split('-');
 return `${m}/${d}/${y}`;
}
export function mapSamType(type,active){
 const t=String(type||'').trim().toLowerCase();
 let stage='unknown',status=null;
 if(t==='a'||/award/.test(t)){stage='award';status='awarded';}
 else if(t==='g'||/sale of surplus|surplus property/.test(t)){stage='disposal';status='disposal';}
 else if(['r','p','s','i'].includes(t)||/sources sought|presolicitation|special notice|intent to bundle/.test(t)){stage='planning';}
 else if(['o','k'].includes(t)||/^solicitation$|combined synopsis/.test(t)){stage='competition';}
 else if(/cancel/.test(t)){stage='unknown';status='cancelled';}
 if(active==='No'||active===false){if(status!=='awarded'&&status!=='cancelled'&&status!=='disposal')status='inactive';}
 return {stage,status};
}
export async function samFeed(p,key){
 if(!key)return {notices:[],disabled:true,total:null,partial:true,coverage:'SAM_GOV_API_KEY not configured',searchMode:'disabled'};
 const params=new URLSearchParams({api_key:key,postedFrom:usDate(dayAgo(Math.min(90,p.days))),postedTo:usDate(new Date().toISOString().slice(0,10)),limit:'50',offset:String((p.page-1)*50)});
 if(p.q)params.set('title',p.q.slice(0,70));
 const d=await remoteJSON(`https://api.sam.gov/opportunities/v2/search?${params}`);
 if(!Array.isArray(d.opportunitiesData))throw Error('Unexpected SAM.gov response');
 const notices=d.opportunitiesData.map(n=>{
  const id=text(n.noticeId,90);if(!id)return null;
  const {stage,status}=mapSamType(n.type,n.active);
  return normalize({id:`sam:${id}`,noticeId:id,source:'sam',title:n.title,buyer:n.fullParentPathName||n.department,country:'USA',publishedAt:n.postedDate,
   deadline:n.responseDeadLine??n.reponseDeadLine,deadlineKind:'tender',noticeType:n.type,stage,status,
   description:n.description||null,url:safeOfficialLink(n.uiLink,['sam.gov'])||`https://sam.gov/opp/${encodeURIComponent(id)}/view`,provenance:'SAM.gov public opportunities API'});
 }).filter(Boolean);
 return {notices,hasMore:notices.length===50,total:Number(d.totalRecords)||null,partial:notices.length===50,coverage:'US SAM.gov public opportunity notices (MM/dd/yyyy)',searchMode:'official-index'};
}
export function getParams(url){
 const p=url.searchParams;
 const rawPage=p.get('page');
 let page=1;
 if(rawPage!==null&&rawPage!==''){
  if(!/^\d+$/.test(rawPage))return {error:'Invalid page parameter: must be a positive integer'};
  const n=Number(rawPage);
  if(!Number.isSafeInteger(n)||n<1||n>MAX_PAGE)return {error:`Invalid page parameter: must be between 1 and ${MAX_PAGE}`};
  page=n;
 }
 const rawCpv=(p.get('cpv')||'').trim();
 let cpv='';
 if(rawCpv){
  const formatted=formatCpvWithCheckDigit(rawCpv);
  if(!formatted)return {error:'Invalid CPV code or check digit (expected ######## or ########-#)'};
  cpv=formatted;
 }
 const rawSource=p.get('source');
 const source=(rawSource===null||rawSource==='')?'all':rawSource;
 if(source!=='all'&&!Object.hasOwn(SOURCES,source))return {error:'Invalid source parameter'};
 const rawDays=p.get('days');
 let days=30;
 if(rawDays!==null&&rawDays!==''){
  if(!/^(7|14|30|60|90)$/.test(rawDays))return {error:'Invalid days parameter: must be 7, 14, 30, 60, or 90'};
  days=Number(rawDays);
 }
 const country=(p.get('country')||'').toUpperCase();
 const cpvMode=p.get('cpvMode')==='exact'?'exact':'family';
 const ukCursor=(p.get('ukCursor')||'').trim();
 return {q:(p.get('q')||'').trim().slice(0,100),source,country:/^[A-Z]{3}$/.test(country)?country:'',days,page,cpv,cpvMode,ukCursor};
}
const sourceForCountry=(s,c)=>!c||s==='ted'||s==='wb'||(s==='gr'&&c==='GRC')||(s==='uk'&&c==='GBR')||(s==='fr'&&c==='FRA')||(s==='sam'&&c==='USA');
export async function collect(p,env={}){
 const cpvUnsupported=s=>Boolean(p.cpv&&SOURCES[s]?.supportsCpv===false);
const jobs=Object.keys(SOURCES).filter(s=>(p.source==='all'||s===p.source)&&sourceForCountry(s,p.country)&&!cpvUnsupported(s));
 const health={},out=[];const started=Date.now();
 const rs=await Promise.all(jobs.map(async s=>{const t=Date.now();try{const result=await ({ted:tedFeed,gr:greekFeed,uk:ukFeed,fr:boampFeed,wb:worldBankFeed,sam:pp=>samFeed(pp,env.SAM_GOV_API_KEY)})[s](p);return {s,result,ms:Date.now()-t}}catch(e){return{s,error:text(e.message,100),ms:Date.now()-t}}}));
 const ids=new Set();let totalAvailable=0;
 for(const s of Object.keys(SOURCES)){
  const x=rs.find(z=>z.s===s);
  if(!x){health[s]=cpvUnsupported(s)?{status:'excluded',count:0,filterUnsupported:['cpv'],message:'Excluded: source does not support EU CPV filtering'}:{status:'not-queried',count:0};continue;}
  if(x.error){health[s]={status:'error',count:0,latencyMs:x.ms,message:x.error};continue;}
  if(x.result.disabled){health[s]={status:'not-configured',count:0,message:x.result.coverage};continue;}
  const records=x.result.notices.filter(n=>(!p.country||n.country===p.country)&&(!p.cpv||(Array.isArray(n.cpv)&&n.cpv.some(c=>cpvMatches(c,p.cpv,p.cpvMode||'family')))));
  let count=0;
  for(const n of records){if(!n.id||ids.has(n.id))continue;ids.add(n.id);out.push(n);count++;}
  totalAvailable++;
  health[s]={status:'ok',count,latencyMs:x.ms,hasMore:x.result.hasMore,partial:x.result.partial,searchMode:x.result.searchMode,total:x.result.total,coverage:x.result.coverage};
 }
 out.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
 return {version:VERSION,items:out,notices:out,health,returned:out.length,queriedSources:jobs,respondedSources:totalAvailable,
  fetchedAt:new Date().toISOString(),durationMs:Date.now()-started,page:p.page,query:p,
  coverage:'Live, bounded search results. Not a complete archive of all public tenders; source coverage and dates require independent verification.'};
}
function json(d,status=200,headers={}){return new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...headers}});}
async function search(request,env,ctx){const p=getParams(new URL(request.url));
 if(p.error)return json({error:p.error},400);
 const key=new Request(new URL('/api/search?'+new URLSearchParams(Object.entries(p)),request.url));
 let cache;try{cache=caches.default;const r=await cache.match(key);if(r){const d=await r.json();return json({...d,fromEdgeCache:true});}}catch{}
 const d=await collect(p,env);
 if(p.cpv&&p.source!=='all'&&SOURCES[p.source]?.supportsCpv===false){
 return json({...d,error:'FILTER_UNSUPPORTED',code:'FILTER_UNSUPPORTED',filter:'cpv',source:p.source,
  supportedSources:Object.entries(SOURCES).filter(([,v])=>v.supportsCpv!==false).map(([k])=>k),
  message:`${SOURCES[p.source].label} does not support EU CPV filtering.`},422);
}
if(d.respondedSources===0)return json({...d,error:p.source==='sam'&&!env.SAM_GOV_API_KEY?'SAM.gov requires a server-side API key.':'No queried official publisher responded. Check the source diagnostics and retry.'},503);
 if(cache){try{ctx?.waitUntil?.(cache.put(key,new Response(JSON.stringify(d),{headers:{'Cache-Control':`public,max-age=${TTL}`}})));}catch{}}
 return json({...d,fromEdgeCache:false});
}

export function escIcs(val){
 return String(val||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
}
export function makeIcs(u){
 const rawDeadline=(u.searchParams.get('deadline')||'').trim();
 const validDate=/^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)?dateOnly(rawDeadline):null;
 if(!validDate)return json({error:'Invalid calendar deadline date (expected valid YYYY-MM-DD)'},400);
 const icsDate=validDate.replaceAll('-','');
 const title=escIcs((u.searchParams.get('title')||'Tender Submission Deadline').slice(0,180));
 const rawUrl=u.searchParams.get('url')||'';
 let safeUrl='';
 try{const parsed=new URL(rawUrl);if(parsed.protocol==='https:')safeUrl=parsed.href;}catch{}
 const lines=[
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//TenderAtlas//v10.6//EN','BEGIN:VEVENT',
  `UID:${(globalThis.crypto?.randomUUID?.() ?? (Date.now()+"-"+Math.random().toString(36).slice(2)))}@tenderatlas`,
  `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z`,
  `DTSTART;VALUE=DATE:${icsDate}`,
  `SUMMARY:${escIcs('Tender Deadline: ')}${title}`,
  safeUrl?`DESCRIPTION:${escIcs('Official Notice: '+safeUrl)}`:'DESCRIPTION:Official Notice',
  ...(safeUrl?[`URL:${escIcs(safeUrl)}`]:[]),
  'END:VEVENT','END:VCALENDAR'
 ];
 return new Response(lines.join('\r\n'),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="tender-deadline.ics"'}});
}

export function buildCitedDossier(n){
 const missing=[];
 if(!n.buyer)missing.push('Contracting authority (buyer) not disclosed in API summary');
 if(!n.deadlineAt)missing.push('Submission deadline not disclosed');
 if(!n.deadlineTimezone)missing.push('Exact submission timezone not disclosed in API summary — verify official notice');
 if(!n.value)missing.push('Estimated contract value not disclosed');
 if(!Array.isArray(n.cpv)||!n.cpv.length)missing.push('CPV classification not disclosed');
 return {
  version:VERSION,
  assessmentType:'unverified-metadata-summary',
  sourceVerified:false,
  verifiedEligibility:'unknown',
  noticeId:n.noticeId||n.id,
  title:n.title,
  source:n.source,
  officialUrl:n.url||null,
  metadata:{
   reportedStage:n.stage||'unknown',
   reportedStatus:n.status||'unknown',
   buyer:n.buyer||null,
   country:n.country||null,
   deadlineAt:n.deadlineAt||null,
   deadlineTimezone:n.deadlineTimezone||null,
   value:n.value??null,
   currency:n.currency||null,
   cpv:n.cpv||[]
  },
  missingOrUnverified:missing,
  disclaimer:'Unverified metadata summary from caller/API fields. Eligibility, mandatory requirements, and active status are UNKNOWN until verified in official publisher documents.'
 };
}

export default {async fetch(request,env={},ctx={}){
 const u=new URL(request.url);
 if(u.pathname==='/api/health')return json({ok:true,version:VERSION,environment:'Cloudflare Pages advanced worker',at:new Date().toISOString(),sources:SOURCES,
  features:{officialEdgeSearch:true,localPipeline:true,localWatchlists:true,aiGeneratedAssessments:false,automaticEmails:false,cloudAccounts:false,subscriptions:false,metadataSummaryOnly:true},samKeyConfigured:Boolean(env.SAM_GOV_API_KEY)});
 if(u.pathname==='/api/ics')return makeIcs(u);
 if(u.pathname==='/api/dossier'&&request.method==='POST'){try{const n=await request.json();if(!n||!n.title)return json({error:'Notice payload with title required'},400);return json(buildCitedDossier(n));}catch{return json({error:'Invalid JSON payload'},400);}}
 if(u.pathname==='/api/search')return request.method==='GET'?search(request,env,ctx):json({error:'Method not allowed'},405,{Allow:'GET'});
 if(u.pathname.startsWith('/api/'))return json({error:'Endpoint not found'},404);
 return env.ASSETS?.fetch?env.ASSETS.fetch(request):new Response('Cloudflare Pages ASSETS binding missing. Upload ZIP via Pages Direct Upload.',{status:503});
}};
