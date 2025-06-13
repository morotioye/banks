import type { NextApiRequest, NextApiResponse } from 'next'
import { MongoClient, ObjectId } from 'mongodb'

const uri = process.env.MONGO_DB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017'
const dbName = process.env.TEST_DB_NAME || 'testbank'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE'])
    res.status(405).end(`Method ${req.method} Not Allowed`)
    return
  }

  const { domainId, collectionName } = req.body

  if (!domainId || !collectionName) {
    res.status(400).json({ error: 'Domain ID and collection name are required' })
    return
  }

  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db(dbName)
    
    // Delete domain metadata
    const deleteMetadataResult = await db.collection('domain_metadata')
      .deleteOne({ _id: new ObjectId(domainId) })

    if (deleteMetadataResult.deletedCount === 0) {
      res.status(404).json({ error: 'Domain not found' })
      return
    }

    // Delete the associated data collection
    try {
      await db.collection(collectionName).drop()
      console.log(`Dropped collection: ${collectionName}`)
    } catch (dropError) {
      // Collection might not exist or already be empty, which is fine
      console.log(`Collection ${collectionName} could not be dropped:`, dropError)
    }

    console.log(`Deleted domain: ${domainId} and collection: ${collectionName}`)
    res.status(200).json({ 
      message: 'Domain deleted successfully',
      deletedDomainId: domainId,
      deletedCollection: collectionName
    })
  } catch (error) {
    console.error('Database error:', error)
    res.status(500).json({ error: 'Failed to delete domain' })
  } finally {
    await client.close()
  }
} 