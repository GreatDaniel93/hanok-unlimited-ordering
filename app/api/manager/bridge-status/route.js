import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(){
  const role=await requireRole(['manager']);
  if(!role)return jsonError('Manager login required.',401);
  const token=await getAccessToken();
  try{
    const {data,error}=await db().rpc('manager_get_bridge_status',{p_secret:token});
    if(error)return jsonError(error.message,401);
    return Response.json(data,{headers:{'cache-control':'no-store'}});
  }catch(error){
    return jsonError(error.message,503);
  }
}
