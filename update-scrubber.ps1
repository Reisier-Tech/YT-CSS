param(
    [string]$AssetsDir = "$PSScriptRoot\assets",
    [string]$CssFile = "$PSScriptRoot\youtube-enhancer-theme.css"
)

# Look for image files in the assets folder
$imageFiles = Get-ChildItem -Path $AssetsDir -Include *.gif, *.webp, *.png -Recurse

if ($imageFiles.Count -eq 0) {
    Write-Host "No GIF or image found in: $AssetsDir" -ForegroundColor Yellow
    Write-Host "Please put your GIF file into the 'assets' folder and run this script again."
    exit
}

$targetFile = $imageFiles[0]
Write-Host "Found image: $($targetFile.FullName)" -ForegroundColor Cyan

# Detect mime type
$ext = $targetFile.Extension.ToLower().TrimStart('.')
$mime = switch ($ext) {
    "gif"  { "image/gif" }
    "webp" { "image/webp" }
    "png"  { "image/png" }
    default { "image/gif" }
}

# Convert image to Base64
$bytes = [System.IO.File]::ReadAllBytes($targetFile.FullName)
$base64 = [System.Convert]::ToBase64String($bytes)
$dataUri = "data:$mime;base64,$base64"

Write-Host "Generated Base64 Data URI ($($bytes.Length) bytes)" -ForegroundColor Green

# Read CSS file
$cssContent = Get-Content -Path $CssFile -Raw

# Replace the scrubber GIF variable in CSS
$pattern = '(?s)(--scrubber-gif:\s*)url\([^)]+\)'
if ($cssContent -match $pattern) {
    $newCss = $cssContent -replace $pattern, "`$1url(`"$dataUri`")"
    Set-Content -Path $CssFile -Value $newCss -Encoding UTF8 -NoNewline
    Write-Host "Successfully updated $CssFile with your GIF!" -ForegroundColor Green
    Write-Host "You can now copy the updated CSS from $CssFile into Enhancer for YouTube!"
} else {
    Write-Host "Could not find '--scrubber-gif:' placeholder in $CssFile" -ForegroundColor Red
}
