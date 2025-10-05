package com.mobile.battery

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.*

class BatteryOptModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "BatteryOptimization"

  @ReactMethod
  fun isIgnoringOptimizations(promise: Promise) {
    try {
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      val pkg = reactContext.packageName
      val ignoring = pm.isIgnoringBatteryOptimizations(pkg)
      promise.resolve(ignoring)
    } catch (e: Exception) {
      promise.reject("ERR_CHECK", e)
    }
  }

  /**
   * Opens the system dialog asking the user to allow ignoring optimizations for this app.
   * This does not return a result (system UI). You can re-check isIgnoringOptimizations later.
   */
  @ReactMethod
  fun requestIgnore() {
    try {
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${reactContext.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
    } catch (e: Exception) {
      // Fallback to the general settings screen if direct intent fails
      try {
        val alt = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(alt)
      } catch (_: Exception) {}
    }
  }

  /**
   * Opens the list screen so user can manually toggle apps.
   */
  @ReactMethod
  fun openSettings() {
    try {
      val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
    } catch (_: Exception) {}
  }
}
