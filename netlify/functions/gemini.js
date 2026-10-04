const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('DEBUG ERROR: GEMINI_API_KEY is missing in Netlify Environment Variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'GEMINI_API_KEY missing in Netlify environment variables' }),
      };
    }

    const { prompt } = JSON.parse(event.body || '{}');
    console.log('DEBUG: Received intake prompt:', prompt);

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing prompt in request body' }),
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `
You are Fresh, the master Digital Coordinator for Aerus Home Wellness.
Your job is to parse intake prompts and output a professional, high-converting customer proposal formatted strictly as valid JSON.

GUIDELINES FOR GENERATING THE PROPOSAL:
1. CUSTOMER & LOCATION: Extract customer name, address, and city/state/zip if provided. If missing, default customerName to "Valued Customer".
2. WATER DIAGNOSTIC REASONING: Explain WHY each product is needed in fifth-grade, plain-English layman terms based on water test findings (e.g., pH acidic levels destroying copper pipes, removing regional nitrate risks, why low hardness means NO water softener is needed, etc.).
3. ITEMIZATION & PRICES:
   - Acid Neutralizer (e.g. C2.0 Heavy-Duty): $3,850.00 | Labor: $750.00
   - UV Pathogen Disinfection Module: $1,900.00 | Labor: $300.00
   - 6-Stage Alkaline RO System w/ Brushed Nickel Faucet: $1,800.00 | Labor: $450.00
   - Two Laundry Pro 2.0 Units: $2,400.00 ($1,200/ea) | Labor: $150.00 ($75/ea)
   - Pure & Gentle 5-Shipment Household Soap Program (pureandgentlesoap.com): $350.00 (Included at $0 promo bonus)
4. DISCOUNT HANDLING: Extract any specified package discounts or calculate the retail total vs target investment discount. Show a clear discount description and negative dollar amount.
5. STRICT JSON OUTPUT FORMAT ONLY (NO MARKDOWN WRAPPERS, NO BACKTICKS):
{
  "proposal": {
    "customerName": "Customer Name",
    "summary": "Aerus Whole Home Water & Wellness Package",
    "diagnosticNotes": "Layman explanation of water test findings and why these exact products were selected.",
    "retailTotal": 11950.00,
    "discount": 4455.00,
    "total": 7495.00,
    "items": [
      { "name": "Heavy-Duty 2.0 CU FT Acid Neutralizer System (C2.0)", "price": 3850.00, "reason": "Protects home copper plumbing from acidic water corrosion." },
      { "name": "Neutralizer Plumbing Installation Labor", "price": 750.00, "reason": "Master plumbing bypass assembly and calibration." },
      { "name": "Medical-Grade UV Pathogen & Disinfection Unit", "price": 1900.00, "reason": "Eliminates bacteria and microorganisms on contact." },
      { "name": "UV Disinfection Installation Labor", "price": 300.00, "reason": "Electrical and line integration." },
      { "name": "6-Stage Alkaline RO Drinking System w/ Brushed Nickel Faucet", "price": 1800.00, "reason": "Removes nitrates and re-mineralizes healthy drinking water." },
      { "name": "RO Installation & Counter Drilling Labor", "price": 450.00, "reason": "Custom brushed nickel faucet mounting and plumbing hookup." },
      { "name": "Two Laundry Pro 2.0 ActivePure Cold-Water Systems", "price": 2400.00, "reason": "Lifts dirt with cold water oxidizers—zero detergent or hot water bills." },
      { "name": "Laundry Pro Installation Labor (2 Units)", "price": 150.00, "reason": "Standard washing machine hose hookups." },
      { "name": "Pure & Gentle 5-Shipment Soap Program (pureandgentlesoap.com)", "price": 0.00, "reason": "Eco-friendly concentrated household cleaning delivered to door." }
    ]
  }
}
`;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Intake Prompt: "${prompt}"` }
    ]);

    const responseText = result.response.text().trim();
    console.log('DEBUG: Raw responseText from Gemini API:', responseText);

    const cleanJsonText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    console.log('DEBUG: Cleaned JSON text before parse:', cleanJsonText);

    const parsedData = JSON.parse(cleanJsonText);
    console.log('DEBUG: Parsed JSON object successfully:', JSON.stringify(parsedData));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsedData),
    };
  } catch (err) {
    console.error('DEBUG ERROR in gemini.js handler:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
