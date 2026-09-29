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
    const mondayKey = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
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

    // TRACK 2: MOVE TO PINBALL COMMAND (SAFETY PRESERVED)
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
      let moveMutations = [];
      let idx = 0;

      groups.forEach(group => {
        (group.items_page?.items || []).forEach(item => {
          moveMutations.push(`m${idx++}: move_item_to_group(item_id: "${item.id}", group_id: "group_mm7mmekt") { id }`);
        });
      });

      if (moveMutations.length > 0) {
        const batchMoveQuery = JSON.stringify({ query: `mutation { ${moveMutations.join(' ')} }` });
        await makePostRequest('https://api.monday.com/v2', {
          'Content-Type': 'application/json',
          'Authorization': mondayKey,
          'API-Version': '2023-10',
          'Content-Length': Buffer.byteLength(batchMoveQuery)
        }, batchMoveQuery);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: `⚡ STAGED: All ${moveMutations.length} items moved to Pinball queue!`,
          count: moveMutations.length
        })
      };
    }

    // TRACK 3: MULTI-TASK SPLITTER WITH BATCHED GRAPHQL MUTATION & CORRECT GROUP IDS
    let cleanPrompt = rawPrompt.replace(/^(fresh,?\s*process\s*this\s*run:?\s*|fresh,?\s*)/i, '');

    // PROTECT HONORIFICS
    cleanPrompt = cleanPrompt
      .replace(/\bMrs\./gi, 'Mrs___')
      .replace(/\bMr\./gi, 'Mr___')
      .replace(/\bMs\./gi, 'Ms___')
      .replace(/\bDr\./gi, 'Dr___');

    const groupMap = {
      empire: 'group_mm7mfbre',
      pipeline: 'group_mm7myd0b',
      castle: 'group_mm7mv0yv',
      pinball: 'group_mm7mmekt',
      calendar: 'group_mm7maw66',
      housekeeping: 'group_mm6b77as', // FIXED: Mapped to Staff Intake
      intake: 'group_mm6b77as'
    };

    // COMPOUND CONJUNCTION SPLITTING
    const sentences = cleanPrompt
      .split(/(?:\. |\n|;|\band pay\b|\band also\b|\band then\b|\band the other to\b|\band the other\b|\bthe last one\b|, (?=[a-zA-Z]{3,}))/i)
      .map(s => s.replace(/___/g, '.').trim())
      .filter(s => s.length > 3);

    let mutations = [];

    sentences.forEach((sentence, index) => {
      const sLower = sentence.toLowerCase();
      let targetGroupId = groupMap.intake;

      if (sLower.includes('mortgage') || sLower.includes('home') || sLower.includes('personal') || sLower.includes('family')) {
        targetGroupId = groupMap.castle;
      } else if (sLower.includes('rent') || sLower.includes('aerus') || sLower.includes('shop') || sLower.includes('bench') || sLower.includes('repair')) {
        targetGroupId = groupMap.empire;
      } else if (sLower.includes('lead') || sLower.includes('sale') || sLower.includes('quote')) {
        targetGroupId = groupMap.pipeline;
      } else if (sLower.includes('at ') || sLower.includes('am') || sLower.includes('pm') || sLower.includes('tomorrow') || sLower.includes('noon')) {
        targetGroupId = groupMap.calendar;
      } else if (sLower.includes('clean') || sLower.includes('trash') || sLower.includes('chore') || sLower.includes('housekeeping')) {
        targetGroupId = groupMap.housekeeping;
      } else if (sLower.includes('quick') || sLower.includes('urgent') || sLower.includes('pinball')) {
        targetGroupId = groupMap.pinball;
      }

      let cleanTitle = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      mutations.push(`c${index}: create_item(board_id: ${targetBoardId}, group_id: "${targetGroupId}", item_name: "${cleanTitle.replace(/"/g, '\\"')}") { id }`);
    });

    if (mutations.length > 0) {
      const batchCreateQuery = JSON.stringify({
        query: `mutation { ${mutations.join(' ')} }`
      });

      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(batchCreateQuery)
      }, batchCreateQuery);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: `✅ LOGGED ${mutations.length} ACTION CARDS! ⚡`,
        count: mutations.length
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
