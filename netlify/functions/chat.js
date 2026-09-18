exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    var body = JSON.parse(event.body || '{}');
    var prompt = body.prompt || body.message || '';
    var apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: 'API key missing.' })
      };
    }

    var fullPrompt = 'You are Fresh, a sharp Digital Coordinator for William Sullivan at Aerus Home Wellness in Timonium MD. Be direct, helpful, and energetic. Max 1 sentences. User says: ' + prompt;

    var response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/ gemini-1.5-flash-latest:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 80 }
      })
    });

    var data = await response.json();

    if (!data.candidates) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: 'Gemini said: ' + JSON.stringify(data).substring(0, 300) })
      };
    }

    var reply = data.candidates[0].content.parts[0].text;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: reply.trim() })
    };

  } catch(e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: 'Error: ' + e.message })
    };
  }
};
