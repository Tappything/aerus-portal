// Netlify serverless function to proxy Monday.com API requests
// Forwards GraphQL queries from the frontend with proper authorization
const fetch = global.fetch;

const MONDAY_API_URL = 'https://api.monday.com/v2';

exports.handler = async function (event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the incoming request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    // Check that MONDAY_API_KEY is set
    if (!process.env.MONDAY_API_KEY) {
      console.error('MONDAY_API_KEY environment variable is not set');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'API key not configured on server' })
      };
    }

    // Log the authorization header for debugging
    const authHeader = 'apikey ' + process.env.MONDAY_API_KEY;
    console.log('Authorization header set with length:', authHeader.length);

    // Forward the request to Monday.com
    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(requestBody)
    });

    const payload = await response.json();

    // Log response status for debugging
    console.log('Monday.com API response status:', response.status);
    if (response.status !== 200) {
      console.log('Monday.com API error payload:', JSON.stringify(payload));
    }

    // Return the Monday.com response (status code, headers, body)
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // allow browser requests; adjust for production
      },
      body: JSON.stringify(payload)
    };
  } catch (err) {
    console.error('Error in Monday.com proxy function:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Unknown error' })
    };
  }
};
