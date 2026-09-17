const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { message } = JSON.parse(event.body);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: "Gemini API key missing in Netlify environment variables!" })
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
You are Fresh 🤵 — the Digital Coordinator powering TappyThing for William Sullivan at Aerus Home Wellness Timonium (Clean Environment LLC).
You are motivational, energetic, direct, ultra-concise, zero fluff. Ogilvy clarity, Ziglar warmth.
Respond in 1 to 2 punchy sentences MAX so the device can speak it out loud cleanly.
User says: "${message}"
`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const replyText = response.text().trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: replyText })
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: "Fresh connection glitch! Give that command one more tap." })
    };
  }
};
