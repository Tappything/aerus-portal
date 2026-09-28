const https = require('https');

function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: headers
    }, (res) => {
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

    const lower = rawPrompt.toLowerCase().trim();

    // TRACK B: COMMAND & COORDINATOR ACTIONS (Move, Query, Wipe)
    if (lower.includes('bring everything') || lower.includes('move to pinball') || lower.includes('move all')) {
      if (mondayKey) {
        // GraphQL Move Items to Pinball Queue (group_mm7mmekt)
        const getItemsQuery = JSON.stringify({
          query: `{ boards(ids: [${targetBoardId}]) { groups(ids: ["group_mm7mfbre"]) { items_page { items { id } } } } }`
        });

        const itemsRes = await makePostRequest('https://api.monday.com/v2', {
          'Content-Type': 'application/json',
          'Authorization': mondayKey,
          'API-Version': '2023-10',
          'Content-Length': Buffer.byteLength(getItemsQuery)
        }, getItemsQuery);

        const empireItems = itemsRes?.data?.boards?.[0]?.groups?.[0]?.items_page?.items || [];

        for (const item of empireItems) {
          const moveQuery = JSON.stringify({
            query: `mutation { move_item_to_group (item_id: ${item.id}, group_id: "group_mm7mmekt") { id } }`
          });
          await makePostRequest('https://api.monday.com/v2', {
            'Content-Type': 'application/json',
            'Authorization': mondayKey,
            'API-Version': '2023-10',
            'Content-Length': Buffer.byteLength(moveQuery)
          }, moveQuery);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: "All Empire items moved directly to the Pinball queue, William! Let's knock them out!",
          actionPerformed: "MOVE_TO_PINBALL"
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

    const sentences = rawPrompt.split(/(?:\. |\n|;|\band then\b|\band also\b)/i).filter(s => s.trim().length > 3);
    let parsedCards = [];

    sentences.forEach(sentence => {
      const sLower = sentence.toLowerCase();
      let targetKey = 'empire';

      if (sLower.includes('personal') || sLower.includes('home') || sLower.includes('grocery') || sLower.includes('coffee') || sLower.includes('family')) {
        targetKey = 'castle';
      } else if (sLower.includes('lead') || sLower.includes('sale') || sLower.includes('quote') || sLower.includes('prospect') || sLower.includes('$')) {
        targetKey = 'pipeline';
      } else if (sLower.includes('quick') || sLower.includes('urgent') || sLower.includes('pinball')) {
        targetKey = 'pinball';
      }

      let cleanTitle = sentence.trim();
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      parsedCards.push({
        title: cleanTitle,
        groupId: groupMap[targetKey].id,
        groupName: groupMap[targetKey].name
      });
    });

    if (mondayKey) {
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
