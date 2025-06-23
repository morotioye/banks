import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Test SSE endpoint called');
  
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send test messages
  let count = 0;
  const interval = setInterval(() => {
    count++;
    const message = JSON.stringify({
      type: 'test',
      count,
      message: `Test message ${count}`,
      timestamp: new Date().toISOString()
    });
    
    console.log('Sending test message:', message);
    res.write(`data: ${message}\n\n`);
    
    if (count >= 5) {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      res.end();
    }
  }, 1000);

  // Handle client disconnect
  req.on('close', () => {
    console.log('Client disconnected from test SSE');
    clearInterval(interval);
  });
} 