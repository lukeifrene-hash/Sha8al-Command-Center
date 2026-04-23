@echo off
setlocal EnableExtensions

pushd "%~dp0" >nul || exit /b 1

set "APP_EXE="
set "PACKAGED_DIR=%CD%\release\win-unpacked"

if exist "%PACKAGED_DIR%\*.exe" (
    for /f "delims=" %%F in ('dir /b /a-d "%PACKAGED_DIR%\*.exe" 2^>nul') do (
        set "APP_EXE=%PACKAGED_DIR%\%%F"
        goto :launch
    )
)

for /f "delims=" %%D in ('dir /b /ad /o-d "release-rebuild-*" 2^>nul') do (
    if exist "%CD%\%%D\win-unpacked\*.exe" (
        for /f "delims=" %%F in ('dir /b /a-d "%CD%\%%D\win-unpacked\*.exe" 2^>nul') do (
            set "APP_EXE=%CD%\%%D\win-unpacked\%%F"
            goto :launch
        )
    )
)

echo ERROR: No packaged app executable was found under release output folders.
popd >nul
exit /b 1

:launch
start "" "%APP_EXE%"
popd >nul
exit /b 0
