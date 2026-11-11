import {json,fail} from '../_lib/http.js';
import {searchSources} from '../_lib/sources.js';
export async function onRequestGet({request,waitUntil,env={}}){
  try{
    const url=new URL(request.url);const cache=typeof caches!=='undefined'?caches.default:null;
    // Cache only anonymous public lookups; the API never includes per-user state.
    if(cache){try{const hit=await cache.match(request);if(hit)return hit;}catch(e){console.warn('Search cache unavailable',String(e.message||e));}}
    const data=await searchSources(Object.fromEntries(url.searchParams),fetch,{samApiKey:env.SAM_API_KEY||''});
    const response=json(data,200,{'cache-control':'public, max-age=45, s-maxage=180'});
    if(cache&&!data.partial&&typeof waitUntil==='function'){
      waitUntil(cache.put(request,response.clone()).catch(e=>console.warn('Search cache write failed',String(e.message||e))));
    }
    return response;
  }catch(e){return fail(e);}
}
