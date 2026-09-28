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
          resolve({ status: 'ok', raw: data });
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
    const body = JSON.parse(event.body || '{}');
    const rawPrompt = body.prompt || '';
    const targetBoardId = body.board_id || '18424728273';

    if (!rawPrompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ reply: 'No prompt received.' })
      };
    }

    // MAKE.COM PRODUCTION WEBHOOK
    const makeWebhookUrl = 'https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1';

    // INTELLIGENT INTENT & MULTI-CARD SPLITTER
    const sentences = rawPrompt
      .split(/(?:\. |\n|;|\band then\b|\band also\b|\band the other\b|\bthe other to\b|\bthe last one\b)/i)
      .map(s => s.trim())
      .filter(s => s.length > 5);

    let cards = [];

    sentences.forEach(sentence => {
      const lower = sentence.toLowerCase();
      let targetGroup = '👑 Empire Operations';

      if (lower.includes('personal') || lower.includes('home') || lower.includes('grocery') || lower.includes('coffee') || lower.includes('family') || lower.includes('honda')) {
        targetGroup = '🏰 Castle Drawer';
      } else if (lower.includes('lead') || lower.includes('sale') || lower.includes('quote') || lower.includes('prospect') || lower.includes('buy') || lower.includes('

---

### **Action**
Copy this file into **`netlify/functions/chat.js`** and commit to GitHub. 

Once Netlify builds, speaking into `freshtappything.com` will immediately:
1. Fire Make.com.
2. Trigger the automation sound.
3. Drop the split cards straight to Monday!) || lower.includes('dollar')) {
        targetGroup = '📈 Pipeline';
      } else if (lower.includes('appointment') || lower.includes('schedule') || lower.includes('o\'clock') || lower.includes('tomorrow at') || lower.includes('today at')) {
        targetGroup = '📅 Calendar';
      } else if (lower.includes('quick') || lower.includes('urgent') || lower.includes('pinball') || lower.includes('knockout')) {
        targetGroup = '⚡ Pinball Queue';
      }

      let cleanTitle = sentence.charAt(0).toUpperCase() + sentence.slice(1);

      cards.push({
        name: cleanTitle,
        group: targetGroup,
        boardId: targetBoardId
      });
    });

    // POST EACH CARD TO MAKE.COM TO TRIGGER AUTOMATIONS & DROP ON BOARD
    for (const card of cards) {
      const payload = JSON.stringify({
        rawDump: card.name,
        name: card.name,
        group: card.group,
        board_id: targetBoardId,
        timestamp: new Date().toISOString()
      });

      await makePostRequest(makeWebhookUrl, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }, payload);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: `⚡ ${cards.length} Action Card${cards.length > 1 ? 's' : ''} Fired to Make.com & Board!`,
        cardsCreated: cards.length
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ reply: 'Error: ' + err.message })
    };
  }
};
