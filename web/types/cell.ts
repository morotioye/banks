export interface FoodInsecurityFactors {
  population: number;
  povertySnapRate: number;
  distanceToNearestSupermarket: number;
  vehicleAccessRate: number;
}

export interface Cell {
  _id?: string;
  centroidLat: number;
  centroidLon: number;
  population: number | null;
  foodInsecurityFactors: FoodInsecurityFactors | null;
  foodInsecurityScore: number | null;
  need: number | null;
  createdAt?: Date;
  updatedAt?: Date;
} 