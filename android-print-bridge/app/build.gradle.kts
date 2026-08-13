plugins { id("com.android.application") }

android {
    namespace = "com.hanok.printbridge"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.hanok.printbridge"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1-test"
    }
    buildTypes { release { isMinifyEnabled = false } }
}
