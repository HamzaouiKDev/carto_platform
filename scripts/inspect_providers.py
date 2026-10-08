import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)

cmd = "docker exec carto-postgis psql -U carto_user -d carto_db -c 'SELECT id, display_name, base_url, is_active FROM providers ORDER BY id;'"
stdin, stdout, stderr = ssh.exec_command(cmd)
print("=== FOURNISSEURS CONFIGURÉS EN BASE DE DONNÉES ===")
print(stdout.read().decode())

ssh.close()
