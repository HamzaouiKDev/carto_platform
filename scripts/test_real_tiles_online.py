import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=8, look_for_keys=False, allow_agent=False)

# Test réel d'une tuile OpenStreetMap
cmd_osm = "curl -sI -H 'User-Agent: CartoPlatform/1.0' https://tile.openstreetmap.org/15/17311/12942.png | head -n 5"
stdin, stdout, stderr = ssh.exec_command(cmd_osm)
res_osm = stdout.read().decode('utf-8').strip()

# Test réel d'une tuile ESRI Satellite
cmd_esri = "curl -sI https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/12942/17311 | head -n 5"
stdin, stdout, stderr = ssh.exec_command(cmd_esri)
res_esri = stdout.read().decode('utf-8').strip()

print("--- Test Réel Tuile OSM (Zoom 15) ---")
print(res_osm)

print("\n--- Test Réel Tuile ESRI Satellite (Zoom 15) ---")
print(res_esri)

ssh.close()
