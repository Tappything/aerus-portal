// netlify/functions/gemini-memory.js
// Standalone Gemini 1.5 Flash Memory & Duplicate Task Resolver

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' }) 
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '❌ GEMINI_API_KEY environment variable missing.' })
      };
    }

    const bodyData = JSON.parse(event.body || '{}');
    const { prompt = '', boardHistory = [] } = bodyData;

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing prompt in request body.' })
      };
    }

    const historyContext = Array.isArray(boardHistory) && boardHistory.length > 0
      ? JSON.stringify(boardHistory)
      : 'No prior board history provided.';

    const systemInstruction = 
      'You are a memory resolution engine. Compare the incoming task prompt against the provided board history. ' +
      'Determine if this task or customer issue has been processed or completed before. ' +
      'Respond ONLY in valid raw JSON with two fields: ' +
      '"match": (boolean - true if task was found in history, false otherwise) and ' +
      '"summary": (string - a concise 1-2 sentence breakdown of what happened if matched, or empty string if false).';

    const userPrompt = `INCOMING TASK: "${prompt}"\n\nBOARD HISTORY:\n${historyContext}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    const geminiData = await geminiResponse.json();

    if (geminiData.error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Gemini API Error: ' + geminiData.error.message })
      };
    }

    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedResult = JSON.parse(rawText);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        match: Boolean(parsedResult.match),
        summary: parsedResult.summary || ''
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Gemini Memory Function Error: ' + err.message })
    };
  }
};
