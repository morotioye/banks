// Cell type definition for the food insecurity analysis grid

export interface FoodInsecurityFactors {
  // Population in the cell
  population: number;
  
  // Poverty/SNAP rate (0-1 scale, where 1 = 100% poverty/SNAP eligibility)
  // Weight = 3
  povertySnapRate: number;
  
  // Access - distance to nearest supermarket in miles
  // Weight = 2
  distanceToNearestSupermarket: number;
  
  // Vehicle access rate (0-1 scale, where 1 = 100% have vehicle access)
  // Weight = 1
  vehicleAccessRate: number;
}

export interface Cell {
  // Unique identifier for the cell
  _id?: string;
  
  // Geographic center of the cell
  centroidLat: number;
  centroidLon: number;
  
  // Total population in this cell
  population: number;
  
  // Food insecurity factors used to calculate the score
  foodInsecurityFactors: FoodInsecurityFactors;
  
  // Calculated food insecurity score (0-10 scale, where 10 = highest insecurity)
  foodInsecurityScore: number;
  
  // Need metric: population × food insecurity score
  need: number;
  
  // Optional metadata
  createdAt?: Date;
  updatedAt?: Date;
}

// Weight constants for food insecurity calculation (sum to 1)
export const FOOD_INSECURITY_WEIGHTS = {
  povertySnapRate: 0.5,
  distanceToNearestSupermarket: 0.33,
  vehicleAccessRate: 0.17,
} as const;

// Helper function to calculate food insecurity score
export function calculateFoodInsecurityScore(factors: FoodInsecurityFactors): number {
  const {
    povertySnapRate,
    distanceToNearestSupermarket,
    vehicleAccessRate,
  } = factors;
  
  // Normalize distance to a 0-1 scale (assuming max relevant distance is 10 miles)
  const normalizedDistance = Math.min(distanceToNearestSupermarket / 10, 1);
  
  // Invert vehicle access rate (lower access = higher insecurity)
  const vehicleInsecurity = 1 - vehicleAccessRate;
  
  // Calculate weighted score (weights already sum to 1)
  const weightedScore = 
    (povertySnapRate * FOOD_INSECURITY_WEIGHTS.povertySnapRate) +
    (normalizedDistance * FOOD_INSECURITY_WEIGHTS.distanceToNearestSupermarket) +
    (vehicleInsecurity * FOOD_INSECURITY_WEIGHTS.vehicleAccessRate);
  
  // Scale to 0-10 range
  return weightedScore * 10;
}

// Helper function to calculate need
export function calculateNeed(population: number, foodInsecurityScore: number): number {
  return population * foodInsecurityScore;
}

// Factory function to create a new Cell
export function createCell(
  lat: number,
  lon: number,
  population: number,
  factors: Omit<FoodInsecurityFactors, 'population'>
): Cell {
  const foodInsecurityFactors: FoodInsecurityFactors = {
    ...factors,
    population,
  };
  
  const foodInsecurityScore = calculateFoodInsecurityScore(foodInsecurityFactors);
  const need = calculateNeed(population, foodInsecurityScore);
  
  return {
    centroidLat: lat,
    centroidLon: lon,
    population,
    foodInsecurityFactors,
    foodInsecurityScore,
    need,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
} 