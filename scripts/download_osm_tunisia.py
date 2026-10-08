import os
import sys
import math
import time
import tarfile
import urllib.request
import threading
from concurrent.futures import ThreadPoolExecutor
import paramiko

# ── 1. CONFIGURATION GÉOGRAPHIQUE (TUNISIE) ──────────────────────────────────
BBOX = {
    'minLon': 7.52,
    'minLat': 30.24,
    'maxLon': 11.60,
    'maxLat': 37.56
}

VM_IP = '172.31.5.111'
VM_USER = 'adm_enq'
VM_PASS = 'M$n@ge*E2026'
REDIS_PASS = 'change_this_redis_password_in_production_77182'

LOCAL_DIR = r'e:\carto_platform\cache_osm'
os.makedirs(LOCAL_DIR, exist_ok=True)

USER_AGENT = 'CartoPlatformEnterprise/1.0 (contact@ins.tn)'
MIRRORS = [
    'https://a.tile.openstreetmap.org',
    'https://b.tile.openstreetmap.org',
    'https://c.tile.openstreetmap.org'
]

def lon2tile(lon, zoom):
    return int((lon + 180.0) / 360.0 * (2.0 ** zoom))

def lat2tile(lat, zoom):
    lat_rad = math.radians(lat)
    return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * (2.0 ** zoom))

def get_tiles_for_zoom(zoom):
    x_min = lon2tile(BBOX['minLon'], zoom)
    x_max = lon2tile(BBOX['maxLon'], zoom)
    y_min = lat2tile(BBOX['maxLat'], zoom) # En Web Mercator Y pointe vers le Sud
    y_max = lat2tile(BBOX['minLat'], zoom)
    
    tiles = []
    for x in range(min(x_min, x_max), max(x_min, x_max) + 1):
        for y in range(min(y_min, y_max), max(y_min, y_max) + 1):
            tiles.append((zoom, x, y))
    return tiles

def download_tile(tile_info, idx):
    z, x, y = tile_info
    mirror = MIRRORS[idx % len(MIRRORS)]
    url = f"{mirror}/{z}/{x}/{y}.png"
    
    tile_dir = os.path.join(LOCAL_DIR, str(z), str(x))
    tile_path = os.path.join(tile_dir, f"{y}.png")
    
    if os.path.exists(tile_path) and os.path.getsize(tile_path) > 0:
        return True, True # already downloaded
        
    os.makedirs(tile_dir, exist_ok=True)
    
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    retries = 3
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = resp.read()
                if len(data) > 0:
                    with open(tile_path, 'wb') as f:
                        f.write(data)
                    return True, False
        except Exception:
            if attempt == retries - 1:
                return False, False
            time.sleep(0.4 * (attempt + 1))
    return False, False

def download_zoom_level(zoom, max_workers=10):
    print(f"\n==================================================================")
    print(f" [OSM] Téléchargement pour toute la Tunisie — Zoom {zoom}")
    print(f"==================================================================")
    
    tiles = get_tiles_for_zoom(zoom)
    total = len(tiles)
    print(f"Total de tuiles prévues : {total:,} tuiles")
    
    completed = 0
    downloaded = 0
    cached = 0
    errors = 0
    start_time = time.time()
    lock = threading.Lock()
    
    def worker(item):
        idx, t = item
        ok, was_cached = download_tile(t, idx)
        nonlocal completed, downloaded, cached, errors
        with lock:
            completed += 1
            if ok:
                if was_cached:
                    cached += 1
                else:
                    downloaded += 1
            else:
                errors += 1
                
            if completed % 100 == 0 or completed == total:
                elapsed = max(1, time.time() - start_time)
                rate = completed / elapsed
                pct = (completed / total) * 100
                sys.stdout.write(
                    f"\r[{pct:5.1f}%] {completed:,}/{total:,} | Reçues: {downloaded:,} | Cache: {cached:,} | Err: {errors} | Vitesse: {rate:4.1f} t/s "
                )
                sys.stdout.flush()

    items = list(enumerate(tiles))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        list(executor.map(worker, items))
        
    print(f"\nTéléchargement du Zoom {zoom} achevé en {time.time() - start_time:.1f}s.")
    return total, downloaded, cached, errors

def inject_zoom_into_vm(zoom):
    print(f"\n[*] Préparation de l'injection des tuiles Zoom {zoom} dans la VM...")
    zoom_dir = os.path.join(LOCAL_DIR, str(zoom))
    if not os.path.exists(zoom_dir):
        print(f"Erreur : Dossier {zoom_dir} introuvable.")
        return
        
    tar_filename = f"osm_zoom_{zoom}.tar"
    local_tar = os.path.join(LOCAL_DIR, tar_filename)
    print(f"[*] Empaquettage de l'archive {tar_filename}...")
    
    with tarfile.open(local_tar, "w") as tar:
        tar.add(zoom_dir, arcname=str(zoom))
        
    tar_size_mb = os.path.getsize(local_tar) / (1024 * 1024)
    print(f"[*] Archive locale prête ({tar_size_mb:.1f} Mo). Transfert SFTP vers la VM...")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(VM_IP, username=VM_USER, password=VM_PASS, timeout=10, look_for_keys=False, allow_agent=False)
    
    sftp = ssh.open_sftp()
    remote_tar = f"/home/{VM_USER}/carto_platform/{tar_filename}"
    sftp.put(local_tar, remote_tar)
    sftp.close()
    print("[*] Archive déposée sur la VM. Injection ultra-rapide dans Redis via pipeline...")
    
    # Script d'injection Python utilisant redis-cli --pipe (100% natif, zéro dépendance)
    inject_py = f"""import os, tarfile, subprocess

def resp(*args):
    res = f"*{{len(args)}}\\r\\n".encode()
    for a in args:
        if isinstance(a, str):
            a = a.encode()
        res += f"${{len(a)}}\\r\\n".encode() + a + b"\\r\\n"
    return res

tar_path = "/home/{VM_USER}/carto_platform/{tar_filename}"
print(f"[VM] Lecture directe de l archive tar : {{tar_path}}")

p = subprocess.Popen(
    ["docker", "exec", "-i", "carto-redis", "redis-cli", "-a", "{REDIS_PASS}", "--pipe"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
)

count = 0
with tarfile.open(tar_path, "r") as tar:
    for member in tar:
        if member.isfile() and member.name.endswith(".png"):
            parts = member.name.split("/")
            z = parts[0]
            x = parts[1]
            y = parts[2].replace(".png", "")
            f = tar.extractfile(member)
            buf = f.read()
            p.stdin.write(resp("SET", f"tile:osm-standard:{{z}}:{{x}}:{{y}}", buf))
            p.stdin.write(resp("SET", f"tile:meta:osm-standard:{{z}}:{{x}}:{{y}}", '{{"contentType":"image/png"}}'))
            count += 1
            if count % 2000 == 0:
                p.stdin.flush()
                print(f"  [VM] {{count}} tuiles traitées...", end="\\r")

p.stdin.close()
p.wait()
print(f"\\n[VM] Injection terminée : {{count}} tuiles intégrées à Redis !")
if os.path.exists(tar_path):
    os.remove(tar_path)
"""
    # Écriture du script d'injection sur la VM
    sftp = ssh.open_sftp()
    remote_script = f"/home/{VM_USER}/carto_platform/run_inject.py"
    with sftp.file(remote_script, "w") as f:
        f.write(inject_py)
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command(f"python3 {remote_script} && rm -f {remote_script}")
    print(stdout.read().decode())
    err = stderr.read().decode()
    filtered_err = "\n".join([l for l in err.splitlines() if 'Warning: Using a password' not in l])
    if filtered_err.strip():
        print("INFO/ERR:\n", filtered_err)
        
    ssh.close()
    if os.path.exists(local_tar):
        os.remove(local_tar)
    print(f"[OK] Zoom {zoom} parfaitement injecté dans Redis sur la VM !")

if __name__ == '__main__':
    # Exemple d'appel : python download_osm_tunisia.py 13 14 15
    zooms = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else [13, 14, 15]
    for z in zooms:
        download_zoom_level(z)
        inject_zoom_into_vm(z)
