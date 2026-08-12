import { db, backendSecret } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

function authorized(request){const expected=process.env.PRINT_AGENT_SECRET;return expected&&request.headers.get('x-print-secret')===expected;}

export async function GET(request){
  if(!authorized(request)) return jsonError('Unauthorized.',401);
  try { const {data,error}=await db().rpc('print_get_pending',{p_secret:backendSecret()}); if(error)return jsonError(error.message,500); return Response.json(data); }
  catch(error){ return jsonError(error.message,503); }
}
export async function PATCH(request){
  if(!authorized(request)) return jsonError('Unauthorized.',401);
  const body=await request.json().catch(()=>({}));
  try { const {data,error}=await db().rpc('print_mark',{p_secret:backendSecret(),p_order_id:String(body.order_id||''),p_printed:Boolean(body.printed),p_attempts:Number(body.attempts)||1}); if(error)return jsonError(error.message,500); return Response.json(data); }
  catch(error){ return jsonError(error.message,503); }
}
