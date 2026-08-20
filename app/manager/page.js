'use client';
import { useState } from 'react';

export default function ManagerDashboard(){
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const operations=[
    ['Menu & Starter','Products, Standard / No Pork Starter and order settings.','/manager/menu'],
    ['Table Management','Add, rename, set capacity, disable and restore tables.','/manager/tables'],
    ['Table QR Codes','View and print QR codes for active tables.','/manager/qr']
  ];
  const control=[
    ['Analytics & Reports','Historical operating data, date-range analysis and product/table performance.','/manager/analytics'],
    ['Access & PIN Settings','Change Staff and Kitchen access PINs.','/manager/security']
  ];
  const Card=({item})=>{const[t,d,h]=item;return <a className="card dashboard-card" href={h}><div className="eyebrow">Manager</div><h2>{t}</h2><p className="muted" style={{marginBottom:0}}>{d}</p></a>};

  async function managerLogin(){
    const pin=prompt('Manager PIN required');
    if(!pin)return false;
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.role!=='manager'){
      if(r.ok) await fetch('/api/auth/logout',{method:'POST'});
      alert(j.error||'Manager PIN required.');
      return false;
    }
    return true;
  }

  async function runBulk(action){
    const close=action==='close_all_tables';
    const text=close
      ? 'Close ALL currently active tables? This ends every dining session immediately.'
      : 'Clear ALL current kitchen orders? NEW, PREPARING and READY orders will be cancelled and removed from active KDS queues. Historical analytics will be preserved.';
    if(!confirm(text))return;
    setBusy(action);setMessage('');
    let r=await fetch('/api/manager/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});
    if(r.status===401){
      const ok=await managerLogin();
      if(!ok){setBusy('');return;}
      r=await fetch('/api/manager/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});
    }
    const j=await r.json().catch(()=>({}));
    setBusy('');
    if(!r.ok){setMessage(j.error||'Action failed.');return;}
    setMessage(close ? `Closed ${j.sessions_closed||0} active table(s).` : `Cleared ${j.orders_cancelled||0} active kitchen order(s).`);
  }

  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · MANAGER</small></div></div><main className="page" style={{maxWidth:1080}}><section className="hero"><div style={{fontSize:12,fontWeight:900,letterSpacing:'.12em',color:'#e8cda0'}}>MANAGEMENT</div><h1 style={{fontSize:'clamp(30px,4vw,48px)',marginTop:8}}>Manager Dashboard</h1><p>Configuration, reporting and restaurant controls grouped in one place.</p></section>

  <div className="section-title"><h2>Quick Restaurant Controls</h2><p>Manager-only end-of-service and reset actions.</p></div>
  <div className="grid grid-2">
    <div className="card" style={{border:'1px solid #e2b3ad'}}><div className="eyebrow">Dining Room</div><h2>Close All Tables</h2><p className="muted">Immediately closes every active dining session. Tables become available again.</p><button className="btn danger" disabled={!!busy} onClick={()=>runBulk('close_all_tables')}>{busy==='close_all_tables'?'Closing…':'CLOSE ALL TABLES'}</button></div>
    <div className="card" style={{border:'1px solid #e2b3ad'}}><div className="eyebrow">Kitchen Reset</div><h2>Clear All Current Orders</h2><p className="muted">Cancels all NEW / PREPARING / READY tickets on both KDS screens without deleting historical reporting data.</p><button className="btn danger" disabled={!!busy} onClick={()=>runBulk('clear_all_orders')}>{busy==='clear_all_orders'?'Clearing…':'CLEAR ALL ORDERS'}</button></div>
  </div>
  {message&&<div className="notice" style={{marginTop:14}}>{message}</div>}

  <div className="section-title"><h2>Operations & Menu</h2><p>Daily configuration and table setup.</p></div><div className="grid grid-3">{operations.map((x)=><Card key={x[2]} item={x}/>)}</div><div className="section-title"><h2>Reports & System</h2><p>Performance data and access control.</p></div><div className="grid grid-2">{control.map((x)=><Card key={x[2]} item={x}/>)}</div></main></>;
}
