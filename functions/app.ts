import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { app } from '../src/index'; // Import the app object from src/index.ts

const serverless = require('serverless-http');

const handler = serverless(app);

exports.handler = async (event: APIGatewayProxyEvent, context: Context) => {
  // Fixes for "Cannot read property 'replace' of undefined" and "Cannot set property 'statusCode' of undefined"
  context.callbackWaitsForEmptyEventLoop = false;

  // Call your API's handler function here
  const result = await handler(event, context);
  return {
    ...result,
    headers: {
      ...result.headers,
      'Access-Control-Allow-Origin': '*', // Update this to a specific domain in production
      'Access-Control-Allow-Credentials': true,
    },
  };
};
