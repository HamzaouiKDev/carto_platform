import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)

domains = [
    ('Tuiles OpenStreetMap (Plan)', 'tile.openstreetmap.org'),
    ('Tuiles OSM Miroir A', 'a.tile.openstreetmap.org'),
    ('Tuiles OSM Miroir B', 'b.tile.openstreetmap.org'),
    ('Tuiles OSM Miroir C', 'c.tile.openstreetmap.org'),
    ('Tuiles Esri Satellite/Rues/Topo', 'server.arcgisonline.com'),
    ('Services Esri Rest & Métadonnées', 'services.arcgisonline.com'),
    ('Recherche d\'adresses (Nominatim)', 'nominatim.openstreetmap.org'),
    ('Moteur Itinéraires Voiture (OSRM)', 'router.project-osrm.org'),
    ('Moteur Itinéraires Piéton/Vélo (OSRM)', 'routing.openstreetmap.de'),
]

print("=== VÉRIFICATION DE TOUS LES DOMAINES EN DIRECT DEPUIS LA VM ===")
for label, d in domains:
    cmd = f"curl -sI --connect-timeout 4 https://{d} | head -n 1"
    _, stdout, _ = ssh.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='ignore').strip()
    status = "OK " if res else "ERR"
    print(f"[{status}] {label:38} : {d:32} -> {res or 'Timeout/Non joint'}")

ssh.close()
