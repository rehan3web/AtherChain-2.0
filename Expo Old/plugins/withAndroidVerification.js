const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const VERIFICATION_SNIPPET = "DNTB2GEUY4PEIAAAAAAAAAAAAA";

module.exports = function withAndroidVerification(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const assetsDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "assets"
      );

      fs.mkdirSync(assetsDir, { recursive: true });

      const filePath = path.join(
        assetsDir,
        "adi-registration.properties"
      );

      fs.writeFileSync(
        filePath,
        VERIFICATION_SNIPPET,
        "ascii"
      );

      console.log("[AtherChain] Google verification file generated.");

      return config;
    },
  ]);
};
