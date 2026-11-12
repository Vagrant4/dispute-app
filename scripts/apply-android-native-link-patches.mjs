import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const patches = [
  {
    file: "node_modules/expo-modules-core/android/cmake/main.cmake",
    before: `target_link_libraries(\n  expo-modules-core\n  PRIVATE\n  \${LOG_LIB}`,
    after: `target_link_libraries(\n  expo-modules-core\n  PRIVATE\n  c++_shared\n  \${LOG_LIB}`,
  },
  {
    file: "node_modules/react-native/ReactAndroid/cmake-utils/ReactNative-application.cmake",
    before: `target_link_libraries(\${CMAKE_PROJECT_NAME}\n        fbjni`,
    after: `target_link_libraries(\${CMAKE_PROJECT_NAME}\n        c++_shared\n        fbjni`,
  },
  {
    file: "node_modules/react-native-safe-area-context/android/src/main/jni/CMakeLists.txt",
    before: `target_link_libraries(\n          \${LIB_TARGET_NAME}\n          fbjni`,
    after: `target_link_libraries(\n          \${LIB_TARGET_NAME}\n          c++_shared\n          fbjni`,
  },
];

for (const patch of patches) {
  const file = resolve(patch.file);
  const source = readFileSync(file, "utf8");
  if (source.includes(patch.after)) {
    console.log(`[android-link-patch] already applied: ${patch.file}`);
    continue;
  }
  if (!source.includes(patch.before)) {
    throw new Error(`[android-link-patch] expected source not found: ${patch.file}`);
  }
  writeFileSync(file, source.replace(patch.before, patch.after));
  console.log(`[android-link-patch] applied: ${patch.file}`);
}
