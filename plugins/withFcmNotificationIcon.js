// Expo config plugin: configure the default Android notification icon/color
// for FCM background notifications.
//
// This project uses @react-native-firebase/messaging directly (not
// expo-notifications), so none of expo-notifications' automatic notification
// icon generation/injection applies. Without an explicit
// com.google.firebase.messaging.default_notification_icon meta-data entry,
// some OEM skins fail to resolve a usable icon for background push and fall
// back to a generic system icon. Pointing it at the existing app icon with
// the brand gold tint keeps behavior consistent across devices.

const { withAndroidManifest, withAndroidColors, AndroidConfig } = require("@expo/config-plugins");

const NOTIFICATION_COLOR_NAME = "notification_icon_color";
const NOTIFICATION_COLOR_VALUE = "#C9A84C"; // qasid-gold

const withFcmNotificationIcon = (config) => {
  config = withAndroidColors(config, (config) => {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name: NOTIFICATION_COLOR_NAME,
      value: NOTIFICATION_COLOR_VALUE,
    });
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults
    );

    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      "com.google.firebase.messaging.default_notification_icon",
      "@mipmap/ic_launcher",
      "resource"
    );
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApplication,
      "com.google.firebase.messaging.default_notification_color",
      `@color/${NOTIFICATION_COLOR_NAME}`,
      "resource"
    );

    return config;
  });

  return config;
};

module.exports = withFcmNotificationIcon;
