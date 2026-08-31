'use client';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const HANOK_IMG = file => `https://hanokbbq.com.au/wp-content/uploads/2021/02/${file}`;
const FRIED_CHICKEN_IMAGE = HANOK_IMG('%E1%84%83%E1%85%A1%E1%86%B0%E1%84%80%E1%85%A1%E1%86%BC%E1%84%8C%E1%85%A5%E1%86%BC-%E1%84%92%E1%85%AE%E1%84%85%E1%85%A1%E1%84%8B%E1%85%B5%E1%84%83%E1%85%B3_1-%E6%8B%B7%E8%B4%9D.jpg');
const LOCAL_IMAGE_BY_NAME = {
  'Wagyu Scotch Fillet': '/menu/final/wagyu-scotch-fillet.webp',
  'Wagyu Intercostal': '/menu/final/wagyu-intercostal.webp',
  'Wagyu Inside Skirt': '/menu/final/wagyu-inside-skirt.webp',
};
const IMAGE_BY_NAME = {
  'Marinated LA Short Rib': HANOK_IMG('%E1%84%89%E1%85%A9%E1%84%80%E1%85%A1%E1%86%AF%E1%84%87%E1%85%B5_1-%E6%8B%B7%E8%B4%9D.jpg'),
  'Marinated Angus Flap Meat': HANOK_IMG('%E1%84%8B%E1%85%A3%E1%86%BC%E1%84%82%E1%85%A7%E1%86%B7-%E1%84%89%E1%85%A9%E1%84%80%E1%85%A1%E1%86%AF%E1%84%87%E1%85%B5_1-%E6%8B%B7%E8%B4%9D.jpg'),
  'Wagyu Brisket': HANOK_IMG('Wagyu-brisket-%E6%8B%B7%E8%B4%9D.jpg'),
  'Pork Belly': HANOK_IMG('%E1%84%89%E1%85%A1%E1%86%B7%E1%84%80%E1%85%A7%E1%86%B8%E1%84%89%E1%85%A1%E1%86%AF_1-%E6%8B%B7%E8%B4%9D.jpg'),
  'Soy Marinated Chicken Thigh': HANOK_IMG('%E1%84%80%E1%85%A1%E1%86%AB%E1%84%8C%E1%85%A1%E1%86%BC-%E1%84%8B%E1%85%A3%E1%86%BC%E1%84%82%E1%85%A7%E1%86%B7-%E1%84%80%E1%85%A1%E1%86%AF%E1%84%87%E1%85%B5_1-%E6%8B%B7%E8%B4%9D.jpg'),
  'Fresh scollop': HANOK_IMG('Scallop.png'),
  'Seafood Pancake': HANOK_IMG('%E1%84%89%E1%85%A2%E1%84%8B%E1%85%AE%E1%84%8C%E1%85%A5%E1%86%AB_1-%E6%8B%B7%E8%B4%9D.jpg'),
  'Fried Dumplings': HANOK_IMG('%E1%84%80%E1%85%AE%E1%86%AB%E1%84%86%E1%85%A1%E1%86%AB%E1%84%83%E1%85%AE_1-%E6%8B%B7%E8%B4%9D.jpg'),
  'Kimchi Pancake': HANOK_IMG('%E1%84%80%E1%85%B5%E1%86%B7%E1%84%8E%E1%85%B5%E1%84%8C%E1%85%A5%E1%86%AB_1-%E6%8B%B7%E8%B4%9D.jpg'),
};

function imageFor(item){
  const name=item?.display_name||item?.name||'';
  const raw=item?.name||'';
  if(LOCAL_IMAGE_BY_NAME[name]||LOCAL_IMAGE_BY_NAME[raw]) return LOCAL_IMAGE_BY_NAME[name]||LOCAL_IMAGE_BY_NAME[raw];
  if(/fried\s*chicken/i.test(name)||/fried\s*chicken/i.test(raw)) return FRIED_CHICKEN_IMAGE;
  return IMAGE_BY_NAME[name]||IMAGE_BY_NAME[raw]||null;
}

function formatTime(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function CustomerPage() {
  const { token } = useParams();
  const [data,setData] = useState(null);
  const [error,setError] = useState('');
  const [category,setCategory] = useState('meat');
  const [cart,setCart] = useState({});
  const [now,setNow] = useState(Date.now());
  const [submitting,setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const loadLock = useRef(false);

  async function load() {
    if(loadLock.current) return;
    loadLock.current=true;
    try {
      const r = await fetch(`/api/customer/session?token=${encodeURIComponent(token)}`, {cache:'no-store'});
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load table.');
      setData(j);setError('');
    } catch (e) { setError(e.message); }
    finally { loadLock.current=false; }
  }

  useEffect(()=>{
    let timer=null; let stopped=false;
    const schedule=()=>{
      if(stopped)return;
      clearTimeout(timer);
      const delay=document.hidden?60000:15000;
      timer=setTimeout(async()=>{if(!document.hidden)await load();schedule();},delay);
    };
    const onVisible=()=>{if(!document.hidden){load();setNow(Date.now())}schedule();};
    load();schedule();
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',onVisible);
    return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible)};
  },[token]);

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);

  const session=data?.session;
  const isLunch=session?.service_mode==='lunch';
  const noStarter=!isLunch&&session?.starter_preference==='none';
  useEffect(()=>{if(isLunch&&category==='meat')setCategory('hot');},[isLunch,category]);
  const menu=useMemo(()=>data?.menu?.filter(x=>x.category===category)||[],[data,category]);
  const meatCount=Object.entries(cart).reduce((n,[id,q])=>n+(data?.menu?.find(x=>x.id===id)?.category==='meat'?q:0),0);
  const itemCount=Object.values(cart).reduce((a,b)=>a+b,0);
  const meatLimit=!isLunch&&session ? (session.starter_equivalent<=2?4:session.starter_equivalent<=4?6:session.starter_equivalent<=6?8:10) : 0;
  const lunchItemsPerGuest=Number(data?.store?.lunch_items_per_guest??3);
  const lunchSameItemMax=Number(data?.store?.lunch_same_item_max??2);
  const lunchCooldownMinutes=Number(data?.store?.lunch_cooldown_minutes??5);
  const lunchLastOrderMinutes=Number(data?.store?.lunch_last_order_minutes??15);
  const lunchLimit=isLunch&&session ? Math.max(1,Number(session.total_guests)||1)*lunchItemsPerGuest : 0;
  const meatWait=session ? Math.max(0,new Date(session.meat_order_available_at).getTime()-now) : 0;
  const hotWait=session ? Math.max(0,new Date(session.hot_order_available_at).getTime()-now) : 0;
  const lunchWait=isLunch?hotWait:0;
  const remaining=session ? new Date(session.ends_at).getTime()-now : 0;
  const lastOrderClosed=session ? now>=new Date(session.last_order_at).getTime() : false;
  const tabs=isLunch?[["hot","Hot Dishes"],["rice_soup","Rice & Soup"]]:[["meat","BBQ Meats"],["hot","Hot Dishes"],["rice_soup","Rice & Soup"]];

  function maxFor(item){
    const menuMax=Number(item.max_per_round)||0;
    if(isLunch)return menuMax>0?Math.min(menuMax,lunchSameItemMax):lunchSameItemMax;
    return menuMax;
  }

  function change(item,delta){
    if(!session)return;
    const current=cart[item.id]||0;const next=Math.max(0,current+delta);const itemMax=maxFor(item);
    if(itemMax>0&&next>itemMax) return;
    if(item.category==='meat'&&delta>0&&(isLunch||meatCount>=meatLimit)) return;
    if(isLunch&&delta>0&&itemCount>=lunchLimit) return;
    setCart(c=>({...c,[item.id]:next}));
  }

  async function submit(){
    if(!session||!itemCount||submitLock.current)return;
    if(isLunch&&itemCount>lunchLimit){setError(`This table can order up to ${lunchLimit} items this round.`);return;}
    submitLock.current=true;setSubmitting(true);setError('');
    try{
      const items=Object.entries(cart).filter(([,qty])=>qty>0).map(([menu_item_id,qty])=>({menu_item_id,qty}));
      const r=await fetch('/api/customer/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,items})});
      const j=await r.json();
      if(!r.ok){setError(j.error||'Order failed.');return;}
      setCart({});await load();
    }catch(e){setError(e.message||'Order failed.');}
    finally{setSubmitting(false);submitLock.current=false;}
  }

  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · {session?'TABLE ORDERING':'MENU PREVIEW'}</small></div></div>
    <main className="page" style={{maxWidth:820}}>
      {error&&<div className="error" style={{marginBottom:12}}>{error}</div>}
      {!data&&!error&&<div className="card"><div className="spinner"/> Loading…</div>}
      {data&&<>
        <section className="hero">
          <h1>{isLunch?'WEEKDAY LUNCH BUFFET':'HANOK UNLIMITED BBQ'}</h1>
          <div className="actions" style={{marginTop:14}}><span className="badge new">{data.table.name}</span>{session&&<span className="badge new">{session.total_guests} Guests</span>}<span className="spacer"/><b style={{fontSize:28}}>{session?formatTime(remaining):'MENU'}</b></div>
        </section>

        {!session&&<div className="notice" style={{marginTop:14}}><b>Preview our menu while you wait.</b><br/>Your table has not started yet. You can browse everything below now. Once our team starts your session, this same QR code automatically becomes your ordering menu.</div>}
        {session&&isLunch&&<div className="notice" style={{marginTop:14}}><b>Weekday Lunch Buffet · Monday–Friday</b><br/>60-minute dining session. Order up to <b>{lunchItemsPerGuest} items per guest, per round</b>. A new round opens every <b>{lunchCooldownMinutes} minutes</b>. The same dish is limited to <b>{lunchSameItemMax} portions per round</b>. BBQ meats are not included. Last order closes <b>{lunchLastOrderMinutes} minutes before finish</b>.</div>}
        {session&&!isLunch&&(noStarter?<div className="notice" style={{marginTop:14}}><b>Choose Your Own First Grill</b><br/>No Starter Platter has been sent. You can choose your BBQ meats directly below. The normal meat-per-round limit applies, and the cooldown starts after each meat order. Side dishes and desserts are self-service.</div>:<div className="notice" style={{marginTop:14}}><b>Hanok First Grill Selection</b><br/>Your starter platter has been sent to the meat station. Side dishes and desserts are self-service.</div>)}
        {session&&lastOrderClosed&&<div className="error" style={{marginTop:10}}>Last order has closed for this session. Please speak with our team if you need assistance.</div>}
        {session&&isLunch&&lunchWait>0&&<div className="notice" style={{marginTop:10}}><b>Next round opens in {formatTime(lunchWait)}</b><br/>You can prepare your next selection when the timer reaches 00:00.</div>}

        <div className="actions" style={{margin:'16px 0 10px',overflowX:'auto',flexWrap:'nowrap'}}>
          {tabs.map(([k,l])=><button key={k} className={`btn ${category===k?'brand':'secondary'}`} onClick={()=>setCategory(k)}>{l}</button>)}
        </div>
        {session&&!isLunch&&category==='meat'&&<div className="muted" style={{fontSize:12,margin:'0 2px 10px'}}>You may select up to <b>{meatLimit} meat portions</b> in total this round. Each item also has its own maximum shown below.</div>}
        {session&&isLunch&&<div className="muted" style={{fontSize:12,margin:'0 2px 10px'}}>This table may select up to <b>{lunchLimit} items this round</b> ({lunchItemsPerGuest} per guest). Each dish is limited to {lunchSameItemMax} portions per round.</div>}

        <div className="grid grid-2">
          {menu.map(item=>{
            const q=cart[item.id]||0;
            const wait=session?(isLunch?lunchWait:(item.station==='meat'?meatWait:item.station==='hot'?hotWait:0)):0;
            const itemMax=maxFor(item);
            const img=imageFor(item);
            return <div className="card" key={item.id} style={{padding:0,overflow:'hidden'}}>
              {img&&<div style={{width:'100%',aspectRatio:'4 / 3',background:'#17110f',overflow:'hidden'}}><img src={img} alt="" loading="lazy" onError={e=>{e.currentTarget.parentElement.style.display='none'}} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/></div>}
              <div style={{padding:14}}>
                <h3 style={{margin:'0 0 5px',fontSize:16}}>{item.display_name||item.name}</h3>
                <div className="muted" style={{fontSize:12}}>{item.portion_label||item.description}</div>
                {session&&itemMax>0&&<div style={{fontSize:11,fontWeight:700,marginTop:6}}>Max {itemMax} per round</div>}
                {session&&wait>0&&<div style={{fontSize:11,color:'#8a5010',marginTop:6}}>Next order in {formatTime(wait)}</div>}
                {session&&<div className="actions" style={{alignItems:'center',flexWrap:'nowrap',marginTop:12}}><button className="btn secondary small" disabled={submitting} onClick={()=>change(item,-1)}>−</button><b>{q}{itemMax>0?` / ${itemMax}`:''}</b><button className="btn secondary small" disabled={submitting||wait>0||lastOrderClosed||(itemMax>0&&q>=itemMax)||(item.category==='meat'&&(isLunch||meatCount>=meatLimit))||(isLunch&&itemCount>=lunchLimit)} onClick={()=>change(item,1)}>+</button></div>}
              </div>
            </div>
          })}
        </div>

        {session&&<>
          <div className="card" style={{position:'sticky',bottom:12,marginTop:16,background:'#241c18',color:'#fff',zIndex:20}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}><div><b>{itemCount} items</b>{!isLunch&&<div style={{fontSize:12,color:'#d8c7aa'}}>Meat {meatCount} / {meatLimit} this round</div>}{isLunch&&<div style={{fontSize:12,color:'#d8c7aa'}}>Lunch round {itemCount} / {lunchLimit} · max {lunchSameItemMax} of the same dish</div>}</div><div className="spacer"/><button className="btn gold" disabled={!itemCount||submitting||lastOrderClosed||lunchWait>0||(isLunch&&itemCount>lunchLimit)} onClick={submit}>{submitting?'SENDING…':'PLACE ORDER'}</button></div>
          </div>
          <div className="section-title"><h3>Your recent orders</h3></div>
          <div className="card">{!data.recent_orders?.length?<span className="muted">No order submitted yet.</span>:data.recent_orders.map(o=><div key={o.id} style={{borderBottom:'1px solid var(--line)',padding:'10px 0'}}><b>Order</b> · <span className="muted">{o.status}</span><div style={{fontSize:13,marginTop:4}}>{o.order_items.map(i=>`${i.item_name} ×${i.qty}`).join(' · ')}</div></div>)}</div>
        </>}
      </>}
    </main>
  </>;
}