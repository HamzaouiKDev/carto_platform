import os
import re
import time
import json

LOG_PATH = r'C:\Users\khaled.hamzaoui\.gemini\antigravity-ide\brain\482ff7b8-c165-4a75-b3b7-3c63c948829f\.system_generated\tasks\task-654.log'
STATUS_PATH = r'e:\carto_platform\progress_status.json'
AUTO_PILOT_LOG = r'e:\carto_platform\auto_pilot.log'

def update_loop():
    last_line = ""
    while True:
        try:
            if os.path.exists(LOG_PATH):
                with open(LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = [l.strip() for l in f.readlines() if l.strip()]
                    if lines:
                        latest = lines[-1]
                        if latest != last_line:
                            last_line = latest
                            m = re.search(r'\[\s*([\d\.]+)%\]\s*([\d,]+)/([\d,]+)', latest)
                            if m:
                                pct = float(m.group(1))
                                curr = m.group(2)
                                tot = m.group(3)
                                data = {
                                    "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
                                    "stage": "TELECHARGEMENT_ZOOM_15",
                                    "current_zoom": 15,
                                    "target_zoom": 15,
                                    "progress_percent": pct,
                                    "completed": curr,
                                    "total": tot,
                                    "details": latest
                                }
                                with open(STATUS_PATH, 'w', encoding='utf-8') as sf:
                                    json.dump(data, sf, indent=2)
                                with open(AUTO_PILOT_LOG, 'a', encoding='utf-8') as af:
                                    af.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [Zoom 15] {latest}\n")
        except Exception:
            pass
        time.sleep(15)

if __name__ == '__main__':
    update_loop()
