import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function POST(request){
  const role = await requireRole(['manager']);
  if(!role) return jsonError('Manager login required.',401);
  const token = await getAccessToken();
  const body = await request.json().catch(()=>({}));
  const action = String(body.action||'');
  if(!['close_all_tables','clear_all_orders'].includes(action)) return jsonError('Unsupported action.',400);
  try{
    const {data,error}=await db().rpc('manager_bulk_action',{p_secret:token,p_action:action});
    if(error) return jsonError(error.message,409);
    return Response.json(data);
  }catch(error){return jsonError(error.message,503);}
}
