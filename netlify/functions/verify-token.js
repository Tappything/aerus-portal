const https = require('https');

exports.handler = async function(event, context) {
  // CORS & Method Handling
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      },
      body: ''
    };
  }

  const tokenParam = event.queryStringParameters?.token || '';

  if (!tokenParam) {
    return {
      statusCode: 400,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ valid: false, error: 'Token parameter is required.' })
    };
  }

  // Load environment variable tokens (Format: "TOKEN1:BOARD_ID_1:NAME_1,TOKEN2:BOARD_ID_2:NAME_2")
  const validTokensEnv = process.env.VALID_TOKENS || '';
  
  if (!validTokensEnv) {
    return {
      statusCode: 500,
      headers: { 
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ valid: false, error: 'VALID_TOKENS environment variable not configured.' })
    };
  }

  // Parse token list
  const tokenList = validTokensEnv.split(',').map(item => item.trim());
  let matchedToken = null;

  for (const entry of tokenList) {
    const [token, boardId, name] = entry.split(':');
    if (token === tokenParam) {
      matchedToken = {
        valid: true,
        boardId: boardId || '18424728273',
        name: name ? decodeURIComponent(name) : 'TappyThing Subscriber'
      };
      break;
    }
  }

  if (matchedToken) {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(matchedToken)
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ valid: false })
  };
};
