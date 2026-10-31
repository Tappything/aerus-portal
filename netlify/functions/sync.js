/**
 * Netlify Serverless Function: /.netlify/functions/sync
 * Purpose: Cross-device live sync for TappyThing Workstation
 * Reads Exact Monday Column IDs:
 *  - text_mm6aq4rg      : Customer Address
 *  - text_mm6a7420      : Customer Phone
 *  - long_text_mm5vbykc : Intake Notes
 *  - date               : Due / Scheduled Date
 * Routes: Pinball / Intake groups -> pinball[]
 *         Calendar group (group_mm7maw66) -> scheduled[]
 * Filters: Ignores Archive / Trash groups (group_mm6xs2fx)
 */

const https = require('https');

// Monday.com API Configuration
const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '18424728273';

// Fallback Placeholders
const FALLBACK_ADDRESS = "📍 Address on File / Intake Slip";
const FALLBACK_PHONE = "Phone on File";

function callMondayGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    if (!MONDAY_API_KEY) {
      return resolve({ data: { boards: [] } });
    }

    const postData = JSON.stringify({ query, variables });
    const url = new URL(MONDAY_API_URL);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_KEY,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          resolve({ error: 'Failed to parse Monday API response', raw: rawData });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

function cleanCustomerName(rawName) {
  if (!rawName) return "Valued Customer";
  let cleaned = String(rawName).trim();
  const scheduleWords = [
    'today', 'tomorrow', 'tonight', 'yesterday', 'morning', 'afternoon', 'evening',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  ];
  let tokens = cleaned.split(/\s+/);
  while (tokens.length > 1) {
    const lastToken = tokens[tokens.length - 1].toLowerCase().replace(/[^a-z]/g, '');
    if (scheduleWords.includes(lastToken)) {
      tokens.pop();
    } else {
      break;
    }
  }
  return tokens.join(' ').trim();
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  try {
    const boardId = MONDAY_BOARD_ID;

    const query = `
      query GetBoardQueues($boardId: [ID!]) {
        boards(ids: $boardId) {
          name
          groups {
            id
            title
          }
          items_page(limit: 100) {
            items {
              id
              name
              group {
                id
                title
              }
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;

    const mondayRes = await callMondayGraphQL(query, boardId ? { boardId: [boardId] } : {});
    const boards = (mondayRes && mondayRes.data && mondayRes.data.boards) ? mondayRes.data.boards : [];
    const items = (boards[0] && boards[0].items_page && boards[0].items_page.items) ? boards[0].items_page.items : [];

    const pinballQueue = [];
    const scheduledCards = [];

    items.forEach((item) => {
      const groupId = item.group ? item.group.id : '';
      const groupTitle = item.group ? item.group.title.toLowerCase() : '';

      // Skip completed/paid archives and trash
      if (groupId === 'group_mm6xs2fx' || groupTitle.includes('archive') || groupTitle.includes('trash')) return;

      let phone = FALLBACK_PHONE;
      let address = FALLBACK_ADDRESS;
      let note = item.name;
      let status = 'intake';
      let time = 'Pending';
      let totalAmount = 50.00;

      // Exact Column Mapping
      if (Array.isArray(item.column_values)) {
        item.column_values.forEach((col) => {
          const colId = col.id;
          const colIdLower = colId.toLowerCase();
          const txt = (col.text || '').trim();

          // Address Mapping
          if ((colId === 'text_mm6aq4rg' || colIdLower.includes('address') || colIdLower.includes('location')) && txt) {
            address = txt;
          }

          // Phone Mapping
          if ((colId === 'text_mm6a7420' || colIdLower.includes('phone') || colIdLower.includes('mobile')) && txt) {
            phone = txt;
          }

          // Note Mapping
          if ((colId === 'long_text_mm5vbykc' || colIdLower.includes('note') || colIdLower.includes('desc')) && txt) {
            note = txt;
          }

          // Date / Scheduled Time Mapping
          if ((colId === 'date' || colIdLower.includes('time') || colIdLower.includes('schedule')) && txt) {
            time = txt;
          }

          // Status & Pricing
          if (colIdLower.includes('status') && txt) status = txt.toLowerCase();
          if ((colIdLower.includes('amount') || colIdLower.includes('price') || colIdLower.includes('total')) && txt) {
            const parsedNum = parseFloat(txt.replace(/[^0-9.]/g, ''));
            if (!isNaN(parsedNum)) totalAmount = parsedNum;
          }
        });
      }

      const clientName = cleanCustomerName(item.name);

      const cardPayload = {
        id: item.id,
        externalId: item.id,
        name: clientName,
        clientName: clientName,
        text: note,
        phone: phone,
        address: address,
        status: status,
        time: time,
        totalAmount: totalAmount,
        timestamp: "Active",
        lineItems: [{ desc: note, qty: 1, price: totalAmount, isTaxable: false }]
      };

      if (groupId === 'group_mm7maw66' || groupTitle.includes('calendar') || groupTitle.includes('schedule')) {
        scheduledCards.push(cardPayload);
      } else {
        pinballQueue.push(cardPayload);
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        pinball: pinballQueue,
        scheduled: scheduledCards,
        count: scheduledCards.length + pinballQueue.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Internal sync error',
        pinball: [],
        scheduled: []
      })
    };
  }
};
