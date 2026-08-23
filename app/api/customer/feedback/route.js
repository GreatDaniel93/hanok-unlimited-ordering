import { db } from '@/lib/db';
import { jsonError } from '@/lib/helpers';

export async function GET(request){
  const u=new URL(request.url);
  const token=String(u.searchParams.get('token')||'');
  const session=String(u.searchParams.get('session')||'');
  if(!token)return jsonError('Missing table token.',400);
  try{
    const {data,error}=await db().rpc('get_customer_survey',{p_table_token:token,p_session_id:session||null});
    if(error)return jsonError(error.message,409);
    return Response.json(data,{headers:{'cache-control':'no-store'}});
  }catch(error){return jsonError(error.message,503);}
}

export async function POST(request){
  const body=await request.json().catch(()=>({}));
  const token=String(body.token||'');
  const session=String(body.session_id||'');
  const answers=Array.isArray(body.answers)?body.answers:[];
  if(!token)return jsonError('Missing table token.',400);
  if(answers.length>30)return jsonError('Too many answers.',400);
  try{
    const {data,error}=await db().rpc('submit_customer_survey',{p_table_token:token,p_session_id:session||null,p_answers:answers});
    if(error)return jsonError(error.message,409);
    return Response.json(data);
  }catch(error){return jsonError(error.message,503);}
}
