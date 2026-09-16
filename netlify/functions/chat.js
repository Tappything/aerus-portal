exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const userMessage = data.message || data.body || "";

    // Simple echo / response logic for intake
    let reply = "Got it! Logged and routed to your board.";
    
    const lower = userMessage.toLowerCase();
    if (lower.includes("invoice") || lower.includes("bill")) {
      reply = "Invoice request received. Staging line items on screen.";
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply: reply, received: userMessage })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process request", details: err.message })
    };
  }
};
