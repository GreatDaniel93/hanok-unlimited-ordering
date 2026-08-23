'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function SystemNav(){
  const path=usePathname()||'/';
  useEffect(()=>{
    function onClick(e){
      const el=e.target?.closest?.('button,a');
      if(!el)return;
      const text=(el.textContent||'').trim().toLowerCase();
      if(text==='logout' || text==='log out' || text==='退出登录'){
        setTimeout(()=>{window.location.href='/';},180);
      }
    }
    document.addEventListener('click',onClick,true);
    return()=>document.removeEventListener('click',onClick,true);
  },[]);
  if(path==='/' || path==='/feedback' || path.startsWith('/t/')) return null;
  const inManager=path==='/manager' || path.startsWith('/manager/');
  return <div className="system-nav">
    <a href="/" className="system-nav-link">← System Home</a>
    {inManager && path!=='/manager' && <a href="/manager" className="system-nav-link secondary-link">Manager Home</a>}
    {inManager && path!=='/manager/feedback' && <a href="/manager/feedback" className="system-nav-link secondary-link">Feedback / 问卷</a>}
  </div>;
}
