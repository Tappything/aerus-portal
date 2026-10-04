// twilio-outbound.js - TappyThing Outbound Messaging Route
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { to, message } = body;

    if (!to || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing "to" or "message" parameter.' })
      };
    }

    const response = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, sid: response.sid })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
