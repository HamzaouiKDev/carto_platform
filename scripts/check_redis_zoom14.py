import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)
cmd = "docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 --scan --pattern 'tile:osm-standard:14:*' | wc -l"
stdin, stdout, stderr = ssh.exec_command(cmd)
print("Zoom 14 keys in Redis:", stdout.read().decode().strip())
ssh.close()
