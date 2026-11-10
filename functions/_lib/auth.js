import {HttpError,requiredDB,validEmail} from './http.js';
const COOKIE='ta_sid';
export const now=()=>Math.floor(Date.now()/1000);
export const hex=(bytes)=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
export function randomToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return hex(a);}
export async function sha256(s){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))));}
export async function hmac(secret,text){if(!secret)throw new HttpError(503,'SESSION_SECRET is not configured');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text))));}
export function cookie(request){const value=request.headers.get('cookie')||'';return value.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)||'';}
export function cookieHeader(token,req){const secure=new URL(req.url).protocol==='https:'?'; Secure':'';return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14*86400}${secure}`;}
export function clearCookie(req){return cookieHeader('',req).replace(/Max-Age=\d+/,'Max-Age=0');}
export async function sessionUser(req,env){if(!env.DB)return null;const token=cookie(req);if(!/^[0-9a-f]{64}$/.test(token))return null;const key=await sha256(token);const r=await env.DB.prepare('SELECT u.id,u.email,u.stripe_customer_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(key,now()).first();return r||null;}
export async function requireUser(req,env){const db=requiredDB(env);const user=await sessionUser(req,env);if(!user)throw new HttpError(401,'Sign in to continue');return {user,db};}
export async function makeSession(userId,req,env){const token=randomToken(),hash=await sha256(token);await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(hash,userId,now()+14*86400,now()).run();return cookieHeader(token,req);}
export async function getTier(userId,db){const row=await db.prepare('SELECT tier,status FROM subscriptions WHERE user_id=?').bind(userId).first();return row&&['active','trialing'].includes(row.status)?row.tier:'free';}
export function emailNormalized(email){if(!validEmail(email))throw new HttpError(400,'Provide a valid email address');return email.trim().toLowerCase();}
