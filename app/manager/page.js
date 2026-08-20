export default function ManagerDashboard(){
  const operations=[
    ['Menu & Starter','Products, Standard / No Pork Starter and order settings.','/manager/menu'],
    ['Table Management','Add, rename, set capacity, disable and restore tables.','/manager/tables'],
    ['Table QR Codes','View and print QR codes for active tables.','/manager/qr']
  ];
  const control=[
    ['Analytics & Reports','Historical operating data, date-range analysis and product/table performance.','/manager/analytics'],
    ['Access & PIN Settings','Change Staff and Kitchen access PINs.','/manager/security']
  ];
  const Card=({item})=>{const[t,d,h]=item;return <a className="card dashboard-card" href={h}><div className="eyebrow">Manager</div><h2>{t}</h2><p className="muted" style={{marginBottom:0}}>{d}</p></a>};
  return <><div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · MANAGER</small></div><div className="spacer"/><a className="btn secondary small" href="/">System Home</a></div><main className="page" style={{maxWidth:1080}}><section className="hero"><div style={{fontSize:12,fontWeight:900,letterSpacing:'.12em',color:'#e8cda0'}}>MANAGEMENT</div><h1 style={{fontSize:'clamp(30px,4vw,48px)',marginTop:8}}>Manager Dashboard</h1><p>Configuration, reporting and restaurant controls grouped in one place.</p></section><div className="section-title"><h2>Operations & Menu</h2><p>Daily configuration and table setup.</p></div><div className="grid grid-3">{operations.map((x)=><Card key={x[2]} item={x}/>)}</div><div className="section-title"><h2>Reports & System</h2><p>Performance data and access control.</p></div><div className="grid grid-2">{control.map((x)=><Card key={x[2]} item={x}/>)}</div></main></>;
}