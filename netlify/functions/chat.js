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

    // TRACK B: ACTION COMMAND TRACK (Move to Pinball Queue)
    if (lower.includes('bring everything') || lower.includes('move to pinball') || lower.includes('move all') || lower.includes('clean up') || lower.includes('clear board')) {
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
          reply: `All ${moveCount} active tasks moved directly to Pinball queue, William! Let's knock them out!`,
          count: moveCount
        })
      };
    }

    // TRACK A: MULTI-CARD INTAKE SPLITTER & ROUTER
    const groupMap = {
      empire: { id: 'group_mm7mfbre', name: 'Empire Operations' },
      pipeline: { id: 'group_mm7myd0b', name: 'Pipeline' },
      castle: { id: 'group_mm7mv0yv', name: 'Castle Drawer' },
      pinball: { id: 'group_mm7mmekt', name: 'Pinball Queue' },
      housekeeping: { id: 'group_mm6b77as', name: 'Housekeeping' },
      intake: { id: 'group_mm6b77as', name: 'Staff Intake' }
    };

    const sentences = rawPrompt
      .split(/(?:\. |\n|;|\band then\b|\band also\b|\band the other to\b|\band the other\b|\bthe last one\b|, (?=[a-zA-Z]{3,}))/i)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    let parsedCards = [];

    sentences.forEach(sentence => {
      const sLower = sentence.toLowerCase();
      let targetKey = 'intake';

      if (sLower.includes('personal') || sLower.includes('home') || sLower.includes('family')) {
        targetKey = 'castle';
      } else if (sLower.includes('lead') || sLower.includes('sale') || sLower.includes('quote') || sLower.includes('

---

### **Action:**
1. Commit this into **`netlify/functions/chat.js`** on GitHub.
2. Ensure **`index.html`** and **`netlify/functions/getBoard.js`** are pushed.
3. Wait 20 seconds for Netlify to publish the build.

Once deployed, open `freshtappything.com`—your live 2-track voice intake and Pinball queue are ready!) || sLower.includes('dollar')) {
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
        reply: `Got it, William! Logged ${parsedCards.length} action card${parsedCards.length > 1 ? 's' : ''} directly to Monday.`,
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
