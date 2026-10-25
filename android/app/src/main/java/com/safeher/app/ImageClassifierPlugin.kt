package com.safeher.app

import android.os.SystemClock
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * On-device image classification using Google ML Kit Image Labeling (bundled model).
 *
 * It returns general-purpose labels ("Street", "Car", "Person", ...) with the model's confidence.
 * It does NOT judge whether a scene is dangerous: the app only shows what the model reported.
 * The model ships inside the APK, so this works offline and the image never leaves the phone.
 *
 * JS: `ImageClassifier.classify({ base64, minConfidence? })`.
 */
@CapacitorPlugin(name = "ImageClassifier")
class ImageClassifierPlugin : Plugin() {

    private val worker: ExecutorService = Executors.newSingleThreadExecutor()

    @PluginMethod
    fun classify(call: PluginCall) {
        val base64 = call.getString("base64")
        if (base64.isNullOrEmpty()) {
            call.reject("No image was supplied.", "NO_IMAGE")
            return
        }
        if (base64.length > ImageDecoder.MAX_BASE64_CHARS) {
            call.reject("The image is too large to analyse. Try a smaller photo.", "IMAGE_TOO_LARGE")
            return
        }
        val threshold = (call.getFloat("minConfidence", 0.5f) ?: 0.5f).coerceIn(0.05f, 0.95f)

        worker.execute {
            val started = SystemClock.elapsedRealtime()
            val bitmap = ImageDecoder.decode(base64)
            if (bitmap == null) {
                call.reject("The image could not be read. Choose a different photo.", "INVALID_IMAGE")
                return@execute
            }
            val labeler = try {
                ImageLabeling.getClient(ImageLabelerOptions.Builder().setConfidenceThreshold(threshold).build())
            } catch (e: Exception) {
                bitmap.recycle()
                call.reject("Image classification is not available on this device.", "UNSUPPORTED")
                return@execute
            }

            labeler.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener { labels ->
                    val items = JSArray()
                    for (label in labels.sortedByDescending { it.confidence }.take(MAX_LABELS)) {
                        val item = JSObject()
                        item.put("label", label.text)
                        item.put("confidence", label.confidence.toDouble())
                        items.put(item)
                    }
                    val out = JSObject()
                    out.put("labels", items)
                    out.put("elapsedMs", SystemClock.elapsedRealtime() - started)
                    out.put("engine", "Google ML Kit Image Labeling (bundled model, on-device)")
                    out.put("imageWidth", bitmap.width)
                    out.put("imageHeight", bitmap.height)
                    labeler.close()
                    bitmap.recycle()
                    call.resolve(out)
                }
                .addOnFailureListener { e ->
                    labeler.close()
                    bitmap.recycle()
                    call.reject("Image classification failed: " + (e.message ?: "unknown error"), "CLASSIFICATION_FAILED")
                }
        }
    }

    override fun handleOnDestroy() {
        worker.shutdown()
        super.handleOnDestroy()
    }

    companion object {
        private const val MAX_LABELS = 10
    }
}
