// Expo config plugin: build the `fmt` pod as C++17.
//
// Xcode 26.4 (Apple Clang 21) rejects fmt 11.0.2's consteval format-string
// checks ("call to consteval function ... is not a constant expression").
// fmt 11.0.2 is pinned by react-native 0.79.5. Compiling only the fmt pod as
// C++17 skips the consteval (C++20) path so fmt falls back to runtime format
// validation. Everything else stays C++20.
//
// IMPORTANT: the override must run AFTER react_native_post_install. Under the
// New Architecture, react_native_post_install calls
// set_clang_cxx_language_standard_if_needed, which force-sets
// CLANG_CXX_LANGUAGE_STANDARD = c++20 on EVERY pod target (including fmt). If we
// inject before that call (as the original version did), RN overwrites our
// c++17 back to c++20 and the build breaks again. So we anchor the injection to
// the end of the react_native_post_install(...) call.
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
    # ${MARKER} — MUST run after react_native_post_install (which under New Arch
    # forces every pod target to CLANG_CXX_LANGUAGE_STANDARD = c++20).
    installer.pods_project.targets.each do |target|
      next unless target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
`;

// Anchor = the closing of the react_native_post_install(...) call in the Expo
// Podfile template. Injecting our snippet right after it guarantees the fmt
// override runs last and wins.
const ANCHOR =
  "      :ccache_enabled => podfile_properties['apple.ccacheEnabled'] == 'true',\n    )";

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

      if (contents.includes(ANCHOR)) {
        contents = contents.replace(ANCHOR, ANCHOR + "\n" + SNIPPET);
        fs.writeFileSync(podfilePath, contents);
      } else {
        console.warn(
          "[withFmtCxx17] react_native_post_install anchor not found in Podfile; fmt C++17 fix was not applied."
        );
      }
      return config;
    },
  ]);
};

module.exports = withFmtCxx17;
