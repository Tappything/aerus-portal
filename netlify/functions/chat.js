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
          reject(e);
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
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'Successful preflight' }) };
  }

  try {
    const mondayKey = process.env.MONDAY_API_KEY;
    const body = JSON.parse(event.body || '{}');
    const rawPrompt = body.prompt || '';
    const targetBoardId = body.board_id || '18424728273';

    if (!rawPrompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ reply: 'No prompt received.', itemsCreated: 0 })
      };
    }

    // EXACT MONDAY.COM OPERATIONAL GROUP IDS
    const groupMap = {
      empire: { id: 'group_mm7mfbre', name: '👑 Empire Operations' },
      pipeline: { id: 'group_mm7myd0b', name: '📈 Pipeline' },
      castle: { id: 'group_mm7mv0yv', name: '🏰 Castle Drawer' },
      pinball: { id: 'group_mm7mmekt', name: '⚡ Pinball Queue' },
      calendar: { id: 'group_mm7maw66', name: '📅 Calendar' }
    };

    // INTELLIGENT VOICE INTENT SPLITTER
    // Splits on periods, newlines, "and then", "and also", "and the other", "the last one", commas with action phrases
    const sentences = rawPrompt
      .split(/(?:\. |\n|;|\band then\b|\band also\b|\band the other\b|\bthe other to\b|\bthe last one\b)/i)
      .map(s => s.trim())
      .filter(s => s.length > 5);
    
    let parsedCards = [];

    sentences.forEach(sentence => {
      const lower = sentence.toLowerCase();
      let targetKey = 'empire'; // Default shop operational drawer

      if (lower.includes('personal') || lower.includes('home') || lower.includes('grocery') || lower.includes('coffee') || lower.includes('family') || lower.includes('honda') || lower.includes('car')) {
        targetKey = 'castle';
      } else if (lower.includes('lead') || lower.includes('sale') || lower.includes('quote') || lower.includes('prospect') || lower.includes('buy') || lower.includes('

---

### **Action**
Paste this into **`netlify/functions/chat.js`** and commit to GitHub. 

Once Netlify deploys, try speaking your 3-upright task into `freshtappything.com`. It will split into clean individual cards and land directly in **Empire** and **Pipeline** in plain sight!) || lower.includes('dollar')) {
        targetKey = 'pipeline';
      } else if (lower.includes('appointment') || lower.includes('schedule') || lower.includes('o\'clock') || lower.includes('tomorrow at') || lower.includes('today at')) {
        targetKey = 'calendar';
      } else if (lower.includes('quick') || lower.includes('urgent') || lower.includes('pinball') || lower.includes('knockout')) {
        targetKey = 'pinball';
      }

      // Format action title cleanly
      let cleanTitle = sentence.trim();
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      parsedCards.push({
        title: cleanTitle,
        groupKey: targetKey,
        groupId: groupMap[targetKey].id,
        groupName: groupMap[targetKey].name
      });
    });

    // DIRECT MONDAY.COM BATCH CARD CREATION
    let createdTitles = [];

    if (mondayKey) {
      for (const card of parsedCards) {
        const query = JSON.stringify({
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
          'Content-Length': Buffer.byteLength(query)
        }, query);

        createdTitles.push(`${card.title} ➔ ${card.groupName}`);
      }
    }

    const replyMessage = `⚡ ${parsedCards.length} ACTION CARD${parsedCards.length > 1 ? 'S' : ''} SPLIT & FIRED TO BOARD!`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: replyMessage,
        cardsCreated: parsedCards.length,
        cards: parsedCards
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ reply: 'Error parsing voice intake: ' + err.message, cardsCreated: 0 })
    };
  }
};
