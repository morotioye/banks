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

  const { collection } = req.query

  if (!collection || typeof collection !== 'string') {
    return res.status(400).json({ error: 'Collection name required' })
  }

  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db(dbName)
    
    // Get blocks from the specified collection
    const rawBlocks = await db.collection(collection)
      .find({})
      .limit(5000) // Limit for performance
      .toArray()

    // Transform blocks to handle BSON types
    const blocks = rawBlocks.map(block => ({
      ...block,
      properties: {
        ...block.properties,
        // Convert MongoDB NumberInt/Double to regular numbers
        pop: typeof block.properties?.pop === 'object' ? 
          (block.properties.pop.$numberInt || block.properties.pop.$numberDouble || 0) : 
          (block.properties?.pop || 0),
        population: block.properties?.population || block.properties?.pop,
        geoid: block.properties?.geoid || block.properties?.GEOID,
        poverty_rate: typeof block.properties?.poverty_rate === 'object' ?
          (block.properties.poverty_rate.$numberDouble || 0) :
          (block.properties?.poverty_rate || 0),
        snap_rate: typeof block.properties?.snap_rate === 'object' ?
          (block.properties.snap_rate.$numberDouble || 0) :
          (block.properties?.snap_rate || 0),
        vehicle_access_rate: typeof block.properties?.vehicle_access_rate === 'object' ?
          (block.properties.vehicle_access_rate.$numberDouble || 0) :
          (block.properties?.vehicle_access_rate || 0),
        food_insecurity_score: block.properties?.food_insecurity_score || 0
      }
    }))

    res.status(200).json({ blocks })
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Failed to fetch blocks' })
  } finally {
    await client.close()
  }
} 