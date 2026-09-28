const https = require('https');

function makePostRequest(url, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
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
    const body = JSON.parse(event.body || '{}');
    const rawPrompt = body.prompt || body.text || '';
    const targetBoardId = body.board_id || '18424728273';

    if (!rawPrompt) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'No prompt provided', reply: '❌ ERROR: EMPTY PROMPT' }) 
      };
    }

    const makeWebhookUrl = 'https://hook.us2.make.com/g6aw7r8759ar5jr5c7lnb6nvwnuuz67t';
    const payload = JSON.stringify({
      rawDump: rawPrompt,
      prompt: rawPrompt,
      body: rawPrompt,
      board_id: targetBoardId,
      timestamp: new Date().toISOString()
    });

    const response = await makePostRequest(makeWebhookUrl, payload);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        reply: '✅ LOGGED & FIRED TO MAKE! ⚡',
        makeStatus: response.status 
      })
    };
  } catch (err) {
    console.error('Chat Relay Function Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: err.message, 
        reply: '❌ BACKEND RELAY ERROR: ' + err.message 
      })
    };
  }
};
