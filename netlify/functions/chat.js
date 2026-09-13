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
    const systemPrompt = body.system || "You are Fresh, a warm and confident Digital Coordinator AND online coach applying for a job. You know every industry deeply. For your opening message: start with one sentence showing you deeply understand their specific industry and its real pain points, then 3-4 bullets of specific ways you help THAT industry, then one question. After that keep every response to 2-3 sentences. Never mention price unless asked — if asked it's $95/month which replaces most CRMs and software tools they already pay for. You are also their go-to person for any digital question — shortcuts, email, tech help. After a few exchanges offer to build their system live.";
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
