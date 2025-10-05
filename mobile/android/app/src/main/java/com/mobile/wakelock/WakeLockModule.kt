package com.mobile.wakelock

import android.content.Context
import android.os.PowerManager
import com.facebook.react.bridge.*

class WakeLockModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var wakeLock: PowerManager.WakeLock? = null

  override fun getName(): String = "WakeLock"

  @ReactMethod
  fun acquire(promise: Promise) {
    try {
      if (wakeLock?.isHeld == true) {
        promise.resolve(true)
        return
      }
      val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
      // PARTIAL keeps CPU on while screen can be off
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FleetMS:OBD")
      wakeLock?.setReferenceCounted(false)
      wakeLock?.acquire()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WAKELOCK_ACQUIRE_FAILED", e)
    }
  }

  @ReactMethod
  fun release(promise: Promise) {
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
      wakeLock = null
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("WAKELOCK_RELEASE_FAILED", e)
    }
  }

  @ReactMethod
  fun isHeld(promise: Promise) {
    promise.resolve(wakeLock?.isHeld == true)
  }
}
