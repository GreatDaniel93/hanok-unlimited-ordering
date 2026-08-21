'use client';
import { useEffect, useState } from 'react';

export default function ManagerDashboard(){
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [bridge,setBridge]=useState({loading:true,auth:true,online:false,last_seen_at:null,seconds_ago:null,pending_print_orders:0,oldest_pending_seconds:0,queue_state:'healthy'});
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

  async function loadBridgeStatus(){
    try{
      const r=await fetch('/api/manager/bridge-status',{cache:'no-store'});
      if(r.status===401){setBridge(b=>({...b,loading:false,auth:false}));return false;}
      const j=await r.json().catch(()=>({}));
      if(!r.ok){setBridge(b=>({...b,loading:false,auth:true,error:j.error||'Unable to check bridge'}));return false;}
      setBridge({...j,loading:false,auth:true,error:''});
      return true;
    }catch(e){setBridge(b=>({...b,loading:false,error:e.message||'Unable to check bridge'}));return false;}
  }

  useEffect(()=>{
    const refresh=()=>{if(!document.hidden)loadBridgeStatus();};
    refresh();
    const timer=setInterval(refresh,10000);
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);};
  },[]);

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

  async function checkBridge(){
    if(!bridge.auth){const ok=await managerLogin();if(!ok)return;}
    setBridge(b=>({...b,loading:true}));
    await loadBridgeStatus();
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

  const totalKnown=Boolean(bridge.total_printer_checked_at);
  const splitKnown=Boolean(bridge.split_printer_checked_at);
  const queueCritical=bridge.queue_state==='critical';
  const queueWarning=bridge.queue_state==='warning';
  const systemReady=bridge.online&&bridge.total_printer_online&&bridge.split_printer_online&&!queueCritical&&!queueWarning;
  const systemAttention=bridge.online&&!systemReady;
  const systemTitle=bridge.loading?'CHECKING PRINT SYSTEM…':!bridge.auth?'PRINT SYSTEM STATUS':systemReady?'● PRINT SYSTEM READY':systemAttention?'● PRINT SYSTEM ATTENTION':'● PRINT BRIDGE OFFLINE';
  const systemText=!bridge.auth?'Manager login is required to view live print status.':bridge.loading?'Checking Android bridge, both LAN printers and print queue…':systemReady?'Cloud bridge and both printers are online. Kitchen printing is ready.':!bridge.online?(bridge.last_seen_at?`Bridge heartbeat stopped ${bridge.seconds_ago??'--'}s ago. Check the Android phone, Wi-Fi and Bridge service.`:'No bridge heartbeat received yet. Start the Android Print Bridge on the store phone.'):'Bridge is online, but one or more print components need attention.';
  const systemColor=bridge.loading||!bridge.auth?'#8a6d3b':systemReady?'#247a47':systemAttention?'#b56b00':'#a12b2b';
  const systemBg=bridge.loading||!bridge.auth?'#fff8e8':systemReady?'#eef8f1':systemAttention?'#fff7e6':'#fff0ef';
  const tile=(title,state,detail,color)=> <div style={{background:'#fff',border:'1px solid #ddd7d0',borderRadius:12,padding:14,minHeight:98}}><div className="eyebrow">{title}</div><div style={{fontSize:17,fontWeight:900,color,marginTop:5}}>{state}</div><div className="muted" style={{fontSize:12,marginTop:5}}>{detail}</div></div>;

  const bridgeState=bridge.online?'ONLINE':bridge.last_seen_at?'OFFLINE':'NOT SEEN';
  const bridgeDetail=bridge.online?`Heartbeat ${bridge.seconds_ago??0}s ago`:(bridge.last_seen_at?`Last seen ${bridge.seconds_ago??'--'}s ago`:'Waiting for first heartbeat');
  const totalState=!totalKnown?'NOT CHECKED':bridge.total_printer_online?'ONLINE':'OFFLINE';
  const splitState=!splitKnown?'NOT CHECKED':bridge.split_printer_online?'ONLINE':'OFFLINE';
  const totalDetail=!totalKnown?'Install/start Bridge v1.6 to enable printer checks':`${bridge.total_printer_latency_ms??0}ms · checked ${bridge.total_printer_seconds_ago??0}s ago · 192.168.8.232`;
  const splitDetail=!splitKnown?'Install/start Bridge v1.6 to enable printer checks':`${bridge.split_printer_latency_ms??0}ms · checked ${bridge.split_printer_seconds_ago??0}s ago · 192.168.8.231`;
  const queueState=queueCritical?'CRITICAL':queueWarning?'WARNING':'HEALTHY';
  const queueDetail=`${bridge.pending_print_orders||0} pending · oldest ${bridge.oldest_pending_seconds||0}s`;

  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · MANAGER</small></div></div><main className="page" style={{maxWidth:1080}}><section className="hero"><div style={{fontSize:12,fontWeight:900,letterSpacing:'.12em',color:'#e8cda0'}}>MANAGEMENT</div><h1 style={{fontSize:'clamp(30px,4vw,48px)',marginTop:8}}>Manager Dashboard</h1><p>Configuration, reporting and restaurant controls grouped in one place.</p></section>

  <div className="section-title"><h2>System Health</h2><p>Live cloud bridge, printer and queue status.</p></div>
  <div className="card" style={{border:`2px solid ${systemColor}`,background:systemBg}}>
    <div className="actions" style={{alignItems:'center'}}><div><div className="eyebrow">Kitchen Printing</div><h2 style={{margin:'4px 0',color:systemColor}}>{systemTitle}</h2><p className="muted" style={{margin:0}}>{systemText}</p>{bridge.error&&<div className="error" style={{marginTop:10}}>{bridge.error}</div>}</div><div className="spacer"/><button className="btn secondary small" onClick={checkBridge} disabled={bridge.loading}>{bridge.auth?'CHECK NOW':'SIGN IN & CHECK'}</button></div>
    {bridge.auth&&!bridge.loading&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginTop:16}}>
      {tile('Android Bridge',bridgeState,bridgeDetail,bridge.online?'#247a47':'#a12b2b')}
      {tile('Total Printer',totalState,totalDetail,totalKnown&&bridge.total_printer_online?'#247a47':totalKnown?'#a12b2b':'#8a6d3b')}
      {tile('Split Printer',splitState,splitDetail,splitKnown&&bridge.split_printer_online?'#247a47':splitKnown?'#a12b2b':'#8a6d3b')}
      {tile('Print Queue',queueState,queueDetail,queueCritical?'#a12b2b':queueWarning?'#b56b00':'#247a47')}
    </div>}
  </div>

  <div className="section-title"><h2>Quick Restaurant Controls</h2><p>Manager-only end-of-service and reset actions.</p></div>
  <div className="grid grid-2">
    <div className="card" style={{border:'1px solid #e2b3ad'}}><div className="eyebrow">Dining Room</div><h2>Close All Tables</h2><p className="muted">Immediately closes every active dining session. Tables become available again.</p><button className="btn danger" disabled={!!busy} onClick={()=>runBulk('close_all_tables')}>{busy==='close_all_tables'?'Closing…':'CLOSE ALL TABLES'}</button></div>
    <div className="card" style={{border:'1px solid #e2b3ad'}}><div className="eyebrow">Kitchen Reset</div><h2>Clear All Current Orders</h2><p className="muted">Cancels all NEW / PREPARING / READY tickets on both KDS screens without deleting historical reporting data.</p><button className="btn danger" disabled={!!busy} onClick={()=>runBulk('clear_all_orders')}>{busy==='clear_all_orders'?'Clearing…':'CLEAR ALL ORDERS'}</button></div>
  </div>
  {message&&<div className="notice" style={{marginTop:14}}>{message}</div>}

  <div className="section-title"><h2>Operations & Menu</h2><p>Daily configuration and table setup.</p></div><div className="grid grid-3">{operations.map((x)=><Card key={x[2]} item={x}/>)}</div><div className="section-title"><h2>Reports & System</h2><p>Performance data and access control.</p></div><div className="grid grid-2">{control.map((x)=><Card key={x[2]} item={x}/>)}</div></main></>;
}
