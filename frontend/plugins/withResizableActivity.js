const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Config plugin that sets android:resizeableActivity="true" on the MainActivity
 * while explicitly keeping android:screenOrientation="portrait".
 *
 * This satisfies Google Play's large-screen / resizability checks (suppressing
 * the Play Console warning) WITHOUT allowing the UI to rotate — the app stays
 * locked to portrait exactly as before.
 */
module.exports = function withResizableActivity(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults.manifest;
        const application = manifest.application?.[0];

        if (!application) return config;

        // Declare resizability at the application level
        application.$['android:resizeableActivity'] = 'true';

        const activities = application.activity || [];
        const mainActivity = activities.find(
            (a) =>
                a.$?.['android:name'] === '.MainActivity' ||
                a.$?.['android:name']?.includes('MainActivity')
        );

        if (mainActivity) {
            // Keep the app resizable (satisfies Play Console large-screen policy)
            mainActivity.$['android:resizeableActivity'] = 'true';
            // Explicitly pin portrait so the UI never rotates
            mainActivity.$['android:screenOrientation'] = 'portrait';
        }

        return config;
    });
};
