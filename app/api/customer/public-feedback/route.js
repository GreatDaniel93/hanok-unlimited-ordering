import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

export async function GET(request){
  const u=new URL(request.url);
  const mode=String(u.searchParams.get('mode')||'');
  if(!['lunch','bbq'].includes(mode))return jsonError('Please choose a valid buffet type.',400);
  try{
    const {data,error}=await db().rpc('get_public_survey',{p_service_mode:mode});
    if(error)return jsonError(error.message,409);
    return Response.json(data,{headers:{'cache-control':'no-store'}});
  }catch(error){return jsonError(error.message,503);}
}

export async function POST(request){
  const body=await request.json().catch(()=>({}));
  const mode=String(body.service_mode||'');
  const answers=Array.isArray(body.answers)?body.answers:[];
  if(!['lunch','bbq'].includes(mode))return jsonError('Please choose a valid buffet type.',400);
  if(answers.length>30)return jsonError('Too many answers.',400);
  try{
    const {data,error}=await db().rpc('submit_public_survey',{p_service_mode:mode,p_answers:answers});
    if(error)return jsonError(error.message,409);
    return Response.json(data);
  }catch(error){return jsonError(error.message,503);}
}
