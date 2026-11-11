/** Pure view-level intelligence helpers. Never labels a notice legally 'open'. */
export function deadlineCategory(n, today = new Date().toISOString().slice(0,10)) {
  if(n?.status==='cancelled')return 'cancelled';
  if(n?.status==='archived')return 'archived';
  if(n?.deadline&&n.deadline<today)return 'expired';
  if(n?.deadline&&n.deadline>=today)return 'upcoming';
  return 'unknown';
}
export function visibleItems(items, {status='all',sort='recent',scoreFn=null} = {}) {
  const list=(items||[]).filter(n=>{
    const category=deadlineCategory(n);
    return status==='all'||status==='expired'&&['cancelled','expired','archived'].includes(category)||
      status==='upcoming'&&category==='upcoming'||status==='unknown'&&category==='unknown';
  });
  const dateValue=(n,key)=>n[key]||'';
  return list.sort((a,b)=>{
    if(sort==='deadline'){
      const d=(a.deadline||'9999-12-31').localeCompare(b.deadline||'9999-12-31');
      return d||(b.published||'').localeCompare(a.published||'');
    }
    if(sort==='value')return Number(b.budget??-1)-Number(a.budget??-1)||(b.published||'').localeCompare(a.published||'');
    if(sort==='relevance'&&typeof scoreFn==='function')return (scoreFn(b)?.score||0)-(scoreFn(a)?.score||0)||dateValue(b,'published').localeCompare(dateValue(a,'published'));
    return dateValue(b,'published').localeCompare(dateValue(a,'published'));
  });
}
export function upcomingWithin(items,days=14,today=new Date().toISOString().slice(0,10)) {
  const until=new Date(today+'T00:00:00Z');until.setUTCDate(until.getUTCDate()+days);
  const bound=until.toISOString().slice(0,10);
  return (items||[]).filter(n=>deadlineCategory(n,today)==='upcoming'&&n.deadline<=bound).length;
}
const csvCell=v=>{
  let text=String(v??'');
  // Prevent Excel / LibreOffice formula execution from untrusted publisher values.
  if(/^[\s\uFEFF]*[=+\-@]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
};
export function makeCsv(rows){
  const headers=['Source','Reference','Title','Buyer','Market','Published','Deadline','Deadline status','Value','Currency','CPV codes','Official notice URL'];
  const values=(rows||[]).map(n=>[
    n.sourceLabel||n.source,n.reference,n.title,n.buyer,n.countryName||n.country,n.published,n.deadline,
    deadlineCategory(n),n.budget??'',n.currency,(n.cpv||[]).join('; '),n.url,
  ]);
  return '\uFEFF'+[headers,...values].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function marketsInView(items){
  const count=new Map();for(const n of items||[]){const key=n.countryName||n.country||'Unspecified';count.set(key,(count.get(key)||0)+1);}
  return [...count].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name));
}
