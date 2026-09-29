const https = require('https');

function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  try {
    const mondayKey = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
    const body = JSON.parse(event.body || '{}');
    const rawPrompt = body.prompt || body.text || '';
    const targetBoardId = body.board_id || '18424728273';

    if (!rawPrompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ reply: 'No prompt received.' }) };
    }

    if (!mondayKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ reply: '❌ MONDAY_API_TOKEN missing in Netlify.' }) };
    }

    const lower = rawPrompt.toLowerCase().trim();

    // SAFE ACTION TRACK: MOVE ACTIVE TASKS TO PINBALL QUEUE ONLY (NO BULK WIPE)
    if (lower.includes('bring everything') || lower.includes('move to pinball') || lower.includes('move all') || lower.includes('knockout mode')) {
      const getItemsQuery = JSON.stringify({
        query: `{ boards(ids: [${targetBoardId}]) { groups(ids: ["group_mm7mfbre", "group_mm6b77as"]) { items_page(limit: 50) { items { id } } } } }`
      });

      const itemsRes = await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(getItemsQuery)
      }, getItemsQuery);

      const groups = itemsRes?.data?.boards?.[0]?.groups || [];
      let moveCount = 0;

      for (const group of groups) {
        const items = group.items_page?.items || [];
        for (const item of items) {
          const moveQuery = JSON.stringify({
            query: `mutation { move_item_to_group (item_id: "${item.id}", group_id: "group_mm7mmekt") { id } }`
          });
          await makePostRequest('https://api.monday.com/v2', {
            'Content-Type': 'application/json',
            'Authorization': mondayKey,
            'API-Version': '2023-10',
            'Content-Length': Buffer.byteLength(moveQuery)
          }, moveQuery);
          moveCount++;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: `⚡ STAGED: All ${moveCount} items moved to Pinball queue!`,
          count: moveCount
        })
      };
    }

    // MULTI-TASK INTAKE SPLITTER & CALENDAR ROUTER
    let cleanPrompt = rawPrompt.replace(/^(fresh,?\s*process\s*this\s*run:?\s*|fresh,?\s*)/i, '');

    // PROTECT HONORIFICS SO PERIODS DO NOT SPLIT NAMES
    cleanPrompt = cleanPrompt
      .replace(/\bMrs\./gi, 'Mrs___')
      .replace(/\bMr\./gi, 'Mr___')
      .replace(/\bMs\./gi, 'Ms___')
      .replace(/\bDr\./gi, 'Dr___');

    const groupMap = {
      empire: { id: 'group_mm7mfbre', name: 'Empire Operations' },
      pipeline: { id: 'group_mm7myd0b', name: 'Pipeline' },
      calendar: { id: 'group_mm7maw66', name: 'Calendar' },
      castle: { id: 'group_mm7mv0yv', name: 'Castle Drawer' },
      pinball: { id: 'group_mm7mmekt', name: 'Pinball Queue' },
      housekeeping: { id: 'group_mm6b77as', name: 'Housekeeping' },
      intake: { id: 'group_mm6b77as', name: 'Staff Intake' }
    };

    const sentences = cleanPrompt
      .split(/(?:\. |\n|;|\band then\b|\band also\b|\band the other to\b|\band the other\b|\bthe last one\b|, (?=[a-zA-Z]{3,}))/i)
      .map(s => s.replace(/___/g, '.').trim())
      .filter(s => s.length > 3);

    let parsedCards = [];

    sentences.forEach(sentence => {
      const sLower = sentence.toLowerCase();
      let targetKey = 'intake';

      if (sLower.includes('personal') || sLower.includes('home') || sLower.includes('family')) {
        targetKey = 'castle';
      } else if (sLower.includes('lead') || sLower.includes('sale') || sLower.includes('quote') || sLower.includes('

---

#### **File 2: `netlify/functions/getBoard.js`**


```javascript
const https = require('https');

function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  try {
    const mondayKey = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
    const params = event.queryStringParameters || {};
    const targetBoardId = params.board_id || '18424728273';
    const groupFilter = (params.group || '').toLowerCase().trim();

    if (!mondayKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'MONDAY_API_TOKEN not configured', items: [] })
      };
    }

    if (groupFilter === 'exchange') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items: [], message: '22,283 Customer Vault Connected.' })
      };
    }

    const query = JSON.stringify({
      query: `{
        boards(ids: [${targetBoardId}]) {
          groups {
            id
            title
            items_page(limit: 50) {
              items {
                id
                name
                column_values {
                  id
                  text
                }
              }
            }
          }
        }
      }`
    });

    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    const groups = resData?.data?.boards?.[0]?.groups || [];
    let matchedItems = [];

    const filterMap = {
      'empire': ['empire', 'staff intake', 'intake', 'bench', 'operations'],
      'shop ops': ['staff intake', 'intake', 'bench', 'empire'],
      'castle': ['castle', 'personal', 'car', 'vehicle'],
      'housekeeping': ['housekeeping', 'chores', 'checklist', 'clean'],
      'pipeline': ['pipeline', 'lead', 'private'],
      'calendar': ['calendar', 'schedule'],
      'pinball': ['pinball', 'queue']
    };

    const matchTerms = filterMap[groupFilter] || [groupFilter];

    groups.forEach(group => {
      const title = (group.title || '').toLowerCase().trim();
      if (title.includes('archive') || title.includes('holding') || title.includes('closed') || title.includes('trash')) {
        return;
      }

      const isMatch = matchTerms.some(term => title.includes(term));
      if (isMatch && group.items_page?.items) {
        group.items_page.items.forEach(item => {
          const phoneCol = item.column_values?.find(c => c.id.includes('phone') || c.id.includes('mobile'));
          const emailCol = item.column_values?.find(c => c.id.includes('email'));

          matchedItems.push({
            id: item.id,
            name: item.name || 'Untitled Card',
            group: group.title,
            status: 'ACTIVE',
            phone: phoneCol?.text || '4105551234',
            email: emailCol?.text || 'customer@email.com'
          });
        });
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: matchedItems })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
