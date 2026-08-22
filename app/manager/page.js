'use client';
import { useEffect, useState } from 'react';

export default function ManagerDashboard(){
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [bridge,setBridge]=useState({loading:true,auth:true,online:false,last_seen_at:null,seconds_ago:null,pending_print_orders:0,oldest_pending_seconds:0,queue_state:'healthy'});
  const [opening,setOpening]=useState({running:false,result:null,error:''});
  const [helpOpen,setHelpOpen]=useState('');

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

  async function logout(){await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});window.location.href='/';}
  async function checkBridge(){if(!bridge.auth){const ok=await managerLogin();if(!ok)return;}setBridge(b=>({...b,loading:true}));await loadBridgeStatus();}

  async function runOpeningCheck(){
    setOpening({running:true,result:null,error:''});
    let r=await fetch('/api/manager/opening-check',{cache:'no-store'});
    if(r.status===401){const ok=await managerLogin();if(!ok){setOpening({running:false,result:null,error:'Manager login required.'});return;}r=await fetch('/api/manager/opening-check',{cache:'no-store'});}
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setOpening({running:false,result:null,error:j.error||'Opening check failed.'});return;}
    setOpening({running:false,result:j,error:''});await loadBridgeStatus();
  }

  async function runBulk(action){
    const close=action==='close_all_tables';
    const text=close?'Close ALL currently active tables? This ends every dining session immediately.':'Clear ALL current kitchen orders? NEW, PREPARING and READY orders will be cancelled and removed from active KDS queues. Historical analytics will be preserved.';
    if(!confirm(text))return;
    setBusy(action);setMessage('');
    let r=await fetch('/api/manager/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});
    if(r.status===401){const ok=await managerLogin();if(!ok){setBusy('');return;}r=await fetch('/api/manager/bulk',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});}
    const j=await r.json().catch(()=>({}));setBusy('');if(!r.ok){setMessage(j.error||'Action failed.');return;}
    setMessage(close?`Closed ${j.sessions_closed||0} active table(s).`:`Cleared ${j.orders_cancelled||0} active kitchen order(s).`);
  }

  const totalKnown=Boolean(bridge.total_printer_checked_at);
  const splitKnown=Boolean(bridge.split_printer_checked_at);
  const barKnown=Boolean(bridge.bar_printer_checked_at);
  const queueCritical=bridge.queue_state==='critical';
  const queueWarning=bridge.queue_state==='warning';
  const systemReady=bridge.online&&bridge.total_printer_online&&bridge.split_printer_online&&bridge.bar_printer_online&&!queueCritical&&!queueWarning;
  const systemAttention=bridge.online&&!systemReady;
  const systemTitle=bridge.loading?'CHECKING…':!bridge.auth?'SIGN IN REQUIRED':systemReady?'SYSTEM READY':systemAttention?'NEEDS ATTENTION':'BRIDGE OFFLINE';
  const systemColor=bridge.loading||!bridge.auth?'#8a6d3b':systemReady?'#247a47':systemAttention?'#b56b00':'#a12b2b';
  const systemText=!bridge.auth?'Manager login is required to view live print status.':bridge.loading?'Checking Android Bridge, printers and queue…':systemReady?'Bridge and all three printers are online.':!bridge.online?(bridge.last_seen_at?`Bridge last seen ${bridge.seconds_ago??'--'}s ago.`:'No bridge heartbeat received yet.'):'Bridge is online, but one or more components need attention.';

  const bridgeState=bridge.online?'ONLINE':bridge.last_seen_at?'OFFLINE':'NOT SEEN';
  const bridgeDetail=bridge.online?`Heartbeat ${bridge.seconds_ago??0}s ago`:(bridge.last_seen_at?`Last seen ${bridge.seconds_ago??'--'}s ago`:'Waiting for first heartbeat');
  const totalState=!totalKnown?'NOT CHECKED':bridge.total_printer_online?'ONLINE':'OFFLINE';
  const splitState=!splitKnown?'NOT CHECKED':bridge.split_printer_online?'ONLINE':'OFFLINE';
  const barState=!barKnown?'NOT CHECKED':bridge.bar_printer_online?'ONLINE':'OFFLINE';
  const totalDetail=!totalKnown?'Start Bridge v1.9 to enable checks':`${bridge.total_printer_latency_ms??0}ms · ${bridge.total_printer_seconds_ago??0}s ago · .232`;
  const splitDetail=!splitKnown?'Start Bridge v1.9 to enable checks':`${bridge.split_printer_latency_ms??0}ms · ${bridge.split_printer_seconds_ago??0}s ago · .231`;
  const barDetail=!barKnown?'Install/start Bridge v1.9 to enable checks':`${bridge.bar_printer_latency_ms??0}ms · ${bridge.bar_printer_seconds_ago??0}s ago · .230`;
  const queueState=queueCritical?'CRITICAL':queueWarning?'WARNING':'HEALTHY';
  const queueDetail=`${bridge.pending_print_orders||0} pending · oldest ${bridge.oldest_pending_seconds||0}s`;

  const StatusTile=({title,state,detail,color})=><div className="status-tile"><div className="eyebrow">{title}</div><div className="state" style={{color}}>{state}</div><div className="detail">{detail}</div></div>;
  const HelpButton=({kind})=><button className="btn secondary small" aria-label="Help / Troubleshooting" title="Help / Troubleshooting" onClick={()=>setHelpOpen(helpOpen===kind?'':kind)} style={{width:28,height:28,minWidth:28,borderRadius:999,padding:0,fontSize:16,lineHeight:1}}>?</button>;
  const TroubleshootingBox=({children})=><div className="notice" style={{marginTop:12,background:'#fff9ec'}}><div className="actions" style={{marginBottom:8}}><b>Troubleshooting</b><span className="spacer"/><button className="btn secondary small" onClick={()=>setHelpOpen('')}>Close</button></div>{children}</div>;
  const Step=({title,children})=><div style={{padding:'8px 0',borderTop:'1px solid rgba(100,70,30,.12)'}}><b>{title}</b><div style={{marginTop:4,lineHeight:1.45,fontSize:13}}>{children}</div></div>;

  const openingResult=opening.result;
  const openingTitle=opening.running?'CHECKING…':openingResult?(openingResult.ready?'READY FOR SERVICE':'NOT READY'):'NOT RUN YET';
  const openingColor=!openingResult?'#8a6d3b':openingResult.ready?'#247a47':'#a12b2b';
  const failedOpeningKeys=new Set((openingResult?.checks||[]).filter(c=>!c.ok).map(c=>c.key));

  return <>
    <div className="topbar">
      <div className="logo">HANOK<small>WAGGA WAGGA · MANAGER CONTROL</small></div><span className="spacer"/>
      <a className="btn secondary small" href="/staff">Staff</a><a className="btn secondary small" href="/kitchen/meat">Meat KDS</a><a className="btn secondary small" href="/kitchen/hot">Hot KDS</a><a className="btn secondary small" href="/manager/qr">QR</a><button className="btn secondary small" onClick={logout}>Logout</button>
    </div>
    <main className="page">
      <section className="hero"><h1>Manager Control</h1><p>Ordering rules, tables, system health, printing and performance.</p></section>
      <div className="manager-tabs"><button className="btn brand">OVERVIEW</button><a className="btn secondary" href="/manager/menu">MENU & STARTER</a><a className="btn secondary" href="/manager/tables">TABLES</a><a className="btn secondary" href="/manager/analytics">ANALYTICS</a><a className="btn secondary" href="/manager/security">SECURITY</a><a className="btn secondary" href="/manager/qr">QR CODES</a></div>
      {message&&<div className="notice" style={{marginTop:12}}>{message}</div>}
      <div className="manager-overview-grid">
        <div className="card manager-section-card">
          <div className="actions"><div><div className="actions" style={{gap:7}}><div className="eyebrow">Kitchen Printing</div><HelpButton kind="printing"/></div><h2 style={{color:systemColor}}>{systemTitle}</h2><p className="muted">{systemText}</p></div><span className="spacer"/><button className="btn secondary small" onClick={checkBridge} disabled={bridge.loading}>{bridge.auth?'CHECK NOW':'SIGN IN'}</button></div>
          {helpOpen==='printing'&&<TroubleshootingBox>
            {!bridge.auth&&<Step title="Manager login required">Sign in with the Manager PIN, then press CHECK NOW again.</Step>}
            {bridge.auth&&!bridge.loading&&systemReady&&<Step title="System is healthy">No action is required. Keep the Bridge phone connected to power, on store Wi-Fi, with Bridge v1.9 running.</Step>}
            {bridge.auth&&!bridge.loading&&!bridge.online&&<Step title="Android Bridge is offline">Go to the dedicated Bridge phone. Confirm it is charging, connected to the store Wi-Fi, the screen is kept awake, and Hanok Wagga Print Bridge v1.9 is open. Press START BRIDGE. Do not Force Stop the app.</Step>}
            {bridge.auth&&!bridge.loading&&(!totalKnown||!splitKnown||!barKnown)&&<Step title="Printer status says NOT CHECKED">Confirm Bridge v1.9 is installed and START BRIDGE is running. Wait up to 30 seconds, then press CHECK NOW.</Step>}
            {bridge.auth&&!bridge.loading&&totalKnown&&!bridge.total_printer_online&&<Step title="Total Printer is offline">Check the TOTAL printer is powered on, has paper, and its Ethernet cable is connected. Its IP must be 192.168.8.232. On the Bridge phone use TEST P1, then press CHECK NOW.</Step>}
            {bridge.auth&&!bridge.loading&&splitKnown&&!bridge.split_printer_online&&<Step title="Split Printer is offline">Check the SPLIT printer is powered on, has paper, and its Ethernet cable is connected. Its IP must be 192.168.8.231. On the Bridge phone use TEST P2, then press CHECK NOW.</Step>}
            {bridge.auth&&!bridge.loading&&barKnown&&!bridge.bar_printer_online&&<Step title="Bar Rice Printer is offline">Check the BAR RICE printer is powered on, has paper, and its Ethernet cable is connected. Its IP must be 192.168.8.230. On the Bridge phone use TEST BAR, then press CHECK NOW.</Step>}
            {bridge.auth&&!bridge.loading&&(queueWarning||queueCritical)&&<Step title="Print Queue is delayed">Do not submit the same customer order again. First restore any offline Bridge or printer. The queue will retry automatically. When all printers are online, wait 10–20 seconds and press CHECK NOW. Use CLEAR ALL ORDERS only when you intentionally want to cancel active kitchen orders.</Step>}
            {bridge.error&&<Step title="Manager status cannot be loaded">Check internet access on the Manager device and reload the page. If customer QR ordering is also unavailable, do not rely on the ordering system until connectivity is restored.</Step>}
          </TroubleshootingBox>}
          {bridge.error&&<div className="error" style={{marginTop:10}}>{bridge.error}</div>}
          {bridge.auth&&!bridge.loading&&<div className="status-grid">
            <StatusTile title="Android Bridge" state={bridgeState} detail={bridgeDetail} color={bridge.online?'#247a47':'#a12b2b'}/>
            <StatusTile title="Total Printer" state={totalState} detail={totalDetail} color={totalKnown&&bridge.total_printer_online?'#247a47':totalKnown?'#a12b2b':'#8a6d3b'}/>
            <StatusTile title="Split Printer" state={splitState} detail={splitDetail} color={splitKnown&&bridge.split_printer_online?'#247a47':splitKnown?'#a12b2b':'#8a6d3b'}/>
            <StatusTile title="Bar Rice Printer" state={barState} detail={barDetail} color={barKnown&&bridge.bar_printer_online?'#247a47':barKnown?'#a12b2b':'#8a6d3b'}/>
            <StatusTile title="Print Queue" state={queueState} detail={queueDetail} color={queueCritical?'#a12b2b':queueWarning?'#b56b00':'#247a47'}/>
          </div>}
        </div>
        <div className="card manager-section-card">
          <div className="actions"><div><div className="actions" style={{gap:7}}><div className="eyebrow">Pre-Service Readiness</div><HelpButton kind="opening"/></div><h2 style={{color:openingColor}}>{openingTitle}</h2><p className="muted">One read-only check for cloud, database, Bridge, all printers, queue, tables and menu.</p></div><span className="spacer"/><button className="btn brand small" onClick={runOpeningCheck} disabled={opening.running}>{opening.running?'CHECKING…':'RUN OPENING CHECK'}</button></div>
          {helpOpen==='opening'&&<TroubleshootingBox>
            {!openingResult&&!opening.error&&<Step title="Before opening">Press RUN OPENING CHECK. If every item shows PASS, the system is ready. If any item shows FAIL, follow the matching instruction below and run the check again.</Step>}
            {openingResult?.ready&&<Step title="All checks passed">No corrective action is required. Keep the Bridge phone powered and leave all three printers on.</Step>}
            {failedOpeningKeys.has('cloud_db')&&<Step title="Cloud & Database failed">Confirm the Manager device and Bridge phone both have internet access. Reload the Manager page and run the check again. If the customer QR page is also unavailable, do not open QR ordering until service is restored.</Step>}
            {failedOpeningKeys.has('bridge')&&<Step title="Android Bridge failed">On the Bridge phone confirm power, store Wi-Fi and Bridge v1.9. Open the app and press START BRIDGE, then wait about 10 seconds and run the opening check again.</Step>}
            {failedOpeningKeys.has('total_printer')&&<Step title="Total Printer failed">Power on the TOTAL printer, confirm paper and Ethernet, and verify IP 192.168.8.232. Use TEST P1 on the Bridge phone. Run the opening check again after the test succeeds.</Step>}
            {failedOpeningKeys.has('split_printer')&&<Step title="Split Printer failed">Power on the SPLIT printer, confirm paper and Ethernet, and verify IP 192.168.8.231. Use TEST P2 on the Bridge phone. Run the opening check again after the test succeeds.</Step>}
            {failedOpeningKeys.has('bar_printer')&&<Step title="Bar Rice Printer failed">Power on the BAR RICE printer, confirm paper and Ethernet, and verify IP 192.168.8.230. Use TEST BAR on the Bridge phone. Run the opening check again after the test succeeds.</Step>}
            {failedOpeningKeys.has('print_queue')&&<Step title="Print Queue failed">Do not place duplicate test orders. Restore the Bridge and any offline printers first. Wait for pending tickets to clear automatically, then run the opening check again. Only use CLEAR ALL ORDERS if those active orders should truly be cancelled.</Step>}
            {failedOpeningKeys.has('tables')&&<Step title="Dining Tables failed">Open Manager → TABLES and make sure at least one dining table is ACTIVE. Restore or add the required tables, then run the opening check again.</Step>}
            {failedOpeningKeys.has('menu')&&<Step title="Ordering Menu failed">Open Manager → MENU & STARTER → PRODUCTS. Confirm at least one BBQ Meat item and at least one Hot Dish item are ACTIVE, then run the opening check again.</Step>}
            {opening.error&&<Step title="Opening check could not run">Check internet access, reload the Manager page, sign in again if required, then retry RUN OPENING CHECK.</Step>}
          </TroubleshootingBox>}
          {opening.error&&<div className="error" style={{marginTop:10}}>{opening.error}</div>}
          {openingResult?<div className="status-grid">{(openingResult.checks||[]).map(c=><StatusTile key={c.label} title={c.label} state={c.ok?'PASS':'FAIL'} detail={c.detail} color={c.ok?'#247a47':'#a12b2b'}/>)}</div>:<div className="notice" style={{marginTop:14}}>Run this once before service. It does not create orders or print test tickets.</div>}
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
