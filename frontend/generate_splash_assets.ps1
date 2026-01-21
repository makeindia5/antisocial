
Add-Type -AssemblyName System.Drawing

$sourcePath = "D:\Finance-Chat-V\frontend\assets\hike_logo.jpg"
$baseDir = "D:\Finance-Chat-V\frontend\android\app\src\main\res"

# Standard scale factors for Android drawables (Base size: 192px for splash centered logo at mdpi seems reasonable for high quality)
# mdpi = 1x
# hdpi = 1.5x
# xhdpi = 2x
# xxhdpi = 3x
# xxxhdpi = 4x

$baseSize = 192 

$configs = @(
    @{ Name = "drawable-mdpi"; Scale = 1.0 },
    @{ Name = "drawable-hdpi"; Scale = 1.5 },
    @{ Name = "drawable-xhdpi"; Scale = 2.0 },
    @{ Name = "drawable-xxhdpi"; Scale = 3.0 },
    @{ Name = "drawable-xxxhdpi"; Scale = 4.0 }
)

Write-Host "Reading source image from $sourcePath..."
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source file not found!"
    exit 1
}

$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)

foreach ($config in $configs) {
    $targetDir = Join-Path $baseDir $config.Name
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        Write-Host "Created directory: $targetDir"
    }

    $newWidth = [int]($baseSize * $config.Scale)
    $newHeight = [int]($baseSize * $config.Scale)

    # Calculate aspect ratio to fit within the box without distortion
    $ratioX = $newWidth / $sourceImage.Width
    $ratioY = $newHeight / $sourceImage.Height
    $ratio = if ($ratioX -lt $ratioY) { $ratioX } else { $ratioY }

    $finalWidth = [int]($sourceImage.Width * $ratio)
    $finalHeight = [int]($sourceImage.Height * $ratio)

    $bitmap = New-Object System.Drawing.Bitmap($finalWidth, $finalHeight)
    $graph = [System.Drawing.Graphics]::FromImage($bitmap)
    
    # High quality settings
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graph.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $graph.DrawImage($sourceImage, 0, 0, $finalWidth, $finalHeight)

    $targetFile = Join-Path $targetDir "splashscreen_logo.png"
    
    # Verify we can save
    try {
        $bitmap.Save($targetFile, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Generated: $targetFile ($finalWidth x $finalHeight)"
    } catch {
        Write-Error "Failed to save $targetFile : $_"
    }

    $bitmap.Dispose()
    $graph.Dispose()
}

$sourceImage.Dispose()
Write-Host "Done!"
