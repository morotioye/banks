import type { NextApiRequest, NextApiResponse } from 'next'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGO_DB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.TEST_DB_NAME || 'testbank'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
    return
  }

  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db(dbName)
    
    // Get all domains from domain_metadata
    const domains = await db.collection('domain_metadata')
      .find({})
      .sort({ created_at: -1 })
      .toArray()

    console.log('Found domains:', domains.length)
    domains.forEach(d => console.log(' -', d.name, ':', d.collection_name))

    res.status(200).json({ domains })
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Failed to fetch domains' })
  } finally {
    await client.close()
  }
} 