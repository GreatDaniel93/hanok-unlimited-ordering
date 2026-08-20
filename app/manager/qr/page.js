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
  useEffect(()=>{let live=true;QRCode.toDataURL(url,{errorCorrectionLevel:'H',margin:1,width:800,color:{dark:'#000000',light:'#ffffff'}}).then(x=>{if(live){setSrc(x);setError('')}}).catch(e=>{if(live)setError(e.message||'QR generation failed')});return()=>{live=false};},[url]);
  return <div className="label-wrap"><div className="qr-label"><div className="qr-center"><div className="qr-box">{src?<img src={src} alt={`${table.name} QR code`}/>:<span>{error||'Generating…'}</span>}</div></div><div className="table-number-row"><i/><strong>{table.name}</strong><i/></div></div></div>;
}

export default function ManagerQRPage(){
  const [auth,setAuth]=useState(true); const [tables,setTables]=useState([]); const [error,setError]=useState('');
  async function load(){const r=await fetch('/api/staff/tables',{cache:'no-store'});const j=await r.json().catch(()=>({}));if(r.status===401){setAuth(false);setTables([]);return;}if(!r.ok){setError(j.error||'Unable to load tables.');return;}if(j.role!=='manager'){await fetch('/api/auth/logout',{method:'POST'});setAuth(false);setTables([]);setError('Manager PIN required.');return;}setAuth(true);setTables(j.tables||[]);setError('');}
  useEffect(()=>{load();},[]);
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});setAuth(false);setTables([]);}
  if(!auth)return <Login onDone={()=>{setAuth(true);load();}}/>;
  return <><style>{`
    .label-sheet{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:22px;margin-top:18px}.label-wrap{display:flex;justify-content:center}.qr-label{width:200px;height:200px;box-sizing:border-box;border-radius:50%;background:#050505;border:3px solid #050505;box-shadow:inset 0 0 0 2px #e31b23,inset 0 0 0 7px #050505;padding:15px 20px 13px;text-align:center;display:flex;flex-direction:column;align-items:center;overflow:hidden}.qr-center{flex:1;width:100%;display:flex;align-items:center;justify-content:center;padding-top:7px}.qr-box{width:122px;height:122px;background:#fff;border-radius:8px;padding:5px;box-sizing:border-box;display:grid;place-items:center}.qr-box img{width:100%;height:100%;display:block}.qr-box span{color:#555;font-size:7px}.table-number-row{width:100%;height:34px;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px}.table-number-row strong{color:#e31b23;font-size:25px;line-height:25px;font-weight:950;letter-spacing:-.5px}.table-number-row i{display:block;width:22px;height:2px;background:#e31b23}
    @media print{@page{margin:5mm}.no-print,.topbar{display:none!important}.page{max-width:none!important;padding:0!important;margin:0!important}.label-sheet{display:grid!important;grid-template-columns:repeat(3,50mm)!important;grid-auto-rows:50mm!important;gap:3mm!important;justify-content:center!important;margin:0!important}.label-wrap{width:50mm!important;height:50mm!important;break-inside:avoid!important;page-break-inside:avoid!important}.qr-label{width:50mm!important;height:50mm!important;box-shadow:inset 0 0 0 .45mm #e31b23,inset 0 0 0 1.6mm #050505!important;padding:3.8mm 5mm 3mm!important}.qr-center{padding-top:1.5mm!important}.qr-box{width:30.5mm!important;height:30.5mm!important;border-radius:2mm!important;padding:1.1mm!important}.table-number-row{height:8.2mm!important;gap:2mm!important;margin-bottom:1mm!important}.table-number-row strong{font-size:6.3mm!important;line-height:6.3mm!important}.table-number-row i{width:5.5mm!important;height:.4mm!important}body{background:#fff!important}}
  `}</style><div className="topbar no-print"><div className="logo">HANOK<small>WAGGA WAGGA · TABLE QR CODES</small></div><div className="spacer"/><a href="/manager/tables" className="btn secondary small">Table Management</a><a href="/manager/menu" className="btn secondary small">Manager Menu</a><a href="/staff" className="btn secondary small">Staff Dashboard</a><button className="btn secondary small" onClick={logout}>Logout</button></div><main className="page" style={{maxWidth:1120}}><section className="hero no-print"><h1>50mm Round Table QR Codes</h1><p>Centered QR + compact table number layout for all active tables.</p><div className="notice" style={{marginTop:12}}><b>Official QR domain:</b> {PRODUCTION_ORIGIN}<br/><b>Print size:</b> 50mm × 50mm · Scale 100% / Actual Size · Disable “Fit to page”.</div><div className="actions" style={{marginTop:14}}><button className="btn brand" disabled={!tables.length} onClick={()=>window.print()}>PRINT ALL {tables.length} ACTIVE TABLES</button></div></section>{error&&<div className="error" style={{marginTop:12}}>{error}</div>}{!tables.length&&!error?<div className="card" style={{marginTop:16}}>No active tables found.</div>:<div className="label-sheet">{tables.map(t=><QRCard key={t.id} table={t}/>)}</div>}</main></>;
}
