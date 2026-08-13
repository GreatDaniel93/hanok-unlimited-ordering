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

const ESC=0x1b, GS=0x1d;
const cmd=(...b)=>Buffer.from(b);
const line=(s='')=>Buffer.from(`${s}\n`,'ascii');
const center=()=>cmd(ESC,0x61,0x01);
const left=()=>cmd(ESC,0x61,0x00);
const boldOn=()=>cmd(ESC,0x45,0x01);
const boldOff=()=>cmd(ESC,0x45,0x00);
const reverseOn=()=>cmd(GS,0x42,0x01);
const reverseOff=()=>cmd(GS,0x42,0x00);
const size=(w=1,h=1)=>cmd(GS,0x21,((w-1)<<4)|(h-1));
const normal=()=>size(1,1);
const feed=(n=1)=>Buffer.from('\n'.repeat(n),'ascii');
const divider='------------------------------------------';

function sectionName(order){
  if(order.source==='starter'){
    const label=String(order.label||'').toUpperCase();
    return label.includes('NO PORK')?'NO PORK STARTER':'STARTER PLATTER';
  }
  return order.station==='hot'?'HOT KITCHEN':'BBQ MEAT';
}
function orderType(order){
  if(order.source==='starter') return 'STARTER';
  return order.round_no?`ROUND ${order.round_no}`:'NEW ORDER';
}
function escpos(order){
  const parts=[];
  const items=order.order_items||[];
  const count=items.reduce((n,i)=>n+Number(i.qty||0),0);
  const time=new Date(order.created_at).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'});
  const orderNo=String(order.id||'').slice(0,8).toUpperCase();

  parts.push(cmd(ESC,0x40));
  parts.push(center(),boldOn(),size(2,2),line('HANOK WAGGA'),normal(),boldOff());
  parts.push(line(divider));
  parts.push(boldOn(),size(4,4),line(order.table_name||'TABLE'),normal(),boldOff(),feed());
  parts.push(reverseOn(),boldOn(),size(2,2),line(` ${sectionName(order)} `),normal(),boldOff(),reverseOff());
  parts.push(feed(),boldOn(),size(2,1),line(orderType(order)),normal(),boldOff());
  parts.push(line(divider));

  parts.push(left(),boldOn(),size(1,2));
  for(const item of items){
    parts.push(line(String(item.item_name||'Item')));
    parts.push(size(2,2),line(`  x ${Number(item.qty||0)}`),size(1,2));
    if(item.notes) parts.push(normal(),line(`  ${item.notes}`),size(1,2));
    parts.push(normal(),line('..........................................'),size(1,2));
  }
  parts.push(normal(),boldOff());
  parts.push(center(),line(divider));
  parts.push(boldOn(),size(2,2),line(`ITEMS: ${count}`),normal(),boldOff());
  parts.push(line(divider));
  parts.push(left(),boldOn(),size(1,2),line(`ORDER: ${orderNo}`),line(`TIME:  ${time}`),normal(),boldOff());
  parts.push(feed(3));
  parts.push(cmd(GS,0x56,0x00));
  return Buffer.concat(parts);
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
