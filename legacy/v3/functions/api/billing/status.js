import {json,fail} from '../../_lib/http.js';
import {requireUser,getTier} from '../../_lib/auth.js';
export async function onRequestGet({request,env}){try{const {db,user}=await requireUser(request,env);const row=await db.prepare('SELECT status,tier,updated_at FROM subscriptions WHERE user_id=?').bind(user.id).first();return json({tier:await getTier(user.id,db),status:row?.status||'inactive',billingConfigured:!!(env.STRIPE_SECRET_KEY&&env.STRIPE_WEBHOOK_SECRET&&env.STRIPE_PRICE_PRO)});}catch(e){return fail(e);}}
