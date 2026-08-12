import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(){
  const role=await requireRole(['manager']);
  if(!role)return jsonError('Manager login required.',401);
  const token=await getAccessToken();
  try{const {data,error}=await db().rpc('manager_get_tables',{p_secret:token});if(error)return jsonError(error.message,500);return Response.json(data);}catch(error){return jsonError(error.message||'Unable to load tables.',503);}
}

export async function POST(request){
  const role=await requireRole(['manager']);
  if(!role)return jsonError('Manager login required.',401);
  const token=await getAccessToken();
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||'');
  if(!['add','update','disable','enable'].includes(action))return jsonError('Unsupported table action.');
  try{const {data,error}=await db().rpc('manager_table_action',{p_secret:token,p_action:action,p_table_id:body.table_id||null,p_payload:body.payload||{}});if(error)return jsonError(error.message,409);return Response.json(data);}catch(error){return jsonError(error.message||'Table update failed.',503);}
}
