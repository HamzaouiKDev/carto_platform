import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)

def run(c):
    _, out, _ = ssh.exec_command(c)
    return out.read().decode().strip()

z13 = run("docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 --scan --pattern 'tile:osm-standard:13:*' | wc -l")
z14 = run("docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 --scan --pattern 'tile:osm-standard:14:*' | wc -l")
z15 = run("docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 --scan --pattern 'tile:osm-standard:15:*' | wc -l")
dbsize = run("docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 dbsize")
info_mem = run("docker exec carto-redis redis-cli -a change_this_redis_password_in_production_77182 info memory | grep used_memory_human")
df = run("df -h /")

print(f"OSM Zoom 13 keys: {z13}")
print(f"OSM Zoom 14 keys: {z14}")
print(f"OSM Zoom 15 keys: {z15}")
print(f"DBSIZE total keys: {dbsize}")
print(f"{info_mem}")
print(f"Disk space:\n{df}")

ssh.close()
