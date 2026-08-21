import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(){
  const role=await requireRole(['manager']);
  if(!role)return jsonError('Manager login required.',401);
  const token=await getAccessToken();
  const started=Date.now();
  try{
    const {data,error}=await db().rpc('manager_opening_check',{p_secret:token});
    if(error)return jsonError(error.message,409);
    return Response.json({...data,api_latency_ms:Date.now()-started},{headers:{'cache-control':'no-store'}});
  }catch(error){
    return jsonError(error.message,503);
  }
}
