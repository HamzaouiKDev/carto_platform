import paramiko
import shutil

shutil.copyfile(r'e:\carto_platform\app_test\app.js', r'e:\carto_platform\frontend\public\app_test\app.js')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('172.31.5.111', username='adm_enq', password='M$n@ge*E2026', timeout=10, look_for_keys=False, allow_agent=False)

sftp = ssh.open_sftp()
sftp.put(r'e:\carto_platform\frontend\public\app.js', '/home/adm_enq/carto_platform/frontend/public/app.js')
sftp.put(r'e:\carto_platform\app_test\app.js', '/home/adm_enq/carto_platform/app_test/app.js')
sftp.close()

stdin, stdout, stderr = ssh.exec_command('docker cp /home/adm_enq/carto_platform/frontend/public/app.js carto-frontend:/usr/share/nginx/html/app.js')
stdout.channel.recv_exit_status()

stdin, stdout, stderr = ssh.exec_command('docker cp /home/adm_enq/carto_platform/app_test/app.js carto-frontend:/usr/share/nginx/html/app_test/app.js')
stdout.channel.recv_exit_status()

print("Synchronisation reussie vers carto-frontend !")
ssh.close()
