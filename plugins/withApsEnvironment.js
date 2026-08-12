// Expo config plugin: set the iOS `aps-environment` entitlement per build.
//
// Push notifications need aps-environment=development for local Xcode debug
// builds, but ad-hoc (preview) and App Store (production) builds are signed
// with a distribution profile that only supports aps-environment=production —
// a mismatch here breaks code signing or silently drops push delivery.
//
// Controlled via the APS_ENVIRONMENT env var (set per-profile in eas.json).
// Defaults to "development" so local `expo run:ios` / dev-client builds keep
// working without extra setup. This plugin re-applies the value on every
// `expo prebuild`, so it survives `prebuild --clean` instead of relying on a
// hand-edited ios/QASID/QASID.entitlements file.

const { withEntitlementsPlist } = require("@expo/config-plugins");

const withApsEnvironment = (config) => {
  return withEntitlementsPlist(config, (config) => {
    config.modResults["aps-environment"] =
      process.env.APS_ENVIRONMENT === "production" ? "production" : "development";
    return config;
  });
};

module.exports = withApsEnvironment;
