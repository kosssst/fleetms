# Fleet Management Mobile App

This is a mobile application for the Fleet Management system, built with React Native and Expo.

## Prerequisites

- Node.js (LTS version)
- Expo CLI
- An iOS simulator or Android emulator

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the Metro bundler:**
   ```bash
   npx expo start
   ```

3. **Run on a simulator or device:**
   - Press `i` to run on the iOS simulator.
   - Press `a` to run on the Android emulator.
   - Scan the QR code with the Expo Go app on your physical device.

## Backend Configuration

The mobile app's API endpoint is configured in `src/config/api.ts`. If your backend is running on a different URL, you'll need to update the `API_URL` constant in this file.
