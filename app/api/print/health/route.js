import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

function secretFrom(request){
  return request.headers.get('x-print-secret') || '';
}

export async function POST(request){
  const body=await request.json().catch(()=>({}));
  const totalOnline=Boolean(body.total_printer_online);
  const splitOnline=Boolean(body.split_printer_online);
  const totalLatency=Math.max(0,Math.min(10000,Number(body.total_printer_latency_ms)||0));
  const splitLatency=Math.max(0,Math.min(10000,Number(body.split_printer_latency_ms)||0));
  const hasBar=Object.prototype.hasOwnProperty.call(body,'bar_printer_online');
  try{
    const args={p_secret:secretFrom(request),p_total_online:totalOnline,p_split_online:splitOnline,p_total_latency_ms:totalLatency,p_split_latency_ms:splitLatency};
    if(hasBar){
      const {data,error}=await db().rpc('print_report_health_v2',{...args,p_bar_online:Boolean(body.bar_printer_online),p_bar_latency_ms:Math.max(0,Math.min(10000,Number(body.bar_printer_latency_ms)||0))});
      if(error)return jsonError(error.message,401);
      return Response.json(data,{headers:{'cache-control':'no-store'}});
    }
    const {data,error}=await db().rpc('print_report_health',args);
    if(error)return jsonError(error.message,401);
    return Response.json(data,{headers:{'cache-control':'no-store'}});
  }catch(error){
    return jsonError(error.message,503);
  }
}
