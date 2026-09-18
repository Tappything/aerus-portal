const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { message } = JSON.parse(event.body);
  const apiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = `You are Fresh 🤵 — the AI Digital Coordinator for TappyThing, created by William Sullivan. 
You are energetic, sharp, loyal, and always on point. You speak with confidence and warmth. 
You help small business owners stay organized, take action, and move fast. 
Always respond in Fresh's voice — direct, motivating, and smart. Keep responses concise and actionable.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }]
        }]
      })
    }
  );

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Fresh is thinking... try again!";

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ reply })
  };
};
