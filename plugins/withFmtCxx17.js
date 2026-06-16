// Expo config plugin: build the `fmt` pod as C++17.
//
// Xcode 26.4 (Apple Clang 21) rejects fmt 11.0.2's consteval format-string
// checks ("call to consteval function ... is not a constant expression").
// fmt 11.0.2 is pinned by react-native 0.79.5. Compiling only the fmt pod as
// C++17 skips the consteval (C++20) path so fmt falls back to runtime format
// validation. Everything else stays C++20.
//
// This plugin re-injects the fix into the Podfile on every `expo prebuild`, so
// it survives `prebuild --clean` (which regenerates ios/Podfile from template).
// Drop this plugin once React Native ships a newer fmt that builds cleanly
// under the latest Xcode.

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "fmt C++17 fix (Xcode 26.4 consteval)";

const SNIPPET = `
    # ${MARKER}
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

const withFmtCxx17 = (config) => {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = fs.readFileSync(podfilePath, "utf8");

      // Idempotent: skip if already injected.
      if (contents.includes(MARKER)) {
        return config;
      }

      const anchor = "post_install do |installer|";
      if (contents.includes(anchor)) {
        contents = contents.replace(anchor, anchor + SNIPPET);
        fs.writeFileSync(podfilePath, contents);
      } else {
        console.warn(
          "[withFmtCxx17] post_install hook not found in Podfile; fmt C++17 fix was not applied."
        );
      }
      return config;
    },
  ]);
};

module.exports = withFmtCxx17;
