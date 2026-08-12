'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';

const PRODUCTION_ORIGIN = 'https://orderhanokbbqwagga.com';

function Login({ onDone }) {
  const [pin,setPin]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();setBusy(true);setError('');const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});const j=await r.json().catch(()=>({}));setBusy(false);if(!r.ok)return setError(j.error||'Login failed.');if(j.role!=='manager'){await fetch('/api/auth/logout',{method:'POST'});return setError('Manager PIN required.');}onDone();}
  return <main className="page"><div className="card login"><div className="logo-big">HANOK</div><p className="muted">Manager · Table QR Codes</p>{error&&<div className="error">{error}</div>}<form onSubmit={submit} style={{marginTop:16}}><div className="field"><label>Manager PIN</label><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} autoFocus/></div><button className="btn brand" style={{width:'100%',marginTop:12}} disabled={busy}>{busy?'Signing in…':'SIGN IN'}</button></form></div></main>;
}

function QRCard({table}){
  const url=useMemo(()=>`${PRODUCTION_ORIGIN}/t/${table.token}`,[table.token]);
  const [src,setSrc]=useState(''); const [error,setError]=useState('');
  useEffect(()=>{let live=true;QRCode.toDataURL(url,{errorCorrectionLevel:'H',margin:2,width:640}).then(x=>{if(live){setSrc(x);setError('')}}).catch(e=>{if(live)setError(e.message||'QR generation failed')});return()=>{live=false};},[url]);
  function download(){if(!src)return;const a=document.createElement('a');a.href=src;a.download=`Hanok-Wagga-${table.name}-QR.png`;document.body.appendChild(a);a.click();a.remove();}
  return <div className="card qr-card" style={{textAlign:'center',breakInside:'avoid'}}><div style={{fontSize:26,fontWeight:900,letterSpacing:1}}>{table.name}</div><div className="muted" style={{fontSize:12,marginTop:2}}>HANOK WAGGA WAGGA · TABLE ORDERING</div><div style={{margin:'14px auto',width:'100%',maxWidth:260,aspectRatio:'1/1',display:'grid',placeItems:'center',background:'#fff',borderRadius:12,padding:8}}>{src?<img src={src} alt={`${table.name} QR code`} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:<span className="muted">{error||'Generating…'}</span>}</div><div style={{fontSize:12,fontWeight:700}}>SCAN TO ORDER</div><div className="muted qr-url" style={{fontSize:9,wordBreak:'break-all',marginTop:6}}>{url}</div><button className="btn secondary small no-print" style={{marginTop:12}} disabled={!src} onClick={download}>Download PNG</button></div>;
}

export default function ManagerQRPage(){
  const [auth,setAuth]=useState(true); const [tables,setTables]=useState([]); const [error,setError]=useState('');
  async function load(){const r=await fetch('/api/staff/tables',{cache:'no-store'});const j=await r.json().catch(()=>({}));if(r.status===401){setAuth(false);setTables([]);return;}if(!r.ok){setError(j.error||'Unable to load tables.');return;}if(j.role!=='manager'){await fetch('/api/auth/logout',{method:'POST'});setAuth(false);setTables([]);setError('Manager PIN required.');return;}setAuth(true);setTables(j.tables||[]);setError('');}
  useEffect(()=>{load();},[]);
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});setAuth(false);setTables([]);}
  if(!auth)return <Login onDone={()=>{setAuth(true);load();}}/>;
  return <><style>{`@media print{.no-print,.topbar{display:none!important}.page{max-width:none!important;padding:0!important}.qr-grid{grid-template-columns:repeat(2,1fr)!important;gap:8mm!important}.qr-card{box-shadow:none!important;border:1px solid #ccc!important;padding:8mm!important}.qr-url{display:none!important}body{background:#fff!important}}`}</style><div className="topbar no-print"><div className="logo">HANOK<small>WAGGA WAGGA · TABLE QR CODES</small></div><div className="spacer"/><a href="/manager/tables" className="btn secondary small">Table Management</a><a href="/manager/menu" className="btn secondary small">Manager Menu</a><a href="/staff" className="btn secondary small">Staff Dashboard</a><button className="btn secondary small" onClick={logout}>Logout</button></div><main className="page" style={{maxWidth:1120}}><section className="hero no-print"><h1>Table QR Codes</h1><p>Each active table has a permanent QR token. Renaming a table does not change its QR destination.</p><div className="notice" style={{marginTop:12}}><b>Official QR domain:</b> {PRODUCTION_ORIGIN}<br/>Disabled tables are excluded from this page until restored.</div><div className="actions" style={{marginTop:14}}><button className="btn brand" disabled={!tables.length} onClick={()=>window.print()}>PRINT ALL {tables.length} ACTIVE TABLES</button></div></section>{error&&<div className="error" style={{marginTop:12}}>{error}</div>}{!tables.length&&!error?<div className="card" style={{marginTop:16}}>No active tables found.</div>:<div className="grid grid-4 qr-grid" style={{marginTop:16}}>{tables.map(t=><QRCard key={t.id} table={t}/>)}</div>}</main></>;
}
