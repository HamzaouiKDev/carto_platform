@echo off
chcp 65001 > nul
cls
echo =========================================================
echo  TEST DE CONNEXION INTERNET SUR LA VM (172.31.5.111)
echo =========================================================
echo.
python e:\carto_platform\scripts\test_vm_internet.py
echo.
echo =========================================================
pause
