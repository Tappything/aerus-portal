exports.handler = async (event, context) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const workizLink = process.env.WORKIZ_LINK;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY missing in Netlify" })
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, workizLink })
  };
};
