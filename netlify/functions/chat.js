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

    // TRACK 1: WIPE / CLEAR QUEUE COMMAND
    if (lower.includes('clear board') || lower.includes('clear queue') || lower.includes('wipe queue') || lower.includes('clear out the temporary queue')) {
      const getItemsQuery = JSON.stringify({
        query: `{ boards(ids: [${targetBoardId}]) { groups(ids: ["group_mm7mfbre", "group_mm6b77as", "group_mm7mmekt"]) { items_page(limit: 50) { items { id } } } } }`
      });

      const itemsRes = await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(getItemsQuery)
      }, getItemsQuery);

      const groups = itemsRes?.data?.boards?.[0]?.groups || [];
      let archiveCount = 0;

      for (const group of groups) {
        const items = group.items_page?.items || [];
        for (const item of items) {
          const archiveQuery = JSON.stringify({
            query: `mutation { move_item_to_group (item_id: "${item.id}", group_id: "group_mm6xs2fx") { id } }`
          });
          await makePostRequest('https://api.monday.com/v2', {
            'Content-Type': 'application/json',
            'Authorization': mondayKey,
            'API-Version': '2023-10',
            'Content-Length': Buffer.byteLength(archiveQuery)
          }, archiveQuery);
          archiveCount++;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: `⚡ BOARD CLEARED: All ${archiveCount} active items moved to Archive!`,
          count: archiveCount
        })
      };
    }

    // TRACK 2: MOVE TO PINBALL COMMAND
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

    // TRACK 3: MULTI-TASK SPLITTER WITH HONORIFIC PROTECTOR
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
      } else if (sLower.includes('lead') || sLower.includes('sale') || sLower.includes('quote')) {
        targetKey = 'pipeline';
      } else if (sLower.includes('clean') || sLower.includes('trash') || sLower.includes('chore') || sLower.includes('housekeeping')) {
        targetKey = 'housekeeping';
      } else if (sLower.includes('quick') || sLower.includes('urgent') || sLower.includes('pinball')) {
        targetKey = 'pinball';
      } else if (sLower.includes('shop') || sLower.includes('bench') || sLower.includes('repair')) {
        targetKey = 'empire';
      }

      let cleanTitle = sentence.charAt(0).toUpperCase() + sentence.slice(1);

      parsedCards.push({
        title: cleanTitle,
        groupId: groupMap[targetKey].id
      });
    });

    for (const card of parsedCards) {
      const createQuery = JSON.stringify({
        query: `mutation { create_item (board_id: ${targetBoardId}, group_id: "${card.groupId}", item_name: "${card.title.replace(/"/g, '\\"')}") { id } }`
      });

      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(createQuery)
      }, createQuery);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: `✅ LOGGED ${parsedCards.length} CLEAN TASKS TO EMPIRE & PINBALL! ⚡`,
        cardsCreated: parsedCards.length
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ reply: 'Error processing intake: ' + err.message })
    };
  }
};
