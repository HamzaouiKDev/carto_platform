import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)

cmd = """if curl -f -s -I --connect-timeout 3 https://tile.openstreetmap.org > /dev/null; then echo " INTERNET FONCTIONNE VRAIMENT !"; else echo "❌ INTERNET TOUJOURS BLOQUE (Timeout code $?)"; fi"""
stdin, stdout, stderr = ssh.exec_command(cmd)

out = stdout.read().decode('utf-8', errors='ignore')
print(out.strip())

ssh.close()
