'use client';
import {useEffect,useState} from 'react';

export default function LunchSettingsPage(){
  const [data,setData]=useState(null);const[error,setError]=useState('');const[message,setMessage]=useState('');const[busy,setBusy]=useState(false);const[zh,setZh]=useState(false);
  const L=(en,cn)=>zh?cn:en;
  useEffect(()=>{const sync=()=>setZh(String(document.documentElement.lang||'en').toLowerCase().startsWith('zh'));sync();const o=new MutationObserver(sync);o.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});return()=>o.disconnect()},[]);
  async function load(){setError('');const r=await fetch('/api/manager/settings',{cache:'no-store'});const j=await r.json().catch(()=>({}));if(r.status===401){location.href='/manager';return}if(!r.ok){setError(j.error||L('Unable to load settings.','无法加载设置。'));return}setData(j)}
  useEffect(()=>{load()},[]);
  function set(k,v){setData(d=>({...d,[k]:v}))}
  async function save(){setBusy(true);setError('');setMessage('');const r=await fetch('/api/manager/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'lunch',lunch_dining_minutes:data.lunch_dining_minutes,lunch_last_order_minutes:data.lunch_last_order_minutes,lunch_cooldown_minutes:data.lunch_cooldown_minutes,lunch_items_per_guest:data.lunch_items_per_guest,lunch_same_item_max:data.lunch_same_item_max})});const j=await r.json().catch(()=>({}));setBusy(false);if(!r.ok){setError(j.error||L('Unable to save settings.','无法保存设置。'));return}setData(d=>({...d,...j}));setMessage(L('Lunch Buffet settings saved. New sessions will use these rules.','午餐自助设置已保存，新开的桌台会使用这些规则。'))}
  const field=(label,key,min,max,help)=><div className="field"><label>{label}</label><input type="number" min={min} max={max} value={data?.[key]??''} onChange={e=>set(key,Math.max(min,Math.min(max,Number(e.target.value))))}/>{help&&<div className="muted" style={{fontSize:12,marginTop:5}}>{help}</div>}</div>;
  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · LUNCH BUFFET SETTINGS</small></div><span className="spacer"/><a className="btn secondary small" href="/manager">{L('Manager Home','经理首页')}</a></div><main className="page" style={{maxWidth:920}}>
    <section className="hero"><h1>{L('Weekday Lunch Buffet Settings','工作日午餐自助设置')}</h1><p>{L('Monday–Friday only. Control dining time, last order and per-round ordering limits without changing the dinner BBQ rules.','仅周一至周五。可单独调整用餐时间、最后点餐和每轮点餐限制，不影响晚餐烤肉规则。')}</p></section>
    {error&&<div className="error" style={{marginTop:14}}>{error}</div>}{message&&<div className="notice" style={{marginTop:14}}>{message}</div>}
    {!data?<div className="card" style={{marginTop:16}}>Loading…</div>:<>
      <div className="card" style={{marginTop:16}}><div className="eyebrow">{L('CURRENT LUNCH RULES','当前午餐规则')}</div><h2 style={{margin:'5px 0 8px'}}>{data.lunch_items_per_guest} {L('items per guest, per round','道 / 每人 / 每轮')}</h2><p className="muted">{L(`New round every ${data.lunch_cooldown_minutes} minutes · Same dish max ${data.lunch_same_item_max} portions · Last order ${data.lunch_last_order_minutes} minutes before finish.`,`每 ${data.lunch_cooldown_minutes} 分钟开放新一轮 · 同一道菜每轮最多 ${data.lunch_same_item_max} 份 · 结束前 ${data.lunch_last_order_minutes} 分钟停止点餐。`)}</p></div>
      <div className="grid grid-2" style={{marginTop:14}}>
        {field(L('Dining Time (minutes)','用餐时间（分钟）'),'lunch_dining_minutes',30,120,L('Default: 60 minutes','默认：60 分钟'))}
        {field(L('Last Order Before Finish (minutes)','结束前停止点餐（分钟）'),'lunch_last_order_minutes',0,30,L('Default: 15 minutes','默认：15 分钟'))}
        {field(L('New Round Cooldown (minutes)','每轮冷却时间（分钟）'),'lunch_cooldown_minutes',0,15,L('Default: 5 minutes','默认：5 分钟'))}
        {field(L('Items Per Guest Per Round','每人每轮最多道数'),'lunch_items_per_guest',1,10,L('Default: 3 items per guest','默认：每人每轮 3 道'))}
        {field(L('Same Dish Max Per Round','同一道菜每轮最多份数'),'lunch_same_item_max',1,10,L('Default: 2 portions','默认：2 份'))}
      </div>
      <div className="notice" style={{marginTop:14}}><b>{L('How the table limit works:','桌台上限计算：')}</b><br/>{L(`Guests × ${data.lunch_items_per_guest}. Example: a 4-person table can order up to ${4*Number(data.lunch_items_per_guest||0)} items in one round. The next round opens after ${data.lunch_cooldown_minutes} minutes.`,`客人数 × ${data.lunch_items_per_guest}。例如：4 人桌每轮最多可点 ${4*Number(data.lunch_items_per_guest||0)} 道；${data.lunch_cooldown_minutes} 分钟后开放下一轮。`)}</div>
      <div className="notice" style={{marginTop:10}}><b>{L('Protection:','系统保护：')}</b> {L('BBQ meat remains disabled for Lunch Buffet. These limits are enforced by the database, not only by the customer screen.','Lunch Buffet 仍然禁止点烤肉。这些限制由数据库强制执行，不只是前端显示限制。')}</div>
      <button className="btn brand" style={{marginTop:16}} disabled={busy} onClick={save}>{busy?L('SAVING…','保存中…'):L('SAVE LUNCH SETTINGS','保存午餐设置')}</button>
    </>}
  </main></>;
}
