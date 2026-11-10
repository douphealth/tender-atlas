export function json(data,status=200,headers={}) { return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}}); }
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export function fail(err){ console.error('API request failed:',String(err?.message||err)); return json({error:err instanceof HttpError?err.message:'Service temporarily unavailable',code:err instanceof HttpError?'REQUEST_ERROR':'SERVER_ERROR'},err instanceof HttpError?err.status:500); }
export function sameOrigin(req) { const origin=req.headers.get('origin');const site=req.headers.get('sec-fetch-site');return site!=='cross-site' && (!origin || origin === new URL(req.url).origin); }
export function requireOrigin(req){if(!sameOrigin(req)) throw new HttpError(403,'Cross-site request blocked');}
export async function body(req,max=4000){ const length=Number(req.headers.get('content-length')||0);if(length>max) throw new HttpError(413,'Request too large'); const raw=await req.text();if(raw.length>max)throw new HttpError(413,'Request too large');try{return JSON.parse(raw);}catch{throw new HttpError(400,'Invalid JSON');}}
export function limitStr(value,max=200){return typeof value==='string'?value.trim().slice(0,max):'';}
export function validEmail(v){return typeof v==='string' && v.length<=254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
export function requiredDB(env){if(!env.DB)throw new HttpError(503,'Account features require the DB binding. See deployment setup.');return env.DB;}
export function cleanUrl(url){try{const u=new URL(url);return u.protocol==='https:'?u.toString():null;}catch{return null;}}
