'use client';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const FRIED_CHICKEN_IMAGE = '/menu/final/fried-chicken.webp';
const LOCAL_IMAGE_BY_NAME = {
  'Wagyu Scotch Fillet': '/menu/final/wagyu-scotch-fillet.webp',
  'Wagyu Intercostal': '/menu/final/wagyu-intercostal.webp',
  'Wagyu Inside Skirt': '/menu/final/wagyu-inside-skirt.webp',
  'Marinated LA Short Rib': '/menu/final/la-short-rib.webp',
  'Marinated Angus Flap Meat': '/menu/final/angus-flap-meat.webp',
  'Wagyu Brisket': '/menu/final/wagyu-brisket.webp',
  'Pork Belly': '/menu/final/pork-belly.webp',
  'Lamb cuttlet': '/menu/final/lamb-cutlet.webp',
  'OX.tongue': '/menu/final/ox-tongue.webp',
  'Pork jowl': '/menu/final/pork-jowl.webp',
  'Fresh scollop': '/menu/final/scallop.webp',
  'Fried Dumplings': '/menu/final/fried-dumplings.webp',
  'Seafood Pancake': '/menu/final/seafood-pancake.webp',
  'Tteokbokki': '/menu/final/tteokbokki.webp',
  'Dolsot Bibimbap': '/menu/final/dolsot-bibimbap.webp',
  'Steamed Rice': '/menu/final/steamed-rice.webp',
  'Pork cutlet': '/menu/final/pork-cutlet.webp',
  'Chicken schinizel': '/menu/final/chicken-schnitzel.webp',
};

function imageFor(item){
  const name=item?.display_name||item?.name||'';
  const raw=item?.name||'';
  if(LOCAL_IMAGE_BY_NAME[name]||LOCAL_IMAGE_BY_NAME[raw]) return LOCAL_IMAGE_BY_NAME[name]||LOCAL_IMAGE_BY_NAME[raw];
  if(/fried\s*chicken/i.test(name)||/fried\s*chicken/i.test(raw)) return FRIED_CHICKEN_IMAGE;
  return null;
}
function formatTime(ms){const seconds=Math.max(0,Math.floor(ms/1000));const m=Math.floor(seconds/60);const s=seconds%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}

export default function CustomerPage(){
  const {token}=useParams();
  const [data,setData]=useState(null),[error,setError]=useState(''),[category,setCategory]=useState('meat'),[cart,setCart]=useState({}),[now,setNow]=useState(Date.now()),[submitting,setSubmitting]=useState(false),[lang,setLang]=useState('en');
  const submitLock=useRef(false),loadLock=useRef(false);
  const zh=lang==='zh';
  const L=(en,cn)=>zh?cn:en;

  useEffect(()=>{try{const saved=localStorage.getItem('hanok_customer_lang');if(saved==='zh'||saved==='en')setLang(saved);}catch{}},[]);
  function changeLang(next){setLang(next);try{localStorage.setItem('hanok_customer_lang',next);}catch{}}

  async function load(){
    if(loadLock.current)return;loadLock.current=true;
    try{const r=await fetch(`/api/customer/session?token=${encodeURIComponent(token)}`,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to load table.');setData(j);setError('');}
    catch(e){setError(e.message);}finally{loadLock.current=false;}
  }
  useEffect(()=>{let timer=null,stopped=false;const schedule=()=>{if(stopped)return;clearTimeout(timer);const delay=document.hidden?60000:15000;timer=setTimeout(async()=>{if(!document.hidden)await load();schedule();},delay);};const onVisible=()=>{if(!document.hidden){load();setNow(Date.now())}schedule();};load();schedule();document.addEventListener('visibilitychange',onVisible);window.addEventListener('focus',onVisible);return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible)};},[token]);
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);

  const session=data?.session,isLunch=session?.service_mode==='lunch',noStarter=!isLunch&&session?.starter_preference==='none';
  useEffect(()=>{if(isLunch&&category==='meat')setCategory('hot');},[isLunch,category]);
  const menu=useMemo(()=>data?.menu?.filter(x=>x.category===category)||[],[data,category]);
  const meatCount=Object.entries(cart).reduce((n,[id,q])=>n+(data?.menu?.find(x=>x.id===id)?.category==='meat'?q:0),0);
  const itemCount=Object.values(cart).reduce((a,b)=>a+b,0);
  const meatLimit=!isLunch&&session?(session.starter_equivalent<=2?4:session.starter_equivalent<=4?6:session.starter_equivalent<=6?8:10):0;
  const lunchItemsPerGuest=Number(data?.store?.lunch_items_per_guest??3),lunchSameItemMax=Number(data?.store?.lunch_same_item_max??2),lunchCooldownMinutes=Number(data?.store?.lunch_cooldown_minutes??5),lunchLastOrderMinutes=Number(data?.store?.lunch_last_order_minutes??15);
  const lunchLimit=isLunch&&session?Math.max(1,Number(session.total_guests)||1)*lunchItemsPerGuest:0;
  const meatWait=session?Math.max(0,new Date(session.meat_order_available_at).getTime()-now):0,hotWait=session?Math.max(0,new Date(session.hot_order_available_at).getTime()-now):0,lunchWait=isLunch?hotWait:0;
  const remaining=session?new Date(session.ends_at).getTime()-now:0,lastOrderClosed=session?now>=new Date(session.last_order_at).getTime():false;
  const tabs=isLunch?[["hot",L('Hot Dishes','热菜')],["rice_soup",L('Rice & Soup','米饭与汤')]]:[["meat",L('BBQ Meats','烤肉')],["hot",L('Hot Dishes','热菜')],["rice_soup",L('Rice & Soup','米饭与汤')]];

  function itemName(item){return zh?(item.display_name_zh||item.display_name||item.name):(item.display_name||item.name);}
  function itemDetail(item){return zh?(item.portion_label_zh||item.description_zh||item.portion_label||item.description):(item.portion_label||item.description);}
  function maxFor(item){const menuMax=Number(item.max_per_round)||0;if(isLunch)return menuMax>0?Math.min(menuMax,lunchSameItemMax):lunchSameItemMax;return menuMax;}
  function change(item,delta){if(!session)return;const current=cart[item.id]||0,next=Math.max(0,current+delta),itemMax=maxFor(item);if(itemMax>0&&next>itemMax)return;if(item.category==='meat'&&delta>0&&(isLunch||meatCount>=meatLimit))return;if(isLunch&&delta>0&&itemCount>=lunchLimit)return;setCart(c=>({...c,[item.id]:next}));}
  async function submit(){if(!session||!itemCount||submitLock.current)return;if(isLunch&&itemCount>lunchLimit){setError(L(`This table can order up to ${lunchLimit} items this round.`,`本桌本轮最多可点 ${lunchLimit} 份。`));return;}submitLock.current=true;setSubmitting(true);setError('');try{const items=Object.entries(cart).filter(([,qty])=>qty>0).map(([menu_item_id,qty])=>({menu_item_id,qty}));const r=await fetch('/api/customer/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,items})});const j=await r.json();if(!r.ok){setError(j.error||L('Order failed.','下单失败。'));return;}setCart({});await load();}catch(e){setError(e.message||L('Order failed.','下单失败。'));}finally{setSubmitting(false);submitLock.current=false;}}

  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · {session?L('TABLE ORDERING','扫码点餐'):L('MENU PREVIEW','菜单预览')}</small></div><span className="spacer"/><div data-no-translate style={{display:'flex',gap:4,background:'#fff',borderRadius:999,padding:3}}><button onClick={()=>changeLang('en')} style={{border:0,borderRadius:999,padding:'6px 9px',fontWeight:800,background:lang==='en'?'#8e1d21':'transparent',color:lang==='en'?'#fff':'#333'}}>EN</button><button onClick={()=>changeLang('zh')} style={{border:0,borderRadius:999,padding:'6px 9px',fontWeight:800,background:lang==='zh'?'#8e1d21':'transparent',color:lang==='zh'?'#fff':'#333'}}>中文</button></div></div>
    <main className="page" style={{maxWidth:820}}>
      {error&&<div className="error" style={{marginBottom:12}}>{error}</div>}
      {!data&&!error&&<div className="card"><div className="spinner"/> {L('Loading…','加载中…')}</div>}
      {data&&<>
        <section className="hero"><h1>{isLunch?L('WEEKDAY LUNCH BUFFET','工作日午餐自助'):L('HANOK UNLIMITED BBQ','HANOK 韩式烤肉自助')}</h1><div className="actions" style={{marginTop:14}}><span className="badge new">{data.table.name}</span>{session&&<span className="badge new">{session.total_guests} {L('Guests','位客人')}</span>}<span className="spacer"/><b style={{fontSize:28}}>{session?formatTime(remaining):L('MENU','菜单')}</b></div></section>
        {!session&&<div className="notice" style={{marginTop:14}}><b>{L('Preview our menu while you wait.','等待开台期间可以先浏览菜单。')}</b><br/>{L('Your table has not started yet. You can browse everything below now. Once our team starts your session, this same QR code automatically becomes your ordering menu.','当前桌台尚未开台。您现在可以先浏览全部菜单；员工开台后，这个二维码会自动变成点餐页面。')}</div>}
        {session&&isLunch&&<div className="notice" style={{marginTop:14}}><b>{L('Weekday Lunch Buffet · Monday–Friday','工作日午餐自助 · 周一至周五')}</b><br/>{L(`60-minute dining session. Order up to ${lunchItemsPerGuest} items per guest, per round. A new round opens every ${lunchCooldownMinutes} minutes. The same dish is limited to ${lunchSameItemMax} portions per round. BBQ meats are not included. Last order closes ${lunchLastOrderMinutes} minutes before finish.`,`用餐时间60分钟。每位客人每轮最多点${lunchItemsPerGuest}份，每${lunchCooldownMinutes}分钟开放新一轮；同一道菜每轮最多${lunchSameItemMax}份。不包含烤肉。结束前${lunchLastOrderMinutes}分钟停止点餐。`)}</div>}
        {session&&!isLunch&&(noStarter?<div className="notice" style={{marginTop:14}}><b>{L('Choose Your Own First Grill','自由选择第一轮烤肉')}</b><br/>{L('No Starter Platter has been sent. You can choose your BBQ meats directly below. The normal meat-per-round limit applies, and the cooldown starts after each meat order. Side dishes and desserts are self-service.','本桌未安排 Starter Platter，可直接在下方选择烤肉。每轮肉类数量限制照常执行，每次肉类下单后进入冷却时间。小菜和甜品请自取。')}</div>:<div className="notice" style={{marginTop:14}}><b>{L('Hanok First Grill Selection','Hanok 首轮烤肉拼盘')}</b><br/>{L('Your starter platter has been sent to the meat station. Side dishes and desserts are self-service.','您的 Starter Platter 已发送至肉类档口。小菜和甜品请自取。')}</div>)}
        {session&&lastOrderClosed&&<div className="error" style={{marginTop:10}}>{L('Last order has closed for this session. Please speak with our team if you need assistance.','本桌已停止点餐，如有需要请联系工作人员。')}</div>}
        {session&&isLunch&&lunchWait>0&&<div className="notice" style={{marginTop:10}}><b>{L('Next round opens in','下一轮开放倒计时')} {formatTime(lunchWait)}</b><br/>{L('You can prepare your next selection when the timer reaches 00:00.','倒计时到 00:00 后即可开始下一轮点餐。')}</div>}
        <div className="actions" style={{margin:'16px 0 10px',overflowX:'auto',flexWrap:'nowrap'}}>{tabs.map(([k,l])=><button key={k} className={`btn ${category===k?'brand':'secondary'}`} onClick={()=>setCategory(k)}>{l}</button>)}</div>
        {session&&!isLunch&&category==='meat'&&<div className="muted" style={{fontSize:12,margin:'0 2px 10px'}}>{L('You may select up to','本轮最多可选择')} <b>{meatLimit} {L('meat portions','份肉类')}</b>{L(' in total this round. Each item also has its own maximum shown below.','。每个单品也有独立上限。')}</div>}
        {session&&isLunch&&<div className="muted" style={{fontSize:12,margin:'0 2px 10px'}}>{L('This table may select up to','本桌本轮最多可点')} <b>{lunchLimit} {L('items this round','份')}</b> ({L(`${lunchItemsPerGuest} per guest`,`每人${lunchItemsPerGuest}份`)})。{L(`Each dish is limited to ${lunchSameItemMax} portions per round.`,`同一道菜每轮最多${lunchSameItemMax}份。`)}</div>}
        <div className="grid grid-2">{menu.map(item=>{const q=cart[item.id]||0;const wait=session?(isLunch?lunchWait:(item.station==='meat'?meatWait:item.station==='hot'?hotWait:0)):0;const itemMax=maxFor(item);const img=imageFor(item);return <div className="card" key={item.id} style={{padding:0,overflow:'hidden'}}>{img&&<div style={{width:'100%',aspectRatio:'4 / 3',background:'#17110f',overflow:'hidden'}}><img src={img} alt="" loading="lazy" onError={e=>{e.currentTarget.parentElement.style.display='none'}} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/></div>}<div style={{padding:14}}><h3 style={{margin:'0 0 5px',fontSize:16}}>{itemName(item)}</h3><div className="muted" style={{fontSize:12}}>{itemDetail(item)}</div>{session&&itemMax>0&&<div style={{fontSize:11,fontWeight:700,marginTop:6}}>{L('Max','最多')} {itemMax} {L('per round','份/轮')}</div>}{session&&wait>0&&<div style={{fontSize:11,color:'#8a5010',marginTop:6}}>{L('Next order in','下次可点')} {formatTime(wait)}</div>}{session&&<div className="actions" style={{alignItems:'center',flexWrap:'nowrap',marginTop:12}}><button className="btn secondary small" disabled={submitting} onClick={()=>change(item,-1)}>−</button><b>{q}{itemMax>0?` / ${itemMax}`:''}</b><button className="btn secondary small" disabled={submitting||wait>0||lastOrderClosed||(itemMax>0&&q>=itemMax)||(item.category==='meat'&&(isLunch||meatCount>=meatLimit))||(isLunch&&itemCount>=lunchLimit)} onClick={()=>change(item,1)}>+</button></div>}</div></div>})}</div>
        {session&&<><div className="card" style={{position:'sticky',bottom:12,marginTop:16,background:'#241c18',color:'#fff',zIndex:20}}><div style={{display:'flex',alignItems:'center',gap:12}}><div><b>{itemCount} {L('items','份')}</b>{!isLunch&&<div style={{fontSize:12,color:'#d8c7aa'}}>{L('Meat','肉类')} {meatCount} / {meatLimit} {L('this round','本轮')}</div>}{isLunch&&<div style={{fontSize:12,color:'#d8c7aa'}}>{L('Lunch round','午餐本轮')} {itemCount} / {lunchLimit} · {L('same dish max','同菜最多')} {lunchSameItemMax}</div>}</div><div className="spacer"/><button className="btn gold" disabled={!itemCount||submitting||lastOrderClosed||lunchWait>0||(isLunch&&itemCount>lunchLimit)} onClick={submit}>{submitting?L('SENDING…','发送中…'):L('PLACE ORDER','确认下单')}</button></div></div><div className="section-title"><h3>{L('Your recent orders','最近订单')}</h3></div><div className="card">{!data.recent_orders?.length?<span className="muted">{L('No order submitted yet.','还没有提交订单。')}</span>:data.recent_orders.map(o=><div key={o.id} style={{borderBottom:'1px solid var(--line)',padding:'10px 0'}}><b>{L('Order','订单')}</b> · <span className="muted">{o.status}</span><div style={{fontSize:13,marginTop:4}}>{o.order_items.map(i=>`${zh?(i.item_name_zh||i.item_name):i.item_name} ×${i.qty}`).join(' · ')}</div></div>)}</div></>}
      </>}
    </main>
  </>;
}
