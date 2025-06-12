import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import path from 'path'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
    return
  }

  const { collection } = req.body

  if (!collection || !collection.startsWith('d_')) {
    return res.status(400).json({ error: 'Invalid collection name' })
  }

  // Run step 2 of the orchestrator to calculate scores (vehicle access data should already be present)
  const scriptPath = path.join(process.cwd(), '..', 'samples', 'scripts', 'orchestrator.py')
  
  const env = {
    ...process.env,
    TEST_DB_NAME: 'testbank',
    PYTHONPATH: path.join(process.cwd(), '..', 'samples')
  }
  
  const pythonProcess = spawn('python3', [
    scriptPath,
    '--collection', collection,
    '--steps', '2'  // Only run step 2 (calculate scores) - vehicle access data is already present
  ], { env })

  let output = ''
  let error = ''

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString()
  })

  pythonProcess.stderr.on('data', (data) => {
    error += data.toString()
  })

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('Python script error:', error)
      return res.status(500).json({ 
        error: 'Failed to calculate scores',
        details: error 
      })
    }

    res.status(200).json({ 
      success: true,
      message: 'Scores calculated successfully',
      output 
    })
  })
} 