import net from 'node:net';

const APP_URL=(process.env.APP_URL||'https://orderhanokbbqwagga.com').replace(/\/$/,'');
const SECRET=process.env.PRINT_AGENT_SECRET||'';
const HOST=process.env.PRINTER_HOST||'192.168.0.192';
const PORT=Number(process.env.PRINTER_PORT||9100);
const STATION=process.env.PRINTER_STATION||'';
const POLL_MS=Number(process.env.POLL_MS||2000);
const startedAt=new Date().toISOString();

if(!SECRET){console.error('Missing PRINT_AGENT_SECRET');process.exit(1)}
if(STATION && !['meat','hot'].includes(STATION)){console.error('PRINTER_STATION must be meat, hot, or blank');process.exit(1)}

function escpos(order){
  const lines=[];
  lines.push('\x1b\x40');
  lines.push('==========================================\n');
  lines.push('HANOK WAGGA WAGGA\n');
  lines.push(`${String(order.station||'').toUpperCase()} STATION\n`);
  lines.push('==========================================\n');
  lines.push(`TABLE: ${order.table_name||'-'}\n`);
  if(order.label) lines.push(`${order.label}\n`);
  if(order.source==='customer') lines.push(`ROUND: ${order.round_no||'-'}\n`);
  lines.push('------------------------------------------\n');
  for(const item of order.order_items||[]){
    lines.push(`${item.item_name}  x${item.qty}\n`);
    if(item.notes) lines.push(`  ${item.notes}\n`);
  }
  lines.push('------------------------------------------\n');
  lines.push(`${new Date(order.created_at).toLocaleString('en-AU')}\n`);
  lines.push('\n\n\n');
  lines.push('\x1d\x56\x00');
  return Buffer.from(lines.join(''),'binary');
}

function sendToPrinter(buffer){
  return new Promise((resolve,reject)=>{
    const socket=net.createConnection({host:HOST,port:PORT});
    socket.setTimeout(5000);
    socket.on('connect',()=>socket.end(buffer));
    socket.on('close',hadError=>hadError?reject(new Error('Printer connection closed with error')):resolve());
    socket.on('timeout',()=>socket.destroy(new Error('Printer timeout')));
    socket.on('error',reject);
  });
}

async function mark(orderId,printed,attempts){
  const r=await fetch(`${APP_URL}/api/print/pending`,{method:'PATCH',headers:{'content-type':'application/json','x-print-secret':SECRET},body:JSON.stringify({order_id:orderId,printed,attempts})});
  if(!r.ok) throw new Error(`Mark failed: ${r.status} ${await r.text()}`);
}

async function poll(){
  const qs=new URLSearchParams({since:startedAt});
  if(STATION) qs.set('station',STATION);
  const r=await fetch(`${APP_URL}/api/print/pending?${qs}`,{headers:{'x-print-secret':SECRET},cache:'no-store'});
  if(!r.ok) throw new Error(`Poll failed: ${r.status} ${await r.text()}`);
  const j=await r.json();
  for(const order of j.orders||[]){
    try{
      console.log(`Printing ${order.table_name} ${order.station} ${order.id}`);
      await sendToPrinter(escpos(order));
      await mark(order.id,true,1);
      console.log(`Printed ${order.id}`);
    }catch(e){
      console.error(`Print failed ${order.id}:`,e.message);
      try{await mark(order.id,false,1)}catch{}
    }
  }
}

console.log(`Hanok Print Agent started ${startedAt}`);
console.log(`Cloud: ${APP_URL}`);
console.log(`Printer: ${HOST}:${PORT}`);
console.log(`Station: ${STATION||'all'} (test mode)`);
console.log('Only orders created after agent startup will be printed. Ctrl+C to stop.');

let busy=false;
setInterval(async()=>{if(busy)return;busy=true;try{await poll()}catch(e){console.error(e.message)}finally{busy=false}},POLL_MS);
await poll();
