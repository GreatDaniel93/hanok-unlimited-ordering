'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const pairs=[
  ['Start Weekday Lunch Buffet or Unlimited BBQ sessions and manage the dining flow.','开启工作日午餐自助或烤肉自助，并管理用餐流程。'],
  ['Service Type','服务类型'],
  ['Weekday Lunch Buffet · 60 min','工作日午餐自助 · 60 分钟'],
  ['Unlimited BBQ · 90 min','烤肉自助 · 90 分钟'],
  ['WEEKDAY LUNCH BUFFET','工作日午餐自助'],
  ['60-minute dining session · Last order closes with 15 minutes remaining · No BBQ meat · No Starter Platter. Customers can order all active Hot Dishes and Rice & Soup items.','用餐时间 60 分钟 · 剩余 15 分钟时停止点餐 · 不包含烤肉 · 不出 Starter Platter。顾客可点所有启用的热菜、米饭和汤。'],
  ['START 60-MIN LUNCH','开始 60 分钟午餐自助'],
  ['START 90-MIN BBQ SESSION','开始 90 分钟烤肉自助'],
  ['Weekday Lunch Buffet is available Monday to Friday. Managers can open a test session outside weekdays.','工作日午餐自助供周一至周五使用。经理可在非工作日开启测试桌。'],
  ['UNLIMITED BBQ','烤肉自助'],
  ['Last order closes 15 minutes before session end · BBQ meat is disabled.','结束前 15 分钟停止点餐 · 烤肉已禁用。'],
  ['WEEKDAY LUNCH · 60 MIN','工作日午餐 · 60 分钟'],
  ['BBQ · NO PORK STARTER','烤肉 · 无猪肉 Starter'],
  ['BBQ · STANDARD STARTER','烤肉 · 标准 Starter'],
  ['BBQ · NO STARTER','烤肉 · 不要 Starter'],
  ['Starter Preference','Starter 选择'],
  ['Standard Starter','标准 Starter'],
  ['No Pork Starter','无猪肉 Starter'],
  ['No Starter · Guests choose their own meat','不要 Starter · 客人自己选肉'],
  ['NO STARTER','不要 Starter'],
  ['No Starter Platter will be sent. Guests can immediately choose their own BBQ meats from the QR menu, subject to the normal meat-per-round limit and cooldown after each meat order.','不会发送 Starter Platter。客人可以立即从扫码菜单自行选择烤肉，仍受正常的每轮肉类上限限制；每次成功点肉后进入正常冷却时间。'],
  ['Starter:','Starter：'],
  ['NONE · Guests choose their own meat','无 · 客人自己选肉'],
  ['All Services','全部服务'],
  ['Weekday Lunch Buffet','工作日午餐自助'],
  ['Unlimited BBQ','烤肉自助'],
  ['Lunch Sessions','午餐桌次'],
  ['BBQ Sessions','烤肉桌次'],
  ['Bar / Rice Serves','吧台 / 米饭份数'],
  ['Use the Service Type filter to keep Lunch and BBQ consumption separate. Meat kg is estimated at 100g per serve.','使用“服务类型”筛选，将午餐和烤肉自助的用量分开统计。肉类重量按每份 100g 估算。'],
  ['Lunch Settings / 午餐设置','午餐设置'],
  ['Weekday Lunch Buffet Settings','工作日午餐自助设置'],
  ['CURRENT LUNCH RULES','当前午餐规则'],
  ['SAVE LUNCH SETTINGS','保存午餐设置']
];
const enToZh=new Map(pairs), zhToEn=new Map(pairs.map(([a,b])=>[b,a]));

function translateText(value,zh){
  if(!value||!value.trim())return value;
  const m=value.match(/^(\s*)([\s\S]*?)(\s*)$/);let core=m?m[2]:value;
  core=core.replace('Last order closes with 10 minutes remaining','Last order closes with 15 minutes remaining');
  core=core.replace('Last order closes 10 minutes before session end','Last order closes 15 minutes before session end');
  const map=zh?enToZh:zhToEn;let next=map.get(core)||core;
  if(zh){
    next=next.replace(/^(\d+) min remaining · WEEKDAY LUNCH · 60 MIN$/,'剩余 $1 分钟 · 工作日午餐 · 60 分钟');
    next=next.replace(/^(\d+) min remaining · BBQ · NO PORK STARTER$/,'剩余 $1 分钟 · 烤肉 · 无猪肉 Starter');
    next=next.replace(/^(\d+) min remaining · BBQ · STANDARD STARTER$/,'剩余 $1 分钟 · 烤肉 · 标准 Starter');
    next=next.replace(/^(\d+) min remaining · BBQ · NO STARTER$/,'剩余 $1 分钟 · 烤肉 · 不要 Starter');
  }else{
    next=next.replace(/^剩余 (\d+) 分钟 · 工作日午餐 · 60 分钟$/,'$1 min remaining · WEEKDAY LUNCH · 60 MIN');
    next=next.replace(/^剩余 (\d+) 分钟 · 烤肉 · 无猪肉 Starter$/,'$1 min remaining · BBQ · NO PORK STARTER');
    next=next.replace(/^剩余 (\d+) 分钟 · 烤肉 · 标准 Starter$/,'$1 min remaining · BBQ · STANDARD STARTER');
    next=next.replace(/^剩余 (\d+) 分钟 · 烤肉 · 不要 Starter$/,'$1 min remaining · BBQ · NO STARTER');
  }
  return m?m[1]+next+m[3]:next;
}
function apply(root,zh){
  if(!root)return;
  if(root.nodeType===Node.TEXT_NODE){const el=root.parentElement;if(el?.closest('.language-switcher,script,style,code,pre,[data-no-translate]'))return;const n=translateText(root.nodeValue,zh);if(n!==root.nodeValue)root.nodeValue=n;return;}
  if(root.nodeType!==Node.ELEMENT_NODE)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=walker.nextNode())){const el=n.parentElement;if(el?.closest('.language-switcher,script,style,code,pre,[data-no-translate]'))continue;const next=translateText(n.nodeValue,zh);if(next!==n.nodeValue)n.nodeValue=next;}
}
export default function LunchLanguagePatch(){
  const path=usePathname()||'/';
  useEffect(()=>{
    if(path.startsWith('/t/'))return;
    let applying=false;
    const run=(root=document.body)=>{if(applying)return;applying=true;try{apply(root,document.documentElement.lang.startsWith('zh'));}finally{applying=false;}};
    run();
    const bodyObs=new MutationObserver(ms=>{for(const m of ms){if(m.type==='childList')for(const n of m.addedNodes)run(n);if(m.type==='characterData')run(m.target);}});
    bodyObs.observe(document.body,{subtree:true,childList:true,characterData:true});
    const langObs=new MutationObserver(()=>run());langObs.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    return()=>{bodyObs.disconnect();langObs.disconnect();};
  },[path]);
  return null;
}
