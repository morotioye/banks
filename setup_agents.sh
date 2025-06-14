#!/bin/bash

echo "🚀 Setting up Food Bank Optimization Agents"
echo "=========================================="

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install agent dependencies
echo "📦 Installing location agent dependencies..."
pip install -r agents/location_agent/requirements.txt

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# MongoDB Configuration
MONGO_DB_URI=mongodb://localhost:27017/
DB_NAME=testbank

# Python Path (update if needed)
PYTHON_PATH=python3

# Agent Configuration
MAX_CONCURRENT_AGENTS=6
RESULT_OUTPUT_DIR=./results
EOL
    echo "✅ .env file created. Please update with your MongoDB URI if needed."
else
    echo "✅ .env file already exists"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the optimization system:"
echo "1. Make sure MongoDB is running"
echo "2. Start the Next.js development server: cd web && npm run dev"
echo "3. The optimization button will appear when you select a domain"
echo ""
echo "Note: The system currently uses a mock API for testing."
echo "To use the real Python backend, update the API endpoints in OptimizationPanel.tsx" 