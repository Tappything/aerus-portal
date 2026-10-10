let cloudState = { 
  appointments: [],
  vaultInvoices: []
};

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  if (event.httpMethod === "GET") {
    return { statusCode: 200, headers, body: JSON.stringify(cloudState) };
  }

  if (event.httpMethod === "POST") {
    try {
      const data = JSON.parse(event.body || "{}");
      if (data.appointments) cloudState.appointments = data.appointments;
      if (data.vaultInvoices) cloudState.vaultInvoices = data.vaultInvoices;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, cloudState }) };
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
    }
  }

  return { statusCode: 405, headers, body: "Method Not Allowed" };
};
