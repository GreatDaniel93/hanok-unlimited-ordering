'use client';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

function Login({onDone}){
  const [pin,setPin]=useState('');const [error,setError]=useState('');
  async function login(e){e.preventDefault();const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});const j=await r.json();if(!r.ok)return setError(j.error||'Login failed');onDone();}
  return <main className="page"><div className="card login"><div className="logo-big">HANOK</div><p className="muted">Kitchen KDS</p>{error&&<div className="error">{error}</div>}<form onSubmit={login}><div className="field"><label>Kitchen PIN</label><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} autoFocus/></div><button className="btn brand" style={{width:'100%',marginTop:12}}>SIGN IN</button></form></div></main>
}

export default function KitchenPage(){
  const {station}=useParams();const safeStation=station==='hot'?'hot':'meat';const [orders,setOrders]=useState([]);const [auth,setAuth]=useState(true);const [error,setError]=useState('');
  const loadLock=useRef(false);const orderCount=useRef(0);
  async function load(){
    if(loadLock.current)return;
    loadLock.current=true;
    try{
      const r=await fetch(`/api/kitchen/orders?station=${safeStation}`,{cache:'no-store'});
      if(r.status===401){setAuth(false);return;}
      const j=await r.json();if(!r.ok){setError(j.error||'Unable to load orders');return;}
      const next=j.orders||[];orderCount.current=next.length;setAuth(true);setOrders(next);setError('');
    }catch(e){setError(e.message||'Unable to load orders');}
    finally{loadLock.current=false;}
  }
  useEffect(()=>{
    let timer=null;let stopped=false;
    const schedule=()=>{
      if(stopped)return;
      clearTimeout(timer);
      const delay=document.hidden?30000:(orderCount.current>0?2000:5000);
      timer=setTimeout(async()=>{if(!document.hidden)await load();schedule();},delay);
    };
    const onVisible=()=>{if(!document.hidden)load();schedule();};
    load();schedule();document.addEventListener('visibilitychange',onVisible);window.addEventListener('focus',onVisible);
    return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible)};
  },[safeStation]);
  if(!auth)return <Login onDone={()=>{setAuth(true);load()}}/>;
  async function patch(order_id,body){const r=await fetch('/api/kitchen/orders',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({order_id,...body})});const j=await r.json();if(!r.ok)return setError(j.error||'Action failed');await load();}
  const groups={new:orders.filter(x=>x.status==='new'),preparing:orders.filter(x=>x.status==='preparing'),ready:orders.filter(x=>x.status==='ready')};
  function Ticket({o}){const age=Math.max(0,Math.floor((Date.now()-new Date(o.created_at).getTime())/60000));return <div className="card" style={{border:age>=8&&o.status!=='ready'?'2px solid #b66a12':'1px solid var(--line)'}}><div className="actions" style={{justifyContent:'space-between'}}><div><b style={{fontSize:23}}>{o.table_name}</b><div className="muted" style={{fontSize:12}}>{o.source==='starter'?o.label:`ROUND ${o.round_no}`} · {age} min</div></div><span className={`badge ${o.status==='new'?'new':o.status==='preparing'?'prep':'ready'}`}>{o.status.toUpperCase()}</span></div><div style={{borderTop:'1px dashed var(--line)',marginTop:10,paddingTop:10}}>{o.order_items.map((i,idx)=><div key={idx} style={{fontWeight:750,margin:'6px 0'}}>{i.item_name} × {i.qty}</div>)}</div><div className="actions" style={{marginTop:14}}>{o.status==='new'&&<button className="btn gold small" onClick={()=>patch(o.id,{action:'status',status:'preparing'})}>START</button>}{o.status==='preparing'&&<button className="btn brand small" onClick={()=>patch(o.id,{action:'status',status:'ready'})}>READY</button>}{o.status==='ready'&&<button className="btn small" onClick={()=>patch(o.id,{action:'status',status:'picked_up'})}>PICKED UP</button>}<button className="btn secondary small" onClick={()=>patch(o.id,{action:'reprint'})}>REPRINT</button></div></div>}
  return <><div className="topbar"><div className="logo">HANOK<small>{safeStation==='meat'?'MEAT STATION':'HOT KITCHEN'} · KDS</small></div><div className="spacer"/><a className="btn secondary small" href={`/kitchen/${safeStation==='meat'?'hot':'meat'}`}>Switch Station</a></div><main className="page"><section className="hero"><h1>{safeStation==='meat'?'Meat Station':'Hot Kitchen'}</h1><p>{safeStation==='meat'?'Starter platters and BBQ meat orders.':'Hot dishes, Dolsot Bibimbap and Soup.'}</p></section>{error&&<div className="error" style={{marginTop:12}}>{error}</div>}<div className="grid grid-3" style={{marginTop:16}}><div className="card"><b>NEW</b><div style={{fontSize:30,fontWeight:900}}>{groups.new.length}</div></div><div className="card"><b>PREPARING</b><div style={{fontSize:30,fontWeight:900}}>{groups.preparing.length}</div></div><div className="card"><b>READY</b><div style={{fontSize:30,fontWeight:900}}>{groups.ready.length}</div></div></div><div className="grid grid-3" style={{marginTop:16}}>{[['NEW',groups.new],['PREPARING',groups.preparing],['READY / PICKUP',groups.ready]].map(([name,list])=><section key={name}><h3>{name}</h3><div className="grid">{list.map(o=><Ticket key={o.id} o={o}/>)}{!list.length&&<div className="card muted">No orders</div>}</div></section>)}</div></main></>;
}
