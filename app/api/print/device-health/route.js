import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

function secretFrom(request){return request.headers.get('x-print-secret')||'';}

export async function POST(request){
  const body=await request.json().catch(()=>({}));
  try{
    const {data,error}=await db().rpc('print_report_device_health',{
      p_secret:secretFrom(request),
      p_payload:body&&typeof body==='object'?body:{}
    });
    if(error)return jsonError(error.message,401);
    return Response.json(data,{headers:{'cache-control':'no-store'}});
  }catch(error){
    return jsonError(error.message,503);
  }
}
