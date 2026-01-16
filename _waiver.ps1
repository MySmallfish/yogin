$content = (Invoke-WebRequest -UseBasicParsing -Uri https://tazman.co.il/f/conatus/Health-Waiver).Content
$match = [regex]::Match($content, 'props="([^"]+)"')
if (-not $match.Success) { Write-Error 'props not found'; exit 1 }
Add-Type -AssemblyName System.Web
$json = [System.Web.HttpUtility]::HtmlDecode($match.Groups[1].Value)
$data = $json | ConvertFrom-Json
$fields = $data.initialData.data.form.fields
foreach ($f in $fields) {
  $title = $f.title
  if ($f.client_additional_field) { $title = $f.client_additional_field.title }
  $kind = if ($f.content) { 'content' } else { 'field' }
  $type = $null
  if ($f.client_additional_field) { $type = $f.client_additional_field.field_type_id }
  Write-Output ("$kind|$title|$type|$($f.required)")
}
