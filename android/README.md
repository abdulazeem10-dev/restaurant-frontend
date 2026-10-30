# Al-Madina Android app

This is a native Android shell around the Al-Madina customer website. It bundles the current website files into the app and loads them through AndroidX `WebViewAssetLoader` at the secure `https://appassets.androidplatform.net` origin. Existing backend requests continue to use the website's configured production API URL.

## Build a debug APK

1. Open the `android` folder in Android Studio and let Gradle sync.
2. Select **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
3. Android Studio writes the installable APK to `app/build/outputs/apk/debug/app-debug.apk`.

Or, from this folder, run `gradlew.bat assembleDebug` on Windows (or `./gradlew assembleDebug` on macOS/Linux). The `syncWebsiteAssets` Gradle task copies the repository's current website files into the APK at build time. The generated asset copy is ignored by Git so website code remains the single source of truth.

The app requires Android 8.1 (API 27) or newer. Location is only requested when the website invokes location features. Website content has JavaScript and DOM storage enabled; local file/content access, cleartext networking, and mixed HTTP content are disabled.

Google sign-in providers may refuse authentication in embedded WebViews. For release use, configure the identity provider's supported Android OAuth flow or open authentication in a system browser and return through an app link.
