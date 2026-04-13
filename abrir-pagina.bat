@echo off
setlocal
cd /d "%~dp0"

echo Iniciando servidor local en http://localhost:5500 ...
start "Servidor Tenis" cmd /k py -m http.server 5500

timeout /t 2 >nul
start "" "http://localhost:5500/index.html"

echo.
echo La pagina se abrio en tu navegador.
echo Si quieres cerrar todo, cierra la ventana "Servidor Tenis".
pause
