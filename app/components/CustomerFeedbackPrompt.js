'use client';
import {usePathname} from 'next/navigation';

export default function CustomerFeedbackPrompt(){
  const path=usePathname()||'';
  const m=path.match(/^\/t\/([^/]+)$/);
  if(!m)return null;
  return <a href={`${path}/feedback`} style={{position:'fixed',right:14,bottom:86,zIndex:45,textDecoration:'none',background:'#fff',color:'#9e1b1f',border:'1px solid #e8dfd5',borderRadius:999,padding:'9px 13px',fontSize:12,fontWeight:900,boxShadow:'0 4px 16px rgba(36,28,24,.12)'}}>FEEDBACK</a>;
}
