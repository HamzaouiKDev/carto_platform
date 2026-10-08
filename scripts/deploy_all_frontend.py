import paramiko
import shutil

# 1. Copier localement
shutil.copyfile(r'e:\carto_platform\app_test\app.js', r'e:\carto_platform\frontend\public\app_test\app.js')
shutil.copyfile(r'e:\carto_platform\app_test\index.html', r'e:\carto_platform\frontend\public\app_test\index.html')

# 2. Synchroniser sur la VM
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)

sftp = ssh.open_sftp()
sftp.put(r'e:\carto_platform\frontend\public\app.js', '/home/adm_enq/carto_platform/frontend/public/app.js')
sftp.put(r'e:\carto_platform\frontend\public\index.html', '/home/adm_enq/carto_platform/frontend/public/index.html')
sftp.put(r'e:\carto_platform\app_test\app.js', '/home/adm_enq/carto_platform/app_test/app.js')
sftp.put(r'e:\carto_platform\app_test\index.html', '/home/adm_enq/carto_platform/app_test/index.html')
sftp.close()

# 3. Injection dans le conteneur Nginx
commands = [
    'docker cp /home/adm_enq/carto_platform/frontend/public/app.js carto-frontend:/usr/share/nginx/html/app.js',
    'docker cp /home/adm_enq/carto_platform/frontend/public/index.html carto-frontend:/usr/share/nginx/html/index.html',
    'docker cp /home/adm_enq/carto_platform/app_test/app.js carto-frontend:/usr/share/nginx/html/app_test/app.js',
    'docker cp /home/adm_enq/carto_platform/app_test/index.html carto-frontend:/usr/share/nginx/html/app_test/index.html',
]

for cmd in commands:
    stdin, stdout, stderr = ssh.exec_command(cmd)
    stdout.channel.recv_exit_status()

print("Synchronisation complete et versionnage a jour sur la VM !")
ssh.close()
