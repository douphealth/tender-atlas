import {json,fail,requireOrigin} from '../../_lib/http.js';
import {cookie,sha256,clearCookie} from '../../_lib/auth.js';
export async function onRequestPost({request,env}){try{requireOrigin(request);const token=cookie(request);if(env.DB&&/^[a-f0-9]{64}$/.test(token)){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();}return json({ok:true},200,{'set-cookie':clearCookie(request)});}catch(e){return fail(e);}}
