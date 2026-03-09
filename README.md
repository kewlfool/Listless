# Listless

## Cordova iPhone Install (No App Store)

### Prerequisites
1. macOS with Xcode installed.
2. iPhone connected by cable (or wireless debugging enabled).
3. Apple ID added in Xcode (`Settings > Accounts`).
4. Notification permission allowed on device for this app.

### One-time setup
1. Install project dependencies:
```bash
npm install
```
2. Initialize Cordova wrapper + iOS platform + local notification plugin:
```bash
npm run cordova:init
```

### Build and prepare iOS wrapper
```bash
npm run cordova:prepare:ios
```

This does:
1. Builds the web app.
2. Copies build output (including `sounds/`) into `cordova-app/www`.
3. Prepares the iOS project in `cordova-app/platforms/ios`.

### Optional: Build with Cordova CLI
```bash
npm run cordova:build:ios
```

If code-signing is not configured yet, this command can fail. In that case, use Xcode workflow below.

### Open in Xcode and install to phone
1. Open workspace:
```bash
npm run cordova:open:ios
```
2. In Xcode:
1. Select the `App` target.
2. Set a unique `Bundle Identifier` if needed.
3. Under `Signing & Capabilities`, choose your Team.
4. Choose your connected iPhone as run target.
5. Press Run.

### Trust developer certificate on iPhone (first install)
1. `Settings > General > VPN & Device Management`
2. Trust your developer profile.

### Rebuild after app code changes
```bash
npm run cordova:prepare:ios
```
Then run again from Xcode.
