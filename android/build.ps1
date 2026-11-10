# Builds a signed Basketball Arcade APK with the plain Android SDK tools (no Gradle, no downloads).
# Usage: powershell -File android\build.ps1 [-VersionCode 3 -VersionName 1.2] [-Sdk <path>] [-Jdk <path>]
# Bump -VersionCode on every store upload. Needs: Android SDK (build-tools + a platform) and a JDK 17.
param(
  [string]$Sdk = $(if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { 'D:\SENAEI-DNS\.local\android\sdk' }),
  [string]$Jdk = $(if ($env:JAVA_HOME) { $env:JAVA_HOME } else { 'D:\SENAEI-DNS\.local\android\jdk' }),
  [int]$VersionCode = 3, [string]$VersionName = '2.0'
)
$ErrorActionPreference = 'Stop'
function Run([string]$what, [scriptblock]$cmd) {
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit code $LASTEXITCODE)" }
}
$root = Split-Path $PSScriptRoot -Parent; $a = $PSScriptRoot
$bt = Get-ChildItem "$Sdk\build-tools" | Sort-Object { [version]($_.Name -replace '[^\d.]', '') } | Select-Object -Last 1 | ForEach-Object FullName
$jar = (Get-ChildItem "$Sdk\platforms\android-*\android.jar" | Sort-Object FullName | Select-Object -Last 1).FullName
if (-not $bt -or -not $jar) { throw "Android SDK build-tools/platform not found under $Sdk" }
$env:JAVA_HOME = $Jdk
$out = "$a\build"; Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory "$out\cls", "$out\dex", "$out\assets\www" | Out-Null

# web assets (only what the game needs)
Copy-Item "$root\index.html", "$root\style.css" "$out\assets\www"
Copy-Item "$root\js" "$out\assets\www\js" -Recurse
New-Item -ItemType Directory "$out\assets\www\assets" | Out-Null
Copy-Item "$root\assets\fonts" "$out\assets\www\assets\fonts" -Recurse   # bundled fonts, loaded by style.css

# resources + manifest
Run 'aapt2 compile' { & "$bt\aapt2.exe" compile --dir "$a\res" -o "$out\res.zip" }
Run 'aapt2 link' { & "$bt\aapt2.exe" link -o "$out\base.apk" -I $jar --manifest "$a\AndroidManifest.xml" `
    --min-sdk-version 24 --target-sdk-version 36 --version-code $VersionCode --version-name $VersionName `
    -A "$out\assets" "$out\res.zip" }

# java -> dex
$src = Get-ChildItem "$a\src" -Recurse -Filter *.java | ForEach-Object FullName
Run 'javac' { & "$Jdk\bin\javac.exe" -source 8 -target 8 -Xlint:-options -classpath $jar -d "$out\cls" $src }
$classes = Get-ChildItem "$out\cls" -Recurse -Filter *.class | ForEach-Object FullName
Run 'd8' { & "$bt\d8.bat" --lib $jar --min-api 24 --output "$out\dex" $classes }

# add classes.dex to the apk
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::Open("$out\base.apk", 'Update')
# aapt2 on Windows can record asset paths with backslashes ("assets/www\index.html"), which the
# WebView cannot find. Rewrite those entries with forward slashes.
foreach ($e in @($zip.Entries | Where-Object { $_.FullName.Contains('\') })) {
  $ms = New-Object IO.MemoryStream; $s = $e.Open(); $s.CopyTo($ms); $s.Dispose()
  $name = $e.FullName.Replace('\', '/'); $e.Delete()
  $n = $zip.CreateEntry($name, 'Optimal'); $w = $n.Open(); $ms.WriteTo($w); $w.Dispose()
}
[void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, "$out\dex\classes.dex", 'classes.dex', 'Optimal')
$zip.Dispose()
# sanity: the game must really be inside the APK
$zip = [IO.Compression.ZipFile]::OpenRead("$out\base.apk")
$names = @($zip.Entries | ForEach-Object FullName); $zip.Dispose()
if ($names -contains 'assets/www/index.html' -and $names -contains 'classes.dex' -and -not ($names | Where-Object { $_.Contains('\') })) { }
else { throw "APK is missing assets/www/index.html or classes.dex, or has bad entry paths" }

# keystore: created once. KEEP IT SAFE (release.jks + keystore.pw), you need it for every update.
$ks = "$a\keystore"; New-Item -ItemType Directory $ks -Force | Out-Null
if (-not (Test-Path "$ks\release.jks")) {
  $pw = -join ((48..57 + 97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
  Run 'keytool' { & "$Jdk\bin\keytool.exe" -genkeypair -keystore "$ks\release.jks" -alias turbohoops -keyalg RSA -keysize 2048 -validity 10000 `
      -storepass $pw -keypass $pw -dname "CN=Basketball Arcade, O=Basketball Arcade" }
  Set-Content "$ks\keystore.pw" $pw
  Write-Host "Created a NEW keystore in $ks. BACK IT UP (release.jks + keystore.pw)."
}
$pw = (Get-Content "$ks\keystore.pw").Trim()

Run 'zipalign' { & "$bt\zipalign.exe" -p -f 4 "$out\base.apk" "$out\aligned.apk" }
Run 'zipalign verify' { & "$bt\zipalign.exe" -c -p 4 "$out\aligned.apk" }
Remove-Item "$a\BasketballArcade.apk", "$a\BasketballArcade.apk.idsig" -ErrorAction SilentlyContinue
Run 'apksigner sign' { & "$bt\apksigner.bat" sign --ks "$ks\release.jks" --ks-key-alias turbohoops --ks-pass "pass:$pw" --key-pass "pass:$pw" `
    --out "$a\BasketballArcade.apk" "$out\aligned.apk" }
Run 'apksigner verify' { & "$bt\apksigner.bat" verify --verbose "$a\BasketballArcade.apk" }
Remove-Item "$a\BasketballArcade.apk.idsig" -ErrorAction SilentlyContinue
Write-Host "Built $a\BasketballArcade.apk (version $VersionName / code $VersionCode)"
