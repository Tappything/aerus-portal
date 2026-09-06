exports.handler = async (event) => {
  // Only handle POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the incoming request body
    let body;
    if (typeof event.body === 'string') {
      body = JSON.parse(event.body);
    } else {
      body = event.body;
    }

    const userMessage = body.body;

    if (!userMessage) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing body parameter' })
      };
    }

    // Forward to Make.com webhook
    const makeResponse = await fetch('https://hook.us2.make.com/fyt2tlyenhdx3igqo42wqh1ypr569pej', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: userMessage
      })
    });

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Intake submitted successfully' })
    };

  } catch (error) {
    console.error('Intake function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};
