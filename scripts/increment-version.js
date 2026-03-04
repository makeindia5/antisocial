const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '../frontend/app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Increment versionCode
if (appJson.expo.android && typeof appJson.expo.android.versionCode === 'number') {
    const oldVersionCode = appJson.expo.android.versionCode;
    const newVersionCode = oldVersionCode + 1;
    appJson.expo.android.versionCode = newVersionCode;

    // Optional: Auto-increment patch version (e.g., 2.2.0 -\u003e 2.2.1)
    const versionParts = appJson.expo.version.split('.');
    if (versionParts.length === 3) {
        versionParts[2] = parseInt(versionParts[2]) + 1;
        appJson.expo.version = versionParts.join('.');
    }

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log(`✅ Version updated: ${appJson.expo.version} (Build ${newVersionCode})`);
} else {
    console.error('❌ Could not find valid versionCode in app.json');
    process.exit(1);
}
