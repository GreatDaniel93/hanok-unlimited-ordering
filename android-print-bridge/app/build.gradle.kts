plugins { id("com.android.application") }

android {
    namespace = "com.hanok.printbridge"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.hanok.printbridge"
        minSdk = 26
        targetSdk = 35
        versionCode = 10
        versionName = "1.10"
    }
    buildTypes { release { isMinifyEnabled = false } }
}
