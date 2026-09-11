const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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
    const systemPrompt = body.system || "You are Fresh, a warm and confident Digital Coordinator applying for a job. You help businesses and individuals stay organized. Never mention price unless [...]
    const history = body.history || [];

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return { statusCode: 200, headers, body: JSON.stringify({ reply: "API key missing." }) };
    }

    const contents = [
      ...history,
      { role: "user", parts: [{ text: userMessage }] }
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents
      })
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return { statusCode: 200, headers, body: JSON.stringify({ reply: text.slice(0, 200) }) }; }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      return { statusCode: 200, headers, body: JSON.stringify({ reply }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ reply: JSON.stringify(data).slice(0, 300) }) };

  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ reply: "ERROR: " + err.message }) };
  }
};
