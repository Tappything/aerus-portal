const https = require('https');

const SYSTEM_PROMPT = `You are Fresh 🤵, the Digital Coordinator powering TappyThing for William Sullivan and his team at Aerus Home Wellness in Timonium, MD.

You have direct knowledge of Aerus Timonium's core pricing and services:
- Labor / Diagnostic: $40.00
- Standard RO Installation: $300.00
- Water Cooler w/ 6 Stage Reverse Osmosis: $2500.00
- Aerus Mobile: $271.00
- AP 500: $500.00
- Common Vacuum Belts / Bags / Filters: $15.00 - $35.00
- Full Service Tune-Up / Rebuild: $89.95 - $149.95

YOUR CORE FUNCTIONS & RULES:
1. VOICE-FIRST INTAKE & INVOICING:
   - When the user dictates a repair, note, or invoice (e.g. "Invoice for Beth Rose belt and labor"), extract the customer name, match parts/services against pricing, and calculate the total.
   - Provide a punchy response and include the invoice summary.

2. DIRECT & PUNCHY TONE:
   - Direct, energetic motivational coach tone (Ogilvy clarity, Ziglar warmth).
   - Keep responses to 2-3 short, powerful sentences. Fifth-grade clarity always. Zero fluff.

3. WORKFLOW CATEGORIZATION:
   - Intakes/Repairs -> Category: "business"
   - Personal/Home/Groceries -> Category: "personal"
   - Invoices/Billing/Money -> Category: "invoices"
   - Team Directives (Mona, Chris, Mike, Norby) -> Category: "shared"

4. STRICT CONSTRAINTS:
   - Workiz is the cash register only. Monday.com is the command board.
   - Never mention "Dan" unless William brings him up.
   - Never ask "Are we hanging up now?"
`;

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const userMessage = data.message || data.note || '';

    if (!userMessage) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ reply: "Hey Boudie! I'm listening. Speak or type what's on your mind!" })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      let cat = 'business';
      let reply = `Logged: "${userMessage}". Filed to Business Ops!`;
      let lower = userMessage.toLowerCase();
      let invoiceData = null;

      if (lower.includes('invoice') || lower.includes('bill') || lower.includes('$') || lower.includes('charge')) {
        cat = 'invoices';
        const match = userMessage.match(/\$?(\d+(\.\d{2})?)/);
        const amount = match ? `$${match[1]}` : '$40.00';
        invoiceData = { amount, text: userMessage };
        reply = `💵 Staged Invoice: ${amount}. Staged for Saturday Settlement!`;
      } else if (lower.includes('grocery') || lower.includes('home') || lower.includes('wife')) {
        cat = 'personal';
        reply = `Filed to Personal & Home: "${userMessage}"!`;
      } else if (lower.includes('mike') || lower.includes('mona') || lower.includes('chris') || lower.includes('norby')) {
        cat = 'shared';
        reply = `Routed to Team Space: "${userMessage}"!`;
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ reply, category: cat, invoiceData })
      };
    }

    const geminiPayload = JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${SYSTEM_PROMPT}\n\nUser message: "${userMessage}"\n\nPlease analyze this note. Respond in 2 short sentences as Fresh. Also indicate category (business, personal, invoices, or shared) and if it is an invoice, specify the estimated total amount.` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 250
      }
    });

    const geminiResponse = await new Promise((resolve, reject) => {
      const req = https.request(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(geminiPayload)
          }
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode, body }));
        }
      );
      req.on('error', reject);
      req.write(geminiPayload);
      req.end();
    });

    const parsed = JSON.parse(geminiResponse.body);
    const textOut = parsed.candidates?.[0]?.content?.parts?.[0]?.text || `Got it! Logged "${userMessage}".`;

    let cat = 'business';
    const lower = userMessage.toLowerCase();
    let invoiceData = null;

    if (lower.includes('invoice') || lower.includes('bill') || lower.includes('$') || textOut.toLowerCase().includes('invoice') || textOut.includes('$')) {
      cat = 'invoices';
      const match = (userMessage + ' ' + textOut).match(/\$?(\d+(\.\d{2})?)/);
      const amount = match ? `$${match[1]}` : '$40.00';
      invoiceData = { amount, text: userMessage };
    } else if (lower.includes('grocery') || lower.includes('home') || lower.includes('wife')) {
      cat = 'personal';
    } else if (lower.includes('mike') || lower.includes('mona') || lower.includes('chris') || lower.includes('norby')) {
      cat = 'shared';
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        reply: textOut,
        category: cat,
        invoiceData
      })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        reply: "Got it, Boudie! Note logged and staged to your ops board.",
        category: "business",
        invoiceData: null
      })
    };
  }
};
