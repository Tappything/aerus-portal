const https = require('https');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS Preflight OK' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const promptText = body.prompt || 'Empty intake';
    const boardId = body.board_id || '18424728273';

    // 1. FIRE MAKE.COM WEBHOOK IN PARALLEL
    const webhookData = JSON.stringify({ prompt: promptText, board_id: boardId, timestamp: new Date().toISOString() });
    const webhookReq = https.request('https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(webhookData) }
    });
    webhookReq.on('error', (e) => console.error('Webhook error:', e));
    webhookReq.write(webhookData);
    webhookReq.end();

    // 2. RETURN CLEAN CONFIRMATION
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: 'Logged! ⚡' })
    };
  } catch (error) {
    console.error('Chat error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: 'Logged! ⚡' })
    };
  }
};
