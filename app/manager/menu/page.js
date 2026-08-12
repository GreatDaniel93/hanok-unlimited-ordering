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
  return <main className="page"><div className="card login"><div className="logo-big">HANOK</div><p className="muted">Manager Control</p>{error&&<div className="error">{error}</div>}<form onSubmit={submit} style={{marginTop:16}}><div className="field"><label>Manager PIN</label><input type="password" inputMode="numeric" value={pin} onChange={e=>setPin(e.target.value)} autoFocus/></div><button className="btn brand" style={{width:'100%',marginTop:12}} disabled={busy}>{busy?'Signing in…':'SIGN IN'}</button></form></div></main>;
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

function StarterEditor({data,onReload,setError,setMessage}) {
  const [size,setSize]=useState(2);
  const [draft,setDraft]=useState([]);
  const [selected,setSelected]=useState('');
  const [busy,setBusy]=useState(false);
  const recipe=useMemo(()=>data?.recipes?.find(x=>x.party_size===size),[data,size]);
  const meats=data?.meats||[];

  useEffect(()=>{setDraft((recipe?.items||[]).map(x=>({menu_item_id:x.menu_item_id,qty:x.qty})));setSelected('');},[recipe,size]);

  const total=useMemo(()=>draft.reduce((n,x)=>n+(Number(x.qty)||0),0),[draft]);
  const unused=meats.filter(m=>m.active&&!draft.some(x=>x.menu_item_id===m.id));
  function nameFor(id){const m=meats.find(x=>x.id===id);return m?.display_name||m?.name||id;}
  function add(){if(!selected)return;setDraft(d=>[...d,{menu_item_id:selected,qty:1}]);setSelected('');}
  function qty(id,delta){setDraft(d=>d.map(x=>x.menu_item_id===id?{...x,qty:Math.max(1,Math.min(10,x.qty+delta))}:x));}
  function remove(id){setDraft(d=>d.filter(x=>x.menu_item_id!==id));}
  async function save(){
    if(!draft.length)return setError('Starter must contain at least one meat.');
    setBusy(true);setError('');setMessage('');
    const r=await fetch('/api/manager/starter',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({party_size:size,items:draft})});
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setError(j.error||'Starter update failed.');
    setMessage(`${size}P Starter updated. New table sessions will use this recipe.`);await onReload();
  }

  return <>
    <div className="notice" style={{marginBottom:14}}><b>How it works:</b> these recipes are used automatically when a table session starts. 7+ guest tables continue to combine the 2P–6P recipes using the existing split rules.</div>
    <div className="actions" style={{marginBottom:14}}>{[2,3,4,5,6].map(n=><button key={n} className={`btn ${size===n?'brand':'secondary'}`} onClick={()=>setSize(n)}>{n}P</button>)}</div>
    <div className="card">
      <div className="actions"><div><div className="muted">STARTER RECIPE</div><h2 style={{margin:'2px 0'}}>{size} Person Starter</h2></div><div className="spacer"/><span className="badge new">{total} portions · approx {total*100}g</span></div>
      <div style={{display:'grid',gap:8,marginTop:14}}>{draft.map((x,i)=><div key={x.menu_item_id} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--line)'}}>
        <div><b>{i+1}. {nameFor(x.menu_item_id)}</b><div className="muted" style={{fontSize:12}}>100g per portion</div></div>
        <div className="actions" style={{flexWrap:'nowrap',alignItems:'center'}}><button className="btn secondary small" onClick={()=>qty(x.menu_item_id,-1)}>−</button><b style={{minWidth:22,textAlign:'center'}}>{x.qty}</b><button className="btn secondary small" onClick={()=>qty(x.menu_item_id,1)}>+</button><button className="btn danger small" onClick={()=>remove(x.menu_item_id)}>Remove</button></div>
      </div>)}</div>
      {!draft.length&&<div className="error" style={{marginTop:12}}>This Starter is empty. Add at least one meat before saving.</div>}
      <div className="actions" style={{marginTop:14,alignItems:'end'}}><div className="field" style={{flex:'1 1 280px'}}><label>Add Meat</label><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select a meat…</option>{unused.map(m=><option key={m.id} value={m.id}>{m.display_name||m.name}</option>)}</select></div><button className="btn secondary" disabled={!selected} onClick={add}>ADD TO STARTER</button><button className="btn brand" disabled={busy||!draft.length} onClick={save}>{busy?'SAVING…':'SAVE STARTER'}</button></div>
    </div>
    <div className="notice" style={{marginTop:14}}><b>Protection:</b> a meat that is still used in any Starter cannot be hidden or changed into a non-meat category until it is removed from the Starter recipes.</div>
  </>;
}

export default function ManagerMenuPage(){
  const [items,setItems]=useState([]); const [starterData,setStarterData]=useState(null); const [tab,setTab]=useState('products'); const [auth,setAuth]=useState(true); const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const [adding,setAdding]=useState(false); const [newItem,setNewItem]=useState(blank); const [editing,setEditing]=useState(null);

  async function loadMenu(){
    const r=await fetch('/api/manager/menu',{cache:'no-store'}); const j=await r.json().catch(()=>({}));
    if(r.status===401){setAuth(false);setItems([]);return false;}
    if(!r.ok){setError(j.error||'Unable to load menu.');return false;}
    setAuth(true);setItems(j.items||[]);return true;
  }
  async function loadStarter(){
    const r=await fetch('/api/manager/starter',{cache:'no-store'}); const j=await r.json().catch(()=>({}));
    if(r.status===401){setAuth(false);setStarterData(null);return false;}
    if(!r.ok){setError(j.error||'Unable to load Starter configuration.');return false;}
    setStarterData(j);return true;
  }
  async function loadAll(){setError('');const ok=await loadMenu();if(ok)await loadStarter();}
  useEffect(()=>{loadAll();},[]);
  const activeCount=useMemo(()=>items.filter(x=>x.active).length,[items]);

  async function save(action,item_id,payload){
    setBusy(true);setError('');setMessage('');
    const r=await fetch('/api/manager/menu',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,item_id,payload})});
    const j=await r.json().catch(()=>({}));setBusy(false);
    if(!r.ok)return setError(j.error||'Menu update failed.');
    setMessage('Product menu updated. Customer ordering will refresh automatically.');setEditing(null);setAdding(false);setNewItem(blank);await loadAll();
  }
  async function logout(){await fetch('/api/auth/logout',{method:'POST'});setAuth(false);setItems([]);setStarterData(null);}
  if(!auth)return <Login onDone={()=>{setAuth(true);loadAll();}}/>;

  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · MANAGER CONTROL</small></div><div className="spacer"/><a href="/staff" className="btn secondary small">Staff Dashboard</a><button className="btn secondary small" onClick={logout}>Logout</button></div>
    <main className="page" style={{maxWidth:1100}}>
      <section className="hero"><h1>Menu & Starter Management</h1><p>Manage customer ordering products and the automatic First Grill Starter recipes. All changes are saved directly to the Hanok Wagga database.</p></section>
      {error&&<div className="error" style={{marginTop:12}}>{error}</div>}{message&&<div className="notice" style={{marginTop:12}}>{message}</div>}
      <div className="actions" style={{marginTop:16}}><button className={`btn ${tab==='products'?'brand':'secondary'}`} onClick={()=>setTab('products')}>PRODUCTS</button><button className={`btn ${tab==='starter'?'brand':'secondary'}`} onClick={()=>setTab('starter')}>STARTER PLATTERS</button></div>

      {tab==='products'?<>
        <div className="grid grid-3" style={{marginTop:16}}><div className="card"><div className="muted">Active Products</div><div style={{fontSize:30,fontWeight:900}}>{activeCount}</div></div><div className="card"><div className="muted">Hidden Products</div><div style={{fontSize:30,fontWeight:900}}>{items.length-activeCount}</div></div><div className="card"><div className="muted">Total Products</div><div style={{fontSize:30,fontWeight:900}}>{items.length}</div></div></div>
        <div className="section-title"><h2>Products</h2><button className="btn brand" onClick={()=>{setAdding(x=>!x);setEditing(null);}}>{adding?'CANCEL':'ADD PRODUCT'}</button></div>
        {adding&&<div className="card" style={{marginBottom:16}}><h3 style={{marginTop:0}}>New Product</h3><ProductForm value={newItem} onChange={setNewItem} busy={busy} saveLabel="ADD PRODUCT" onSave={()=>save('add',null,newItem)}/></div>}
        <div style={{display:'grid',gap:10}}>{items.map(item=><div className="card" key={item.id} style={{opacity:item.active?1:.62}}>
          {editing?.id===item.id ? <><div className="actions" style={{marginBottom:12}}><h3 style={{margin:0}}>Edit {item.display_name||item.name}</h3><div className="spacer"/><button className="btn secondary small" onClick={()=>setEditing(null)}>Cancel</button></div><ProductForm value={editing} onChange={setEditing} busy={busy} onSave={()=>save('update',item.id,editing)}/></> : <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:14,alignItems:'center'}}>
            <div><div className="actions"><b style={{fontSize:17}}>{item.display_name||item.name}</b><span className={`badge ${item.active?'available':'last'}`}>{item.active?'ACTIVE':'HIDDEN'}</span></div><div className="muted" style={{fontSize:12,marginTop:5}}>{item.category==='meat'?'BBQ Meat':item.category==='hot'?'Hot Dish':'Rice & Soup'} · {item.station==='meat'?'Meat Station':'Hot Kitchen'} · {item.portion_label||'No portion label'} · max {item.max_per_round}/order · sort {item.sort_order}</div>{item.description&&<div style={{fontSize:13,marginTop:6}}>{item.description}</div>}</div>
            <div className="actions" style={{justifyContent:'flex-end'}}><button className="btn secondary small" onClick={()=>{setEditing({...item});setAdding(false);}}>Edit</button>{item.active?<button className="btn danger small" disabled={busy} onClick={()=>confirm(`Hide ${item.display_name||item.name} from customer ordering?`)&&save('disable',item.id,{})}>Hide</button>:<button className="btn gold small" disabled={busy} onClick={()=>save('enable',item.id,{})}>Restore</button>}</div>
          </div>}
        </div>)}</div>
        <div className="notice" style={{marginTop:16}}><b>Safe removal:</b> “Hide” removes the product from new customer orders but keeps historical order records intact.</div>
      </>:<StarterEditor data={starterData} onReload={loadStarter} setError={setError} setMessage={setMessage}/>} 
    </main>
  </>;
}
