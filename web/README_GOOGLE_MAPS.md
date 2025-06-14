# Google Maps Setup Instructions

To use Google Maps in this application, you need to obtain a Google Maps API key.

## Steps to get your API key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API (if needed for future features)
   - Geocoding API (if needed for future features)
4. Go to "Credentials" and create a new API key
5. (Optional) Restrict the API key to your domain for security

## Setting up the API key:

1. Create a `.env.local` file in the `web` directory
2. Add the following line:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
3. Replace `your_api_key_here` with your actual Google Maps API key
4. Restart the development server

## Important Notes:

- The API key should start with `NEXT_PUBLIC_` to be accessible in the browser
- Never commit your `.env.local` file to version control
- For production, set this environment variable in your deployment platform
- Google Maps API has usage limits and may incur charges beyond the free tier

## Troubleshooting:

If the map doesn't load:
1. Check the browser console for errors
2. Verify your API key is correct
3. Ensure the required APIs are enabled in Google Cloud Console
4. Check if your API key has the necessary permissions 