import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)

def run(c):
    _, stdout, stderr = ssh.exec_command(c)
    return stdout.read().decode().strip()

print("Test proxy sur passerelle 172.31.5.1 (ports 8080, 3128, 80) :")
for p in [8080, 3128, 80]:
    res = run(f"nc -zv -w 2 172.31.5.1 {p} 2>&1")
    print(f"Port {p}: {res}")

ssh.close()
