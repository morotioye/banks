import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.TEST_DB_NAME || 'food_insecurity_test';

let cachedClient: MongoClient | null = null;

async function getMongoClient() {
  if (cachedClient) {
    return cachedClient;
  }
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection') || 'cells';
    const limit = parseInt(searchParams.get('limit') || '1000');
    const skip = parseInt(searchParams.get('skip') || '0');
    
    const client = await getMongoClient();
    const db = client.db(DB_NAME);
    
    // Get total count
    const totalCount = await db.collection(collection).countDocuments();
    
    // Get cells with pagination
    const cells = await db.collection(collection)
      .find({})
      .skip(skip)
      .limit(limit)
      .toArray();
    
    // Get statistics
    const stats = await db.collection(collection).aggregate([
      {
        $group: {
          _id: null,
          avgPopulation: { $avg: '$population' },
          avgFoodInsecurityScore: { $avg: '$foodInsecurityScore' },
          totalNeed: { $sum: '$need' },
          minLat: { $min: '$centroidLat' },
          maxLat: { $max: '$centroidLat' },
          minLon: { $min: '$centroidLon' },
          maxLon: { $max: '$centroidLon' },
        }
      }
    ]).toArray();
    
    return NextResponse.json({
      cells,
      totalCount,
      stats: stats[0] || {},
      collection,
    });
  } catch (error) {
    console.error('Error fetching cells:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cells' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { collection } = await request.json();
    
    const client = await getMongoClient();
    const db = client.db(DB_NAME);
    
    // Get list of collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    return NextResponse.json({ collections: collectionNames });
  } catch (error) {
    console.error('Error listing collections:', error);
    return NextResponse.json(
      { error: 'Failed to list collections' },
      { status: 500 }
    );
  }
} 