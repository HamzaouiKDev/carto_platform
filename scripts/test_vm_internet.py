import paramiko
import sys

# Forcer l'encodage UTF-8 sous Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def main():
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=8, look_for_keys=False, allow_agent=False)
    except Exception as e:
        print(f"[ERREUR] Impossible de joindre la VM (172.31.5.111) en SSH : {e}")
        return

    # Test curl vers OpenStreetMap
    stdin, stdout, stderr = ssh.exec_command("curl -Is --connect-timeout 4 https://tile.openstreetmap.org | head -n 1")
    res_osm = stdout.read().decode('utf-8', errors='ignore').strip()

    # Test curl vers Google
    stdin, stdout, stderr = ssh.exec_command("curl -Is --connect-timeout 4 https://www.google.com | head -n 1")
    res_google = stdout.read().decode('utf-8', errors='ignore').strip()

    print("\n---------------------------------------------------------")
    if "200" in res_osm or "301" in res_osm or "200" in res_google:
        print("[SUCCES] INTERNET FONCTIONNE PARFAITEMENT SUR LA VM !")
        print(f" -> Reponse OSM : {res_osm or 'OK'}")
        print(f" -> Reponse Google : {res_google or 'OK'}")
    else:
        print("[INFO] AUCUN ACCES INTERNET SUR LA VM ACTUELLEMENT")
        print(" -> Le pare-feu bloque toujours les connexions sortantes (ports 80 / 443).")
    print("---------------------------------------------------------")

    ssh.close()

if __name__ == '__main__':
    main()
