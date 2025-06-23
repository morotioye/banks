import { NextApiRequest, NextApiResponse } from 'next';

interface RouteRequest {
  warehouses: Array<{
    geoid: string;
    lat: number;
    lon: number;
    food_banks_served: string[];
  }>;
  foodBanks: Array<{
    geoid: string;
    lat: number;
    lon: number;
  }>;
}

interface RouteResponse {
  status: 'success' | 'error';
  routes?: Array<{
    warehouse_id: string;
    foodbank_id: string;
    distance: number; // meters
    duration: number; // seconds
    polyline: string; // encoded polyline
    steps: Array<{
      distance: number;
      duration: number;
      html_instructions: string;
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
    }>;
  }>;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RouteResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      status: 'error',
      error: `Method ${req.method} Not Allowed`
    });
  }

  const { warehouses, foodBanks } = req.body as RouteRequest;

  if (!warehouses || !foodBanks || warehouses.length === 0 || foodBanks.length === 0) {
    return res.status(400).json({
      status: 'error',
      error: 'Warehouses and food banks are required'
    });
  }

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) {
    return res.status(500).json({
      status: 'error',
      error: 'Google Maps API key not configured'
    });
  }

  try {
    const routes = [];

    // Calculate routes for each warehouse-foodbank connection
    for (const warehouse of warehouses) {
      if (!warehouse.food_banks_served || warehouse.food_banks_served.length === 0) {
        continue;
      }

      for (const foodBankId of warehouse.food_banks_served) {
        const foodBank = foodBanks.find(fb => fb.geoid === foodBankId);
        if (!foodBank) {
          continue;
        }

        // Call Google Directions API
        const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
          `origin=${warehouse.lat},${warehouse.lon}&` +
          `destination=${foodBank.lat},${foodBank.lon}&` +
          `mode=driving&` +
          `optimize=true&` +
          `key=${googleMapsApiKey}`;

        const response = await fetch(directionsUrl);
        const data = await response.json();

        if (data.status === 'OK' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];

          routes.push({
            warehouse_id: warehouse.geoid,
            foodbank_id: foodBank.geoid,
            distance: leg.distance.value, // meters
            duration: leg.duration.value, // seconds
            polyline: route.overview_polyline.points,
            steps: leg.steps.map((step: any) => ({
              distance: step.distance.value,
              duration: step.duration.value,
              html_instructions: step.html_instructions,
              start_location: step.start_location,
              end_location: step.end_location
            }))
          });
        } else if (data.status !== 'OK') {
          console.error(`Google Directions API error for ${warehouse.geoid} -> ${foodBank.geoid}:`, data.status, data.error_message);
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      routes
    });

  } catch (error) {
    console.error('Route calculation error:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to calculate routes'
    });
  }
} 