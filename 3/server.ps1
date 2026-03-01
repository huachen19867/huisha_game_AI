$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8000/")
$listener.Start()
Write-Host "Server running at http://localhost:8000/"

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    # Map URL path to local file path
    $localPath = $request.Url.LocalPath.TrimStart('/')
    if ($localPath -eq "") { $localPath = "index.html" }
    
    # Fix path separators for Windows
    $localPath = $localPath.Replace('/', '\')
    
    $filePath = Join-Path -Path $PSScriptRoot -ChildPath $localPath
    
    # Security check: prevent directory traversal
    $fullPath = [System.IO.Path]::GetFullPath($filePath)
    if (-not $fullPath.StartsWith($PSScriptRoot)) {
        $response.StatusCode = 403
        $response.Close()
        continue
    }

    Write-Host "Request: $localPath -> $filePath"

    if (Test-Path $filePath -PathType Leaf) {
        try {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $content.Length
            
            # Set Content-Type
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            switch ($ext) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".json" { $response.ContentType = "application/json; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
            }
            
            # Disable caching
            $response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.AddHeader("Pragma", "no-cache")
            $response.AddHeader("Expires", "0")
            
            $response.OutputStream.Write($content, 0, $content.Length)
            $response.StatusCode = 200
        } catch {
            $response.StatusCode = 500
        }
    } else {
        $response.StatusCode = 404
    }
    $response.Close()
}
