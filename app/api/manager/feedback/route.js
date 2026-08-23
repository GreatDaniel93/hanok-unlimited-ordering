import { db } from '@/lib/db';
import { getAccessToken, requireRole } from '@/lib/auth';
import { jsonError } from '@/lib/helpers';

export async function GET(request){
  const role=await requireRole(['manager']);
  if(!role)return jsonError('Manager login required.',401);
  const token=await getAccessToken();
  const u=new URL(request.url);
  const from=u.searchParams.get('from');
  const to=u.searchParams.get('to');
  if(!from||!to)return jsonError('Date range required.',400);
  try{
    const {data,error}=await db().rpc('manager_get_survey',{p_secret:token,p_from:from,p_to:to});
    if(error)return jsonError(error.message,500);
    return Response.json(data,{headers:{'cache-control':'no-store'}});
  }catch(error){return jsonError(error.message,503);}
}

export async function POST(request){
  const role=await requireRole(['manager']);
  if(!role)return jsonError('Manager login required.',401);
  const token=await getAccessToken();
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||'');
  if(!['add','update','delete','restore'].includes(action))return jsonError('Unsupported action.',400);
  const payload=body.payload&&typeof body.payload==='object'?body.payload:{};
  try{
    const {data,error}=await db().rpc('manager_save_survey_question',{p_secret:token,p_action:action,p_question_id:body.question_id||null,p_payload:payload});
    if(error)return jsonError(error.message,409);
    return Response.json(data);
  }catch(error){return jsonError(error.message,503);}
}
