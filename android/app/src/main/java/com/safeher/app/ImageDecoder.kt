package com.safeher.app

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64

/** Decodes base64 images from the web layer, down-sampling large photos so they cannot exhaust memory. */
object ImageDecoder {
    const val MAX_BASE64_CHARS = 14_000_000
    private const val MAX_DIMENSION = 2400

    fun decode(base64: String): Bitmap? {
        return try {
            val raw = Base64.decode(base64, Base64.DEFAULT)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(raw, 0, raw.size, bounds)
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / sample > MAX_DIMENSION) sample *= 2
            val options = BitmapFactory.Options().apply { inSampleSize = sample }
            BitmapFactory.decodeByteArray(raw, 0, raw.size, options)
        } catch (e: IllegalArgumentException) {
            null
        } catch (e: OutOfMemoryError) {
            null
        }
    }
}
