plugins { id("com.android.application") }

android {
    namespace = "com.hanok.printbridge"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.hanok.printbridge"
        minSdk = 26
        targetSdk = 35
        versionCode = 6
        versionName = "1.6"
    }
    buildTypes { release { isMinifyEnabled = false } }
}
