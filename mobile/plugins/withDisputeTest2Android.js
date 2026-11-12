const { withAppBuildGradle } = require("expo/config-plugins");

const TEST_KEYSTORE_PATH = "C:/Users/User 2024/signing-backup/dispute-test/debug-9f10-2026-11-12.keystore";
const TEST_CERT_SHA256 = "9F:10:13:15:7C:43:59:C4:2D:DB:82:AD:2F:55:1B:BD:4C:F4:93:D4:58:09:11:4E:0E:FD:E3:8A:77:D6:89:A6";

const injectedGradle = `

// Re-applied by plugins/withDisputeTest2Android.js after Expo prebuild.
android {
    signingConfigs {
        debug {
            storeFile file("${TEST_KEYSTORE_PATH}")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }
    buildTypes {
        debug {
            applicationIdSuffix ".test2"
            versionNameSuffix "-test"
            resValue "string", "app_name", "DISPUTE Test 2"
            signingConfig signingConfigs.debug
        }
        internal {
            initWith release
            applicationIdSuffix ".test2"
            versionNameSuffix "-test"
            resValue "string", "app_name", "DISPUTE Test 2"
            signingConfig signingConfigs.debug
            matchingFallbacks = ["release"]
        }
    }
}

def disputeTest2ExpectedCertSha256 = "${TEST_CERT_SHA256}"
def disputeTest2ApkVerifier = { String buildType ->
    tasks.register("verify\${buildType.capitalize()}Signing") {
        doLast {
            def apk = layout.buildDirectory.file("outputs/apk/\${buildType}/app-\${buildType}.apk").get().asFile
            if (!apk.isFile()) {
                throw new GradleException("Expected \${buildType} APK was not produced: \${apk}")
            }
            def executableName = System.getProperty("os.name").toLowerCase().contains("windows") ? "apksigner.bat" : "apksigner"
            def apksigner = new File(android.sdkDirectory, "build-tools/\${android.buildToolsVersion}/\${executableName}")
            if (!apksigner.isFile()) {
                throw new GradleException("apksigner was not found at \${apksigner}")
            }
            def process = new ProcessBuilder(apksigner.absolutePath, "verify", "--print-certs", apk.absolutePath)
                .redirectErrorStream(true)
                .start()
            def output = process.inputStream.getText("UTF-8")
            if (process.waitFor() != 0 || !output.toUpperCase().contains("SHA-256 DIGEST: \${disputeTest2ExpectedCertSha256.replace(':', '')}")) {
                throw new GradleException("\${buildType} APK signing certificate SHA-256 did not match the pinned test certificate.")
            }
        }
    }
}
disputeTest2ApkVerifier("debug")
disputeTest2ApkVerifier("internal")
tasks.configureEach {
    if (name == "assembleDebug") finalizedBy "verifyDebugSigning"
    if (name == "assembleInternal") finalizedBy "verifyInternalSigning"
}
`;

module.exports = function withDisputeTest2Android(config) {
  return withAppBuildGradle(config, (config) => {
    const marker = "// Re-applied by plugins/withDisputeTest2Android.js after Expo prebuild.";
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += injectedGradle;
    }
    return config;
  });
};
