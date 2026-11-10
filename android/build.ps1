# Builds a signed Basketball Arcade APK with the plain Android SDK tools (no Gradle, no downloads).
# Usage: powershell -File android\build.ps1 [-Sdk <path>] [-Jdk <path>]
param(
  [string]$Sdk = 'D:\SENAEI-DNS\.local\android\sdk',
  [string]$Jdk = 'D:\SENAEI-DNS\.local\android\jdk',
  [int]$VersionCode = 1, [string]$VersionName = '1.0'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent; $a = $PSScriptRoot
$bt = Get-ChildItem "$Sdk\build-tools" | Sort-Object Name | Select-Object -Last 1 | ForEach-Object FullName
$jar = (Get-ChildItem "$Sdk\platforms\android-*\android.jar" | Sort-Object FullName | Select-Object -Last 1).FullName
$env:JAVA_HOME = $Jdk
$out = "$a\build"; Remove-Item $out -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory "$out\res","$out\cls","$out\dex","$out\assets\www" | Out-Null

# web assets
Copy-Item "$root\index.html","$root\style.css" "$out\assets\www"
Copy-Item "$root\js" "$out\assets\www\js" -Recurse

# resources + manifest
& "$bt\aapt2.exe" compile --dir "$a\res" -o "$out\res.zip"
& "$bt\aapt2.exe" link -o "$out\base.apk" -I $jar --manifest "$a\AndroidManifest.xml" `
  --min-sdk-version 24 --target-sdk-version 36 --version-code $VersionCode --version-name $VersionName `
  -A "$out\assets" "$out\res.zip"

# java -> dex
& "$Jdk\bin\javac.exe" -source 8 -target 8 -Xlint:-options -classpath $jar -d "$out\cls" "$a\src\com\basketballarcade\game\MainActivity.java"
$classes = Get-ChildItem "$out\cls" -Recurse -Filter *.class | ForEach-Object FullName
& "$bt\d8.bat" --lib $jar --min-api 24 --output "$out\dex" $classes

# add classes.dex to the apk
python -c "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],'a'); z.write(sys.argv[2],'classes.dex'); z.close()" "$out\base.apk" "$out\dex\classes.dex"

# keystore (created once; keep it safe, you need it for every update)
$ks = "$a\keystore"; New-Item -ItemType Directory $ks -Force | Out-Null
if (-not (Test-Path "$ks\release.jks")) {
  $pw = -join ((48..57 + 97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ })
  & "$Jdk\bin\keytool.exe" -genkeypair -keystore "$ks\release.jks" -alias turbohoops -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass $pw -keypass $pw -dname "CN=Basketball Arcade, O=Basketball Arcade"
  Set-Content "$ks\keystore.pw" $pw
  Write-Host "Created new keystore in $ks. BACK IT UP (release.jks + keystore.pw)."
}
$pw = (Get-Content "$ks\keystore.pw").Trim()

& "$bt\zipalign.exe" -p -f 4 "$out\base.apk" "$out\aligned.apk"
& "$bt\apksigner.bat" sign --ks "$ks\release.jks" --ks-key-alias turbohoops --ks-pass "pass:$pw" --key-pass "pass:$pw" `
  --out "$a\BasketballArcade.apk" "$out\aligned.apk"
& "$bt\apksigner.bat" verify --verbose "$a\BasketballArcade.apk"
Write-Host "Built $a\BasketballArcade.apk"
