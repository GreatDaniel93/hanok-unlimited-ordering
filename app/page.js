export default function Home() {
  return (
    <>
      <div className="topbar"><div className="logo">HANOK<small>UNLIMITED ORDERING SYSTEM</small></div></div>
      <main className="page" style={{maxWidth:900}}>
        <section className="hero"><h1>Hanok Wagga Wagga</h1><p>Table-order unlimited Korean BBQ system.</p></section>
        <div className="grid grid-3" style={{marginTop:16}}>
          <a className="card" href="/staff" style={{textDecoration:'none',color:'inherit'}}><h2>Staff</h2><p className="muted">Tables, sessions and manager controls.</p></a>
          <a className="card" href="/manager/menu" style={{textDecoration:'none',color:'inherit'}}><h2>Manager Menu</h2><p className="muted">Products, Starter Platters and order settings.</p></a>
          <a className="card" href="/manager/security" style={{textDecoration:'none',color:'inherit'}}><h2>Access & PIN Settings</h2><p className="muted">Manager-only Staff and Kitchen PIN management.</p></a>
          <a className="card" href="/manager/qr" style={{textDecoration:'none',color:'inherit'}}><h2>Table QR Codes</h2><p className="muted">Generate, download and print T01–T16 QR codes.</p></a>
          <a className="card" href="/kitchen/meat" style={{textDecoration:'none',color:'inherit'}}><h2>Meat KDS</h2><p className="muted">Starter platters and BBQ meat orders.</p></a>
          <a className="card" href="/kitchen/hot" style={{textDecoration:'none',color:'inherit'}}><h2>Hot Kitchen</h2><p className="muted">Hot dishes, bibimbap and soup.</p></a>
        </div>
      </main>
    </>
  );
}
