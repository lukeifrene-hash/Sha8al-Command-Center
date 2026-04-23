@echo off
setlocal EnableExtensions EnableDelayedExpansion

pushd "%~dp0" >nul || (
    echo ERROR: Unable to switch to the repository root.
    exit /b 1
)

set "ROOT_DIR=%CD%"
set "RELEASE_DIR=%ROOT_DIR%\release"
set "FALLBACK_RELEASE_DIR=%ROOT_DIR%\release-rebuild-%RANDOM%%RANDOM%"
set "OUT_DIR=%ROOT_DIR%\out"
set "ACTIVE_RELEASE_DIR=%RELEASE_DIR%"
set "ACTIVE_UNPACKED_DIR=%ACTIVE_RELEASE_DIR%\win-unpacked"
set "ELECTRON_EXE=%ROOT_DIR%\node_modules\electron\dist\electron.exe"
set "APP_EXE="

echo ==============================================
echo Sha8al Command Center - Windows Build and Run
echo ==============================================

echo.
echo [0] Ensuring Windows build dependencies are installed...
if not exist "%ROOT_DIR%\node_modules\electron-vite\dist\cli.js" goto :install_dependencies
if not exist "%ROOT_DIR%\node_modules\electron-builder\cli.js" goto :install_dependencies
if not exist "%ROOT_DIR%\node_modules\app-builder-bin\win\x64\app-builder.exe" goto :install_dependencies
echo Dependencies already available.
goto :dependencies_ready

:install_dependencies
echo Installing dependencies with legacy peer dependency resolution...
call npm.cmd install --legacy-peer-deps
if errorlevel 1 goto :dependencies_failed

if not exist "%ROOT_DIR%\node_modules\electron-vite\dist\cli.js" goto :dependencies_failed
if not exist "%ROOT_DIR%\node_modules\electron-builder\cli.js" goto :dependencies_failed
if not exist "%ROOT_DIR%\node_modules\app-builder-bin\win\x64\app-builder.exe" goto :dependencies_failed

echo Dependencies installed successfully.

:dependencies_ready

call :sync_active_paths
call :resolve_app_exe

echo.
echo [1] Closing any running packaged app instances...
if defined APP_EXE (
    call :terminate_process "%APP_EXE%"
) else (
    call :terminate_known_processes
)
call :close_explorer_windows

echo.
echo [2] Cleaning previous build directories...
call :remove_dir_with_retries "%RELEASE_DIR%" "release"
if errorlevel 1 (
    echo release is still locked. Falling back to "%FALLBACK_RELEASE_DIR%" for this build.
    set "ACTIVE_RELEASE_DIR=%FALLBACK_RELEASE_DIR%"
    call :sync_active_paths
)

call :remove_dir_with_retries "%OUT_DIR%" "out"
if errorlevel 1 goto :cleanup_failed

echo.
echo [3] Building app...
call :build_app
if errorlevel 1 goto :build_failed

echo.
echo [4] Running Windows packager...
call :run_packager
set "BUILD_EXIT=%ERRORLEVEL%"

if not "%BUILD_EXIT%"=="0" (
    echo.
    echo ERROR: Windows packaging failed with exit code %BUILD_EXIT%.
    echo If this happened right after launching the unpacked app, make sure
    echo Explorer windows, Defender, or another scanner are not holding files
    echo in "%ACTIVE_UNPACKED_DIR%".
    echo.
    echo [4b] Falling back to a direct production launch from the built out/ folder...
    call :build_and_launch_direct
    set "FALLBACK_EXIT=%ERRORLEVEL%"
    if "%FALLBACK_EXIT%"=="0" (
        popd >nul
        exit /b 0
    )
    popd >nul
    exit /b %BUILD_EXIT%
)

call :resolve_app_exe
if not defined APP_EXE (
    echo.
    echo ERROR: Build succeeded, but no packaged executable was found in:
    echo   "%ACTIVE_UNPACKED_DIR%"
    echo Check the electron-builder output before trying again.
    call :maybe_pause
    popd >nul
    exit /b 1
)

echo.
echo [5] Build succeeded. Launching "%APP_EXE%"...
echo Dynamic packaged launcher: "%ROOT_DIR%\Launch_CC_Windows.bat"
start "" "%ACTIVE_UNPACKED_DIR%\%APP_EXE%"

popd >nul
exit /b 0

:dependencies_failed
echo.
echo ERROR: Failed to install or validate project dependencies.
call :maybe_pause
popd >nul
exit /b 1

:build_failed
echo.
echo ERROR: Failed to build the production app before packaging.
call :maybe_pause
popd >nul
exit /b 1

:cleanup_failed
echo.
echo ERROR: Unable to clean the previous build output.
echo A file in "%ACTIVE_RELEASE_DIR%" or "%OUT_DIR%" is still locked.
echo Close the unpacked app, close any Explorer windows in the release folder,
echo and temporarily pause Defender or antivirus scanning if it keeps happening.
call :maybe_pause
popd >nul
exit /b 1

:maybe_pause
pause
exit /b 0

:build_app
node "%ROOT_DIR%\node_modules\electron-vite\dist\cli.js" build
exit /b %ERRORLEVEL%

:build_and_launch_direct
if not exist "%ELECTRON_EXE%" (
    echo ERROR: Electron runtime was not found at:
    echo   "%ELECTRON_EXE%"
    exit /b 1
)

if not exist "%OUT_DIR%\main\index.js" (
    node "%ROOT_DIR%\node_modules\electron-vite\dist\cli.js" build
    if errorlevel 1 (
        echo ERROR: Failed to build the production app for direct launch.
        exit /b 1
    )
)

if not exist "%OUT_DIR%\main\index.js" (
    echo ERROR: Expected compiled main process output was not found at:
    echo   "%OUT_DIR%\main\index.js"
    exit /b 1
)

echo Dynamic direct launcher: "%ROOT_DIR%\Launch_CC_Direct_Windows.bat"
start "" "%ELECTRON_EXE%" "%ROOT_DIR%"
echo Direct Electron launch started from the compiled out/ folder.
exit /b 0

:sync_active_paths
set "ACTIVE_UNPACKED_DIR=%ACTIVE_RELEASE_DIR%\win-unpacked"
exit /b 0

:resolve_app_exe
set "APP_EXE="
if exist "%ACTIVE_UNPACKED_DIR%\*.exe" (
    for /f "delims=" %%F in ('dir /b /a-d "%ACTIVE_UNPACKED_DIR%\*.exe" 2^>nul') do (
        set "APP_EXE=%%F"
        goto :resolve_app_exe_done
    )
)
:resolve_app_exe_done
exit /b 0

:run_packager
if /I "%ACTIVE_RELEASE_DIR%"=="%RELEASE_DIR%" (
    node "%ROOT_DIR%\node_modules\electron-builder\cli.js" --win
    exit /b %ERRORLEVEL%
)

node "%ROOT_DIR%\node_modules\electron-builder\cli.js" --win --config.directories.output="%ACTIVE_RELEASE_DIR%"
exit /b %ERRORLEVEL%

:terminate_process
set "TARGET_EXE=%~1"
if "%TARGET_EXE%"=="" exit /b 0

taskkill /F /T /IM "%TARGET_EXE%" >nul 2>&1
if errorlevel 1 (
    echo No running packaged app process found for "%TARGET_EXE%".
    exit /b 0
)

echo Closed running packaged app process "%TARGET_EXE%".
timeout /t 2 /nobreak >nul
exit /b 0

:terminate_known_processes
for %%P in ("Sha8al Command Center.exe" "Sha8al-Command-Center.exe" "sha8al-command-center.exe") do (
    taskkill /F /T /IM %%~P >nul 2>&1
    if not errorlevel 1 (
        echo Closed running packaged app process %%~P.
        timeout /t 2 /nobreak >nul
    )
)
exit /b 0

:close_explorer_windows
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$targets = @('%RELEASE_DIR%', '%FALLBACK_RELEASE_DIR%') | ForEach-Object { [System.IO.Path]::GetFullPath($_) };" ^
  "$shell = New-Object -ComObject Shell.Application;" ^
  "$closed = 0;" ^
  "foreach ($window in @($shell.Windows())) {" ^
  "  try {" ^
  "    $path = $window.Document.Folder.Self.Path;" ^
  "    if (-not $path) { continue }" ^
  "    $fullPath = [System.IO.Path]::GetFullPath($path);" ^
  "    if ($targets | Where-Object { $fullPath.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) }) {" ^
  "      $window.Quit();" ^
  "      $closed++;" ^
  "    }" ^
  "  } catch { }" ^
  "}" ^
  "if ($closed -gt 0) { Write-Output ('Closed ' + $closed + ' Explorer window(s) that were pointing at the build output.') }" >nul 2>&1
exit /b 0

:remove_dir_with_retries
set "TARGET_DIR=%~1"
set "TARGET_LABEL=%~2"

if not exist "%TARGET_DIR%" exit /b 0

for /L %%I in (1,1,5) do (
    rmdir /s /q "%TARGET_DIR%" >nul 2>&1
    if exist "%TARGET_DIR%" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path -LiteralPath '%TARGET_DIR%') { Remove-Item -LiteralPath '%TARGET_DIR%' -Recurse -Force -ErrorAction SilentlyContinue }" >nul 2>&1
    )
    if not exist "%TARGET_DIR%" (
        if %%I GTR 1 echo Removed %TARGET_LABEL% after retry %%I.
        exit /b 0
    )

    echo Waiting for %TARGET_LABEL% locks to clear ^(attempt %%I of 5^)...
    timeout /t 2 /nobreak >nul
)

exit /b 1
