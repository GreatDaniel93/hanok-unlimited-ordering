'use client';
import {useEffect,useMemo,useState} from 'react';

function fmtLocal(x){const y=x.getFullYear(),m=String(x.getMonth()+1).padStart(2,'0'),d=String(x.getDate()).padStart(2,'0');return `${y}-${m}-${d}`}
function range(days){const to=new Date(),from=new Date();from.setDate(from.getDate()-(days-1));return [fmtLocal(from),fmtLocal(to)]}
function bounds(from,to){const a=new Date(`${from}T00:00:00`),b=new Date(`${to}T00:00:00`);b.setDate(b.getDate()+1);return [a.toISOString(),b.toISOString()]}
const blank={question_text:'',question_type:'rating',options:[],required:false,service_modes:['lunch','bbq'],sort_order:100};

export default function FeedbackManager(){
  const r=range(30);const[from,setFrom]=useState(r[0]),[to,setTo]=useState(r[1]);
  const[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState(false),[editing,setEditing]=useState(null),[draft,setDraft]=useState(blank),[tab,setTab]=useState('analytics'),[zh,setZh]=useState(false);
  const L=(en,cn)=>zh?cn:en;
  useEffect(()=>{const sync=()=>setZh(String(document.documentElement.lang||'en').toLowerCase().startsWith('zh'));sync();const o=new MutationObserver(sync);o.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});return()=>o.disconnect()},[]);
  async function load(f=from,t=to){setError('');const[a,b]=bounds(f,t);const res=await fetch(`/api/manager/feedback?from=${encodeURIComponent(a)}&to=${encodeURIComponent(b)}`,{cache:'no-store'});if(res.status===401){location.href='/manager';return}const j=await res.json().catch(()=>({}));if(!res.ok){setError(j.error||L('Unable to load feedback.','无法加载问卷数据。'));return}setData(j)}
  useEffect(()=>{load()},[]);
  function preset(n){const x=range(n);setFrom(x[0]);setTo(x[1]);load(x[0],x[1])}
  function formValue(q){return {...q,options:Array.isArray(q.options)?q.options:[],service_modes:Array.isArray(q.service_modes)?q.service_modes:['lunch','bbq']}}
  async function save(action,q){setBusy(true);setError('');const payload={...q,options:(q.options||[]).map(x=>String(x).trim()).filter(Boolean),service_modes:q.service_modes||[]};const res=await fetch('/api/manager/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,question_id:q.id||null,payload})});const j=await res.json().catch(()=>({}));setBusy(false);if(!res.ok){setError(j.error||L('Unable to save question.','无法保存问题。'));return}setAdding(false);setEditing(null);setDraft(blank);await load()}
  async function toggleDelete(q){const action=q.active?'delete':'restore';if(q.active&&!confirm(L('Delete this question from the live survey? Historical responses will be kept.','从当前问卷中删除这个问题？历史回答会保留。')))return;await save(action,q)}
  const qs=data?.questions||[],active=qs.filter(q=>q.active),hidden=qs.filter(q=>!q.active),k=data?.kpi||{};
  const sorted=useMemo(()=>[...qs].sort((a,b)=>a.sort_order-b.sort_order),[qs]);
  const QuestionForm=({value,onChange,onSave})=><div>
    <div className="field"><label>{L('Question','问题')}</label><textarea rows={3} value={value.question_text||''} onChange={e=>onChange({...value,question_text:e.target.value})}/></div>
    <div className="grid grid-2" style={{marginTop:10}}>
      <div className="field"><label>{L('Question Type','问题类型')}</label><select value={value.question_type} onChange={e=>onChange({...value,question_type:e.target.value})}><option value="rating">{L('Rating 1–5','1–5 分评分')}</option><option value="single">{L('Single Choice','单选')}</option><option value="multi">{L('Multiple Choice','多选')}</option><option value="text">{L('Free Text','文字回答')}</option></select></div>
      <div className="field"><label>{L('Sort Order','排序')}</label><input type="number" min="0" max="9999" value={value.sort_order??100} onChange={e=>onChange({...value,sort_order:Number(e.target.value)})}/></div>
    </div>
    {(value.question_type==='single'||value.question_type==='multi')&&<div className="field" style={{marginTop:10}}><label>{L('Answer Options · one per line','答案选项 · 每行一个')}</label><textarea rows={6} value={(value.options||[]).join('\n')} onChange={e=>onChange({...value,options:e.target.value.split('\n')})}/></div>}
    <div className="actions" style={{marginTop:12}}>
      <label style={{display:'flex',gap:7,alignItems:'center'}}><input type="checkbox" checked={!!value.required} onChange={e=>onChange({...value,required:e.target.checked})}/>{L('Required','必答')}</label>
      <label style={{display:'flex',gap:7,alignItems:'center'}}><input type="checkbox" checked={(value.service_modes||[]).includes('lunch')} onChange={e=>onChange({...value,service_modes:e.target.checked?[...(value.service_modes||[]).filter(x=>x!=='lunch'),'lunch']:(value.service_modes||[]).filter(x=>x!=='lunch')})}/>{L('Lunch Buffet','午餐自助')}</label>
      <label style={{display:'flex',gap:7,alignItems:'center'}}><input type="checkbox" checked={(value.service_modes||[]).includes('bbq')} onChange={e=>onChange({...value,service_modes:e.target.checked?[...(value.service_modes||[]).filter(x=>x!=='bbq'),'bbq']:(value.service_modes||[]).filter(x=>x!=='bbq')})}/>{L('Unlimited BBQ','烤肉自助')}</label>
    </div>
    <button className="btn brand" style={{marginTop:12}} disabled={busy||!value.question_text?.trim()||!(value.service_modes||[]).length} onClick={onSave}>{busy?L('SAVING…','保存中…'):L('SAVE QUESTION','保存问题')}</button>
  </div>;
  const Metric=({label,value})=><div className="card"><div className="muted">{label}</div><div style={{fontSize:30,fontWeight:900}}>{value??0}</div></div>;
  const Bar=({label,count,max})=><div style={{margin:'7px 0'}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>{label}</span><b>{count}</b></div><div style={{height:8,background:'#eee6dc',borderRadius:999,overflow:'hidden',marginTop:4}}><div style={{height:'100%',width:`${max?Math.round(count/max*100):0}%`,background:'var(--brand)'}}/></div></div>;

  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · FEEDBACK</small></div><span className="spacer"/><a className="btn secondary small" href="/manager">{L('Manager Home','经理首页')}</a></div><main className="page" style={{maxWidth:1180}}>
    <section className="hero"><h1>{L('Customer Feedback','顾客问卷')}</h1><p>{L('Survey analytics and live question management. Question deletion is soft-delete so historical responses are preserved.','查看问卷统计并管理当前问题。删除采用软删除，历史回答不会丢失。')}</p></section>
    {error&&<div className="error" style={{marginTop:12}}>{error}</div>}
    <div className="manager-tabs"><button className={`btn ${tab==='analytics'?'brand':'secondary'}`} onClick={()=>setTab('analytics')}>{L('ANALYTICS','数据统计')}</button><button className={`btn ${tab==='questions'?'brand':'secondary'}`} onClick={()=>setTab('questions')}>{L('QUESTIONS','问题管理')}</button></div>
    {tab==='analytics'&&<>
      <div className="card" style={{marginTop:14}}><div className="actions" style={{alignItems:'end'}}><div className="field"><label>{L('From','开始日期')}</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></div><div className="field"><label>{L('To','结束日期')}</label><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></div><button className="btn brand" onClick={()=>load()}>{L('RUN REPORT','生成报表')}</button><button className="btn secondary" onClick={()=>preset(7)}>{L('LAST 7 DAYS','最近7天')}</button><button className="btn secondary" onClick={()=>preset(30)}>{L('LAST 30 DAYS','最近30天')}</button></div></div>
      <div className="grid grid-4" style={{marginTop:14}}><Metric label={L('Responses','问卷数量')} value={k.responses}/><Metric label={L('Lunch Responses','午餐问卷')} value={k.lunch_responses}/><Metric label={L('BBQ Responses','烤肉问卷')} value={k.bbq_responses}/><Metric label={L('Average Rating','平均评分')} value={k.rating_average??'—'}/></div>
      <div className="section-title"><h2>{L('Question Results','各题统计')}</h2></div>
      <div style={{display:'grid',gap:12}}>{sorted.filter(q=>q.response_count>0).map(q=><div className="card" key={q.id}><div className="actions"><div><div className="eyebrow">{q.question_type.toUpperCase()} · {q.response_count} {L('answers','份回答')}</div><h3 style={{margin:'5px 0'}}>{q.question_text}</h3></div>{q.rating_average!=null&&<span className="badge new" style={{fontSize:15}}>{q.rating_average} / 5</span>}</div>
        {q.question_type==='rating'&&<div style={{marginTop:10}}>{[5,4,3,2,1].map(n=>{const d=q.rating_distribution||{};const max=Math.max(1,...Object.values(d).map(Number));return <Bar key={n} label={`${n} ★`} count={Number(d[String(n)]||0)} max={max}/>})}</div>}
        {(q.question_type==='single'||q.question_type==='multi')&&<div style={{marginTop:10}}>{(q.option_counts||[]).map(x=>{const max=Math.max(1,...(q.option_counts||[]).map(y=>Number(y.count)||0));return <Bar key={x.option} label={x.option} count={Number(x.count)||0} max={max}/>})}</div>}
        {q.question_type==='text'&&<div style={{display:'grid',gap:8,marginTop:10}}>{!(q.comments||[]).length?<span className="muted">{L('No comments yet.','暂无留言。')}</span>:(q.comments||[]).map((c,i)=><div key={i} style={{padding:'9px 0',borderTop:'1px solid var(--line)'}}><div>{c.answer}</div><div className="muted" style={{fontSize:11,marginTop:3}}>{c.service_mode==='lunch'?L('Lunch','午餐'):c.service_mode==='bbq'?L('BBQ','烤肉'):L('General','通用')} · {new Date(c.submitted_at).toLocaleString()}</div></div>)}</div>}
      </div>)}</div>
    </>}
    {tab==='questions'&&<>
      <div className="grid grid-3" style={{marginTop:14}}><Metric label={L('Active Questions','启用问题')} value={active.length}/><Metric label={L('Deleted / Hidden','已删除 / 隐藏')} value={hidden.length}/><Metric label={L('Total Questions','问题总数')} value={qs.length}/></div>
      <div className="section-title"><h2>{L('Survey Questions','问卷问题')}</h2><button className="btn brand" onClick={()=>{setAdding(x=>!x);setEditing(null);setDraft(blank)}}>{adding?L('CANCEL','取消'):L('ADD QUESTION','新增问题')}</button></div>
      {adding&&<div className="card" style={{marginBottom:12}}><h3>{L('New Question','新问题')}</h3><QuestionForm value={draft} onChange={setDraft} onSave={()=>save('add',draft)}/></div>}
      <div style={{display:'grid',gap:10}}>{sorted.map(q=><div className="card" key={q.id} style={{opacity:q.active?1:.55}}>{editing?.id===q.id?<><div className="actions"><h3 style={{margin:0}}>{L('Edit Question','编辑问题')}</h3><span className="spacer"/><button className="btn secondary small" onClick={()=>setEditing(null)}>{L('Cancel','取消')}</button></div><div style={{marginTop:12}}><QuestionForm value={editing} onChange={setEditing} onSave={()=>save('update',editing)}/></div></>:<div><div className="actions"><div style={{minWidth:0}}><div className="eyebrow">#{q.sort_order} · {q.question_type.toUpperCase()} · {(q.service_modes||[]).map(x=>x==='lunch'?L('LUNCH','午餐'):L('BBQ','烤肉')).join(' + ')}</div><h3 style={{margin:'5px 0'}}>{q.question_text}</h3><div className="muted" style={{fontSize:12}}>{q.required?L('Required','必答'):L('Optional','选答')} · {q.response_count||0} {L('answers in selected date range','份回答（当前日期范围）')}</div></div><span className="spacer"/><button className="btn secondary small" onClick={()=>setEditing(formValue(q))}>{L('EDIT','编辑')}</button><button className={`btn ${q.active?'danger':'secondary'} small`} onClick={()=>toggleDelete(q)}>{q.active?L('DELETE','删除'):L('RESTORE','恢复')}</button></div>{(q.question_type==='single'||q.question_type==='multi')&&<div className="muted" style={{fontSize:12,marginTop:8}}>{(q.options||[]).join(' · ')}</div>}</div>}</div>)}</div>
    </>}
  </main></>;
}
