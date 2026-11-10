import {json} from '../../_lib/http.js';
import {sessionUser,getTier} from '../../_lib/auth.js';
export async function onRequestGet({request,env}){try{const user=await sessionUser(request,env);if(!user)return json({authenticated:false,setupRequired:!env.DB});const tier=await getTier(user.id,env.DB);return json({authenticated:true,user:{id:user.id,email:user.email},tier});}catch{return json({authenticated:false,error:'Account service unavailable'},503);}}
