const https = require('https');

const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '18424728273';

function callMonday(query) {
  return new Promise((resolve) => {
    if (!MONDAY_API_KEY) return resolve({ data: { boards: [] } });
    const postData = JSON.stringify({ query });
    const req = https.request(MONDAY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': MONDAY_API_KEY, 'API-Version': '2023-10' }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { resolve({ error: e.message }); } });
    });
    req.on('error', () => resolve({ error: 'Network error' }));
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  const query = `query { boards(ids: [${MONDAY_BOARD_ID}]) { items_page(limit: 100, query_params: { order_by: [{ column_id: "__creation_log__", direction: desc }] }) { items { id name group { id title } column_values { id text } } } } }`;
  const res = await callMonday(query);
  const items = res?.data?.boards?.[0]?.items_page?.items || [];

  const pinball = [], scheduled = [];

  for (const item of items) {
    const gid = item.group?.id || '';
    const gtitle = (item.group?.title || '').toLowerCase();
    if (gid === 'group_mm6xs2fx' || gtitle.includes('archive') || gtitle.includes('trash')) continue;

    const cols = Object.fromEntries((item.column_values || []).map(c => [c.id, (c.text || '').trim()]));
    const card = {
      id: item.id,
      clientName: item.name || 'Valued Customer',
      address: cols['text_mm6aq4rg'] || '📍 Address on File',
      phone: cols['text_mm6a7420'] || 'Phone on File',
      text: cols['long_text_mm5vbykc'] || item.name,
      time: cols['date'] || 'In Shop',
      status: gid === 'group_mm76qbbh' ? 'bench' : (gid === 'group_mm7maw66' ? 'route' : 'intake')
    };

    if (gid === 'group_mm7maw66' || gtitle.includes('calendar')) scheduled.push(card);
    else pinball.push(card);
  }

  return { statusCode: 200, headers, body: JSON.stringify({ pinball, scheduled, count: pinball.length + scheduled.length }) };
};
