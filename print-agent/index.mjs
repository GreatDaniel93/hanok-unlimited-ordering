import net from 'node:net';

const baseUrl = process.env.HANOK_BASE_URL;
const secret = process.env.PRINT_AGENT_SECRET;
const pollMs = Number(process.env.POLL_MS || 1500);
if (!baseUrl || !secret) { console.error('Missing HANOK_BASE_URL or PRINT_AGENT_SECRET.'); process.exit(1); }
const printers = {
  meat: { host: process.env.MEAT_PRINTER_HOST, port: Number(process.env.MEAT_PRINTER_PORT || 9100) },
  hot: { host: process.env.HOT_PRINTER_HOST, port: Number(process.env.HOT_PRINTER_PORT || 9100) },
};
function ticket(order) {
  const lines = ['HANOK WAGGA WAGGA','================================',`${order.table_name}   ${order.source === 'starter' ? order.label : `ROUND ${order.round_no}`}`,new Date(order.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),'--------------------------------'];
  for (const item of order.order_items || []) lines.push(`${item.item_name}  x${item.qty}`);
  lines.push('--------------------------------',`ORDER ${order.id.slice(0, 8).toUpperCase()}`,'\n\n\n');
  return lines.join('\n');
}
function rawPrint(host, port, text) {
  return new Promise((resolve, reject) => {
    if (!host) return reject(new Error('Printer host is not configured.'));
    const socket = net.createConnection({ host, port, timeout: 5000 }, () => {
      const init = Buffer.from([0x1b, 0x40]);
      const body = Buffer.from(text, 'ascii');
      const cut = Buffer.from([0x1d, 0x56, 0x00]);
      socket.write(Buffer.concat([init, body, cut]), () => socket.end());
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
