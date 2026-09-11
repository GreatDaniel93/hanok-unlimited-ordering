'use client';
import {useEffect,useMemo,useState} from 'react';

export default function MenuTranslations(){
  const [items,setItems]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(''),[show,setShow]=useState('all');
  async function load(){setError('');const r=await fetch('/api/manager/menu',{cache:'no-store'});if(r.status===401){location.href='/manager';return;}const j=await r.json().catch(()=>({}));if(!r.ok){setError(j.error||'Unable to load menu.');return;}setItems(j.items||[]);}
  useEffect(()=>{load()},[]);
  const visible=useMemo(()=>items.filter(x=>show==='all'||x.category===show),[items,show]);
  function patch(id,key,value){setItems(xs=>xs.map(x=>x.id===id?{...x,[key]:value}:x));}
  async function save(item){setBusy(item.id);setError('');setMessage('');const payload={display_name_zh:item.display_name_zh||'',description_zh:item.description_zh||'',portion_label_zh:item.portion_label_zh||''};const r=await fetch('/api/manager/menu',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'update',item_id:item.id,payload})});const j=await r.json().catch(()=>({}));setBusy('');if(!r.ok){setError(j.error||'Unable to save Chinese menu name.');return;}setMessage(`${item.display_name||item.name} updated.`);await load();}
  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · MENU LANGUAGES</small></div><span className="spacer"/><a className="btn secondary small" href="/manager/menu">Menu</a><a className="btn secondary small" href="/manager">Manager Home</a></div><main className="page" style={{maxWidth:1100}}>
    <section className="hero"><h1>English / 中文 Menu</h1><p>English stays as the default customer and printing language. Maintain the Chinese customer names here. Hot Kitchen split tickets use the Chinese name; Total Order and Meat tickets stay English.</p></section>
    {error&&<div className="error" style={{marginTop:12}}>{error}</div>}{message&&<div className="notice" style={{marginTop:12}}>{message}</div>}
    <div className="actions" style={{marginTop:16}}>{[['all','ALL'],['meat','BBQ MEAT'],['hot','HOT FOOD'],['rice_soup','RICE & SOUP']].map(([k,l])=><button key={k} className={`btn ${show===k?'brand':'secondary'}`} onClick={()=>setShow(k)}>{l}</button>)}</div>
    <div className="notice" style={{marginTop:14}}><b>Print language rule:</b> HOT FOOD split ticket = 中文 · TOTAL ORDER = English · BBQ MEAT split ticket = English · BAR RICE = English.</div>
    <div style={{display:'grid',gap:10,marginTop:14}}>{visible.map(item=><div className="card" key={item.id} style={{opacity:item.active?1:.55}}>
      <div className="actions"><div><div className="eyebrow">{item.category.toUpperCase()} · {item.station.toUpperCase()} {item.active?'':'· HIDDEN'}</div><h3 style={{margin:'4px 0'}}>{item.display_name||item.name}</h3></div><span className="spacer"/><button className="btn brand small" disabled={busy===item.id} onClick={()=>save(item)}>{busy===item.id?'SAVING…':'SAVE 中文'}</button></div>
      <div className="grid grid-3" style={{marginTop:12}}>
        <div className="field"><label>English Name</label><input value={item.display_name||item.name||''} disabled/></div>
        <div className="field"><label>中文菜名</label><input value={item.display_name_zh||''} onChange={e=>patch(item.id,'display_name_zh',e.target.value)} placeholder="例如：原味韩式炸鸡"/></div>
        <div className="field"><label>中文份量</label><input value={item.portion_label_zh||''} onChange={e=>patch(item.id,'portion_label_zh',e.target.value)} placeholder="例如：每份100g"/></div>
      </div>
      <div className="field" style={{marginTop:10}}><label>中文描述（可选）</label><input value={item.description_zh||''} onChange={e=>patch(item.id,'description_zh',e.target.value)} placeholder="顾客切换中文后显示"/></div>
    </div>)}</div>
  </main></>;
}
