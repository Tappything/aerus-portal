const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event, context) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { message } = JSON.parse(event.body);

    // Pull API Key securely from Netlify Environment Variables
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ reply: "Gemini API key is missing in Netlify environment variables!" })
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // System Persona Prompt
    const prompt = `You are Fresh, the direct, energetic, motivational Digital Coordinator for TappyThing at Aerus Home Wellness. Respond in 1-2 punchy, highly intelligent sentences. User says: "${message}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const replyText = response.text();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: replyText })
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ reply: "Fresh encountered a connection glitch. Let's try that command again!" })
    };
  }
};
