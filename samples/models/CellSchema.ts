// Mongoose schema for Cell model
// This file is separate to avoid dependency issues if Mongoose is not installed

import { Schema, model, Document } from 'mongoose';
import { Cell, FoodInsecurityFactors, calculateFoodInsecurityScore, calculateNeed } from './Cell';

export interface CellDocument extends Omit<Cell, '_id'>, Document {}

const FoodInsecurityFactorsSchema = new Schema<FoodInsecurityFactors>({
  population: { 
    type: Number, 
    required: true,
    min: 0,
  },
  povertySnapRate: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 1,
    validate: {
      validator: (v: number) => v >= 0 && v <= 1,
      message: 'Poverty/SNAP rate must be between 0 and 1'
    }
  },
  distanceToNearestSupermarket: { 
    type: Number, 
    required: true, 
    min: 0,
    validate: {
      validator: (v: number) => v >= 0,
      message: 'Distance cannot be negative'
    }
  },
  vehicleAccessRate: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 1,
    validate: {
      validator: (v: number) => v >= 0 && v <= 1,
      message: 'Vehicle access rate must be between 0 and 1'
    }
  },
}, { _id: false });

const CellSchema = new Schema<CellDocument>({
  centroidLat: { 
    type: Number, 
    required: true,
    validate: {
      validator: (v: number) => v >= -90 && v <= 90,
      message: 'Latitude must be between -90 and 90'
    }
  },
  centroidLon: { 
    type: Number, 
    required: true,
    validate: {
      validator: (v: number) => v >= -180 && v <= 180,
      message: 'Longitude must be between -180 and 180'
    }
  },
  population: { 
    type: Number, 
    required: true,
    min: 0,
  },
  foodInsecurityFactors: { 
    type: FoodInsecurityFactorsSchema, 
    required: true 
  },
  foodInsecurityScore: { 
    type: Number, 
    required: true,
    min: 0,
    max: 10,
  },
  need: { 
    type: Number, 
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
  collection: 'cells',
});

// Add indexes for efficient querying
CellSchema.index({ centroidLat: 1, centroidLon: 1 });
CellSchema.index({ foodInsecurityScore: -1 }); // Descending for finding highest insecurity
CellSchema.index({ need: -1 }); // Descending for finding highest need

// Compound index for geospatial queries within a bounding box
CellSchema.index({ 
  centroidLat: 1, 
  centroidLon: 1, 
  foodInsecurityScore: -1 
});

// Pre-save hook to calculate scores
CellSchema.pre('save', function(next) {
  if (this.isModified('foodInsecurityFactors') || this.isModified('population') || this.isNew) {
    // Ensure population in factors matches cell population
    this.foodInsecurityFactors.population = this.population;
    
    // Calculate scores
    this.foodInsecurityScore = calculateFoodInsecurityScore(this.foodInsecurityFactors);
    this.need = calculateNeed(this.population, this.foodInsecurityScore);
  }
  next();
});

// Static method to find cells by insecurity level
CellSchema.statics.findByInsecurityLevel = function(minScore: number, maxScore: number) {
  return this.find({
    foodInsecurityScore: { $gte: minScore, $lte: maxScore }
  }).sort({ foodInsecurityScore: -1 });
};

// Static method to find cells within a geographic boundary
CellSchema.statics.findWithinBounds = function(
  minLat: number, 
  maxLat: number, 
  minLon: number, 
  maxLon: number
) {
  return this.find({
    centroidLat: { $gte: minLat, $lte: maxLat },
    centroidLon: { $gte: minLon, $lte: maxLon }
  });
};

// Instance method to get neighboring cells (simplified - assumes grid structure)
CellSchema.methods.getNeighboringCells = function(gridSize: number = 0.01) {
  const latRange = [this.centroidLat - gridSize, this.centroidLat + gridSize];
  const lonRange = [this.centroidLon - gridSize, this.centroidLon + gridSize];
  
  return this.model('Cell').find({
    centroidLat: { $gte: latRange[0], $lte: latRange[1] },
    centroidLon: { $gte: lonRange[0], $lte: lonRange[1] },
    _id: { $ne: this._id }
  });
};

export const CellModel = model<CellDocument>('Cell', CellSchema); 