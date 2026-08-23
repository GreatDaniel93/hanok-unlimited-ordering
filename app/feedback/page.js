'use client';
import {useEffect,useMemo,useState} from 'react';

export default function PublicFeedbackPage(){
  const [mode,setMode]=useState('');
  const [data,setData]=useState(null);
  const [answers,setAnswers]=useState({});
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search);
    const m=p.get('mode');
    if(m==='lunch'||m==='bbq')setMode(m);
  },[]);

  useEffect(()=>{
    if(!mode){setData(null);setAnswers({});return;}
    let active=true;
    setError('');setData(null);setAnswers({});setDone(false);
    (async()=>{
      try{
        const r=await fetch(`/api/customer/public-feedback?mode=${encodeURIComponent(mode)}`,{cache:'no-store'});
        const j=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(j.error||'Unable to load survey.');
        if(active)setData(j);
      }catch(e){if(active)setError(e.message||'Unable to load survey.');}
    })();
    return()=>{active=false};
  },[mode]);

  const questions=data?.questions||[];
  const answeredCount=useMemo(()=>questions.filter(q=>answered(q)).length,[questions,answers]);
  function setAnswer(id,value){setAnswers(a=>({...a,[id]:value}));}
  function toggleMulti(id,value){setAnswers(a=>{const cur=Array.isArray(a[id])?a[id]:[];return {...a,[id]:cur.includes(value)?cur.filter(x=>x!==value):[...cur,value]};});}
  function answered(q){const v=answers[q.id];if(q.question_type==='multi')return Array.isArray(v)&&v.length>0;if(q.question_type==='text')return typeof v==='string'&&v.trim().length>0;return v!==undefined&&v!==null&&v!=='';}

  async function submit(){
    const missing=questions.filter(q=>q.required&&!answered(q));
    if(missing.length){setError('Please answer all required questions before submitting.');window.scrollTo({top:0,behavior:'smooth'});return;}
    setBusy(true);setError('');
    try{
      const payload=questions.filter(q=>answered(q)).map(q=>({question_id:q.id,answer:answers[q.id]}));
      const r=await fetch('/api/customer/public-feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({service_mode:mode,answers:payload})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||'Unable to submit feedback.');
      setDone(true);window.scrollTo({top:0,behavior:'smooth'});
    }catch(e){setError(e.message||'Unable to submit feedback.');}
    finally{setBusy(false);}
  }

  if(done)return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · CUSTOMER FEEDBACK</small></div></div><main className="page" style={{maxWidth:680}}><section className="hero"><h1>Thank you!</h1><p>Your feedback has been received and helps us improve Hanok Wagga Wagga.</p></section><div className="card" style={{marginTop:16,textAlign:'center'}}><div style={{fontSize:48}}>✓</div><h2>Feedback submitted</h2><p className="muted">Thank you for dining with us.</p><button className="btn secondary" onClick={()=>{setDone(false);setMode('');setData(null);setAnswers({})}}>SUBMIT ANOTHER RESPONSE</button></div></main></>;

  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · CUSTOMER FEEDBACK</small></div></div><main className="page" style={{maxWidth:720}}>
    <section className="hero"><h1>Customer Feedback</h1><p>A quick 1–2 minute survey. Your feedback helps us improve the food, service and value at Hanok Wagga Wagga.</p></section>
    {error&&<div className="error" style={{marginTop:14}}>{error}</div>}

    {!mode&&<div className="card" style={{marginTop:16}}><div className="eyebrow">STEP 1</div><h2 style={{margin:'6px 0 6px'}}>Which buffet did you have today?</h2><p className="muted">Choose your dining package so we only show questions relevant to your experience.</p><div className="grid grid-2" style={{marginTop:14}}><button className="btn brand" style={{minHeight:74,fontSize:16}} onClick={()=>setMode('lunch')}>WEEKDAY LUNCH BUFFET<br/><span style={{fontSize:12,fontWeight:600}}>60-minute lunch</span></button><button className="btn brand" style={{minHeight:74,fontSize:16}} onClick={()=>setMode('bbq')}>UNLIMITED BBQ<br/><span style={{fontSize:12,fontWeight:600}}>Korean BBQ buffet</span></button></div></div>}

    {mode&&!data&&!error&&<div className="card" style={{marginTop:16}}><div className="spinner"/> Loading survey…</div>}
    {mode&&data&&<>
      <div className="card" style={{marginTop:16}}><div className="actions"><div><div className="eyebrow">YOUR VISIT</div><h2 style={{margin:'4px 0'}}>{mode==='lunch'?'Weekday Lunch Buffet':'Unlimited BBQ'}</h2></div><span className="spacer"/><button className="btn secondary small" onClick={()=>setMode('')}>CHANGE</button></div><p className="muted" style={{marginBottom:0}}>{answeredCount} of {questions.length} questions answered</p></div>
      <div style={{display:'grid',gap:12,marginTop:12}}>{questions.map((q,i)=><div className="card" key={q.id}>
        <div className="eyebrow">QUESTION {i+1}{q.required?' · REQUIRED':''}</div>
        <h3 style={{margin:'6px 0 14px',lineHeight:1.35}}>{q.question_text}</h3>
        {q.question_type==='rating'&&<div><div className="actions" style={{gap:8,flexWrap:'nowrap'}}>{[1,2,3,4,5].map(n=><button key={n} className={`btn ${answers[q.id]===n?'brand':'secondary'}`} style={{flex:1,minWidth:42}} onClick={()=>setAnswer(q.id,n)}>{n}</button>)}</div><div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--muted)',marginTop:6}}><span>Poor</span><span>Excellent</span></div></div>}
        {q.question_type==='single'&&<div style={{display:'grid',gap:8}}>{(q.options||[]).map(opt=><label key={opt} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',border:'1px solid var(--line)',borderRadius:10,cursor:'pointer'}}><input type="radio" name={q.id} checked={answers[q.id]===opt} onChange={()=>setAnswer(q.id,opt)}/><span>{opt}</span></label>)}</div>}
        {q.question_type==='multi'&&<div style={{display:'grid',gap:8}}>{(q.options||[]).map(opt=>{const checked=Array.isArray(answers[q.id])&&answers[q.id].includes(opt);return <label key={opt} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 12px',border:'1px solid var(--line)',borderRadius:10,cursor:'pointer'}}><input type="checkbox" checked={checked} onChange={()=>toggleMulti(q.id,opt)}/><span>{opt}</span></label>})}</div>}
        {q.question_type==='text'&&<textarea value={answers[q.id]||''} maxLength={2000} rows={5} onChange={e=>setAnswer(q.id,e.target.value)} placeholder="Tell us what we could do better…" style={{width:'100%',padding:12,border:'1px solid var(--line)',borderRadius:10,resize:'vertical'}}/>}
      </div>)}</div>
      <div className="card" style={{marginTop:16,marginBottom:30}}><p className="muted" style={{marginTop:0}}>Your response is anonymous. We do not ask for your name, email address or phone number.</p><button className="btn brand" disabled={busy||!questions.length} onClick={submit} style={{width:'100%',minHeight:48}}>{busy?'SUBMITTING…':'SUBMIT FEEDBACK'}</button></div>
    </>}
  </main></>;
}
