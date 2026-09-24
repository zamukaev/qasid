const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const PLIST = "ios/QASID/Info.plist";
const PBXPROJ = "ios/QASID.xcodeproj/project.pbxproj";
const GRADLE = "android/app/build.gradle";

/**
 * Replaces a pattern that must occur an exact number of times. A version bump
 * that silently matches nothing is how 1.1.0 once queued a build as 1.0.0, so
 * a missed anchor has to fail the bump rather than pass quietly. The pattern
 * must be global, so that match() counts occurrences and not capture groups.
 */
function replaceExactly(contents, pattern, replacement, times, label) {
  const found = (contents.match(pattern) ?? []).length;
  if (found !== times) {
    throw new Error(`${label}: expected ${times} match(es), found ${found}`);
  }
  return contents.replace(pattern, replacement);
}

const version = JSON.parse(read("package.json")).version;

// app.json is read by expo-constants for the version shown in Settings. It is
// NOT what ships: ios/ and android/ are committed, so EAS builds the native
// projects and ignores app config for versioning.
const appJson = JSON.parse(read("app.json"));
appJson.expo.version = version;
const versionCode = (appJson.expo.android.versionCode ?? 0) + 1;
appJson.expo.android.versionCode = versionCode;

// iOS marketing version, in the plist and in both build configurations. The
// build number is deliberately untouched — eas.json sets appVersionSource to
// "remote", so EAS owns CFBundleVersion.
const plist = replaceExactly(
  read(PLIST),
  /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/g,
  `$1${version}$2`,
  1,
  `${PLIST} CFBundleShortVersionString`,
);

const pbxproj = replaceExactly(
  read(PBXPROJ),
  /MARKETING_VERSION = [^;]+;/g,
  `MARKETING_VERSION = ${version};`,
  2,
  `${PBXPROJ} MARKETING_VERSION`,
);

let gradle = replaceExactly(
  read(GRADLE),
  /versionName "[^"]*"/g,
  `versionName "${version}"`,
  1,
  `${GRADLE} versionName`,
);
gradle = replaceExactly(
  gradle,
  /versionCode \d+/g,
  `versionCode ${versionCode}`,
  1,
  `${GRADLE} versionCode`,
);

// Everything resolved — write only now, so a failed anchor above leaves the
// working tree untouched instead of half-bumped.
const write = (p, contents) => fs.writeFileSync(path.join(ROOT, p), contents);
write("app.json", JSON.stringify(appJson, null, 2) + "\n");
write(PLIST, plist);
write(PBXPROJ, pbxproj);
write(GRADLE, gradle);

console.log(`Version bumped to ${version} (versionCode: ${versionCode})`);
