package com.safeher.app

import android.os.SystemClock
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * On-device OCR using Google ML Kit Text Recognition (v2).
 *
 * The recognition models are bundled with the app, so this works offline and the image never
 * leaves the phone. The plugin returns exactly what the model produced; it never fabricates text.
 *
 * JS: `TextScanner.recognize({ base64, script?: 'latin' | 'devanagari' })`.
 */
@CapacitorPlugin(name = "TextScanner")
class TextScannerPlugin : Plugin() {

    private val worker: ExecutorService = Executors.newSingleThreadExecutor()

    @PluginMethod
    fun recognize(call: PluginCall) {
        val base64 = call.getString("base64")
        if (base64.isNullOrEmpty()) {
            call.reject("No image was supplied.", "NO_IMAGE")
            return
        }
        if (base64.length > ImageDecoder.MAX_BASE64_CHARS) {
            call.reject("The image is too large to scan. Try a smaller photo.", "IMAGE_TOO_LARGE")
            return
        }
        val script = call.getString("script", "latin")

        worker.execute {
            val started = SystemClock.elapsedRealtime()
            val bitmap = ImageDecoder.decode(base64)
            if (bitmap == null) {
                call.reject("The image could not be read. Choose a different photo.", "INVALID_IMAGE")
                return@execute
            }

            val recognizer: TextRecognizer = try {
                if (script == "devanagari") {
                    TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
                } else {
                    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
                }
            } catch (e: Exception) {
                bitmap.recycle()
                call.reject("Text recognition is not available on this device.", "UNSUPPORTED")
                return@execute
            }

            recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener { result ->
                    val blocks = JSArray()
                    var lineCount = 0
                    for (block in result.textBlocks) {
                        val lines = JSArray()
                        for (line in block.lines) {
                            lines.put(line.text)
                            lineCount++
                        }
                        val b = JSObject()
                        b.put("text", block.text)
                        b.put("lines", lines)
                        blocks.put(b)
                    }
                    val out = JSObject()
                    out.put("text", result.text)
                    out.put("blocks", blocks)
                    out.put("lineCount", lineCount)
                    out.put("elapsedMs", SystemClock.elapsedRealtime() - started)
                    out.put("engine", "Google ML Kit Text Recognition v2 (bundled, on-device)")
                    out.put("script", if (script == "devanagari") "devanagari" else "latin")
                    out.put("imageWidth", bitmap.width)
                    out.put("imageHeight", bitmap.height)
                    recognizer.close()
                    bitmap.recycle()
                    call.resolve(out)
                }
                .addOnFailureListener { e ->
                    recognizer.close()
                    bitmap.recycle()
                    call.reject("Text recognition failed: " + (e.message ?: "unknown error"), "RECOGNITION_FAILED")
                }
        }
    }

    override fun handleOnDestroy() {
        worker.shutdown()
        super.handleOnDestroy()
    }
}
