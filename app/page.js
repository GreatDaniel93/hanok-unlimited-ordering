export default function Home(){
  const cards=[
    ['Operations','Staff Dashboard','Open tables, guest counts and dining sessions.','/staff'],
    ['Kitchen','Meat KDS','Starter platters and BBQ meat production.','/kitchen/meat'],
    ['Kitchen','Hot Kitchen KDS','Hot dishes, rice, soup and pickup flow.','/kitchen/hot'],
    ['Management','Manager Dashboard','Menu, starters, tables, QR codes, reports and access settings.','/manager']
  ];
  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · ORDERING SYSTEM</small></div></div><main className="page" style={{maxWidth:1080}}><section className="hero"><div style={{fontSize:12,fontWeight:900,letterSpacing:'.12em',color:'#e8cda0'}}>HANOK WAGGA WAGGA</div><h1 style={{fontSize:'clamp(32px,5vw,54px)',marginTop:8}}>Restaurant Control Centre</h1><p style={{fontSize:17,opacity:.9}}>One home for front-of-house, kitchen operations and management.</p></section><div className="grid grid-2" style={{marginTop:18}}>{cards.map(([e,t,d,h])=><a key={h} className="card dashboard-card" href={h}><div className="eyebrow">{e}</div><h2>{t}</h2><p className="muted" style={{marginBottom:0}}>{d}</p></a>)}</div></main></>;
}