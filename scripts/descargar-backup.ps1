<#
.SYNOPSIS
    Descarga a esta PC el ultimo backup CIFRADO (base de datos y media) del servidor.

.DESCRIPTION
    Se conecta por SSH al servidor, copia el backup mas reciente del volumen de
    Docker "..._backups" a una carpeta temporal, lo descarga con scp y borra esa
    carpeta temporal. Los archivos llegan cifrados (.gpg): se abren con la
    contrasena BACKUP_PASSPHRASE (ver README, "Backups").

    Requisitos: Cliente OpenSSH de Windows (ssh y scp) y un usuario SSH del
    servidor que pueda usar Docker (root o del grupo "docker").

.PARAMETER Servidor
    usuario@servidor, por ejemplo  admin@203.0.113.10

.PARAMETER Puerto
    Puerto SSH (22 por defecto).

.PARAMETER Destino
    Carpeta local. Por defecto  Documentos\Backups-SistemaDocentes  (nunca dentro
    del repositorio: los backups tienen datos personales).

.PARAMETER Volumen
    Nombre del volumen de backups en el servidor. Si se omite, se busca el que
    termina en "_backups" (se ve con  docker volume ls).

.EXAMPLE
    .\scripts\descargar-backup.ps1 -Servidor admin@203.0.113.10
#>
param(
    [Parameter(Mandatory = $true)][string]$Servidor,
    [int]$Puerto = 22,
    [string]$Destino = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Backups-SistemaDocentes'),
    [string]$Volumen = ''
)

$ErrorActionPreference = 'Stop'

function Invoke-Remoto([string]$Script) {
    # El script va por la entrada estandar; tr quita los CR que agrega Windows.
    $salida = $Script | & ssh -p $Puerto $Servidor "tr -d '\r' | sh -s"
    if ($LASTEXITCODE -ne 0) { throw "Fallo el comando en el servidor (codigo $LASTEXITCODE)." }
    return $salida
}

foreach ($programa in 'ssh', 'scp') {
    if (-not (Get-Command $programa -ErrorAction SilentlyContinue)) {
        throw "No se encontro '$programa'. Instale el Cliente OpenSSH (Configuracion > Aplicaciones > Caracteristicas opcionales)."
    }
}

# Los backups contienen datos personales: nunca dentro del repositorio.
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\') + '\'
$destinoCompleto = [System.IO.Path]::GetFullPath($Destino).TrimEnd('\') + '\'
if ($destinoCompleto.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "El destino no puede estar dentro del repositorio ($repo). Use una carpeta fuera, por ejemplo en Documentos."
}
New-Item -ItemType Directory -Force -Path $destinoCompleto | Out-Null

if (-not $Volumen) {
    $candidatos = @(Invoke-Remoto 'docker volume ls -q --filter name=backups' | Where-Object { $_ -match '_backups$' })
    if ($candidatos.Count -ne 1) {
        throw "No se pudo elegir el volumen de backups (encontrados: $($candidatos -join ', ')). Indiquelo con -Volumen."
    }
    $Volumen = $candidatos[0]
}
Write-Host "Volumen de backups: $Volumen"

$temporal = "/tmp/backup-descarga-$PID"
$copiar = @'
set -e
docker run --rm -v "__VOLUMEN__":/backups:ro -v "__TEMPORAL__":/salida alpine sh -c '
  d=$(ls -1t /backups/db_*.dump.gpg 2>/dev/null | head -1)
  m=$(ls -1t /backups/media_*.tar.gz.gpg 2>/dev/null | head -1)
  if [ -z "$d" ] || [ -z "$m" ]; then echo "No hay backups cifrados en el volumen." >&2; exit 1; fi
  cp "$d" "$m" /salida/
  chmod 755 /salida && chmod 644 /salida/*
  basename "$d"; basename "$m"'
'@.Replace('__VOLUMEN__', $Volumen).Replace('__TEMPORAL__', $temporal)

try {
    $archivos = @(Invoke-Remoto $copiar | Where-Object { $_ -match '\.gpg$' })
    if ($archivos.Count -ne 2) { throw 'No se encontro el par de backups (base de datos y media).' }

    foreach ($archivo in $archivos) {
        Write-Host "Descargando $archivo ..."
        & scp -P $Puerto "${Servidor}:$temporal/$archivo" $destinoCompleto
        if ($LASTEXITCODE -ne 0) { throw "Fallo la descarga de $archivo." }
        $local = Get-Item (Join-Path $destinoCompleto $archivo)
        if ($local.Length -eq 0) { throw "$archivo llego vacio." }
    }
}
finally {
    # La carpeta temporal la creo Docker (root): se borra tambien con Docker.
    $limpiar = 'docker run --rm -v /tmp:/t alpine rm -rf "/t/__NOMBRE__"'.Replace('__NOMBRE__', "backup-descarga-$PID")
    try { Invoke-Remoto $limpiar | Out-Null } catch { Write-Warning "No se pudo borrar $temporal en el servidor: borrelo a mano." }
}

Write-Host ''
Write-Host "Backup descargado en $destinoCompleto (cifrado):"
$archivos | ForEach-Object { Write-Host "  $_" }
Write-Host 'Copie tambien estos archivos a un disco externo (2 copias). Para descifrar y restaurar: README, "Backups".'
