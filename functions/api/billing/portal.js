import {json,fail,HttpError,requireOrigin} from '../../_lib/http.js';
import {requireUser} from '../../_lib/auth.js';
import {stripe} from '../../_lib/stripe.js';
export async function onRequestPost({request,env}){try{requireOrigin(request);const {user}=await requireUser(request,env);if(!user.stripe_customer_id)throw new HttpError(400,'No billing account found');const origin=env.APP_URL||new URL(request.url).origin;const p=await stripe(env,'billing_portal/sessions',{customer:user.stripe_customer_id,return_url:`${origin}/?view=billing`});if(!p.url||!p.url.startsWith('https://billing.stripe.com/'))throw new HttpError(502,'Invalid billing portal response');return json({url:p.url});}catch(e){return fail(e);}}
