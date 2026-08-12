'use client';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

function formatTime(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function CustomerPage() {
  const { token } = useParams();
  const [data,setData] = useState(null);
  const [error,setError] = useState('');
  const [category,setCategory] = useState('meat');
  const [cart,setCart] = useState({});
  const [now,setNow] = useState(Date.now());
  const [submitting,setSubmitting] = useState(false);

  async function load() {
    try {
      const r = await fetch(`/api/customer/session?token=${encodeURIComponent(token)}`, {cache:'no-store'});
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load table.');
      setData(j);setError('');
    } catch (e) { setError(e.message); }
  }
  useEffect(()=>{ load(); const p=setInterval(load,5000); const t=setInterval(()=>setNow(Date.now()),1000); return()=>{clearInterval(p);clearInterval(t)}; },[token]);

  const session=data?.session;
  const menu=useMemo(()=>data?.menu?.filter(x=>x.category===category)||[],[data,category]);
  const meatCount=Object.entries(cart).reduce((n,[id,q])=>n+(data?.menu?.find(x=>x.id===id)?.category==='meat'?q:0),0);
  const itemCount=Object.values(cart).reduce((a,b)=>a+b,0);
  const meatLimit=session ? (session.starter_equivalent<=2?4:session.starter_equivalent<=4?6:session.starter_equivalent<=6?8:10) : 0;
  const meatWait=session ? Math.max(0,new Date(session.meat_order_available_at).getTime()-now) : 0;
  const hotWait=session ? Math.max(0,new Date(session.hot_order_available_at).getTime()-now) : 0;
  const remaining=session ? new Date(session.ends_at).getTime()-now : 0;
  const lastOrderClosed=session ? now>=new Date(session.last_order_at).getTime() : false;

  function change(item,delta){
    const current=cart[item.id]||0;const next=Math.max(0,current+delta);
    if(next>item.max_per_round) return;
    if(item.category==='meat'&&delta>0&&meatCount>=meatLimit) return;
    setCart(c=>({...c,[item.id]:next}));
  }

  async function submit(){
    if(!itemCount)return;
    setSubmitting(true);setError('');
    const items=Object.entries(cart).filter(([,qty])=>qty>0).map(([menu_item_id,qty])=>({menu_item_id,qty}));
    const r=await fetch('/api/customer/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,items})});
    const j=await r.json();
    if(!r.ok){setError(j.error||'Order failed.');setSubmitting(false);return;}
    setCart({});setSubmitting(false);await load();
  }

  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · TABLE ORDERING</small></div></div>
    <main className="page" style={{maxWidth:760}}>
      {error&&<div className="error" style={{marginBottom:12}}>{error}</div>}
      {!data&&!error&&<div className="card"><div className="spinner"/> Loading…</div>}
      {data&&<>
        <section className="hero">
          <h1>HANOK UNLIMITED</h1>
          <div className="actions" style={{marginTop:14}}><span className="badge new">{data.table.name}</span>{session&&<span className="badge new">{session.total_guests} Guests</span>}<span className="spacer"/><b style={{fontSize:28}}>{session?formatTime(remaining):'--:--'}</b></div>
        </section>
        {!session ? <div className="notice" style={{marginTop:14}}><b>Your table is not active yet.</b><br/>Please wait for our team to start your dining session.</div> : <>
          <div className="notice" style={{marginTop:14}}><b>Hanok First Grill Selection</b><br/>Your starter platter has been sent to the meat station. Side dishes and desserts are self-service.</div>
          {lastOrderClosed&&<div className="error" style={{marginTop:10}}>Last order has closed for this session. Please speak with our team if you need assistance.</div>}
          <div className="actions" style={{margin:'16px 0 10px',overflowX:'auto',flexWrap:'nowrap'}}>
            {[["meat","BBQ Meats"],["hot","Hot Dishes"],["rice_soup","Rice & Soup"]].map(([k,l])=><button key={k} className={`btn ${category===k?'brand':'secondary'}`} onClick={()=>setCategory(k)}>{l}</button>)}
          </div>
          <div className="grid grid-2">
            {menu.map(item=>{const q=cart[item.id]||0;const wait=item.category==='meat'?meatWait:hotWait;return <div className="card" key={item.id} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'center'}}>
              <div><h3 style={{margin:'0 0 4px',fontSize:16}}>{item.display_name||item.name}</h3><div className="muted" style={{fontSize:12}}>{item.portion_label||item.description}</div>{wait>0&&<div style={{fontSize:11,color:'#8a5010',marginTop:6}}>Next order in {formatTime(wait)}</div>}</div>
              <div className="actions" style={{alignItems:'center',flexWrap:'nowrap'}}><button className="btn secondary small" onClick={()=>change(item,-1)}>−</button><b>{q}</b><button className="btn secondary small" disabled={wait>0||lastOrderClosed} onClick={()=>change(item,1)}>+</button></div>
            </div>})}
          </div>
          <div className="card" style={{position:'sticky',bottom:12,marginTop:16,background:'#241c18',color:'#fff',zIndex:20}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}><div><b>{itemCount} items</b><div style={{fontSize:12,color:'#d8c7aa'}}>Meat {meatCount} / {meatLimit} this round</div></div><div className="spacer"/><button className="btn gold" disabled={!itemCount||submitting||lastOrderClosed} onClick={submit}>{submitting?'SENDING…':'PLACE ORDER'}</button></div>
          </div>
          <div className="section-title"><h3>Your recent orders</h3></div>
          <div className="card">{!data.recent_orders?.length?<span className="muted">No reorder submitted yet.</span>:data.recent_orders.map(o=><div key={o.id} style={{borderBottom:'1px solid var(--line)',padding:'10px 0'}}><b>Round {o.round_no}</b> · <span className="muted">{o.status}</span><div style={{fontSize:13,marginTop:4}}>{o.order_items.map(i=>`${i.item_name} ×${i.qty}`).join(' · ')}</div></div>)}</div>
        </>}
      </>}
    </main>
  </>;
}
