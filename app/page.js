export default function Home(){
  return <>
    <div className="topbar"><div className="logo">HANOK<small>WAGGA WAGGA · ORDERING SYSTEM</small></div></div>
    <main className="page">
      <section className="hero"><h1>Hanok Wagga Wagga</h1><p>Unlimited Korean BBQ table-ordering and kitchen control system.</p></section>
      <div className="grid grid-3" style={{marginTop:16}}>
        <a className="card dashboard-card" href="/staff"><div className="eyebrow">Front of House</div><h2>Staff</h2><p className="muted">Open tables, guest counts and dining sessions.</p></a>
        <div className="card"><div className="eyebrow">Kitchen</div><h2>Kitchen</h2><p className="muted">Live production screens for BBQ meat and hot kitchen.</p><div className="home-kitchen-actions"><a className="btn secondary small" href="/kitchen/meat">MEAT KDS</a><a className="btn secondary small" href="/kitchen/hot">HOT KDS</a></div></div>
        <a className="card dashboard-card" href="/manager"><div className="eyebrow">Management</div><h2>Manager</h2><p className="muted">Menu, tables, QR, system health, security and analytics.</p></a>
      </div>
    </main>
  </>;
}
