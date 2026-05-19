const fs = require("fs");
const path = require("path");

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
const appJsonPath = path.resolve(__dirname, "../app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

appJson.expo.version = pkg.version;
appJson.expo.ios.buildNumber = pkg.version;
appJson.expo.android.versionCode = (appJson.expo.android.versionCode ?? 0) + 1;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");
console.log(`Version bumped to ${pkg.version} (versionCode: ${appJson.expo.android.versionCode})`);
