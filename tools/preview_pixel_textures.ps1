param([string]$OutputPath = '', [switch]$MemoryRooms, [switch]$CrashScene)

if ($MemoryRooms -and $CrashScene) { throw 'Choose either -MemoryRooms or -CrashScene' }

if (-not $OutputPath) {
    $previewName = if ($CrashScene) { 'crash-scene-v1.png' } elseif ($MemoryRooms) { 'memory-rooms-v1.png' } else { 'pixel-textures-v1.png' }
    $OutputPath = Join-Path $PSScriptRoot "../docs/previews/$previewName"
}

$ErrorActionPreference = 'Stop'
# Render the actual fillRect recipes; this is an art sheet, not a Phaser screenshot.
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $textureJson = @'
import { ManorPresentation } from './src/systems/ManorPresentation.js';
import { Maps } from './src/data/Maps.js';
const sheets = [];
const scene = { textures: {
    exists: () => false,
    createCanvas(key, width, height) {
        const ops = [];
        sheets.push({ key, width, height, ops });
        const ctx = { fillRect(x, y, w, h) { ops.push([x, y, w, h, this.fillStyle]); } };
        return { getContext: () => ctx, refresh() {} };
    }
} };
ManorPresentation.generateTextures(scene);
const keys = ['tile_floor', 'tile_ceramic', 'tile_stone', 'tile_classroom', 'tile_hospital', 'tile_road', 'document_page', 'incense_bundle', 'spirit_money_bundle', 'red_key', 'altar', 'cabinet', 'offering_rice', 'offering_ash', 'safe', 'safe_open', 'car', 'car_wrecked', 'height_marks', 'well', 'well_empty', 'portrait_covered', 'portrait_father', 'school_board', 'school_report', 'clinic_window', 'hospital_bed', 'guardrail_marker', 'boarded_window', 'kitchen_cabinet_rice', 'kitchen_cabinet_empty', 'workbench_matches', 'workbench_empty', 'coffin', 'coffin_1', 'coffin_2', 'coffin_3', 'coffin_4', 'coffin_5', 'coffin_6', 'coffin_7', 'mountain_path', 'manor_threshold', 'classroom_desk', 'teacher_desk', 'classroom_window', 'exam_stack', 'waiting_bench', 'privacy_screen', 'bedside_cabinet', 'forms_table', 'payment_slip', 'road_guardrail', 'road_lane', 'skid_marks'];
console.log(JSON.stringify({ sheets: keys.map(key => sheets.find(sheet => sheet.key === key)), rooms: ['memory_school', 'memory_hospital'].map(id => ({ ...Maps[id], floorTexture: ManorPresentation.floorTexture(id) })), crash: { ...Maps.memory_crash, floorTexture: ManorPresentation.floorTexture('memory_crash') } }));
'@ | node --input-type=module
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read pixel texture recipes' }
} finally { Pop-Location }

Add-Type -AssemblyName System.Drawing
$previewData = $textureJson | ConvertFrom-Json
$sheets = $previewData.sheets
$recipeIndex = @{}
foreach ($sheet in $sheets) { $recipeIndex[$sheet.key] = $sheet }
$bitmap = if ($CrashScene) { [Drawing.Bitmap]::new(1000, 484) } elseif ($MemoryRooms) { [Drawing.Bitmap]::new(1320, 548) } else { [Drawing.Bitmap]::new(960, [int](78 + [Math]::Ceiling($sheets.Count / 4) * 234)) }
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$font = [Drawing.Font]::new('Consolas', 12)
$labelBrush = [Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml('#d8c49c'))
function Draw-PixelRecipe($Sheet, [single]$X, [single]$Y, [single]$Scale = 1, [long]$Tint = -1) {
    foreach ($op in $Sheet.ops) {
        $color = [Drawing.ColorTranslator]::FromHtml($op[4])
        if ($Tint -ge 0) {
            $color = [Drawing.Color]::FromArgb([int]($color.R * (($Tint -shr 16) -band 255) / 255), [int]($color.G * (($Tint -shr 8) -band 255) / 255), [int]($color.B * ($Tint -band 255) / 255))
        }
        $brush = [Drawing.SolidBrush]::new($color)
        try { $graphics.FillRectangle($brush, [single]($X + $op[0] * $Scale), [single]($Y + $op[1] * $Scale), [single]($op[2] * $Scale), [single]($op[3] * $Scale)) }
        finally { $brush.Dispose() }
    }
}
try {
    $graphics.Clear([Drawing.ColorTranslator]::FromHtml('#172426'))
    if ($MemoryRooms -or $CrashScene) {
        $graphics.DrawString('HUISHA / source layout study / schematic walls, no game lighting or camera', $font, $labelBrush, 20, 12)
        $roomX = 20
        $layoutRooms = if ($CrashScene) { @($previewData.crash) } else { $previewData.rooms }
        foreach ($room in $layoutRooms) {
            $roomY = 72
            $graphics.DrawString($room.id, $font, $labelBrush, [single]$roomX, 44)
            $wallBrush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(255, [int](($room.visual.wallTint -shr 16) -band 255), [int](($room.visual.wallTint -shr 8) -band 255), [int]($room.visual.wallTint -band 255)))
            try {
                for ($tileY = 0; $tileY -lt $room.height; $tileY++) {
                    for ($tileX = 0; $tileX -lt $room.width; $tileX++) {
                        $px = $roomX + $tileX * 32
                        $py = $roomY + $tileY * 32
                        if ($room.data[$tileY][$tileX] -eq 1) { $graphics.FillRectangle($wallBrush, $px, $py, 32, 32) }
                        else { Draw-PixelRecipe $recipeIndex[$room.floorTexture] $px $py 1 $room.visual.floorTint }
                    }
                }
            } finally { $wallBrush.Dispose() }
            $placements = @()
            foreach ($item in @($room.objects.furnishings) + @($room.objects.interactables)) {
                $key = if ($item.documentText -and (-not $item.texture -or $item.texture -eq 'trash_paper')) { 'document_page' } else { $item.texture }
                $sheet = $recipeIndex[$key]
                if (-not $sheet) { throw "Missing layout recipe: $key" }
                $depth = if ($item.collision) { 20 + ($item.y + $sheet.height * 0.35) / 1000 } elseif ($room.objects.interactables -contains $item) { 21 } else { 10 }
                $placements += [pscustomobject]@{ item = $item; sheet = $sheet; depth = $depth }
            }
            foreach ($placement in $placements | Sort-Object depth) {
                $itemTint = if ($null -ne $placement.item.tint) { [long]$placement.item.tint } else { -1 }
                Draw-PixelRecipe $placement.sheet ($roomX + $placement.item.x - $placement.sheet.width / 2) ($roomY + $placement.item.y - $placement.sheet.height / 2) 1 $itemTint
            }
            $graphics.FillRectangle($labelBrush, ($roomX + $room.objects.playerStart.x - 3), ($roomY + $room.objects.playerStart.y - 3), 6, 6)
            $graphics.DrawString('start', $font, $labelBrush, [single]($roomX + $room.objects.playerStart.x + 8), [single]($roomY + $room.objects.playerStart.y - 9))
            $roomX += $room.width * 32 + 40
        }
    } else {
      $graphics.DrawString('HUISHA / 2D pixel recipes / no game lighting', $font, $labelBrush, 24, 16)
      for ($index = 0; $index -lt $sheets.Count; $index++) {
        $sheet = $sheets[$index]
        $cellX = 24 + ($index % 4) * 234
        $cellY = 60 + [Math]::Floor($index / 4) * 234
        $scale = [Math]::Min(4, [Math]::Floor(180 / [Math]::Max($sheet.width, $sheet.height)))
        $artX = $cellX + (210 - $sheet.width * $scale) / 2
        $artY = $cellY + (180 - $sheet.height * $scale) / 2
        Draw-PixelRecipe $sheet $artX $artY $scale
        $graphics.DrawString($sheet.key, $font, $labelBrush, [single]$cellX, [single]($cellY + 188))
      }
    }
    $absoluteOutput = [IO.Path]::GetFullPath($OutputPath)
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($absoluteOutput)) | Out-Null
    $bitmap.Save($absoluteOutput, [Drawing.Imaging.ImageFormat]::Png)
    Write-Output $absoluteOutput
} finally {
    $labelBrush.Dispose()
    $font.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
