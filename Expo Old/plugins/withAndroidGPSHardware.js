const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidGPSHardware(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    if (!androidManifest['uses-feature']) {
      androidManifest['uses-feature'] = [];
    }

    // Add or update android.hardware.location.gps
    const hasGpsFeature = androidManifest['uses-feature'].find(
      (item) => item.$['android:name'] === 'android.hardware.location.gps'
    );

    if (!hasGpsFeature) {
      androidManifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.location.gps',
          'android:required': 'false',
        },
      });
    } else {
      hasGpsFeature.$['android:required'] = 'false';
    }
    
    // Also add android.hardware.location required false for good measure
    const hasLocationFeature = androidManifest['uses-feature'].find(
      (item) => item.$['android:name'] === 'android.hardware.location'
    );

    if (!hasLocationFeature) {
      androidManifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.location',
          'android:required': 'false',
        },
      });
    } else {
      hasLocationFeature.$['android:required'] = 'false';
    }

    return config;
  });
};
