exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    console.log('Received payload:', JSON.stringify(payload));
    console.log('Body field:', payload.body);

    try {
      const makeBody = JSON.stringify({ body: payload.body });
      console.log('About to call Make.com with:', makeBody);

      const response = await fetch('https://hook.us2.make.com/ii5yklk5cgwsijw17wanvjt3qh0kcbei', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: makeBody
      });

      const text = await response.text();

      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: response.ok, response: text })
      };
    } catch (fetchError) {
      console.error('Error calling Make.com:', fetchError);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Bad Gateway', message: fetchError.message })
      };
    }
  } catch (error) {
    console.error('Intake function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
