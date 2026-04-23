import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const iconSrc = path.join(rootDir, 'build', 'icon.icns')
const electronPlist = path.join(
  rootDir,
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Info.plist'
)
const iconDest = path.join(
  rootDir,
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Resources',
  'electron.icns'
)

// This branding patch only applies to the macOS Electron app bundle used in dev mode.
if (!fs.existsSync(electronPlist)) {
  process.exit(0)
}

let plist = fs.readFileSync(electronPlist, 'utf8')
plist = plist.replace(
  /<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/,
  '<key>CFBundleDisplayName</key>\n\t<string>Sha8al Command Center</string>'
)
plist = plist.replace(
  /<key>CFBundleName<\/key>\s*<string>.*?<\/string>/,
  '<key>CFBundleName</key>\n\t<string>Sha8al Command Center</string>'
)
fs.writeFileSync(electronPlist, plist)
console.log('Patched Electron.app name for Sha8al Command Center')

if (fs.existsSync(iconSrc) && fs.existsSync(iconDest)) {
  fs.copyFileSync(iconSrc, iconDest)
  console.log('Patched Electron.app icon for Sha8al Command Center')
}
