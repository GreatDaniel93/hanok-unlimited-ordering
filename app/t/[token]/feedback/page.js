'use client';
import { useParams } from 'next/navigation';
import { useEffect,useState } from 'react';

export default function FeedbackPage(){
  const {token}=useParams();
  const [sessionId,setSessionId]=useState(undefined);
  const [data,setData]=useState(null);
  const [answers,setAnswers]=useState({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);

  useEffect(()=>{setSessionId(new URLSearchParams(window.location.search).get('session')||'');},[]);
  useEffect(()=>{
    if(sessionId===undefined)return;
    let active=true;
    (async()=>{
      try{
        const r=await fetch(`/api/customer/feedback?token=${encodeURIComponent(token)}&session=${encodeURIComponent(sessionId)}`,{cache:'no-store'});
        const j=await r.json();
        if(!r.ok)throw new Error(j.error||'Unable to load survey.');
        if(active)setData(j);
      }catch(e){if(active)setError(e.message||'Unable to load survey.');}
    })();
    return()=>{active=false};
  },[token,sessionId]);

  function setAnswer(id,value){setAnswers(a=>({...a,[id]:value}));}
  function toggleMulti(id,value){setAnswers(a=>{const cur=Array.isArray(a[id])?a[id]:[];return {...a,[id]:cur.includes(value)?cur.filter(x=>x!==value):[...cur,value]};});}
  function answered(q){const v=answers[q.id];if(q.question_type==='multi')return Array.isArray(v)&&v.length>0;if(q.question_type==='text')return typeof v==='string'&&v.trim().length>0;return v!==undefined&&v!==null&&v!=='';}

  async function submit(){
    const missing=(data?.questions||[]).filter(q=>q.required&&!answered(q));
    if(missing.length){setError('Please answer all required questions before submitting.');window.scrollTo({top:0,behavior:'smooth'});return;}
    setBusy(true);setError('');
    try{
      const payload=(data?.questions||[]).filter(q=>answered(q)).map(q=>({question_id:q.id,answer:answers[q.id]}));
      const r=await fetch('/api/customer/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,session_id:sessionId||data?.session?.id||null,answers:payload})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Unable to submit feedback.');
      setDone(true);window.scrollTo({top:0,behavior:'smooth'});
    }catch(e){setError(e.message||'Unable to submit feedback.');}
    finally{setBusy(false);}
  }

  const mode=data?.session?.service_mode;
  if(done)return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · FEEDBACK</small></div></div><main className="page" style={{maxWidth:680}}><section className="hero"><h1>Thank you!</h1><p>Your feedback has been received and helps us improve Hanok Wagga Wagga.</p></section><div className="card" style={{marginTop:16,textAlign:'center'}}><div style={{fontSize:46}}>✓</div><h2>Feedback submitted</h2><p className="muted">Thank you for dining with us.</p><a className="btn brand" href={`/t/${token}`}>BACK TO ORDERING</a></div></main></>;

  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · FEEDBACK</small></div></div>
    <main className="page" style={{maxWidth:720}}>
      <section className="hero"><h1>Customer Feedback</h1><p>A quick 1–2 minute survey. Your feedback helps us improve the food, service and value at Hanok Wagga Wagga.</p>{data&&<div className="actions" style={{marginTop:12}}><span className="badge new">{data.table?.name}</span>{mode&&<span className="badge new">{mode==='lunch'?'WEEKDAY LUNCH BUFFET':'UNLIMITED BBQ'}</span>}</div>}</section>
      {error&&<div className="error" style={{marginTop:14}}>{error}</div>}
      {!data&&!error&&<div className="card" style={{marginTop:16}}><div className="spinner"/> Loading survey…</div>}
      {data&&<>
        <div style={{display:'grid',gap:12,marginTop:16}}>{(data.questions||[]).map((q,i)=><div className="card" key={q.id}>
          <div className="eyebrow">QUESTION {i+1}{q.required?' · REQUIRED':''}</div>
          <h3 style={{margin:'6px 0 14px',lineHeight:1.35}}>{q.question_text}</h3>
          {q.question_type==='rating'&&<div><div className="actions" style={{gap:8,flexWrap:'nowrap'}}>{[1,2,3,4,5].map(n=><button key={n} className={`btn ${answers[q.id]===n?'brand':'secondary'}`} style={{flex:1,minWidth:42}} onClick={()=>setAnswer(q.id,n)}>{n}</button>)}</div><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--muted)',marginTop:6}}><span>Poor</span><span>Excellent</span></div></div>}
          {q.question_type==='single'&&<div style={{display:'grid',gap:8}}>{(q.options||[]).map(opt=><label key={opt} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',border:'1px solid var(--line)',borderRadius:10,cursor:'pointer'}}><input type="radio" name={q.id} checked={answers[q.id]===opt} onChange={()=>setAnswer(q.id,opt)}/><span>{opt}</span></label>)}</div>}
          {q.question_type==='multi'&&<div style={{display:'grid',gap:8}}>{(q.options||[]).map(opt=>{const checked=Array.isArray(answers[q.id])&&answers[q.id].includes(opt);return <label key={opt} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',border:'1px solid var(--line)',borderRadius:10,cursor:'pointer'}}><input type="checkbox" checked={checked} onChange={()=>toggleMulti(q.id,opt)}/><span>{opt}</span></label>})}</div>}
          {q.question_type==='text'&&<textarea value={answers[q.id]||''} maxLength={2000} rows={5} onChange={e=>setAnswer(q.id,e.target.value)} placeholder="Tell us what we could do better…" style={{width:'100%',padding:12,border:'1px solid var(--line)',borderRadius:10,resize:'vertical'}}/>}
        </div>)}</div>
        <div className="card" style={{marginTop:16}}><p className="muted" style={{marginTop:0}}>Your response is anonymous. No name, email address or phone number is requested.</p><button className="btn brand" disabled={busy||!(data.questions||[]).length} onClick={submit} style={{width:'100%'}}>{busy?'SUBMITTING…':'SUBMIT FEEDBACK'}</button><a className="btn secondary" href={`/t/${token}`} style={{width:'100%',marginTop:8}}>BACK TO ORDERING</a></div>
      </>}
    </main>
  </>;
}
