'use client';
import { useEffect, useMemo, useState } from 'react';

function minsLeft(end){return Math.max(0,Math.ceil((new Date(end).getTime()-Date.now())/60000));}

function Login({onDone}){
  const [pin,setPin]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function login(e){e.preventDefault();setBusy(true);setError('');const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});const j=await r.json();setBusy(false);if(!r.ok)return setError(j.error||'Login failed');onDone();}
  return <main className="page"><div className="card login"><div className="logo-big">HANOK</div><p className="muted">Staff / Manager Dashboard</p>{error&&<div className="error">{error}</div>}<form onSubmit={login} style={{marginTop:16}}><div className="field"><label>Staff or Manager PIN</label><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} autoFocus/></div><button className="btn brand" style={{width:'100%',marginTop:12}} disabled={busy}>{busy?'Signing in…':'SIGN IN'}</button></form></div></main>
}

export default function StaffPage(){
  const [data,setData]=useState(null);const [auth,setAuth]=useState(true);const [error,setError]=useState('');const [selected,setSelected]=useState(null);const [form,setForm]=useState({adults:2,children_8_12:0,children_4_7:0,under_4:0,starter_preference:'standard'});const [busy,setBusy]=useState(false);const [,tick]=useState(0);
  async function load(){const r=await fetch('/api/staff/tables',{cache:'no-store'});if(r.status===401){setAuth(false);setData(null);return;}const j=await r.json();if(!r.ok){setError(j.error||'Unable to load tables');return;}setAuth(true);setData(j);setError('');}
  useEffect(()=>{load();const p=setInterval(load,4000);const t=setInterval(()=>tick(x=>x+1),30000);return()=>{clearInterval(p);clearInterval(t)};},[]);
  const selectedTable=useMemo(()=>data?.tables?.find(t=>t.id===selected)||null,[data,selected]);
  const counts=useMemo(()=>{const tabs=data?.tables||[];return {dining:tabs.filter(t=>t.session).length,available:tabs.filter(t=>!t.session).length,guests:tabs.reduce((n,t)=>n+(t.session?t.session.adults+t.session.children_8_12+t.session.children_4_7+t.session.under_4:0),0),last:tabs.filter(t=>t.session&&minsLeft(t.session.ends_at)<=15).length}},[data]);
  if(!auth)return <Login onDone={()=>{setAuth(true);load()}}/>;
  async function start(){if(!selectedTable)return;setBusy(true);const r=await fetch('/api/staff/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'start',table_id:selectedTable.id,...form})});const j=await r.json();setBusy(false);if(!r.ok)return setError(j.error||'Unable to start session');setSelected(null);setForm(f=>({...f,starter_preference:'standard'}));await load();}
  async function action(action,extra={}){if(!selectedTable?.session)return;setBusy(true);const r=await fetch('/api/staff/session',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action,session_id:selectedTable.session.id,...extra})});const j=await r.json();setBusy(false);if(!r.ok)return setError(j.error||'Action failed');if(action==='close')setSelected(null);await load();}
  async function editGuests(){const s=selectedTable.session;const adults=prompt('Adults',s.adults);if(adults===null)return;const children_8_12=prompt('Children 8–12',s.children_8_12);if(children_8_12===null)return;const children_4_7=prompt('Children 4–7',s.children_4_7);if(children_4_7===null)return;const under_4=prompt('Under 4',s.under_4);if(under_4===null)return;action('edit_guests',{adults,children_8_12,children_4_7,under_4});}
  async function move(){const dest=prompt('Destination table name, e.g. T05');if(!dest)return;const t=data.tables.find(x=>x.name.toUpperCase()===dest.toUpperCase()&&!x.session);if(!t)return setError('Destination table is not available.');action('move',{table_id:t.id});}
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});setAuth(false);}
  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · STAFF DASHBOARD</small></div><div className="spacer"/><span className="badge new">{data?.role?.toUpperCase()||'STAFF'}</span><button className="btn secondary small" onClick={logout}>Logout</button></div>
    <main className="page">
      <section className="hero"><h1>Table Control</h1><p>Start sessions, confirm guest count and manage the 90-minute dining flow.</p></section>
      {error&&<div className="error" style={{marginTop:12}}>{error}</div>}
      {!data?<div className="card" style={{marginTop:16}}>Loading…</div>:<>
        <div className="grid grid-4" style={{marginTop:16}}>
          <div className="card"><div className="muted">Dining</div><div style={{fontSize:30,fontWeight:900}}>{counts.dining}</div></div><div className="card"><div className="muted">Available</div><div style={{fontSize:30,fontWeight:900}}>{counts.available}</div></div><div className="card"><div className="muted">Guests</div><div style={{fontSize:30,fontWeight:900}}>{counts.guests}</div></div><div className="card"><div className="muted">Last Order</div><div style={{fontSize:30,fontWeight:900}}>{counts.last}</div></div>
        </div>
        <div className="section-title"><h2>Dining Room</h2><p>Click a table to start or manage its session.</p></div>
        <div className="grid grid-4">{data.tables.map(t=>{const s=t.session;const m=s?minsLeft(s.ends_at):null;return <button key={t.id} onClick={()=>{setSelected(t.id);setError('')}} className="card" style={{textAlign:'left',cursor:'pointer',background:selected===t.id?'#f5e6dc':'var(--panel)'}}><div className="actions" style={{justifyContent:'space-between'}}><b style={{fontSize:22}}>{t.name}</b><span className={`badge ${!s?'available':m<=15?'last':'dining'}`}>{!s?'AVAILABLE':m<=15?'LAST ORDER':'DINING'}</span></div><div style={{marginTop:14,fontSize:13}}>{!s?<span className="muted">Ready to start</span>:<><b>{s.adults+s.children_8_12+s.children_4_7+s.under_4} guests</b><br/><span className="muted">{m} min remaining · {s.starter_preference==='no_pork'?'NO PORK STARTER':'STANDARD STARTER'}</span></>}</div></button>})}</div>
      </>}
      {selectedTable&&<div className="card" style={{marginTop:18}}>
        <div className="actions" style={{alignItems:'center'}}><div><div className="muted">SELECTED TABLE</div><h2 style={{margin:'2px 0'}}>{selectedTable.name}</h2></div><div className="spacer"/><button className="btn secondary" onClick={()=>setSelected(null)}>Close</button></div>
        {!selectedTable.session?<>
          <div className="section-title"><h3>Start New Session</h3></div>
          <div className="grid grid-4">{[['adults','Adults'],['children_8_12','Children 8–12'],['children_4_7','Children 4–7'],['under_4','Under 4']].map(([k,l])=><div className="field" key={k}><label>{l}</label><input type="number" min="0" value={form[k]} onChange={e=>setForm(f=>({...f,[k]:Number(e.target.value)}))}/></div>)}</div>
          <div className="field" style={{marginTop:14,maxWidth:360}}><label>Starter Preference</label><select value={form.starter_preference} onChange={e=>setForm(f=>({...f,starter_preference:e.target.value}))}><option value="standard">Standard</option><option value="no_pork">No Pork</option></select></div>
          <div className="notice" style={{margin:'14px 0'}}>Starting the table will begin the 90-minute timer and automatically send the correct <b>{form.starter_preference==='no_pork'?'NO PORK':'STANDARD'}</b> Starter Platter to the Meat Station.</div>
          <button className="btn brand" disabled={busy} onClick={start}>START 90-MIN SESSION</button>
        </>:<>
          <div className="notice" style={{margin:'14px 0'}}><b>{minsLeft(selectedTable.session.ends_at)} min remaining</b><br/>Guests: {selectedTable.session.adults} adults · {selectedTable.session.children_8_12} age 8–12 · {selectedTable.session.children_4_7} age 4–7 · {selectedTable.session.under_4} under 4<br/><b>Starter:</b> {selectedTable.session.starter_preference==='no_pork'?'NO PORK':'STANDARD'}</div>
          <div className="actions"><button className="btn gold" disabled={data.role!=='manager'||busy} onClick={()=>action('unlock')}>Open Ordering Now</button><button className="btn" disabled={data.role!=='manager'||busy} onClick={()=>action('extend',{minutes:5})}>+5 min</button><button className="btn" disabled={data.role!=='manager'||busy} onClick={()=>action('extend',{minutes:10})}>+10 min</button><button className="btn secondary" disabled={data.role!=='manager'||busy} onClick={editGuests}>Edit Guests</button><button className="btn secondary" disabled={data.role!=='manager'||busy} onClick={move}>Move Table</button><button className="btn danger" disabled={busy} onClick={()=>confirm('Close this dining session?')&&action('close')}>Close Session</button></div>
          {data.role!=='manager'&&<p className="muted" style={{fontSize:12}}>Manager PIN is required for overrides, guest changes and table moves.</p>}
          <div className="section-title"><h3>Customer QR URL</h3></div><code style={{display:'block',overflowX:'auto',padding:12,background:'#eee4d8',borderRadius:10}}>{`https://orderhanokbbqwagga.com/t/${selectedTable.token}`}</code>
        </>}
      </div>}
    </main>
  </>;
}
