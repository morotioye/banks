import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('🚀 [optimize-locations-stream] Request received:', {
    method: req.method,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { domain, budget } = req.query;

  if (!domain || !budget) {
    console.error('❌ [optimize-locations-stream] Missing required parameters');
    return res.status(400).json({ error: 'Domain and budget are required' });
  }

  console.log('📊 [optimize-locations-stream] Starting optimization:', {
    domain,
    budget,
    timestamp: new Date().toISOString()
  });

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial message
  const initialMessage = JSON.stringify({ type: 'phase', phase: 'Starting optimization...' });
  res.write(`data: ${initialMessage}\n\n`);
  console.log('📤 [optimize-locations-stream] Sent initial message:', initialMessage);

  // Keep connection alive
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  try {
    // Path to the ADK Python script
    const scriptPath = path.join(process.cwd(), '..', 'agents', 'location_agent', 'run_adk_stream.py');
    console.log('🐍 [optimize-locations-stream] Python script path:', scriptPath);
    
    // Arguments for the Python script
    const args = [
      scriptPath,
      '--domain', domain.toString(),
      '--budget', budget.toString(),
      '--stream'
    ];

    console.log('🔧 [optimize-locations-stream] Spawning Python process with args:', args);

    // Spawn Python process
    const pythonProcess = spawn('python3', args, {
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let resultBuffer = '';
    let isCollectingResult = false;
    let messageCount = 0;
    let buffer = '';

    pythonProcess.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log('📥 [optimize-locations-stream] Raw Python stdout:', dataStr.substring(0, 200) + '...');
      
      // Add to buffer
      buffer += dataStr;
      
      // Process all complete lines
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);
        
        if (!line.trim()) continue;
        
        try {
          // Check if this is the start of final result
          if (line.includes('FINAL_RESULT_START')) {
            console.log('🎯 [optimize-locations-stream] Starting to collect final result');
            isCollectingResult = true;
            resultBuffer = '';
            continue;
          }
          
          // Check if this is the end of final result
          if (line.includes('FINAL_RESULT_END')) {
            console.log('✅ [optimize-locations-stream] Final result collected, parsing...');
            isCollectingResult = false;
            try {
              const finalResult = JSON.parse(resultBuffer);
              const resultMessage = JSON.stringify({ type: 'result', result: finalResult });
              res.write(`data: ${resultMessage}\n\n`);
              console.log('📤 [optimize-locations-stream] Sent final result:', {
                status: finalResult.status,
                locations: finalResult.locations?.length,
                warehouses: finalResult.warehouses?.length,
                timestamp: new Date().toISOString()
              });
            } catch (e) {
              console.error('❌ [optimize-locations-stream] Error parsing final result:', e);
              console.error('Result buffer was:', resultBuffer);
            }
            continue;
          }
          
          // If collecting result, add to buffer
          if (isCollectingResult) {
            resultBuffer += line;
            continue;
          }
          
          // Skip non-JSON lines (like warnings)
          if (!line.startsWith('{')) {
            console.log('⚠️ [optimize-locations-stream] Skipping non-JSON line:', line.substring(0, 100));
            continue;
          }
          
          // Parse streaming messages
          const message = JSON.parse(line);
          messageCount++;
          console.log(`📨 [optimize-locations-stream] Message #${messageCount}:`, {
            type: message.type,
            content: message.type === 'agent_message' ? message.content : 
                    message.type === 'function_call' ? `Calling ${message.function}` :
                    message.type === 'function_result' ? `Result from ${message.function}` :
                    message.type === 'phase' ? message.phase :
                    'Other message'
          });
          
          // Send the appropriate SSE message
          if (message.type === 'agent_message') {
            res.write(`data: ${JSON.stringify({
              type: 'agent_message',
              message: message.content
            })}\n\n`);
          } else if (message.type === 'function_call') {
            res.write(`data: ${JSON.stringify({
              type: 'function_call',
              function_name: message.function,
              args: message.args
            })}\n\n`);
          } else if (message.type === 'function_result') {
            res.write(`data: ${JSON.stringify({
              type: 'function_result',
              function_name: message.function,
              result: message.result
            })}\n\n`);
          } else if (message.type === 'phase') {
            res.write(`data: ${JSON.stringify({
              type: 'phase',
              phase: message.phase
            })}\n\n`);
          } else if (message.type === 'error') {
            res.write(`data: ${JSON.stringify({
              type: 'error',
              error: message.error
            })}\n\n`);
          }
          
          // Messages are automatically flushed by Next.js
        } catch (parseError) {
          console.error('⚠️ [optimize-locations-stream] Error parsing line:', parseError);
          console.error('Line was:', line);
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const errorStr = data.toString();
      console.error('🔴 [optimize-locations-stream] Python stderr:', errorStr);
      
      // Only send critical errors to client
      if (errorStr.includes('ERROR') && !errorStr.includes('INFO')) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: errorStr
        })}\n\n`);
      }
    });

    pythonProcess.on('close', (code) => {
      clearInterval(keepAliveInterval);
      console.log(`🏁 [optimize-locations-stream] Python process closed with code ${code}`);
      
      if (code !== 0) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: `Process exited with code ${code}`
        })}\n\n`);
      }
      res.end();
    });

    pythonProcess.on('error', (error) => {
      clearInterval(keepAliveInterval);
      console.error('💥 [optimize-locations-stream] Failed to start Python process:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: 'Failed to start optimization process'
      })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      clearInterval(keepAliveInterval);
      console.log('👋 [optimize-locations-stream] Client disconnected');
      pythonProcess.kill();
    });

  } catch (error) {
    clearInterval(keepAliveInterval);
    console.error('💥 [optimize-locations-stream] Optimization error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Internal server error'
    })}\n\n`);
    res.end();
  }
} 