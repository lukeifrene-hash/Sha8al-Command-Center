@echo off
setlocal EnableExtensions

pushd "%~dp0" >nul || exit /b 1

set "ELECTRON_EXE=%CD%\node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON_EXE%" (
    echo ERROR: Electron runtime was not found at "%ELECTRON_EXE%".
    popd >nul
    exit /b 1
)

if not exist "%CD%\out\main\index.js" (
    echo ERROR: Built app output was not found. Run Build_Run_Windows.bat first.
    popd >nul
    exit /b 1
)

start "" "%ELECTRON_EXE%" "%CD%"
popd >nul
exit /b 0
