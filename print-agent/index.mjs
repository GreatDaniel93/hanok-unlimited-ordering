import net from 'node:net';

const baseUrl = process.env.HANOK_BASE_URL;
const secret = process.env.PRINT_AGENT_SECRET;
const pollMs = Number(process.env.POLL_MS || 1500);
if (!baseUrl || !secret) { console.error('Missing HANOK_BASE_URL or PRINT_AGENT_SECRET.'); process.exit(1); }
const printers = {
  meat: { host: process.env.MEAT_PRINTER_HOST, port: Number(process.env.MEAT_PRINTER_PORT || 9100) },
  hot: { host: process.env.HOT_PRINTER_HOST, port: Number(process.env.HOT_PRINTER_PORT || 9100) },
};

const ESC = 0x1b;
const GS = 0x1d;
const cmd = (...bytes) => Buffer.from(bytes);
const text = (value = '') => Buffer.from(String(value), 'ascii');
const line = (value = '') => Buffer.from(`${value}\n`, 'ascii');
const center = () => cmd(ESC, 0x61, 0x01);
const left = () => cmd(ESC, 0x61, 0x00);
const boldOn = () => cmd(ESC, 0x45, 0x01);
const boldOff = () => cmd(ESC, 0x45, 0x00);
const reverseOn = () => cmd(GS, 0x42, 0x01);
const reverseOff = () => cmd(GS, 0x42, 0x00);
const size = (width = 1, height = 1) => cmd(GS, 0x21, ((width - 1) << 4) | (height - 1));
const normalSize = () => size(1, 1);
const feed = (n = 1) => Buffer.from('\n'.repeat(n), 'ascii');
const divider = '------------------------------------------';

function sectionName(order) {
  if (order.source === 'starter') {
    const label = String(order.label || '').toUpperCase();
    return label.includes('NO PORK') ? 'NO PORK STARTER' : 'STARTER PLATTER';
  }
  return order.station === 'hot' ? 'HOT KITCHEN' : 'BBQ MEAT';
}

function orderType(order) {
  if (order.source === 'starter') return 'STARTER';
  return order.round_no ? `ROUND ${order.round_no}` : 'NEW ORDER';
}

function ticket(order) {
  const parts = [];
  const items = order.order_items || [];
  const itemCount = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const time = new Date(order.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  const orderNo = String(order.id || '').slice(0, 8).toUpperCase();

  parts.push(cmd(ESC, 0x40));
  parts.push(center(), boldOn(), size(2, 2), line('HANOK WAGGA'), normalSize(), boldOff());
  parts.push(line(divider));

  // Table number is deliberately the largest element on the ticket.
  parts.push(boldOn(), size(4, 4), line(order.table_name || 'TABLE'), normalSize(), boldOff(), feed());

  // Kitchen section: large, bold and reverse-print for instant recognition.
  parts.push(reverseOn(), boldOn(), size(2, 2), line(` ${sectionName(order)} `), normalSize(), boldOff(), reverseOff());
  parts.push(feed(), boldOn(), size(2, 1), line(orderType(order)), normalSize(), boldOff());
  parts.push(line(divider));

  // Item names are bold and quantities are visually prominent.
  parts.push(left(), boldOn(), size(1, 2));
  for (const item of items) {
    const name = String(item.item_name || 'Item');
    const qty = Number(item.qty || 0);
    parts.push(line(name));
    parts.push(size(2, 2), line(`  x ${qty}`), size(1, 2));
    parts.push(normalSize(), line('..........................................'), size(1, 2));
  }
  parts.push(normalSize(), boldOff());

  parts.push(center(), line(divider));
  parts.push(boldOn(), size(2, 2), line(`ITEMS: ${itemCount}`), normalSize(), boldOff());
  parts.push(line(divider));
  parts.push(left(), boldOn(), size(1, 2), line(`ORDER: ${orderNo}`), line(`TIME:  ${time}`), normalSize(), boldOff());
  parts.push(feed(3));
  return Buffer.concat(parts);
}

function rawPrint(host, port, body) {
  return new Promise((resolve, reject) => {
    if (!host) return reject(new Error('Printer host is not configured.'));
    const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
      const cut = Buffer.from([GS, 0x56, 0x00]);
      socket.write(Buffer.concat([body, cut]), () => socket.end());
    });
    socket.on('close', (hadError) => hadError ? reject(new Error('Socket closed with error.')) : resolve());
    socket.on('timeout', () => socket.destroy(new Error('Printer connection timed out.')));
    socket.on('error', reject);
  });
}
async function mark(orderId, printed, attempts = 1) {
  await fetch(`${baseUrl}/api/print/pending`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-print-secret': secret }, body: JSON.stringify({ order_id: orderId, printed, attempts }) });
}
const inFlight = new Set();
async function poll() {
  try {
    const r = await fetch(`${baseUrl}/api/print/pending`, { headers: { 'x-print-secret': secret }, cache: 'no-store' });
    if (!r.ok) throw new Error(`Print API ${r.status}`);
    const j = await r.json();
    for (const order of j.orders || []) {
      if (inFlight.has(order.id)) continue;
      inFlight.add(order.id);
      const printer = printers[order.station];
      try { await rawPrint(printer?.host, printer?.port || 9100, ticket(order)); await mark(order.id, true, 1); console.log(`[PRINTED] ${order.table_name} ${order.id}`); }
      catch (error) { await mark(order.id, false, 1).catch(() => {}); console.error(`[PRINT FAILED] ${order.id}: ${error.message}`); }
      finally { inFlight.delete(order.id); }
    }
  } catch (error) { console.error(`[POLL ERROR] ${error.message}`); }
}
console.log(`Hanok Print Agent started. Polling ${baseUrl} every ${pollMs}ms.`);
setInterval(poll, pollMs);
poll();
