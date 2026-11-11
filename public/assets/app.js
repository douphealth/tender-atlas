import {deadlineCategory,visibleItems,upcomingWithin,makeCsv,marketsInView} from './insights.js';
const ICONS={
 compass:'<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.4 4.8-4.8 2.4 2.4-4.8z"/>',
 bookmark:'<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21l-7-4-7 4z"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
 building:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2m-5 6v-3h2v3"/>',
 credit:'<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 9h20m-15 6h4"/>',
 book:'<path d="M4 3h7a3 3 0 0 1 3 3v15a3 3 0 0 0-3-3H4z"/><path d="M20 3h-3a3 3 0 0 0-3 3v15a3 3 0 0 1 3-3h3z"/>',
 external:'<path d="M14 4h6v6m0-6-9 9"/><path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.8 9A7 7 0 0 1 19 7l1 5M4 12l1 5a7 7 0 0 0 13.2-2"/>',
 sparkles:'<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3zM20 17l.8 2.2L23 20l-2.2.8L20 23l-.8-2.2L17 20l2.2-.8L20 17z"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 x:'<path d="M18 6 6 18M6 6l12 12"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 filter:'<path d="M4 6h16M7 12h10m-7 6h4"/>',
 alert:'<path d="m12 3 10 18H2L12 3zM12 9v5m0 3v.5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
 briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
 inbox:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h5l2 3h4l2-3h5"/>'
};
const $=sel=>document.querySelector(sel),$$=sel=>[...document.querySelectorAll(sel)];
function icon(name){return `<span class="svg-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICONS[name]||ICONS.info}</svg></span>`;}
function icons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[el.dataset.icon]||ICONS.info}</svg>`;});}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={view:'discover',session:null,profile:null,items:[],saved:[],alerts:[],sourceMeta:[],partial:false,searching:false,searchSeq:0,page:1,lang:localStorage.getItem('ta:lang')==='el'?'el':'en',health:null,aiResults:{},guestSaved:[],features:{},sourceErrors:[],queriedAt:null,searchAbort:null};
const text={en:{discover:'Discover',saved:'Saved opportunities',alerts:'Smart alerts',workspace:'Company profile',billing:'Plans & billing',search:'Explore tenders',noResults:'No notices match the current filters.',fail:'Official source search could not complete.',signin:'Sign in',signout:'Sign out',savedok:'Opportunity saved.',savedremove:'Removed from shortlist.',verify:'Verify official deadline',open:'Open official notice'},el:{discover:'Αναζήτηση',saved:'Αποθηκευμένα',alerts:'Ειδοποιήσεις',workspace:'Προφίλ εταιρείας',billing:'Πλάνα & πληρωμές',search:'Αναζήτηση έργων',noResults:'Δεν βρέθηκαν αποτελέσματα με αυτά τα φίλτρα.',fail:'Δεν ήταν δυνατή η σύνδεση με τις επίσημες πηγές.',signin:'Σύνδεση',signout:'Αποσύνδεση',savedok:'Η ευκαιρία αποθηκεύτηκε.',savedremove:'Αφαιρέθηκε από τη λίστα.',verify:'Επιβεβαίωση προθεσμίας',open:'Επίσημη προκήρυξη'}};
const t=k=>text[state.lang][k]||k;
let toastTimer;
function toast(msg,error=false){const el=$('#toast');el.textContent=msg;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4500);}
async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',headers:{...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})},...options});let data;try{data=await r.json();}catch{throw Error(`Server returned non-JSON (HTTP ${r.status})`);}if(!r.ok)throw Error(data.error||`Request failed (${r.status})`);return data;}
const dateFmt=iso=>{if(!iso)return 'Not available';const d=new Date(iso.slice(0,10)+'T12:00:00Z');return Number.isNaN(d.getTime())?'Not available':new Intl.DateTimeFormat(state.lang==='el'?'el-GR':'en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(d);};
const euroFmt=(v,currency)=>{if(!Number.isFinite(Number(v))||v==null)return 'Not disclosed';try{return new Intl.NumberFormat(state.lang==='el'?'el-GR':'en-GB',{style:'currency',currency:currency||'EUR',maximumFractionDigits:0}).format(v);}catch{return 'Not disclosed';}};
const safeUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:'#';}catch{return '#';}};
const savedIds=()=>new Set(state.saved.map(x=>x.noticeId));
const localSaveKey='ta:guestSaved:v1';
function readGuestSaved(){try{const x=JSON.parse(localStorage.getItem(localSaveKey)||'[]');return Array.isArray(x)?x.filter(r=>r&&typeof r.noticeId==='string'&&typeof r.sourceUrl==='string').slice(0,60):[];}catch{return [];}}
function persistGuestSaved(){try{localStorage.setItem(localSaveKey,JSON.stringify(state.guestSaved.slice(0,60)));}catch(e){toast('Browser storage is full. Saved opportunities may not persist on this device.',true);}}
function currentViewItems(){return visibleItems(state.items,{status:$('#filter-status')?.value||'all',sort:$('#filter-sort')?.value||'recent',scoreFn:state.profile?calculateMatch:null});}
function updateViewIndicators(){
  const list=currentViewItems();
  $('#stat-count').textContent=String(list.length);
  $('#stat-countries').textContent=String(new Set(list.map(x=>x.country).filter(Boolean)).size);
  $('#stat-sources').textContent=String(state.sourceMeta.length);
  $('#stat-upcoming').textContent=String(upcomingWithin(list));
  $('#result-count').textContent=`(${list.length} in this view)`;
  const sorted=marketsInView(list),max=Math.max(...sorted.map(x=>x.total),1);
  $('#market-breakdown').innerHTML=sorted.length?sorted.slice(0,7).map(x=>`<div class="market-item"><div class="market-item-header"><span>${esc(x.name)}</span><span>${x.total}</span></div><div class="market-track"><progress value="${x.total}" max="${max}" aria-label="${esc(x.name)}: ${x.total}"></progress></div></div>`).join(''):'<span class="muted">No market data in this view.</span>';
}

function renderCard(n,opts={}){const saved=savedIds().has(n.id);const deadline=n.deadline?dateFmt(n.deadline):'Not verified';const warning=n.status==='expired'||n.status==='cancelled';const score=state.profile?calculateMatch(n):null;const ai=state.aiResults[n.id];return `<article class="notice-card"><div class="notice-card-inner"><div class="notice-meta"><span class="source-pill ${esc(n.source)}">${esc(n.sourceLabel||n.source)}</span><span class="notice-ref">${esc(n.reference||n.id)}</span><span class="date-meta">${icon('calendar')} ${esc(dateFmt(n.published))}</span></div><a class="notice-title" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener noreferrer">${esc(n.title)}</a><div class="buyer-line">${icon('building')} ${esc(n.buyer||'Buyer not stated')}</div><div class="notice-tags"><span class="notice-tag status-${esc(deadlineCategory(n))}">${esc(({upcoming:'Upcoming date listed',expired:'Past deadline',cancelled:'Cancelled',archived:'Archived',unknown:'Deadline unverified'})[deadlineCategory(n)])}</span>${n.amended?'<span class="notice-tag">Amended notice</span>':''}${(n.cpv||[]).slice(0,3).map(c=>`<span class="notice-tag">CPV ${esc(c)}</span>`).join('')}</div><div class="notice-facts"><div><span class="fact-label">MARKET</span><span class="fact-value">${esc(n.countryName||'Unspecified')}</span></div><div><span class="fact-label">EST. VALUE</span><span class="fact-value">${esc(euroFmt(n.budget,n.currency))}</span></div><div><span class="fact-label">DEADLINE</span><span class="fact-value ${warning?'warning':''}">${esc(deadline)}</span></div></div></div>${ai?`<div class="match-panel"><div class="match-badge">${Math.round(ai.similarity*100)}<small>/100</small></div><div class="match-detail">AI semantic similarity (BGE-M3), not eligibility or probability of award.</div></div>`:''}${score?`<div class="match-panel"><div class="match-badge">${score.score}<small>/100</small></div><div class="match-detail">Profile relevance · ${esc(score.reasons||'No matching terms observed')}. Eligibility not evaluated.</div></div>`:''}<div class="notice-footer"><div class="notice-footer-left">${icon(n.status==='cancelled'?'alert':'shield')} ${esc(n.status==='cancelled'?'Cancelled in source':n.status==='archived'?'Archived in source':n.status==='expired'?'Published deadline passed':n.deadline?'Deadline from source · verify':t('verify'))}</div><div class="notice-actions"><button class="detail-button" type="button" data-detail="${esc(n.id)}">Details</button>${state.features.aiMatching?`<button class="ai-button" data-ai="${esc(n.id)}" title="AI semantic similarity · paid plan required">${icon('sparkles')} AI fit</button>`:''}<button class="save-button ${saved?'saved':''}" data-save="${esc(n.id)}" title="${saved?'Remove saved notice':'Save notice'}" aria-label="${saved?'Remove saved notice':'Save notice'}">${icon('bookmark')}</button><a class="open-source" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener noreferrer">${n.source==='khmdhs'?'Open official register':t('open')} ${icon('external')}</a></div></div></article>`;}
function calculateMatch(n){const p=state.profile;if(!p)return null;let score=0,weight=0,reason=[];const kws=(p.keywords||[]).filter(x=>x.length>2);if(kws.length){weight+=55;const hits=kws.filter(k=>`${n.title||''} ${n.buyer||''}`.toLocaleLowerCase().includes(k.toLocaleLowerCase()));score+=Math.min(55,55*hits.length/Math.max(1,Math.min(kws.length,4)));if(hits.length)reason.push(hits.slice(0,2).join(', '));}const cpvs=p.cpvCodes||[];if(cpvs.length){weight+=35;if((n.cpv||[]).some(c=>cpvs.some(k=>c===k))){score+=35;reason.push('CPV match');}}const countries=p.countries||[];if(countries.length){weight+=10;if(countries.includes(n.country)){score+=10;reason.push('market match');}}return weight?{score:Math.round(score/weight*100),reasons:reason.join(' · ')}:null;}
function empty(message,details,iconName='inbox'){return `<div class="empty-state">${icon(iconName)}<h3>${esc(message)}</h3><p>${esc(details||'')}</p></div>`;}
function renderResults(){
  const list=currentViewItems();
  $('#results').innerHTML=list.length?list.map(n=>renderCard(n)).join(''):empty(state.items.length?'No notices in this view':t('noResults'),state.items.length?'Try a different in-view status filter or sort.':'Try another keyword, source, country or publication window.','search');
  updateViewIndicators();
  const errors=state.sourceErrors||[];
  $('#source-state').classList.toggle('error-state',errors.length>0);
  $('#source-state').innerHTML=`<span class="pulse-dot"></span> ${state.sourceMeta.length} responding · ${errors.length} unavailable`;
  const labels={ted:'EU TED',khmdhs:'ΚΗΜΔΗΣ',uk:'Find a Tender',sam:'SAM.gov'};
  const ok=state.sourceMeta.map(m=>`<div class="source-row"><div><label>${esc(labels[m.source]||m.source)}</label><small class="source-meta-small">${esc(m.coverage||'')} · ${m.pagesScanned||1} page(s) checked</small></div><span>${Number(m.count)} retrieved</span></div>`).join('');
  const failed=errors.map(e=>`<div class="source-row is-failed"><div><label>${esc(labels[e.source]||e.source)}</label><small class="source-meta-small">${esc(e.reason)}</small></div><span>Unavailable</span></div>`).join('');
  const date=state.queriedAt?new Date(state.queriedAt):null;
  $('#source-coverage').innerHTML=ok+failed+(ok||failed?`<p class="muted">Checked ${date&&Number.isFinite(date.getTime())?esc(date.toLocaleString(state.lang==='el'?'el-GR':'en-GB')):'just now'}. These counts are not global totals.</p>`:'<p class="muted">No source responded.</p>');
  $('#saved-count').textContent=String(state.saved.length);
}
function showSourceErrors(errors,partial){const notices=$('#source-notices');if(!errors?.length){notices.innerHTML='';return;}notices.innerHTML=`<div class="notice-strip">${icon('alert')} <span>${partial?'Partial results.':'Search unavailable.'} ${errors.map(e=>`${esc(e.source)}: ${esc(e.reason)}`).join(' · ')}. No substitute records were invented.</span></div>`;}
async function loadSearch(reset=true){
  if(state.searching&&!reset)return;
  const seq=++state.searchSeq;
  if(reset){state.page=1;state.items=[];state.sourceMeta=[];state.sourceErrors=[];}
  state.searching=true;
  $('#results').innerHTML=`<div class="loading-placeholder"><span class="spinner"></span> Consulting official procurement registers…</div>`;
  $('#more-results').hidden=true;
  const params=new URLSearchParams({source:$('#filter-source').value,country:$('#filter-country').value,days:$('#filter-days').value,q:$('#query-input').value.trim(),page:String(state.page)});
  const share=new URL(location.href);share.search='';share.searchParams.set('q',params.get('q'));share.searchParams.set('source',params.get('source'));share.searchParams.set('country',params.get('country'));share.searchParams.set('days',params.get('days'));
  history.replaceState(null,'',share.pathname+'?'+share.searchParams.toString());
  try{
    const data=await api('/api/search?'+params);
    if(seq!==state.searchSeq)return;
    if(!Array.isArray(data.items))throw Error('Official search returned invalid data');
    state.items=reset?data.items:[...state.items,...data.items.filter(n=>!state.items.some(x=>x.id===n.id))];
    state.sourceMeta=data.sourceMeta||[];state.sourceErrors=data.sourceErrors||[];state.queriedAt=data.queriedAt||null;
    showSourceErrors(data.sourceErrors,data.partial);
    if(!data.sourceMeta?.length&&!data.sourceErrors?.length&&data.coverage){$('#source-notices').innerHTML=`<div class="notice-strip info">${esc(data.coverage)}. ${esc(data.disclaimer||'')}</div>`;}
    renderResults();
    $('#more-results').hidden=!($('#filter-source').value!=='all'&&data.sourceMeta?.some(m=>m.nextPage));
  }catch(e){
    if(seq!==state.searchSeq)return;
    state.sourceMeta=[];state.sourceErrors=[];state.queriedAt=null;
    $('#results').innerHTML=empty(t('fail'),e.message,'alert');$('#source-notices').innerHTML='';
    $('#source-state').classList.add('error-state');$('#source-state').innerHTML='<span class="pulse-dot"></span> Feed unavailable';
    $('#stat-count').textContent='—';$('#stat-sources').textContent='0';$('#stat-countries').textContent='—';$('#stat-upcoming').textContent='—';
    toast(e.message,true);
  }finally{if(seq===state.searchSeq)state.searching=false;}
}
function showView(view,scroll=true){if(!['discover','saved','alerts','workspace','billing'].includes(view))view='discover';state.view=view;$$('.page-view').forEach(el=>el.classList.toggle('active',el.id===`view-${view}`));$$('[data-view]').forEach(el=>{el.classList.toggle('active',el.dataset.view===view);if(el.tagName==='BUTTON')el.setAttribute('aria-current',el.dataset.view===view?'page':'false');});$('#breadcrumb-view').textContent=t(view);if(scroll)scrollTo({top:0,behavior:'smooth'});history.replaceState(null,'',view==='discover'?'/':`/?view=${encodeURIComponent(view)}`);if(view==='saved')renderSaved();if(view==='alerts')renderAlerts();if(view==='billing')loadBilling();}
const GREEK_UI={
  '.hero h1':'Δημόσιοι διαγωνισμοί.<br><em>Με καθαρές πληροφορίες.</em>',
  '.hero-sub':'Ένας ενιαίος χώρος για να ανακαλύπτεις και να αξιολογείς δημόσιες προκηρύξεις από επίσημες ευρωπαϊκές πηγές.',
  '.hero-search button':`Αναζήτηση ${icon('arrow')}`,
  '#query-input':'Αναζήτηση λογισμικού, κυβερνοασφάλειας, κατασκευών...',
  '.hero-bottom':'',
  '.content-heading h2':'Ανακάλυψε ευκαιρίες <span class="result-count" id="result-count"></span>',
  '.content-heading p':'Προκηρύξεις με τεκμηριωμένες πηγές. Έλεγξε πάντα τους όρους στην επίσημη σελίδα.',
  '#refresh-btn':`${icon('refresh')} Ανανέωση`,
  '#filter-source option[value="all"]':'Όλες οι πηγές',
  '#filter-country option[value=""]':'Όλες οι χώρες',
  '#filter-days option[value="7"]':'Τελευταίες 7 ημέρες',
  '#filter-days option[value="30"]':'Τελευταίες 30 ημέρες',
  '#filter-days option[value="90"]':'Τελευταίες 90 ημέρες',
  '.filter-apply':`Εφαρμογή φίλτρων ${icon('arrow')}`,
  '#clear-filters':'Καθαρισμός',
  '#view-saved .subpage-heading h1':'Αποθηκευμένες ευκαιρίες',
  '#view-saved .subpage-heading p':'Οργάνωσε τις προκηρύξεις που σε ενδιαφέρουν και επέστρεψε στην επίσημη πηγή όταν είσαι έτοιμος.',
  '#view-alerts .subpage-heading h1':'Έξυπνες ειδοποιήσεις',
  '#view-alerts .subpage-heading p':'Παρακολούθησε λέξεις-κλειδιά, αγορές και πηγές. Η αποστολή email απαιτεί ενεργοποιημένο λογαριασμό.',
  '#view-alerts .simple-grid .white-panel:first-child h3':'Δημιουργία στοχευμένης ειδοποίησης',
  '#view-alerts .simple-grid .white-panel:last-child h3':'Οι ενεργές ειδοποιήσεις σου',
  '#alert-form button':`Δημιουργία ειδοποίησης ${icon('arrow')}`,
  '#view-workspace .subpage-heading h1':'Προφίλ επιχείρησης',
  '#view-workspace .subpage-heading p':'Περιέγραψε τις υπηρεσίες και τις αγορές που σε ενδιαφέρουν. Η συνάφεια δεν αποτελεί πρόβλεψη ανάθεσης.',
  '#view-workspace .white-panel:first-child h3':'Στοιχεία επιχείρησης',
  '#view-workspace .explainer h3':'Πώς λειτουργεί η αντιστοίχιση',
  '#profile-form button':`Αποθήκευση προφίλ ${icon('arrow')}`,
  '#view-billing .subpage-heading h1':'Μία πλατφόρμα. Περισσότερες ευκαιρίες.',
  '#view-billing .subpage-heading p':'Βρες το επόμενο δημόσιο έργο χωρίς πολύπλοκο enterprise λογισμικό.',
  '#manage-billing':`Διαχείριση στο Stripe ${icon('external')}`,
  '.billing-account h3':'Η συνδρομή σου',
  '#more-results':`Επόμενη σελίδα ${icon('arrow')}`,
  '#login-dialog .dialog-inner h2':'Σύνδεση στον προσωπικό χώρο',
  '#login-dialog .dialog-inner > p:first-of-type':'Συνδέσου με κωδικό μίας χρήσης μέσω email, χωρίς κωδικό πρόσβασης.',
  '#email-form button':`Αποστολή κωδικού ${icon('arrow')}`,
  '#verify-form button[type="submit"]':`Επιβεβαίωση σύνδεσης ${icon('arrow')}`,
  '#change-email':'Αλλαγή email'
};
const originalUi=new Map();
function translateUi(){for(const [selector,greek] of Object.entries(GREEK_UI)){const el=$(selector);if(!el)continue;if(!originalUi.has(selector))originalUi.set(selector,selector==='#query-input'?el.placeholder:el.innerHTML);if(selector==='#query-input')el.placeholder=state.lang==='el'?greek:originalUi.get(selector);else if(greek)el.innerHTML=state.lang==='el'?greek:originalUi.get(selector);}}
function applyLanguage(){document.documentElement.lang=state.lang;translateUi();$('#language-toggle').textContent=state.lang==='en'?'EL':'EN';const labels={'.nav-link[data-view="discover"] span:last-child':t('discover'),'.nav-link[data-view="alerts"] span:last-child':t('alerts'),'.nav-link[data-view="workspace"] span:last-child':t('workspace')};for(const [sel,value] of Object.entries(labels)){const el=$(sel);if(el)el.textContent=value;}$('#breadcrumb-view').textContent=t(state.view);if(state.items.length)renderResults();}
async function loadAccount(){
  try{
    const data=await api('/api/auth/me');state.session=data.authenticated?data:null;
    if(state.session){
      $('#sign-in-btn').textContent=`${data.user.email.split('@')[0]} · ${t('signout')}`;
      await Promise.allSettled([loadSaved(),loadAlerts(),loadProfile()]);
    }else{
      $('#sign-in-btn').innerHTML=state.health&&!state.features.accounts?`Guest workspace ${icon('bookmark')}`:`${t('signin')} ${icon('arrow')}`;
      state.saved=state.guestSaved;state.alerts=[];state.profile=null;
    }
  }catch(e){console.warn('Account service unavailable:',e.message);state.session=null;state.saved=state.guestSaved;}
  $('#saved-count').textContent=String(state.saved.length);
  if(state.view==='saved')renderSaved();if(state.view==='alerts')renderAlerts();if(state.view==='workspace')showProfile();
}
async function loadSaved(){const res=await api('/api/account/watchlist');state.saved=res.items;$('#saved-count').textContent=String(res.items.length);}
async function loadAlerts(){const res=await api('/api/alerts');state.alerts=res.items;}
async function loadProfile(){const res=await api('/api/account/profile');state.profile=res.profile;showProfile();}
function showProfile(){const p=state.profile;if(!p)return;$('#profile-name').value=p.name||'';$('#profile-description').value=p.description||'';$('#profile-keywords').value=(p.keywords||[]).join(', ');$('#profile-cpvs').value=(p.cpvCodes||[]).join(', ');$('#profile-countries').value=(p.countries||[]).join(', ');}
function renderSaved(){
  const el=$('#saved-content');
  const note=!state.session?'<div class="guest-note">Saved on this device only. Configure D1 + email authentication for secure cross-device synchronization. Clearing browser data will remove these local bookmarks.</div>':'';
  if(!state.saved.length){el.innerHTML=note+empty('Your shortlist starts here','Explore official sources and bookmark an opportunity. You can save locally without an account.','bookmark');return;}
  el.innerHTML=note+`<div class="saved-grid">${state.saved.map(s=>`<div class="saved-card"><small>${esc(s.source)} · ${esc(dateFmt(s.notice?.published))}</small><strong>${esc(s.title)}</strong><a href="${esc(safeUrl(s.sourceUrl))}" target="_blank" rel="noopener noreferrer">Open official publication ${icon('external')}</a><button data-remove="${esc(s.noticeId)}">Remove</button></div>`).join('')}</div>`;
}
function renderAlerts(){const el=$('#alerts-content');if(!state.session){el.innerHTML=empty('Email alerts are not yet active',state.health&&!state.features.alerts?'The owner must configure D1, Resend and scheduled delivery first.':'Sign in to save alerts and receive email.','bell');return;}if(!state.alerts.length){el.innerHTML=empty('No alerts configured','Choose a search term and create your first monitoring rule.','bell');return;}el.innerHTML=`<div class="alert-list">${state.alerts.map(a=>`<div class="alert-item"><strong>${esc(a.term)}</strong><small>${esc(a.country||'All markets')} · ${esc(a.source)} · ${a.last_checked_at?'Checked '+esc(new Date(a.last_checked_at*1000).toLocaleDateString()):'Waiting for scheduled delivery'}</small><button data-delete-alert="${esc(a.id)}">Delete</button></div>`).join('')}</div>`;}
function openNoticeDialog(id){
  const n=state.items.find(x=>x.id===id);if(!n)return;
  const cell=(label,val)=>`<div><span>${esc(label)}</span>${esc(val??'Not disclosed')}</div>`;
  $('#notice-dialog-content').innerHTML=`<div class="notice-dialog-main"><div class="notice-dialog-top"><span class="source-pill ${esc(n.source)}">${esc(n.sourceLabel||n.source)}</span><button id="close-notice" class="icon-button" type="button" aria-label="Close details">${icon('x')}</button></div><h2 class="notice-dialog-title">${esc(n.title)}</h2><div class="buyer-line">${icon('building')} ${esc(n.buyer||'Not listed')}</div><div class="notice-dialog-note">This is a source-backed publication summary, not verification that bidding is currently open. Check the official files for extensions, amendments and eligibility.</div><div class="notice-dialog-facts">${cell('Market',n.countryName)}${cell('Published',dateFmt(n.published))}${cell('Deadline as published',n.deadline?dateFmt(n.deadline):'Not verified')}${cell('Deadline category',deadlineCategory(n))}${cell('Estimated value',euroFmt(n.budget,n.currency))}${cell('Official reference',n.reference)}${cell('Notice type',n.noticeType)}${cell('CPV codes',(n.cpv||[]).join(' · ')||'Not supplied')}${cell('Publisher',n.provenance)}${cell('Amendment signal',n.amended?'Amended — check original notice':'Not identified in feed')}</div><div class="notice-dialog-footer"><a class="primary-button" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener noreferrer">Open original document ${icon('external')}</a>${n.sourceDetailUrl?`<a class="outline-button" href="${esc(safeUrl(n.sourceDetailUrl))}" target="_blank" rel="noopener noreferrer">Tendering portal ${icon('external')}</a>`:''}</div></div>`;
  $('#notice-dialog').showModal();$('#close-notice').addEventListener('click',()=>$('#notice-dialog').close());
}
function exportResults(){
  const rows=currentViewItems();if(!rows.length){toast('No records are available to export in this view.');return;}
  const blob=new Blob([makeCsv(rows)],{type:'text/csv;charset=utf-8'});
  const u=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=u;a.download=`tenderatlas-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
  toast(`${rows.length} sourced record${rows.length===1?'':'s'} exported.`);
}
async function copySearch(){
  const u=new URL(location.href);u.searchParams.delete('view');
  try{await navigator.clipboard.writeText(u.href);toast('Search link copied to clipboard.');}
  catch{toast('Clipboard unavailable. Copy the address from your browser.',true);}
}
async function loadHealth(){
  try{state.health=await api('/api/health');state.features=state.health.features||{};
    const sam=$('#filter-source option[value="sam"]');if(sam){sam.disabled=!state.features.samGov;sam.textContent=state.features.samGov?'USA · SAM.gov':'USA · SAM.gov (requires API key)';}
    if(!state.features.accounts){$('#sign-in-btn').title='Guest bookmarks are local-only. Sign-in requires D1 and email setup.';}
    if(!state.features.alerts){const b=$('#alert-form button[type=submit]');if(b){b.disabled=true;b.title='Email delivery requires D1, Resend and scheduler configuration';}}
  }catch(e){console.warn('Health endpoint unavailable:',e.message);}
}
function openLogin(){if(state.health&&!state.features.accounts){toast('Account sign-in is not configured yet. You can save notices on this device.');return;}const dialog=$('#login-dialog');$('#email-form').hidden=false;$('#verify-form').hidden=true;$('#auth-feedback').textContent='';dialog.showModal();$('#login-email').focus();}
async function handleAi(id){if(state.health&&!state.features.aiMatching)return toast('AI analysis is not yet enabled on this deployment.');if(!state.session){openLogin();return;}if((state.session.tier||'free')==='free'){showView('billing');toast('Upgrade to unlock AI semantic matching.');return;}const notice=state.items.find(x=>x.id===id);if(!notice)return;try{toast('Analyzing semantic relevance…');const out=await api('/api/match',{method:'POST',body:JSON.stringify({notice})});state.aiResults[id]=out;renderResults();toast('AI similarity calculated. Verify all conditions at the source.');}catch(e){toast(e.message,true);}}
async function handleSave(id){
  const notice=state.items.find(x=>x.id===id);
  const exists=state.saved.find(x=>x.noticeId===id);
  try{
    if(!state.session){
      if(exists){state.guestSaved=state.guestSaved.filter(x=>x.noticeId!==id);toast('Removed from device shortlist.');}
      else if(notice){
        const record={noticeId:id,title:notice.title,source:notice.source,sourceUrl:notice.url,notice:{...notice}};
        state.guestSaved=[record,...state.guestSaved].slice(0,60);toast('Saved on this device. Sign in for cross-device sync once enabled.');
      }
      state.saved=state.guestSaved;persistGuestSaved();
    }else if(exists){await api('/api/account/watchlist',{method:'DELETE',body:JSON.stringify({noticeId:id})});state.saved=state.saved.filter(x=>x.noticeId!==id);toast(t('savedremove'));}
    else if(notice){await api('/api/account/watchlist',{method:'POST',body:JSON.stringify({notice})});await loadSaved();toast(t('savedok'));}
    if(state.view==='discover')renderResults();if(state.view==='saved')renderSaved();$('#saved-count').textContent=String(state.saved.length);
  }catch(e){toast(e.message,true);}
}
async function loadBilling(){if(!state.session){$('#billing-status').textContent='Sign in to view your subscription.';return;}try{const b=await api('/api/billing/status');$('#billing-status').textContent=`Current tier: ${b.tier.toUpperCase()} · Billing status: ${b.status}${b.billingConfigured?'':' · Stripe configuration pending'}`;}catch(e){$('#billing-status').textContent=e.message;}}
async function startCheckout(tier){if(state.health&&!state.features.billing)return toast('Payments are not active. The subscription plans are not available for purchase yet.');if(tier==='free')return toast('The free plan is available without payment.');if(!state.session){openLogin();return;}try{const res=await api('/api/billing/checkout',{method:'POST',body:JSON.stringify({tier})});location.assign(res.url);}catch(e){toast(e.message,true);}}
function bind(){icons();
  $('#filter-status').addEventListener('change',renderResults);
  $('#filter-sort').addEventListener('change',renderResults);
  $('#export-results').addEventListener('click',exportResults);
  $('#copy-search').addEventListener('click',copySearch);
  $('#notice-dialog').addEventListener('click',e=>{if(e.target.id==='notice-dialog')e.target.close();});
  $$('#quick-searches button').forEach(btn=>btn.addEventListener('click',()=>{
    $('#query-input').value=btn.dataset.quick;$$('#quick-searches button').forEach(b=>b.classList.toggle('active',b===btn));loadSearch();
  }));
  $$('[data-view]').forEach(el=>el.addEventListener('click',()=>showView(el.dataset.view)));$$('[data-action="open-plans"]').forEach(el=>el.addEventListener('click',()=>showView('billing')));$('#language-toggle').addEventListener('click',()=>{state.lang=state.lang==='en'?'el':'en';localStorage.setItem('ta:lang',state.lang);applyLanguage();});$('#sign-in-btn').addEventListener('click',async()=>{if(!state.session){openLogin();return;}try{await api('/api/auth/logout',{method:'POST',body:'{}'});await loadAccount();showView('discover');toast('Signed out securely.');}catch(e){toast(e.message,true);}});$('#close-login').addEventListener('click',()=>$('#login-dialog').close());$('#login-dialog').addEventListener('click',e=>{if(e.target.id==='login-dialog')e.target.close();});$('#hero-search').addEventListener('submit',e=>{e.preventDefault();showView('discover',false);loadSearch();});$('#filters').addEventListener('submit',e=>{e.preventDefault();loadSearch();});$('#refresh-btn').addEventListener('click',()=>loadSearch());$('#clear-filters').addEventListener('click',()=>{$('#query-input').value='';$('#filter-source').value='all';$('#filter-country').value='';$('#filter-days').value='30';$('#filter-status').value='all';$('#filter-sort').value='recent';$$('#quick-searches button').forEach(b=>b.classList.remove('active'));loadSearch();});$('#more-results').addEventListener('click',()=>{state.page++;loadSearch(false);});document.addEventListener('click',e=>{const detail=e.target.closest('[data-detail]');if(detail){openNoticeDialog(detail.dataset.detail);return;}const ai=e.target.closest('[data-ai]');if(ai){handleAi(ai.dataset.ai);return;}const save=e.target.closest('[data-save]');if(save){handleSave(save.dataset.save);return;}const rem=e.target.closest('[data-remove]');if(rem){handleSave(rem.dataset.remove);return;}const del=e.target.closest('[data-delete-alert]');if(del){(async()=>{try{await api('/api/alerts',{method:'DELETE',body:JSON.stringify({id:del.dataset.deleteAlert})});await loadAlerts();renderAlerts();toast('Alert deleted.');}catch(e){toast(e.message,true);}})();return;}const tier=e.target.closest('[data-tier]');if(tier)startCheckout(tier.dataset.tier);});$('#email-form').addEventListener('submit',async e=>{e.preventDefault();const el=$('#email-form button');el.disabled=true;try{const r=await api('/api/auth/request',{method:'POST',body:JSON.stringify({email:$('#login-email').value.trim()})});state.challengeId=r.challengeId;$('#email-form').hidden=true;$('#verify-form').hidden=false;$('#auth-feedback').textContent='A 6-digit code has been sent. It expires in 10 minutes.';$('#login-code').focus();}catch(err){$('#auth-feedback').textContent=err.message;}finally{el.disabled=false;}});$('#verify-form').addEventListener('submit',async e=>{e.preventDefault();const el=$('#verify-form button[type=submit]');el.disabled=true;try{await api('/api/auth/verify',{method:'POST',body:JSON.stringify({challengeId:state.challengeId,code:$('#login-code').value.trim()})});$('#login-dialog').close();await loadAccount();toast('Signed in. Your workspace is ready.');}catch(err){$('#auth-feedback').textContent=err.message;}finally{el.disabled=false;}});$('#change-email').addEventListener('click',()=>{$('#verify-form').hidden=true;$('#email-form').hidden=false;$('#auth-feedback').textContent='';});$('#profile-form').addEventListener('submit',async e=>{e.preventDefault();if(!state.session){openLogin();return;}const csv=id=>$(id).value.split(',').map(x=>x.trim()).filter(Boolean);const profile={name:$('#profile-name').value.trim(),description:$('#profile-description').value.trim(),keywords:csv('#profile-keywords'),cpvCodes:csv('#profile-cpvs'),countries:csv('#profile-countries').map(x=>x.toUpperCase())};try{await api('/api/account/profile',{method:'PUT',body:JSON.stringify(profile)});await loadProfile();toast('Company profile saved. Matching signals updated.');}catch(e){toast(e.message,true);}});$('#alert-form').addEventListener('submit',async e=>{e.preventDefault();if(!state.session){openLogin();return;}try{await api('/api/alerts',{method:'POST',body:JSON.stringify({term:$('#alert-term').value,country:$('#alert-country').value,source:$('#alert-source').value})});await loadAlerts();renderAlerts();$('#alert-term').value='';toast('Alert created. Delivery begins when the scheduler is configured.');}catch(e){toast(e.message,true);}});$('#manage-billing').addEventListener('click',async()=>{if(!state.session){openLogin();return;}try{const r=await api('/api/billing/portal',{method:'POST',body:'{}'});location.assign(r.url);}catch(e){toast(e.message,true);}});}
(async function init(){
  state.guestSaved=readGuestSaved();state.saved=state.guestSaved;
  bind();applyLanguage();
  const qp=new URLSearchParams(location.search);
  if(qp.get('q'))$('#query-input').value=qp.get('q').slice(0,80);
  if(['all','ted','khmdhs','uk','sam'].includes(qp.get('source')))$('#filter-source').value=qp.get('source');
  if(qp.has('country'))$('#filter-country').value=qp.get('country');
  if(['7','30','90'].includes(qp.get('days')))$('#filter-days').value=qp.get('days');
  if(qp.get('view'))showView(qp.get('view'),false);
  if(qp.get('checkout')==='success')toast('Checkout returned. Access updates after Stripe verifies the subscription.');
  if(qp.get('checkout')==='canceled')toast('Payment was not completed.');
  await loadHealth();
  if($('#filter-source').value==='sam'&&!state.features.samGov)$('#filter-source').value='all';
  await Promise.allSettled([loadAccount(),loadSearch()]);
})();
