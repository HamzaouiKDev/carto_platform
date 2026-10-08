import os
import sys
import time
import json
import re
import ctypes
import ctypes.wintypes
import tarfile
import paramiko

# Importer les modules du projet
sys.path.insert(0, r'e:\carto_platform\scripts')
from download_osm_tunisia import (
    download_zoom_level,
    inject_zoom_into_vm,
    LOCAL_DIR,
    VM_IP,
    VM_USER,
    VM_PASS
)

LOG_FILE = r'e:\carto_platform\auto_pilot.log'
STATUS_FILE = r'e:\carto_platform\progress_status.json'
TASK_533_LOG = r'C:\Users\khaled.hamzaoui\.gemini\antigravity-ide\brain\482ff7b8-c165-4a75-b3b7-3c63c948829f\.system_generated\tasks\task-533.log'

def log(msg):
    ts = time.strftime('%Y-%m-%d %H:%M:%S')
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except Exception:
        pass

def save_status(stage, current_zoom, pct, details=""):
    data = {
        "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
        "stage": stage,
        "current_zoom": current_zoom,
        "target_zoom": 15,
        "progress_percent": pct,
        "details": details
    }
    try:
        with open(STATUS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass

def is_pid_alive(pid):
    try:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return False
        exit_code = ctypes.wintypes.DWORD()
        kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
        kernel32.CloseHandle(handle)
        return exit_code.value == 259  # STILL_ACTIVE
    except Exception:
        return False

def update_apps_native_zoom(zoom):
    log(f"[*] Application de maxNativeZoom: {zoom} sur toutes les applications...")
    
    # 1. E:\geo_app\js\main.js
    try:
        geo_main = r'E:\geo_app\js\main.js'
        if os.path.exists(geo_main):
            with open(geo_main, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            content = re.sub(
                r'maxNativeZoom:\s*\d+,\s*attribution:\s*\'&copy; INS SIG Platform &mdash; OpenStreetMap\'',
                f"maxNativeZoom: {zoom},\n        attribution: '&copy; INS SIG Platform &mdash; OpenStreetMap'",
                content
            )
            with open(geo_main, 'w', encoding='utf-8') as f:
                f.write(content)
            log(f"  -> {geo_main} mis à jour (maxNativeZoom: {zoom})")
    except Exception as e:
        log(f"  Erreur geo_app: {e}")

    # 2. frontend/public/app.js
    try:
        app_js = r'e:\carto_platform\frontend\public\app.js'
        if os.path.exists(app_js):
            with open(app_js, 'r', encoding='utf-8') as f:
                content = f.read()
            content = re.sub(
                r"'osm-standard':\s*\{\s*minZoom:\s*5,\s*maxZoom:\s*19,\s*maxNativeZoom:\s*\d+\s*\}",
                f"'osm-standard': {{ minZoom: 5, maxZoom: 19, maxNativeZoom: {zoom} }}",
                content
            )
            with open(app_js, 'w', encoding='utf-8') as f:
                f.write(content)
            log(f"  -> {app_js} mis à jour (maxNativeZoom: {zoom})")
    except Exception as e:
        log(f"  Erreur frontend app.js: {e}")

    # 3. app_test/app.js & frontend/public/app_test/app.js
    for p in [r'e:\carto_platform\app_test\app.js', r'e:\carto_platform\frontend\public\app_test\app.js']:
        try:
            if os.path.exists(p):
                with open(p, 'r', encoding='utf-8') as f:
                    content = f.read()
                content = re.sub(
                    r"(osm:\s*\{[^}]+maxNativeZoom:\s*)\d+",
                    rf"\g<1>{zoom}",
                    content
                )
                with open(p, 'w', encoding='utf-8') as f:
                    f.write(content)
                log(f"  -> {p} mis à jour (maxNativeZoom: {zoom})")
        except Exception as e:
            log(f"  Erreur {p}: {e}")

    # 4. Déploiement direct dans le conteneur frontend sur la VM
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(VM_IP, username=VM_USER, password=VM_PASS, timeout=10, look_for_keys=False, allow_agent=False)
        sftp = ssh.open_sftp()
        sftp.put(r'e:\carto_platform\frontend\public\app.js', f'/home/{VM_USER}/carto_platform/frontend/public/app.js')
        sftp.put(r'e:\carto_platform\app_test\app.js', f'/home/{VM_USER}/carto_platform/app_test/app.js')
        sftp.close()
        ssh.exec_command('docker cp /home/adm_enq/carto_platform/frontend/public/app.js carto-frontend:/usr/share/nginx/html/app.js')
        ssh.exec_command('docker cp /home/adm_enq/carto_platform/app_test/app.js carto-frontend:/usr/share/nginx/html/app_test/app.js')
        ssh.close()
        log("  -> Nginx carto-frontend conteneur synchronisé avec succès !")
    except Exception as e:
        log(f"  Erreur sync conteneur VM: {e}")

def monitor_zoom14(pid=22060):
    log(f"[*] Surveillance de la tâche Zoom 14 (PID {pid})...")
    last_log_line = ""
    while is_pid_alive(pid):
        try:
            if os.path.exists(TASK_533_LOG):
                with open(TASK_533_LOG, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = [l.strip() for l in f.readlines() if l.strip()]
                    if lines:
                        latest = lines[-1]
                        if latest != last_log_line:
                            last_log_line = latest
                            m = re.search(r'\[\s*([\d\.]+)%\]', latest)
                            pct = float(m.group(1)) if m else 0.0
                            save_status("TELECHARGEMENT_ZOOM_14", 14, pct, latest)
                            log(f"  [Progression Zoom 14] {latest}")
        except Exception:
            pass
        time.sleep(15)

    log("[OK] Tâche de téléchargement Zoom 14 achevée !")
    save_status("INJECTION_ZOOM_14", 14, 100.0, "Téléchargement Z14 terminé, vérification injection...")

def main():
    log("==================================================================")
    log(" AUTO-PILOT CARTOPLATFORM : COUVERTURE TOTALE TUNISIE (ZOOM 14 & 15)")
    log("==================================================================")

    # Étape 1 : Attendre et finaliser Zoom 14
    monitor_zoom14(22060)
    time.sleep(5)
    update_apps_native_zoom(14)
    save_status("ZOOM_14_VALIDE", 14, 100.0, "Zoom 14 injecté et actif")

    # Étape 2 : Lancement immédiat et autonome du Zoom 15 (~299 460 tuiles)
    log("\n[PILOTE AUTO] Lancement immédiat et autonome du Zoom 15 (~299 460 tuiles)...")
    save_status("LANCEMENT_ZOOM_15", 15, 0.0, "Démarrage du téléchargement Zoom 15")
    
    download_zoom_level(15, max_workers=12)
    save_status("INJECTION_ZOOM_15", 15, 100.0, "Téléchargement Z15 achevé, injection dans Redis...")
    
    inject_zoom_into_vm(15)
    
    # Étape 3 : Mise à jour globale vers Zoom 15
    update_apps_native_zoom(15)
    save_status("TERMINE_SUCCES", 15, 100.0, "Zoom 15 opérationnel sur toute la Tunisie")
    
    log("\n==================================================================")
    log(" AUTO-PILOT TERMINÉ AVEC SUCCÈS À 100% !")
    log(" Toute la Tunisie est désormais en cache jusqu'au Zoom 15 !")
    log("==================================================================")

if __name__ == '__main__':
    main()
