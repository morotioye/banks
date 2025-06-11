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

  const { name, lat, lon, radius } = req.body

  if (!name || !lat || !lon || !radius) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  // Run the orchestrator to create domain
  const scriptPath = path.join(process.cwd(), '..', 'samples', 'scripts', 'orchestrator.py')
  
  const env = {
    ...process.env,
    TEST_DB_NAME: 'testbank',
    PYTHONPATH: path.join(process.cwd(), '..', 'samples')
  }
  
  const pythonProcess = spawn('python3', [
    scriptPath,
    '--name', name,
    '--lat', lat.toString(),
    '--lon', lon.toString(),
    '--radius', radius.toString(),
    '--steps', '1'  // Only run step 1 (create domain)
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
        error: 'Failed to create domain',
        details: error 
      })
    }

    res.status(201).json({ 
      success: true,
      message: 'Domain created successfully',
      output 
    })
  })
} 