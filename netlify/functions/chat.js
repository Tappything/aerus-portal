const fs = require('fs');
const path = require('path');

// Upgraded Smart Zone Classifier for incoming voice/text prompts
function classifyZone(text) {
  const lower = (text || '').toLowerCase();
  const cleaned = lower.replace(/^test\.?\s*/i, '').trim();

  // 1. CALENDAR — Appointments, Time-Based, Service Calls (FIRST PRIORITY)
  const calendarWords = ['today', 'tomorrow', 'schedule', 'appointment', 'calendar', 'reminder', 'pick up', 'pickup', 'service call', '7am', '8am', '9am', '10am', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (calendarWords.some(w => cleaned.includes(w)) || /\d{1,2}:\d{2}/.test(cleaned)) {
    return 'group_mm7maw66';
  }

  // 2. CASTLE — Personal, Business Formation, Legal
  if (/\b(personal|bill|mortgage|car|home|family|pickleball|courthouse|llc|company|register|attorney|lawyer|filing|incorporate|formation)\b/.test(cleaned)) {
    return 'group_mm7mv0yv';
  }

  // 3. PIPELINE — Invoices, Proposals, Leads (BEATS REPAIR)
  if (/\b(invoice|estimate|proposal|payment|pay|charge|quote|lead|prospect|call|contact|follow.?up|customer)\b/.test(cleaned)) {
    return 'group_mm7myd0b';
  }

  // 4. PARTS — Orders and Supplies
  if (/\b(parts|order|desco|amazon|supplier|cord|hose|belt|filter|bag)\b/.test(cleaned)) {
    return 'group_mm6bv2h0';
  }

  // 5. EMPIRE — Bench Repairs and Shop Ops (default shop work)
  if (/\b(repair|bench|motor|vacuum|intake|diagnostic|oreck|kirby|machine|tune.?up|work.?bench|dropoff|drop.?off|burnt|wire|overhaul|service)\b/.test(cleaned)) {
    return 'group_mm7mfbre';
  }

  // Default fallback -> Empire Operations
  return 'group_mm7mfbre';
}

// Local CSV Vault Lookup Function (22,283 Records — Zero API Cost)
function lookupCustomerInCSV(promptText) {
  try {
    const csvPath = path.join(__dirname, '..', '..', 'export_export (34).csv');
    if (!fs.existsSync(csvPath)) {
      console.log('CSV Vault file not found at:', csvPath);
      return null;
    }

    const fileData = fs.readFileSync(csvPath, 'utf8');
    const lines = fileData.split(/\r?\n/);
    if (lines.length <= 1) return null;

    // Search for extracted First Last name in prompt
    const nameMatch = promptText.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
    const searchTarget = nameMatch ? nameMatch[1].toLowerCase() : null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Simple CSV row parser handling quotes
      const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"\vert{}"$/g, '').trim());
      const custName = cols[1] || '';
      const address = cols[3] || '';
      const phone = cols[4] || '';

      if (searchTarget && custName.toLowerCase().includes(searchTarget)) {
        return { name: custName, phone, address };
      } else if (!searchTarget) {
        // Fallback: direct line match if entire prompt contains customer name
        if (custName && promptText.toLowerCase().includes(custName.toLowerCase())) {
          return { name: custName, phone, address };
        }
      }
    }
  } catch (err) {
    console.error('CSV Vault Lookup error:', err);
  }
  return null;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
  const boardId = "18424728273";

  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: '❌ MONDAY_API_TOKEN is missing in Netlify Environment Variables.' }) };
  }

  // ==========================================
  // WRITE HANDLER (POST) - CSV Vault Search + Smart Route + Forever Card Search
  // ==========================================
  if (event.httpMethod === 'POST') {
    try {
      const bodyData = JSON.parse(event.body || '{}');
      const prompt = bodyData.prompt || bodyData.text || '';

      if (!prompt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing prompt/text in request body.' })
        };
      }

      let cardTitle = prompt;

      // 1. Query Local CSV Vault (Zero API Cost)
      const csvMatch = lookupCustomerInCSV(prompt);
      if (csvMatch) {
        cardTitle = `${prompt} [📞 ${csvMatch.phone || 'N/A'} | 📍 ${csvMatch.address || 'N/A'}]`;
      }

      const sanitizedTitle = cardTitle.replace(/"/g, '\\"').replace(/\n/g, ' ');

      // 2. Search Monday for existing Forever Card with customer name
      const nameMatch = prompt.match(/\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
      if (nameMatch) {
        const searchName = nameMatch[1];
        const searchQuery = `query { boards(ids: [${boardId}]) { 
          items_page(query_params: { rules: [{ column_id: "name", 
          compare_value: ["${searchName}"], operator: contains_text }] }) 
          { items { id name } } } }`;
        const searchRes = await fetch('https://api.monday.com/v2', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': token, 
            'API-Version': '2023-10' 
          },
          body: JSON.stringify({ query: searchQuery })
        });
        const searchData = await searchRes.json();
        const existing = searchData.data?.boards?.[0]?.items_page?.items || [];
        if (existing.length > 0) {
          const updateMutation = `mutation { create_update(item_id: ${existing[0].id}, 
          body: "${sanitizedTitle}") { id } }`;
          await fetch('https://api.monday.com/v2', { 
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': token, 
              'API-Version': '2023-10' 
            },
            body: JSON.stringify({ query: updateMutation }) 
          });
          return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify({ reply: '✅ Added to ' + searchName + "'s Forever Card! ⚡" }) 
          };
        }
      }

      // 3. Fallback: Create new card as normal if no existing Forever Card found
      const targetGroupId = classifyZone(prompt);
      const mutation = `
        mutation {
          create_item(board_id: ${boardId}, group_id: "${targetGroupId}", item_name: "${sanitizedTitle}") {
            id
          }
        }
      `;

      const mondayResponse = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'API-Version': '2023-10'
        },
        body: JSON.stringify({ query: mutation })
      });

      const result = await mondayResponse.json();

      if (result.errors && result.errors.length > 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Monday Mutation Error: ' + result.errors[0].message })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: '✅ Logged! ⚡',
          itemId: result.data?.create_item?.id
        })
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Write Handler Error: ' + err.message })
      };
    }
  }

  // ==========================================
  // READ HANDLER (GET) - Board Fetch Logic
  // ==========================================
  const qParams = event.queryStringParameters || {};
  const rawDrawer = qParams.group || qParams.drawer || 'all';
  const drawer = rawDrawer.toLowerCase();

  const groupMap = {
    castle: ['group_mm7mv0yv', 'group_mm6b77as'],
    empire: ['group_mm7mfbre', 'group_mm6b77as'],
    pipeline: ['group_mm7myd0b', 'group_mm6b77as'],
    calendar: ['group_mm7maw66', 'group_mm6b77as'],
    housekeeping: ['group_mm6b77as'],
    pinball: ['group_mm7mmekt', 'group_mm6b77as'],
    vault: ['group_mm6xs2fx']
  };

  const targetGroups = groupMap[drawer] || ['group_mm7mfbre', 'group_mm6b77as'];
  const groupIdsFormatted = JSON.stringify(targetGroups);

  const query = `
    query {
      boards(ids: [${boardId}]) {
        groups(ids: ${groupIdsFormatted}) {
          id
          title
          items_page(limit: 50, query_params: { order_by: [{ column_id: "__creation_log__", direction: desc }] }) {
            items {
              id
              name
              created_at
              group {
                id
                title
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2023-10'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Monday GraphQL Error: ' + data.errors[0].message })
      };
    }

    const groups = data.data?.boards?.[0]?.groups || [];
    
    let allItems = [];
    const seen = new Set();
    groups.forEach(g => {
      if (g.items_page && g.items_page.items) {
        g.items_page.items.forEach(item => {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            allItems.push(item);
          }
        });
      }
    });

    allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        drawer: drawer,
        count: allItems.length,
        items: allItems
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server fetch error: ' + err.message })
    };
  }
};
