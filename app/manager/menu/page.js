'use client';
import { useEffect, useMemo, useState } from 'react';

const blank = { name:'', display_name:'', description:'', category:'meat', portion_label:'100g / order', max_per_round:2, sort_order:100 };

function Login({onDone}) {
  const [pin,setPin]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e){
    e.preventDefault(); setBusy(true); setError('');
    const r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin})});
    const j=await r.json().catch(()=>({})); setBusy(false);
    if(!r.ok) return setError(j.error||'Login failed.');
    if(j.role!=='manager') { await fetch('/api/auth/logout',{method:'POST'}); return setError('Manager PIN required.'); }
    onDone();
  }
  return <main className="page"><div className="card login"><div className="logo-big">HANOK</div><p className="muted">Manager Menu Management</p>{error&&<div className="error">{error}</div>}<form onSubmit={submit} style={{marginTop:16}}><div className="field"><label>Manager PIN</label><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} autoFocus/></div><button className="btn brand" style={{width:'100%',marginTop:12}} disabled={busy}>{busy?'Signing in…':'SIGN IN'}</button></form></div></main>;
}

function ProductForm({value,onChange,onSave,busy,saveLabel='SAVE PRODUCT'}) {
  return <>
    <div className="grid grid-2">
      <div className="field"><label>Kitchen / Internal Name</label><input value={value.name} onChange={e=>onChange({...value,name:e.target.value})} placeholder="e.g. Wagyu Chuck Roll"/></div>
      <div className="field"><label>Customer Display Name</label><input value={value.display_name} onChange={e=>onChange({...value,display_name:e.target.value})} placeholder="Leave blank to use product name"/></div>
      <div className="field"><label>Category</label><select value={value.category} onChange={e=>onChange({...value,category:e.target.value,portion_label:e.target.value==='meat'&&!value.portion_label?'100g / order':value.portion_label})}><option value="meat">BBQ Meat</option><option value="hot">Hot Dish</option><option value="rice_soup">Rice & Soup</option></select></div>
      <div className="field"><label>Portion Label</label><input value={value.portion_label||''} onChange={e=>onChange({...value,portion_label:e.target.value})} placeholder="100g / order"/></div>
      <div className="field"><label>Max Portions per Order</label><input type="number" min="1" max="10" value={value.max_per_round} onChange={e=>onChange({...value,max_per_round:Number(e.target.value)})}/></div>
      <div className="field"><label>Sort Order</label><input type="number" min="0" max="9999" value={value.sort_order} onChange={e=>onChange({...value,sort_order:Number(e.target.value)})}/></div>
    </div>
    <div className="field" style={{marginTop:10}}><label>Description</label><input value={value.description||''} onChange={e=>onChange({...value,description:e.target.value})} placeholder="Optional customer description"/></div>
    <button className="btn brand" style={{marginTop:12}} disabled={busy||!value.name.trim()} onClick={onSave}>{busy?'SAVING…':saveLabel}</button>
  </>;
}

export default function ManagerMenuPage(){
  const [items,setItems]=useState([]); const [auth,setAuth]=useState(true); const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const [adding,setAdding]=useState(false); const [newItem,setNewItem]=useState(blank); const [editing,setEditing]=useState(null);

  async function load(){
    const r=await fetch('/api/manager/menu',{cache:'no-store'}); const j=await r.json().catch(()=>({}));
    if(r.status===401){setAuth(false);setItems([]);return;}
    if(!r.ok){setError(j.error||'Unable to load menu.');return;}
    setAuth(true); setItems(j.items||[]); setError('');
  }
  useEffect(()=>{load();},[]);
  const activeCount=useMemo(()=>items.filter(x=>x.active).length,[items]);

  async function save(action,item_id,payload){
    setBusy(true);setError('');setMessage('');
    const r=await fetch('/api/manager/menu',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,item_id,payload})});
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setError(j.error||'Menu update failed.');
    setMessage('Menu updated. Customer ordering will refresh automatically.'); setEditing(null); setAdding(false); setNewItem(blank); await load();
  }
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});setAuth(false);setItems([]);}
  if(!auth)return <Login onDone={()=>{setAuth(true);load();}}/>;

  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · MANAGER MENU</small></div><div className="spacer"/><a href="/staff" className="btn secondary small">Staff Dashboard</a><button className="btn secondary small" onClick={logout}>Logout</button></div>
    <main className="page" style={{maxWidth:1100}}>
      <section className="hero"><h1>Menu Management</h1><p>Add, edit, hide or restore ordering products. Changes are saved directly to the Hanok Wagga database.</p></section>
      {error&&<div className="error" style={{marginTop:12}}>{error}</div>}{message&&<div className="notice" style={{marginTop:12}}>{message}</div>}
      <div className="grid grid-3" style={{marginTop:16}}><div className="card"><div className="muted">Active Products</div><div style={{fontSize:30,fontWeight:900}}>{activeCount}</div></div><div className="card"><div className="muted">Hidden Products</div><div style={{fontSize:30,fontWeight:900}}>{items.length-activeCount}</div></div><div className="card"><div className="muted">Total Products</div><div style={{fontSize:30,fontWeight:900}}>{items.length}</div></div></div>

      <div className="section-title"><h2>Products</h2><button className="btn brand" onClick={()=>{setAdding(x=>!x);setEditing(null);}}>{adding?'CANCEL':'ADD PRODUCT'}</button></div>
      {adding&&<div className="card" style={{marginBottom:16}}><h3 style={{marginTop:0}}>New Product</h3><ProductForm value={newItem} onChange={setNewItem} busy={busy} saveLabel="ADD PRODUCT" onSave={()=>save('add',null,newItem)}/></div>}

      <div style={{display:'grid',gap:10}}>{items.map(item=><div className="card" key={item.id} style={{opacity:item.active?1:.62}}>
        {editing?.id===item.id ? <>
          <div className="actions" style={{marginBottom:12}}><h3 style={{margin:0}}>Edit {item.display_name||item.name}</h3><div className="spacer"/><button className="btn secondary small" onClick={()=>setEditing(null)}>Cancel</button></div>
          <ProductForm value={editing} onChange={setEditing} busy={busy} onSave={()=>save('update',item.id,editing)}/>
        </> : <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:14,alignItems:'center'}}>
          <div><div className="actions"><b style={{fontSize:17}}>{item.display_name||item.name}</b><span className={`badge ${item.active?'available':'last'}`}>{item.active?'ACTIVE':'HIDDEN'}</span></div><div className="muted" style={{fontSize:12,marginTop:5}}>{item.category==='meat'?'BBQ Meat':item.category==='hot'?'Hot Dish':'Rice & Soup'} · {item.station==='meat'?'Meat Station':'Hot Kitchen'} · {item.portion_label||'No portion label'} · max {item.max_per_round}/order · sort {item.sort_order}</div>{item.description&&<div style={{fontSize:13,marginTop:6}}>{item.description}</div>}</div>
          <div className="actions" style={{justifyContent:'flex-end'}}><button className="btn secondary small" onClick={()=>{setEditing({...item});setAdding(false);}}>Edit</button>{item.active?<button className="btn danger small" disabled={busy} onClick={()=>confirm(`Hide ${item.display_name||item.name} from customer ordering?`)&&save('disable',item.id,{})}>Hide</button>:<button className="btn gold small" disabled={busy} onClick={()=>save('enable',item.id,{})}>Restore</button>}</div>
        </div>}
      </div>)}</div>
      <div className="notice" style={{marginTop:16}}><b>Safe removal:</b> “Hide” removes the product from new customer orders but keeps historical order records intact.</div>
    </main>
  </>;
}
