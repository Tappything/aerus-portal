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
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
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
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ reply: '❌ MONDAY_API_TOKEN not configured in Netlify.' })
      };
    }

    const lower = rawPrompt.toLowerCase().trim();

    // TRACK B: COMMAND & COORDINATOR ACTIONS (Move / Clean Up / Pinball)
    if (lower.includes('move') || lower.includes('clean up') || lower.includes('bring everything') || lower.includes('knock them out')) {
      // Query items from Empire Operations AND Staff Intake
      const getItemsQuery = JSON.stringify({
        query: `{
          boards(ids: [${targetBoardId}]) {
            groups(ids: ["group_mm7mfbre", "group_mm6b77as"]) {
              items_page(limit: 50) {
                items {
                  id
                  name
                }
              }
            }
          }
        }`
      });

      const itemsRes = await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(getItemsQuery)
      }, getItemsQuery);

      const groups = itemsRes?.data?.boards?.[0]?.groups || [];
      let movedCount = 0;

      for (const group of groups) {
        const items = group.items_page?.items || [];
        for (const item of items) {
          const moveQuery = JSON.stringify({
            query: `mutation {
              move_item_to_group (item_id: "${item.id}", group_id: "group_mm7mmekt") {
                id
              }
            }`
          });

          await makePostRequest('https://api.monday.com/v2', {
            'Content-Type': 'application/json',
            'Authorization': mondayKey,
            'API-Version': '2023-10',
            'Content-Length': Buffer.byteLength(moveQuery)
          }, moveQuery);

          movedCount++;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: `All ${movedCount} active tasks moved to your Pinball queue, William! Let's knock them out!`,
          actionPerformed: "MOVE_TO_PINBALL",
          count: movedCount
        })
      };
    }

    // TRACK A: NEW TASK INTAKE & MULTI-ACTION SPLITTER
    const groupMap = {
      empire: { id: 'group_mm7mfbre', name: 'Empire Operations' },
      pipeline: { id: 'group_mm7myd0b', name: 'Pipeline' },
      castle: { id: 'group_mm7mv0yv', name: 'Castle Drawer' },
      pinball: { id: 'group_mm7mmekt', name: 'Pinball Queue' }
    };

    const sentences = rawPrompt
      .split(/(?:\. |\n|;|\band then\b|\band also\b|\band the other to\b|\band the other\b|\bthe other to\b|\bthe last one\b|, (?=[a-zA-Z]{3,}))/i)
      .map(s => s.trim())
      .filter(s => s.length > 3);

    let parsedCards = [];

    sentences.forEach(sentence => {
      const sLower = sentence.toLowerCase();
      let targetKey = 'empire';

      if (sLower.includes('personal') || sLower.includes('home') || sLower.includes('grocery') || sLower.includes('coffee') || sLower.includes('family')) {
        targetKey = 'castle';
      } else if (sLower.includes('lead') || sLower.includes('sale') || sLower.includes('quote') || sLower.includes('prospect') || sLower.includes('

Commit this into `netlify/functions/chat.js` and push to GitHub. Once it deploys, any variation of *"clean up the boards"* or *"move to pinball"* will execute the move and clear your queue!)) {
        targetKey = 'pipeline';
      } else if (sLower.includes('quick') || sLower.includes('urgent') || sLower.includes('pinball') || sLower.includes('knockout')) {
        targetKey = 'pinball';
      }

      let cleanTitle = sentence.charAt(0).toUpperCase() + sentence.slice(1);

      parsedCards.push({
        title: cleanTitle,
        groupId: groupMap[targetKey].id,
        groupName: groupMap[targetKey].name
      });
    });

    for (const card of parsedCards) {
      const createQuery = JSON.stringify({
        query: `mutation {
          create_item (
            board_id: ${targetBoardId},
            group_id: "${card.groupId}",
            item_name: "${card.title.replace(/"/g, '\\"')}"
          ) {
            id
          }
        }`
      });

      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(createQuery)
      }, createQuery);
    }

    const replyMsg = `Got it, William! Created ${parsedCards.length} action card${parsedCards.length > 1 ? 's' : ''} on your board.`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: replyMsg,
        cardsCreated: parsedCards.length
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ reply: 'Error processing request: ' + err.message })
    };
  }
};
