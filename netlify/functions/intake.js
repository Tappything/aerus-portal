exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const userMessage = payload.body || '';
    console.log('Received payload:', JSON.stringify(payload));
    console.log('Body field:', userMessage);
    console.log('API key present:', !!process.env.GEMINI_API_KEY);

    if (!userMessage.trim()) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing user message' })
      };
    }

    // Fire-and-forget Monday item creation via Make.com
    try {
      const makeBody = JSON.stringify({ body: userMessage });
      console.log('Posting to Make.com for Monday item creation:', makeBody);
      if (typeof fetch === 'function') {
        void fetch('https://hook.us2.make.com/ii5yklk5cgwsijw17wanvjt3qh0kcbei', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: makeBody
        }).catch(error => {
          console.error('Non-blocking Make.com request failed:', error);
        });
      } else {
        console.error('Global fetch is not available in this runtime');
      }
    } catch (makeError) {
      console.error('Error preparing Make.com request:', makeError);
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      const reply = 'Fresh here, I got your message!';
      console.error('Missing GEMINI_API_KEY environment variable');
      console.log('Returning from intake.js:', JSON.stringify({ reply }));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply })
      };
    }

    const prompt = `You are Fresh, a warm and professional digital coordinator. You help small business owners stay organized by logging their notes, tasks, and customer information. Keep every response under 90 words. Confirm receipt clearly, and when possible suggest one practical next step. User message: ${userMessage}`;

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }]
              }
            ]
          })
        }
      );

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text().catch(() => '');
        console.error('Gemini API error:', geminiResponse.status, errorText);
        const reply = 'Fresh here, I got your message!';
        console.log('Returning from intake.js:', JSON.stringify({ reply }));
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply })
        };
      }

      const geminiData = await geminiResponse.json();
      const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Fresh here, I got your message!';

      console.log('Returning from intake.js:', JSON.stringify({ reply }));

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply })
      };
    } catch (geminiError) {
      console.error('Gemini API call failed, returning fallback reply:', geminiError);
      const reply = 'Fresh here, I got your message!';
      console.log('Returning from intake.js:', JSON.stringify({ reply }));
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply })
      };
    }
  } catch (error) {
    console.error('Intake function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
