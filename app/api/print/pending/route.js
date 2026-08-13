import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

function secretFrom(request) {
  return request.headers.get('x-print-secret') || '';
}

export async function GET(request){
  try {
    const url=new URL(request.url);
    const since=url.searchParams.get('since')||null;
    const station=url.searchParams.get('station')||null;
    const {data,error}=await db().rpc('print_get_pending_v2',{
      p_secret:secretFrom(request),
      p_since:since,
      p_station:station
    });
    if(error)return jsonError(error.message,401);
    return Response.json(data);
  } catch(error){ return jsonError(error.message,503); }
}

export async function PATCH(request){
  const body=await request.json().catch(()=>({}));
  try {
    const {data,error}=await db().rpc('print_mark',{
      p_secret:secretFrom(request),
      p_order_id:String(body.order_id||''),
      p_printed:Boolean(body.printed),
      p_attempts:Number(body.attempts)||1
    });
    if(error)return jsonError(error.message,401);
    return Response.json(data);
  } catch(error){ return jsonError(error.message,503); }
}
