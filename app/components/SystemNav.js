'use client';

import { usePathname } from 'next/navigation';

export default function SystemNav(){
  const path=usePathname()||'/';
  if(path==='/' || path.startsWith('/t/')) return null;
  const inManager=path==='/manager' || path.startsWith('/manager/');
  return <div className="system-nav">
    <a href="/" className="system-nav-link">← System Home</a>
    {inManager && path!=='/manager' && <a href="/manager" className="system-nav-link secondary-link">Manager Home</a>}
  </div>;
}
