import paramiko
import sys

# Forcer l'encodage pour Windows
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

print("[CONNEXION] Connexion SSH a la VM 172.31.5.111...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=8, look_for_keys=False, allow_agent=False)
print("[CONNECTE] Session SSH etablie avec succes.\n")

tests = [
    ("1. PING EXTERNE VERS 8.8.8.8", "ping -c 2 -W 2 8.8.8.8"),
    ("2. REQUETE HTTPS VERS GOOGLE", "curl -v --connect-timeout 3 https://www.google.com 2>&1 | tail -n 8"),
    ("3. REQUETE HTTPS VERS OPENSTREETMAP", "curl -v --connect-timeout 3 https://tile.openstreetmap.org 2>&1 | tail -n 8"),
    ("4. REQUETE HTTPS VERS ESRI ARCGIS", "curl -v --connect-timeout 3 https://services.arcgisonline.com 2>&1 | tail -n 8"),
]

for title, cmd in tests:
    print(f"=== {title} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore').strip()
    print(out)
    print()

ssh.close()
