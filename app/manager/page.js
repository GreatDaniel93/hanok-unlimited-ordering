'use client';
import { useEffect, useState } from 'react';

export default function ManagerDashboard(){
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [bridge,setBridge]=useState({loading:true,auth:true,online:false,last_seen_at:null,seconds_ago:null,pending_print_orders:0,oldest_pending_seconds:0,queue_state:'healthy'});
  const [opening,setOpening]=useState({running:false,result:null,error:''});

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
      if(r.ok)await fetch('/api/auth/logout',{method:'POST'});
      alert(j.error||'Manager PIN required.');
      return false;
    }
    return true;
  }

  async function logout(){
    await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});
    window.location.href='/';
  }

  async function checkBridge(){
    if(!bridge.auth){const ok=await managerLogin();if(!ok)return;}
    setBridge(b=>({...b,loading:true}));
    await loadBridgeStatus();
  }

  async function runOpeningCheck(){
    setOpening({running:true,result:null,error:''});
    let r=await fetch('/api/manager/opening-check',{cache:'no-store'});
    if(r.status===401){
      const ok=await managerLogin();
      if(!ok){setOpening({running:false,result:null,error:'Manager login required.'});return;}
      r=await fetch('/api/manager/opening-check',{cache:'no-store'});
    }
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setOpening({running:false,result:null,error:j.error||'Opening check failed.'});return;}
    setOpening({running:false,result:j,error:''});
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
    setMessage(close?`Closed ${j.sessions_closed||0} active table(s).`:`Cleared ${j.orders_cancelled||0} active kitchen order(s).`);
  }

  const totalKnown=Boolean(bridge.total_printer_checked_at);
  const splitKnown=Boolean(bridge.split_printer_checked_at);
  const queueCritical=bridge.queue_state==='critical';
  const queueWarning=bridge.queue_state==='warning';
  const systemReady=bridge.online&&bridge.total_printer_online&&bridge.split_printer_online&&!queueCritical&&!queueWarning;
  const systemAttention=bridge.online&&!systemReady;
  const systemTitle=bridge.loading?'CHECKING…':!bridge.auth?'SIGN IN REQUIRED':systemReady?'SYSTEM READY':systemAttention?'NEEDS ATTENTION':'BRIDGE OFFLINE';
  const systemColor=bridge.loading||!bridge.auth?'#8a6d3b':systemReady?'#247a47':systemAttention?'#b56b00':'#a12b2b';
  const systemText=!bridge.auth?'Manager login is required to view live print status.':bridge.loading?'Checking Android Bridge, printers and queue…':systemReady?'Bridge and both printers are online.':!bridge.online?(bridge.last_seen_at?`Bridge last seen ${bridge.seconds_ago??'--'}s ago.`:'No bridge heartbeat received yet.'):'Bridge is online, but one or more components need attention.';

  const bridgeState=bridge.online?'ONLINE':bridge.last_seen_at?'OFFLINE':'NOT SEEN';
  const bridgeDetail=bridge.online?`Heartbeat ${bridge.seconds_ago??0}s ago`:(bridge.last_seen_at?`Last seen ${bridge.seconds_ago??'--'}s ago`:'Waiting for first heartbeat');
  const totalState=!totalKnown?'NOT CHECKED':bridge.total_printer_online?'ONLINE':'OFFLINE';
  const splitState=!splitKnown?'NOT CHECKED':bridge.split_printer_online?'ONLINE':'OFFLINE';
  const totalDetail=!totalKnown?'Start Bridge v1.7 to enable checks':`${bridge.total_printer_latency_ms??0}ms · ${bridge.total_printer_seconds_ago??0}s ago · .232`;
  const splitDetail=!splitKnown?'Start Bridge v1.7 to enable checks':`${bridge.split_printer_latency_ms??0}ms · ${bridge.split_printer_seconds_ago??0}s ago · .231`;
  const queueState=queueCritical?'CRITICAL':queueWarning?'WARNING':'HEALTHY';
  const queueDetail=`${bridge.pending_print_orders||0} pending · oldest ${bridge.oldest_pending_seconds||0}s`;

  const StatusTile=({title,state,detail,color})=><div className="status-tile"><div className="eyebrow">{title}</div><div className="state" style={{color}}>{state}</div><div className="detail">{detail}</div></div>;
  const openingResult=opening.result;
  const openingTitle=opening.running?'CHECKING…':openingResult?(openingResult.ready?'READY FOR SERVICE':'NOT READY'):'NOT RUN YET';
  const openingColor=!openingResult?'#8a6d3b':openingResult.ready?'#247a47':'#a12b2b';

  return <>
    <div className="topbar">
      <div className="logo">HANOK<small>WAGGA WAGGA · MANAGER CONTROL</small></div><span className="spacer"/>
      <a className="btn secondary small" href="/staff">Staff</a>
      <a className="btn secondary small" href="/kitchen/meat">Meat KDS</a>
      <a className="btn secondary small" href="/kitchen/hot">Hot KDS</a>
      <a className="btn secondary small" href="/manager/qr">QR</a>
      <button className="btn secondary small" onClick={logout}>Logout</button>
    </div>

    <main className="page">
      <section className="hero"><h1>Manager Control</h1><p>Ordering rules, tables, system health, printing and performance.</p></section>

      <div className="manager-tabs">
        <button className="btn brand">OVERVIEW</button>
        <a className="btn secondary" href="/manager/menu">MENU & STARTER</a>
        <a className="btn secondary" href="/manager/tables">TABLES</a>
        <a className="btn secondary" href="/manager/analytics">ANALYTICS</a>
        <a className="btn secondary" href="/manager/security">SECURITY</a>
        <a className="btn secondary" href="/manager/qr">QR CODES</a>
      </div>

      {message&&<div className="notice" style={{marginTop:12}}>{message}</div>}

      <div className="manager-overview-grid">
        <div className="card manager-section-card">
          <div className="actions"><div><div className="eyebrow">Kitchen Printing</div><h2 style={{color:systemColor}}>{systemTitle}</h2><p className="muted">{systemText}</p></div><span className="spacer"/><button className="btn secondary small" onClick={checkBridge} disabled={bridge.loading}>{bridge.auth?'CHECK NOW':'SIGN IN'}</button></div>
          {bridge.error&&<div className="error" style={{marginTop:10}}>{bridge.error}</div>}
          {bridge.auth&&!bridge.loading&&<div className="status-grid">
            <StatusTile title="Android Bridge" state={bridgeState} detail={bridgeDetail} color={bridge.online?'#247a47':'#a12b2b'}/>
            <StatusTile title="Total Printer" state={totalState} detail={totalDetail} color={totalKnown&&bridge.total_printer_online?'#247a47':totalKnown?'#a12b2b':'#8a6d3b'}/>
            <StatusTile title="Split Printer" state={splitState} detail={splitDetail} color={splitKnown&&bridge.split_printer_online?'#247a47':splitKnown?'#a12b2b':'#8a6d3b'}/>
            <StatusTile title="Print Queue" state={queueState} detail={queueDetail} color={queueCritical?'#a12b2b':queueWarning?'#b56b00':'#247a47'}/>
          </div>}
        </div>

        <div className="card manager-section-card">
          <div className="actions"><div><div className="eyebrow">Pre-Service Readiness</div><h2 style={{color:openingColor}}>{openingTitle}</h2><p className="muted">One read-only check for cloud, database, Bridge, printers, queue, tables and menu.</p></div><span className="spacer"/><button className="btn brand small" onClick={runOpeningCheck} disabled={opening.running}>{opening.running?'CHECKING…':'RUN OPENING CHECK'}</button></div>
          {opening.error&&<div className="error" style={{marginTop:10}}>{opening.error}</div>}
          {openingResult?<div className="status-grid">
            {(openingResult.checks||[]).map(c=><StatusTile key={c.label} title={c.label} state={c.ok?'PASS':'FAIL'} detail={c.detail} color={c.ok?'#247a47':'#a12b2b'}/>) }
          </div>:<div className="notice" style={{marginTop:14}}>Run this once before service. It does not create orders or print test tickets.</div>}
        </div>
      </div>

      <div className="section-title"><h2>Quick Controls</h2><p>End-of-service and emergency reset actions.</p></div>
      <div className="grid grid-2">
        <div className="card"><div className="eyebrow">Dining Room</div><h2>Close All Tables</h2><p className="muted">Ends every active dining session and makes tables available again.</p><button className="btn danger" disabled={!!busy} onClick={()=>runBulk('close_all_tables')}>{busy==='close_all_tables'?'CLOSING…':'CLOSE ALL TABLES'}</button></div>
        <div className="card"><div className="eyebrow">Kitchen Reset</div><h2>Clear Current Orders</h2><p className="muted">Cancels NEW / PREPARING / READY tickets while preserving history and analytics.</p><button className="btn danger" disabled={!!busy} onClick={()=>runBulk('clear_all_orders')}>{busy==='clear_all_orders'?'CLEARING…':'CLEAR ALL ORDERS'}</button></div>
      </div>
    </main>
  </>;
}
