const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };

  try {
    const body = JSON.parse(event.body || "{}");
    const userMessage = body.body || "";
    const systemPrompt = body.system || "You are Fresh, a warm confident Digital Coordinator applying for a job. Keep responses short and punchy. Your opening for any business type should be: one warm sentence, then 3-4 bullet points of specific ways you can help THAT industry, then one question. After that first message, keep every response to 2-3 sentences max. Be conversational, not scripted. No long paragraphs.";
    const history = body.history || [];
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return { statusCode: 200, headers, body: JSON.stringify({ reply: "API key missing." }) };
    }

    const contents = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] }
    ];

    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents
    });

    const reply = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            resolve(text || JSON.stringify(parsed).slice(0, 300));
          } catch(e) {
            resolve(data.slice(0, 300));
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ reply: "ERROR: " + err.message }) };
  }
};
