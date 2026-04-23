@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "MCP_DIR=%ROOT_DIR%\mcp-server"
set "DIST_FILE=%MCP_DIR%\dist\index.js"
set "COMMAND_CENTER_PROJECT_ROOT=%ROOT_DIR%"
set "COMMAND_CENTER_PROFILE=generic"

echo ==========================================
echo Sha8al Command Center - MCP Server Launch
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found in PATH.
  echo Install Node.js first from https://nodejs.org/en/download/current
  pause
  exit /b 1
)

if not exist "%MCP_DIR%\node_modules" (
  echo Installing MCP server dependencies...
  pushd "%MCP_DIR%"
  call npm.cmd install
  if errorlevel 1 (
    set "EXIT_CODE=%ERRORLEVEL%"
    popd
    echo ERROR: MCP server dependency install failed.
    pause
    exit /b %EXIT_CODE%
  )
  popd
)

if not exist "%DIST_FILE%" (
  echo Building MCP server...
  pushd "%MCP_DIR%"
  call npm.cmd run build
  if errorlevel 1 (
    set "EXIT_CODE=%ERRORLEVEL%"
    popd
    echo ERROR: MCP server build failed.
    pause
    exit /b %EXIT_CODE%
  )
  popd
)

echo Starting MCP server on stdio...
echo Keep this terminal open while your MCP client is connected.
echo Using project root: %COMMAND_CENTER_PROJECT_ROOT%
echo.
pushd "%MCP_DIR%"
node "%DIST_FILE%"
set "EXIT_CODE=%ERRORLEVEL%"
popd
exit /b %EXIT_CODE%
