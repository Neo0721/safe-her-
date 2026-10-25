#!/usr/bin/env python3
"""
Generates a styled, academic DOCX document from the audit findings.
"""
import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_report():
    doc = Document()

    # Page Margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Style definitions
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(0x22, 0x22, 0x22)

    # 1. Title Page / Header Block
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_inst = p_inst.add_run("FR. C. RODRIGUES INSTITUTE OF TECHNOLOGY, VASHI\n")
    run_inst.font.size = Pt(14)
    run_inst.font.bold = True
    run_inst.font.color.rgb = RGBColor(0x11, 0x18, 0x27)

    run_dept = p_inst.add_run("DEPARTMENT OF COMPUTER ENGINEERING\n")
    run_dept.font.size = Pt(12)
    run_dept.font.bold = True
    run_dept.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

    run_course = p_inst.add_run("CELBC507: Application Development Lab | Semester V\n\n")
    run_course.font.size = Pt(11)
    run_course.font.italic = True
    run_course.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_title = p_title.add_run("Implementation Audit of SafeHer Against\nApplication Development Lab Experiments 5–10\n")
    run_title.font.size = Pt(18)
    run_title.font.bold = True
    run_title.font.color.rgb = RGBColor(0x6D, 0x28, 0xD9) # Deep purple accent

    p_meta = doc.add_paragraph()
    p_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_meta = p_meta.add_run("Project: SafeHer (Personal Women Safety Mobile Application)\nAudit Date: October 19, 2026\nStatus: Comprehensive Technical Audit Report\n")
    run_meta.font.size = Pt(10)
    run_meta.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    doc.add_paragraph("―" * 55).alignment = WD_ALIGN_PARAGRAPH.CENTER

    # 2. Executive Summary
    h1 = doc.add_heading("1. Executive Summary", level=1)
    h1.style.font.color.rgb = RGBColor(0x4C, 0x1D, 0x95)
    doc.add_paragraph(
        "This audit report presents a rigorous, evidence-based technical evaluation of the SafeHer codebase against "
        "the curriculum specifications of Application Development Lab (CELBC507) Experiments 5 through 10. "
        "SafeHer is architected as a hybrid personal-safety mobile application combining an Android native shell (Capacitor v8.5) "
        "with an embedded dynamic Next.js 16 (React 19) web layer, Firebase Authentication, and a local SQLite 3 (better-sqlite3) "
        "database with Write-Ahead Logging (WAL).\n\n"
        "The audit inspected source code, AndroidManifest.xml, Gradle configurations, native Java plugins/services, "
        "Next.js API route handlers, UI components, database schemas, and background execution triggers. "
        "Every classification is supported by technical file paths, line references, and runtime test outputs."
    )

    # 3. Architecture Overview
    h2 = doc.add_heading("2. System Architecture & Tech Stack", level=1)
    h2.style.font.color.rgb = RGBColor(0x4C, 0x1D, 0x95)
    doc.add_paragraph(
        "SafeHer employs a layered hybrid architecture:\n"
        "• Mobile Container: Capacitor Android 8.5.0 with compileSdk 35 and Java 21.\n"
        "• Native Services: PowerTriggerService (Foreground Service) for power-button press detection and BootReceiver.\n"
        "• Frontend / Presentation: Next.js 16.2.12 (App Router), React 19, Tailwind CSS v4, Lucide icons.\n"
        "• Geolocation & Mapping: Leaflet 1.9.4 with OpenStreetMap raster tiles, @capacitor/geolocation 8.2.2.\n"
        "• Multimedia Capture: W3C MediaRecorder API, HTML5 Audio HAL, Android RECORD_AUDIO permission.\n"
        "• Backend & Storage: Next.js API Routes (app/api/*), Firebase Admin SDK 10.3.0, SQLite 3 (better-sqlite3)."
    )

    # 4. Consolidated Audit Table
    h3 = doc.add_heading("3. Consolidated Audit Summary Table", level=1)
    h3.style.font.color.rgb = RGBColor(0x4C, 0x1D, 0x95)

    table_data = [
        ("Exp. #", "Experiment Title", "Key Requirements", "SafeHer Implementation Evidence", "Classification"),
        ("Exp 5", "Network Connectivity & REST APIs", "Internet permission, GET/POST requests, Async handling, JSON UI display", "Manifest INTERNET permission; Full Next.js REST API (/api/*); apiFetch async wrapper; Reactive JSON binding in contacts & history", "IMPLEMENTED AND VERIFIED"),
        ("Exp 6", "Google Maps and Navigation", "Google Maps SDK, API key, Location permissions, Map rendering, Markers, Navigation", "Leaflet 1.9.4 + OSM substitution; No API key required; Location permissions; L.circleMarker & route polylines; Leaflet zoom/pan; External Google Maps SMS link", "PARTIALLY IMPLEMENTED"),
        ("Exp 7", "Network, Multimedia, and GPS", "Runtime permissions (location, camera, mic), GPS retrieval, Media capture/playback, Network data transmission", "Fine/coarse GPS via @capacitor/geolocation; Audio recording via MediaRecorder & playback; GPS streamed to /api/location; Camera disabled; Audio stored locally", "PARTIALLY IMPLEMENTED"),
        ("Exp 8", "AI Chatbot", "Chat UI, Gemini/OpenAI API integration, Async requests, Dynamic response display", "No chat interface, no LLM SDKs, no AI backend endpoints, no conversational history in codebase", "NOT IMPLEMENTED"),
        ("Exp 9", "Machine Learning", "Google ML Kit / TFLite, Camera/gallery input, OCR or object detection inference, Output display", "No ML Kit / TFLite dependencies, no camera input pipeline, no image inference algorithms present", "NOT IMPLEMENTED"),
        ("Exp 10", "AI Alerts and Notifications", "Notification permissions (Android 13+), Channels, Priority, Background service, AI anomaly detection", "POST_NOTIFICATIONS runtime check; High/Low priority channels; Foreground Service + BroadcastReceiver; Full-screen intent; Deterministic toggle counter (No AI)", "PARTIALLY IMPLEMENTED"),
    ]

    table = doc.add_table(rows=len(table_data), cols=5)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    col_widths = [Inches(0.6), Inches(1.5), Inches(1.6), Inches(1.9), Inches(1.4)]

    for row_idx, row in enumerate(table.rows):
        is_header = (row_idx == 0)
        for col_idx, cell in enumerate(row.cells):
            cell.width = col_widths[col_idx]
            cell.text = table_data[row_idx][col_idx]
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 4] else WD_ALIGN_PARAGRAPH.LEFT
            run = p.runs[0]
            run.font.size = Pt(9.5 if not is_header else 10)

            if is_header:
                run.font.bold = True
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                set_cell_background(cell, "4C1D95") # Deep Purple header
            else:
                status = table_data[row_idx][4]
                if col_idx == 4:
                    run.font.bold = True
                    if "VERIFIED" in status and "PARTIALLY" not in status:
                        set_cell_background(cell, "DCFCE7") # Light Green
                        run.font.color.rgb = RGBColor(0x16, 0x65, 0x34)
                    elif "PARTIALLY" in status:
                        set_cell_background(cell, "FEF3C7") # Light Amber
                        run.font.color.rgb = RGBColor(0x92, 0x40, 0x0E)
                    else:
                        set_cell_background(cell, "FEE2E2") # Light Red
                        run.font.color.rgb = RGBColor(0x99, 0x1B, 0x1B)
                else:
                    set_cell_background(cell, "F9FAFB" if row_idx % 2 == 0 else "FFFFFF")
            set_cell_margins(cell, top=120, bottom=120, left=140, right=140)

    doc.add_paragraph()

    # 5. Detailed Findings for Each Experiment
    h4 = doc.add_heading("4. Experiment-by-Experiment Detailed Findings", level=1)
    h4.style.font.color.rgb = RGBColor(0x4C, 0x1D, 0x95)

    experiments = [
        {
            "id": "Experiment 5: Network Connectivity and REST APIs",
            "status": "IMPLEMENTED AND VERIFIED",
            "aim": "To configure mobile network connectivity, implement asynchronous HTTP GET and POST requests against RESTful endpoints, and parse and display structured JSON responses.",
            "manifest": "android.permission.INTERNET (Line 58), android.permission.ACCESS_NETWORK_STATE (Line 59) in AndroidManifest.xml.",
            "tech": "Next.js App Router REST API (app/api/health, app/api/contacts, app/api/sos, app/api/location, app/api/history). Centralized async fetch wrapper in lib/api-fetch.ts with Firebase Bearer token authorization.",
            "ui": "Reactive data binding in app/contacts/page.tsx (emergency contacts), app/history/page.tsx (SOS activity log), and use-device-status.ts (network reachability).",
            "tests": "curl -s http://127.0.0.1:3000/api/health returned HTTP 200 OK with database: ok, auth: configured. ESLint passed with 0 errors. E2E test harness in scripts/test-api.mjs."
        },
        {
            "id": "Experiment 6: Google Maps and Navigation",
            "status": "PARTIALLY IMPLEMENTED",
            "aim": "To integrate mapping and navigation capabilities, configure API keys and permissions, render interactive maps with custom markers and coordinates, and control camera movements.",
            "manifest": "android.permission.ACCESS_FINE_LOCATION (Line 63), android.permission.ACCESS_COARSE_LOCATION (Line 62).",
            "tech": "SafeHer substitutes native Google Maps SDK with Leaflet v1.9.4 and OpenStreetMap (OSM) tile rendering in components/map-view.tsx. No Google Maps API key required. L.circleMarker custom marker, accuracy circle, and route polyline tracking implemented.",
            "ui": "Live map tracking in app/tracking/page.tsx and historical breadcrumbs in app/history/page.tsx. Camera controls via Leaflet setView, panBy, fitBounds, and zoom.",
            "tests": "Inspected SQLite database: 20 verified coordinates recorded (Navi Mumbai coordinates: 19.074, 72.9915). Turn-by-turn navigation is not implemented, but external Google Maps query URLs are generated for emergency SMS."
        },
        {
            "id": "Experiment 7: Network, Multimedia, and GPS",
            "status": "PARTIALLY IMPLEMENTED",
            "aim": "To capture device GPS and multimedia data (audio/camera), manage runtime permissions across Android versions, and transmit location and media over the network.",
            "manifest": "Location (FINE/COARSE) and RECORD_AUDIO (Line 67) permissions declared. CAMERA permission is omitted, and Permissions-Policy: camera=() header explicitly forbids camera.",
            "tech": "Real GPS coordinate retrieval via @capacitor/geolocation (enableHighAccuracy: true). Audio recording via W3C MediaRecorder API with Opus/WebM encoding and HTML5 <audio> playback.",
            "ui": "Permissions page (app/permissions/page.tsx) and Emergency screen (app/emergency/page.tsx). Location fixes are streamed via POST /api/location with offline buffering. Audio is retained in memory and not uploaded to server.",
            "tests": "Verified audio recording pipeline and database ingestion of GPS fixes. Absence of camera capture and remote audio upload confirmed."
        },
        {
            "id": "Experiment 8: AI Chatbot",
            "status": "NOT IMPLEMENTED",
            "aim": "To develop an AI Chatbot utilizing modern LLM APIs (Gemini/OpenAI) with asynchronous message exchange, conversational history, and dynamic response parsing.",
            "manifest": "None.",
            "tech": "No LLM client libraries (@google/genai, openai) declared in package.json. No chat interface, message history container, or AI proxy routes found in codebase.",
            "ui": "No conversational UI screen present.",
            "tests": "Global grep for gemini, openai, chat, bot returned zero results across the repository."
        },
        {
            "id": "Experiment 9: Machine Learning",
            "status": "NOT IMPLEMENTED",
            "aim": "To integrate machine learning frameworks (such as Google ML Kit or TensorFlow Lite) for on-device computer vision tasks like OCR or object detection.",
            "manifest": "None.",
            "tech": "No ML dependencies in build.gradle or package.json. Camera hardware is explicitly disabled in HTTP headers, preventing image acquisition.",
            "ui": "No OCR or object detection components present.",
            "tests": "Global grep for mlkit, tensorflow, tflite returned zero matches. Absence of ML dependencies verified in build configurations."
        },
        {
            "id": "Experiment 10: AI Alerts and Notifications",
            "status": "PARTIALLY IMPLEMENTED",
            "aim": "To design an intelligent notification system with priority channels, background scheduling, and AI-driven condition/anomaly detection triggers.",
            "manifest": "POST_NOTIFICATIONS (Line 73), FOREGROUND_SERVICE (Line 71), WAKE_LOCK, VIBRATE, RECEIVE_BOOT_COMPLETED.",
            "tech": "Dual notification channels (CHANNEL_PROTECTION, CHANNEL_ALERT) configured in PowerTriggerService.java. High-priority heads-up alert with setFullScreenIntent. Foreground Service with BroadcastReceiver for background execution.",
            "ui": "Trigger logic is a deterministic sliding-window counter monitoring screen on/off toggles (3-6 presses within 2-10s window). No AI or machine learning anomaly detection is implemented. WorkManager is absent.",
            "tests": "Verified native service compilation and channel creation in PowerTriggerService.java."
        }
    ]

    for exp in experiments:
        h_exp = doc.add_heading(exp["id"], level=2)
        h_exp.style.font.color.rgb = RGBColor(0x5B, 0x21, 0xB6)

        p_stat = doc.add_paragraph()
        run_st = p_stat.add_run(f"Audit Status: {exp['status']}")
        run_st.bold = True
        if "VERIFIED" in exp["status"] and "PARTIALLY" not in exp["status"]:
            run_st.font.color.rgb = RGBColor(0x16, 0x65, 0x34)
        elif "PARTIALLY" in exp["status"]:
            run_st.font.color.rgb = RGBColor(0x92, 0x40, 0x0E)
        else:
            run_st.font.color.rgb = RGBColor(0x99, 0x1B, 0x1B)

        doc.add_paragraph(f"• Aim: {exp['aim']}")
        doc.add_paragraph(f"• Manifest & Permissions: {exp['manifest']}")
        doc.add_paragraph(f"• Technical Architecture: {exp['tech']}")
        doc.add_paragraph(f"• User Interface Integration: {exp['ui']}")
        doc.add_paragraph(f"• Verification Evidence: {exp['tests']}")
        doc.add_paragraph()

    # 6. Missing Features & Recommendations
    h5 = doc.add_heading("5. Missing Features and Academic Recommendations", level=1)
    h5.style.font.color.rgb = RGBColor(0x4C, 0x1D, 0x95)
    doc.add_paragraph(
        "To achieve 100% academic compliance with Experiments 5–10, the following modules are recommended:\n\n"
        "1. Experiment 8 (AI Chatbot):\n"
        "   - Create a dedicated conversational route (/safety-assistant) in Next.js.\n"
        "   - Integrate @google/genai or OpenAI SDK with streaming response parsing.\n"
        "   - Provide pre-configured safety advisory prompts (e.g., self-defense advice, distress de-escalation).\n\n"
        "2. Experiment 9 (Machine Learning):\n"
        "   - Enable camera access and integrate Google ML Kit Text Recognition (OCR).\n"
        "   - Implement ID / Medical Card scanning to automatically extract user name, blood group, and emergency contact details.\n\n"
        "3. Experiment 10 (AI Alerts & Anomaly Detection):\n"
        "   - Implement an accelerometer/gyroscope sensor listener with a threshold or ML anomaly detection model for fall detection.\n"
        "   - Add an Android WorkManager periodic worker for background safety status checks.\n\n"
        "4. Experiment 6 (Navigation):\n"
        "   - Integrate OpenRouteService or OSRM client-side routing into MapView to display turn-by-turn walking paths to safe havens."
    )

    # 7. Conclusion
    h6 = doc.add_heading("6. Conclusion", level=1)
    h6.style.font.color.rgb = RGBColor(0x4C, 0x1D, 0x95)
    doc.add_paragraph(
        "The SafeHer application provides an exemplary real-world architecture for personal safety, demonstrating production-level "
        "strengths in REST API networking, local SQLite database management, and low-latency native power-button triggering.\n\n"
        "For academic lab evaluation:\n"
        "• Experiment 5 is fully IMPLEMENTED AND VERIFIED.\n"
        "• Experiments 6, 7, and 10 are PARTIALLY IMPLEMENTED with production substitutions.\n"
        "• Experiments 8 and 9 are NOT IMPLEMENTED.\n\n"
        "This audit report provides an objective, transparent, and comprehensive assessment for submission to Fr. C. Rodrigues Institute of Technology."
    )

    out_path = "/Users/neonisenpalathingal/Documents/TY/women-s-safety-application/SafeHer_Experiments_5_to_10_Audit_Report.docx"
    doc.save(out_path)
    print(f"Report successfully saved to {out_path}")

if __name__ == '__main__':
    create_report()
