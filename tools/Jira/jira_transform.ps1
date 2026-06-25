<#
.SYNOPSIS
    Flow Analytics – JIRA Export Script
    Liest alle Squad-Issues per JIRA REST API und erzeugt eine flowanalytics_DATUM.json
    die direkt ins Flow Analytics Dashboard geladen werden kann.

.PARAMETER ConfigPath
    Pfad zur flow_config.json (Standard: ../config/flow_config.json relativ zum Script)

.EXAMPLE
    cscript wird NICHT benutzt – Aufruf nur über jira_fetch.bat
#>
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "..\config\flow_config.json")
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ─────────────────────────────────────────────────────────────────────────────
# 1. Config laden
# ─────────────────────────────────────────────────────────────────────────────
if (-not (Test-Path $ConfigPath)) {
    Write-Host ""
    Write-Host "[FEHLER] Config-Datei nicht gefunden: $ConfigPath"
    Write-Host "         Vorlage: config\flow_config.example.json"
    Write-Host "         Bitte kopieren und anpassen."
    exit 1
}

try {
    $config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Write-Host "[FEHLER] Config-Datei ungueltig (JSON-Syntaxfehler): $($_.Exception.Message)"
    exit 1
}

$baseUrl    = "https://jiraws.axa.com/jira"
$maxResults = 100
$prefix     = if ($config.PSObject.Properties['output'] -and
                   $config.output.PSObject.Properties['filenamePrefix']) {
                  $config.output.filenamePrefix
              } else { "flowanalytics" }
$rejectedRes = if ($config.PSObject.Properties['rejectedResolutions']) {
                   @($config.rejectedResolutions)
               } else {
                   @("Won't Do", "Duplicate", "Abgelehnt", "Rejected")
               }

# Custom-Field-IDs (konfigurierbar – Fallback auf AXA-Defaults)
$cf = if ($config.jira.PSObject.Properties['customFields']) {
    $config.jira.customFields
} else {
    [PSCustomObject]@{
        epicLink      = "customfield_10222"
        sprint        = "customfield_10221"
        epicStage     = "customfield_19320"
        epicCategory  = "customfield_17726"
        blockedReason = "customfield_23623"
        akzeptanz     = "customfield_11720"
    }
}

# Output landet im Projekt-Root (Elternverzeichnis von config\)
$configDir  = Split-Path (Resolve-Path $ConfigPath) -Parent
$projectRoot = Split-Path $configDir -Parent
$outFile    = Join-Path $projectRoot ("${prefix}_" + (Get-Date -Format "yyyy-MM-dd") + ".json")

# Bestehende JSON suchen - bestimmt Vollabzug vs. Inkrementell
$existingFile = $null
$lastSync     = $null
$existingData = $null
$priorFiles   = Get-ChildItem -Path $projectRoot -Filter "${prefix}_*.json" -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending
if ($priorFiles) {
    try {
        $existingData = Get-Content $priorFiles[0].FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($existingData.meta.PSObject.Properties['exportDate']) {
            $existingFile = $priorFiles[0].FullName
            $lastSync     = $existingData.meta.exportDate
        }
    } catch { }  # Unlesbare Datei -> Vollabzug
}
$syncMode = if ($lastSync) { "Inkrementell (ab $lastSync)" } else { "Vollabzug" }

# ─────────────────────────────────────────────────────────────────────────────
# 2. Credentials abfragen (sicher - Passwort nie auf Disk)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=================================================="
Write-Host "  Flow Analytics - JIRA Export"
Write-Host "=================================================="
Write-Host ""
Write-Host "  JIRA:   $baseUrl"
Write-Host "  Config: $ConfigPath"
Write-Host "  Modus:  $syncMode"
Write-Host ""

$username = Read-Host "  Benutzername"
if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Host "[FEHLER] Kein Benutzername eingegeben."
    exit 1
}
$secPass = Read-Host "  Passwort" -AsSecureString

# SecureString sicher in Base64-Header umwandeln
$bstr      = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
$plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

$credBytes = [System.Text.Encoding]::UTF8.GetBytes("${username}:${plainPass}")
$b64       = [Convert]::ToBase64String($credBytes)
$plainPass = $null   # sofort aus dem Speicher löschen

$headers = @{
    "Authorization" = "Basic $b64"
    "Content-Type"  = "application/json"
    "Accept"        = "application/json"
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Credentials testen (vor dem eigentlichen Export)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Verbindung wird getestet..."
try {
    $me = Invoke-RestMethod -Uri "$baseUrl/rest/api/2/myself" `
        -Headers $headers -Method Get -UseBasicParsing
    Write-Host "  [OK] Angemeldet als: $($me.displayName) ($($me.emailAddress))"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401) {
        Write-Host "[FEHLER] Authentifizierung fehlgeschlagen (401). Benutzername oder Passwort falsch."
    } elseif ($code -eq 403) {
        Write-Host "[FEHLER] Zugriff verweigert (403). Fehlende Berechtigung fuer JIRA REST API."
    } else {
        Write-Host "[FEHLER] JIRA nicht erreichbar (HTTP $code): $($_.Exception.Message)"
    }
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. Helper: JIRA-REST-API aufrufen
# ─────────────────────────────────────────────────────────────────────────────
function Invoke-JiraApi {
    param([string]$Url)
    try {
        return Invoke-RestMethod -Uri $Url -Headers $headers -Method Get -UseBasicParsing
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 400) {
            # JQL-Fehler: Fehlermeldung aus Response Body lesen
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = [System.IO.StreamReader]::new($stream)
            $body   = $reader.ReadToEnd()
            $reader.Close()
            Write-Host "[FEHLER] JQL-Fehler (400): $body"
        } else {
            Write-Host "[FEHLER] API-Aufruf fehlgeschlagen (HTTP $code): $Url"
            Write-Host "         $($_.Exception.Message)"
        }
        exit 1
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. Changelog → Status-Zeitstempel extrahieren (Dual-Period-Logik)
# ─────────────────────────────────────────────────────────────────────────────
function Get-StatusTimestamps {
    param($Issue)

    $result = @{}

    # Changelog vorhanden?
    if (-not ($Issue.PSObject.Properties['changelog'] -and
              $Issue.changelog.PSObject.Properties['histories'])) {
        return $result
    }

    # Alle Status-Übergänge chronologisch sortieren
    $statusChanges = @()
    foreach ($h in ($Issue.changelog.histories | Sort-Object { [datetime]$_.created })) {
        foreach ($item in $h.items) {
            if ($item.field -eq "status") {
                $statusChanges += [PSCustomObject]@{
                    Time       = $h.created          # ISO-String beibehalten
                    FromStatus = $item.fromString
                    ToStatus   = $item.toString
                }
            }
        }
    }

    # Pro Status: Eintrittszeitpunkte sammeln (in Reihenfolge)
    $entriesByStatus = @{}
    foreach ($sc in $statusChanges) {
        $s = $sc.ToStatus
        if (-not $entriesByStatus.ContainsKey($s)) { $entriesByStatus[$s] = [System.Collections.Generic.List[string]]::new() }
        $entriesByStatus[$s].Add($sc.Time)
    }

    # Pro Status: Abgangszeitpunkte = erste FromStatus-Änderung NACH dem jeweiligen Eintritt
    foreach ($s in $entriesByStatus.Keys) {
        $entries = $entriesByStatus[$s]

        # ── Erster Eintritt ──
        $entry1 = $entries[0]
        $result["${s}_first"] = $entry1

        # Abgang nach erstem Eintritt
        $leave1 = ($statusChanges |
            Where-Object { $_.FromStatus -eq $s -and [datetime]$_.Time -gt [datetime]$entry1 } |
            Select-Object -First 1).Time
        $result["leaving_${s}_first"] = $leave1   # $null wenn noch aktiv

        # ── Zweiter Eintritt (falls vorhanden) ──
        if ($entries.Count -ge 2) {
            $entry2 = $entries[1]
            $result[$s] = $entry2

            $leave2 = ($statusChanges |
                Where-Object { $_.FromStatus -eq $s -and [datetime]$_.Time -gt [datetime]$entry2 } |
                Select-Object -First 1).Time
            $result["leaving_${s}"] = $leave2
        }
    }

    return $result
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. Helper: Sprint-Name aus JIRA-Feld extrahieren (Server- und Cloud-Format)
# ─────────────────────────────────────────────────────────────────────────────
function Get-SprintName {
    param($SprintField)
    if (-not $SprintField) { return $null }
    $sprints = @($SprintField)
    if ($sprints.Count -eq 0) { return $null }
    $last = $sprints[-1]
    # JIRA Cloud / neue Server-Versionen: PSCustomObject mit .name-Property
    if ($last.PSObject.Properties['name']) { return $last.name }
    # JIRA Server klassisches String-Format: Sprint@hash[...,name=Sprint 5,...]
    if ($last -is [string] -and $last -match 'name=([^,\]]+)') { return $Matches[1] }
    return $null
}

# ─────────────────────────────────────────────────────────────────────────────
# 7a. Helper: Epic-Status-Pivot (letzter Eintrittszeitpunkt je Status)
# ─────────────────────────────────────────────────────────────────────────────
function Get-EpicStatusPivot {
    param($Issue)
    $pivot = @{}
    if (-not ($Issue.PSObject.Properties['changelog'] -and
              $Issue.changelog.PSObject.Properties['histories'])) {
        return $pivot
    }
    foreach ($h in ($Issue.changelog.histories | Sort-Object { [datetime]$_.created })) {
        foreach ($item in $h.items) {
            if ($item.field -eq "status") {
                $s = $item.toString
                if (-not $pivot.ContainsKey($s) -or [datetime]$h.created -gt [datetime]$pivot[$s]) {
                    $pivot[$s] = $h.created
                }
            }
        }
    }
    return $pivot
}

# ─────────────────────────────────────────────────────────────────────────────
# 7b. Epic → JiraEpics-Zeile
# ─────────────────────────────────────────────────────────────────────────────
function Convert-EpicToRow {
    param($Issue, [string]$SquadName, $CustomFields)
    $f = $Issue.fields

    $stageRaw = if ($f.PSObject.Properties[$CustomFields.epicStage]) { $f.($CustomFields.epicStage) } else { $null }
    $stage    = if ($stageRaw -and $stageRaw.PSObject.Properties['value']) { $stageRaw.value } else { "$stageRaw" }

    $catRaw   = if ($f.PSObject.Properties[$CustomFields.epicCategory]) { $f.($CustomFields.epicCategory) } else { $null }
    $cat      = if ($catRaw -and $catRaw.PSObject.Properties['value']) { $catRaw.value } else { "$catRaw" }

    $pivot = Get-EpicStatusPivot -Issue $Issue

    $row = [ordered]@{
        "Jira-ID"              = $Issue.key
        "Kurzbeschreibung"     = if ($f.PSObject.Properties['summary']) { $f.summary } else { $null }
        "Issue-Status"         = if ($f.PSObject.Properties['status'] -and $f.status) { $f.status.name } else { $null }
        "Stage"                = $stage
        "EPIC-Kategorie"       = $cat
        "Created (Status New)" = if ($f.PSObject.Properties['created']) { $f.created } else { $null }
        "Squad"                = $SquadName
        "Project-Key"          = if ($f.PSObject.Properties['project'] -and $f.project) { $f.project.key } else { $null }
    }
    foreach ($key in ($pivot.Keys | Sort-Object)) { $row[$key] = $pivot[$key] }
    return $row
}

# ─────────────────────────────────────────────────────────────────────────────
# 7c. Blocked-Episoden aus Changelog extrahieren
# ─────────────────────────────────────────────────────────────────────────────
function Get-BlockedEpisodes {
    param($Issue, [string]$SquadName, $CustomFields)
    $episodes = [System.Collections.Generic.List[object]]::new()
    if (-not ($Issue.PSObject.Properties['changelog'] -and
              $Issue.changelog.PSObject.Properties['histories'])) {
        return $episodes
    }

    $starts = [System.Collections.Generic.List[string]]::new()
    $ends   = [System.Collections.Generic.List[PSCustomObject]]::new()

    foreach ($h in ($Issue.changelog.histories | Sort-Object { [datetime]$_.created })) {
        foreach ($item in $h.items) {
            if ($item.field -eq $CustomFields.blockedReason -or
                $item.field -eq "Blocked Reason" -or
                $item.field -eq "Blockiert/Wartend") {
                if (-not [string]::IsNullOrWhiteSpace($item.toString))  { $starts.Add($h.created) }
                if (-not [string]::IsNullOrWhiteSpace($item.fromString)) {
                    $ends.Add([PSCustomObject]@{ Time = $h.created; Reason = $item.fromString })
                }
            }
        }
    }

    for ($i = 0; $i -lt $starts.Count; $i++) {
        $start  = $starts[$i]
        $end    = if ($i -lt $ends.Count) { $ends[$i] } else { $null }
        $durH   = if ($end) { [math]::Round(([datetime]$end.Time - [datetime]$start).TotalHours, 2) } else { $null }
        $seitD  = if (-not $end) { ([datetime]::Now - [datetime]$start).Days }
                  elseif ($durH -ne $null) { [math]::Ceiling($durH / 24) }
                  else { $null }

        $episodes.Add([PSCustomObject]@{
            "Jira-ID"             = $Issue.key
            "Status"              = if ($Issue.fields.PSObject.Properties['status'] -and $Issue.fields.status) { $Issue.fields.status.name } else { $null }
            "Squad"               = $SquadName
            "BlockedStart"        = $start
            "BlockedEnd"          = if ($end) { $end.Time } else { $null }
            "BlockedReason"       = if ($end) { $end.Reason } else { $null }
            "BlockedSeq"          = $i + 1
            "BlockedDurationHours"= $durH
            "BlockiertWartendSeit"= $seitD
        })
    }
    return $episodes
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. Issue → JiraStories-Zeile (entspricht Excel-Zeilenformat)
# ─────────────────────────────────────────────────────────────────────────────
function Convert-IssueToRow {
    param($Issue, [string]$SquadName, $CustomFields)

    $f = $Issue.fields

    # Resolved vs. Rejected anhand Resolution-Name
    $resolvedDate = $null
    $rejectedDate = $null
    $resolution   = if ($f.PSObject.Properties['resolution'] -and $f.resolution) {
                        $f.resolution.name
                    } else { $null }
    $resDate      = if ($f.PSObject.Properties['resolutiondate']) { $f.resolutiondate } else { $null }

    if ($resDate) {
        if ($rejectedRes -contains $resolution) {
            $rejectedDate = $resDate
        } else {
            $resolvedDate = $resDate
        }
    }

    # Status-Zeitstempel aus Changelog
    $ts = Get-StatusTimestamps -Issue $Issue

    # Custom-Field-Werte extrahieren
    $epicLinkKey  = $CustomFields.epicLink
    $sprintKey    = $CustomFields.sprint
    $epicStageKey = $CustomFields.epicStage
    $blockedKey   = $CustomFields.blockedReason
    $akzKey       = $CustomFields.akzeptanz

    $epicLink  = if ($f.PSObject.Properties[$epicLinkKey])  { $f.$epicLinkKey }  else { $null }
    $sprint    = Get-SprintName -SprintField $(if ($f.PSObject.Properties[$sprintKey]) { $f.$sprintKey } else { $null })

    $epicStageRaw = if ($f.PSObject.Properties[$epicStageKey]) { $f.$epicStageKey } else { $null }
    $epicStage = if ($epicStageRaw) {
                     if ($epicStageRaw.PSObject.Properties['value']) { $epicStageRaw.value }
                     else { "$epicStageRaw" }
                 } else { $null }

    $blockedRaw = if ($f.PSObject.Properties[$blockedKey]) { $f.$blockedKey } else { $null }
    $blocked   = if ($blockedRaw) {
                     if ($blockedRaw.PSObject.Properties['value']) { $blockedRaw.value }
                     else { "$blockedRaw" }
                 } else { $null }

    $akzeptanz = if ($f.PSObject.Properties[$akzKey]) { $f.$akzKey } else { $null }
    $labels    = if ($f.PSObject.Properties['labels'] -and $f.labels) { ($f.labels -join ", ") } else { $null }
    $projectKey = if ($f.PSObject.Properties['project'] -and $f.project) { $f.project.key } else { $null }
    $updated   = if ($f.PSObject.Properties['updated']) { $f.updated } else { $null }

    # Zeile aufbauen – feste Spalten zuerst, dann dynamische Status-Spalten
    $row = [ordered]@{
        "Jira-ID"              = $Issue.key
        "Issue-Type"           = if ($f.PSObject.Properties['issuetype'] -and $f.issuetype) { $f.issuetype.name } else { $null }
        "Squad"                = $SquadName
        "Project-Key"          = $projectKey
        "Issue-Status"         = if ($f.PSObject.Properties['status'] -and $f.status) { $f.status.name } else { $null }
        "Created (Status New)" = if ($f.PSObject.Properties['created']) { $f.created } else { $null }
        "Updated"              = $updated
        "Resolved"             = $resolvedDate
        "Rejected"             = $rejectedDate
        "Labels"               = $labels
        "Epic-Link"            = $epicLink
        "Sprint"               = $sprint
        "Epic-Stage"           = $epicStage
        "Blocked-Reason"       = $blocked
        "Akzeptanzkriterien"   = $akzeptanz
    }

    # Dynamische Status-Spalten aus Changelog alphabetisch anfügen
    foreach ($key in ($ts.Keys | Sort-Object)) {
        $row[$key] = $ts[$key]
    }

    return $row
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. Alle Squads paginiert abrufen
# ─────────────────────────────────────────────────────────────────────────────
$fieldsParam = "summary,issuetype,status,created,updated,project,resolution,resolutiondate,labels" +
               ",$($cf.epicLink),$($cf.sprint),$($cf.epicStage),$($cf.epicCategory),$($cf.blockedReason),$($cf.akzeptanz)"
$allStories  = [System.Collections.Generic.List[object]]::new()
$allEpics    = [System.Collections.Generic.List[object]]::new()
$allBlocked  = [System.Collections.Generic.List[object]]::new()

Write-Host ""
foreach ($squad in $config.squads) {
    $squadName = $squad.name

    # JQL aufbauen: Inkrementell (updated >= lastSync) oder Vollabzug (52-Wochen-Fenster)
    if ($lastSync) {
        $syncDateJql = [datetime]::Parse(
            $lastSync,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [System.Globalization.DateTimeStyles]::RoundtripKind
        ).ToLocalTime().ToString("yyyy-MM-dd HH:mm")
        $baseJql = "project in (`"$($squad.project)`") AND issuetype in (Epic, Story, Task, Bug)" +
                   " AND updated >= `"$syncDateJql`""
    } else {
        $baseJql = "project in (`"$($squad.project)`") AND issuetype in (Epic, Story, Task, Bug)" +
                   " AND (resolution = Unresolved OR resolved >= startOfMonth(-52w))" +
                   " AND updated >= startOfMonth(-52w)"
    }
    $jql = if ($squad.PSObject.Properties['modifier'] -and
               -not [string]::IsNullOrWhiteSpace($squad.modifier)) {
        "$baseJql AND $($squad.modifier)"
    } else {
        $baseJql
    }
    $jql += " ORDER BY created ASC"

    $startAt   = 0
    $total     = $null

    Write-Host "  [$squadName] Abruf gestartet..."

    do {
        $encodedJql = [Uri]::EscapeDataString($jql)
        $url = "$baseUrl/rest/api/2/search" +
               "?jql=$encodedJql" +
               "&startAt=$startAt" +
               "&maxResults=$maxResults" +
               "&expand=changelog" +
               "&fields=$fieldsParam"

        $response = Invoke-JiraApi -Url $url

        if ($null -eq $total) {
            $total = $response.total
            Write-Host "    Gesamt: $total Issues gefunden"
        }

        foreach ($issue in $response.issues) {
            $type = if ($issue.fields.PSObject.Properties['issuetype'] -and $issue.fields.issuetype) {
                        $issue.fields.issuetype.name
                    } else { "" }
            if ($type -eq "Epic") {
                $row = Convert-EpicToRow -Issue $issue -SquadName $squadName -CustomFields $cf
                $allEpics.Add([PSCustomObject]$row)
            } else {
                $row = Convert-IssueToRow -Issue $issue -SquadName $squadName -CustomFields $cf
                $allStories.Add([PSCustomObject]$row)
            }
            foreach ($ep in (Get-BlockedEpisodes -Issue $issue -SquadName $squadName -CustomFields $cf)) {
                $allBlocked.Add($ep)
            }
        }

        $startAt += $response.issues.Count
        Write-Host "    $startAt / $total geladen..."

    } while ($startAt -lt $total)

    Write-Host "  [$squadName] Fertig."
}

# "Wie oft in Blocked" je Issue nachberechnen
if ($allBlocked.Count -gt 0) {
    $blockedCount = @{}
    foreach ($ep in $allBlocked) {
        $k = $ep.'Jira-ID'
        if ($blockedCount.ContainsKey($k)) { $blockedCount[$k]++ } else { $blockedCount[$k] = 1 }
    }
    foreach ($ep in $allBlocked) {
        $ep | Add-Member -NotePropertyName "Wie oft in Blocked" -NotePropertyValue $blockedCount[$ep.'Jira-ID'] -Force
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 8. Inkrementeller Merge
# ─────────────────────────────────────────────────────────────────────────────
if ($lastSync -and $existingData) {
    Write-Host ""
    Write-Host "  Merge mit bestehenden Daten..."
    $mergeMap = [System.Collections.Generic.Dictionary[string,object]]::new()

    foreach ($row in @($existingData.sheets.JiraStories)) {
        $mergeMap[$row.'Jira-ID'] = $row
    }
    $beforeCount = $mergeMap.Count

    $newCount = 0; $updCount = 0
    foreach ($row in $allStories) {
        if ($mergeMap.ContainsKey($row.'Jira-ID')) { $updCount++ } else { $newCount++ }
        $mergeMap[$row.'Jira-ID'] = $row
    }

    $allStories = [System.Collections.Generic.List[object]]::new()
    foreach ($val in $mergeMap.Values) { $allStories.Add($val) }

    Write-Host "  Vorher: $beforeCount  |  Neu: $newCount  |  Aktualisiert: $updCount  |  Gesamt: $($allStories.Count)"

    # Epics mergen (nach Jira-ID)
    $epicMergeMap = [System.Collections.Generic.Dictionary[string,object]]::new()
    foreach ($row in @($existingData.sheets.JiraEpics)) {
        if ($row -and $row.'Jira-ID') { $epicMergeMap[$row.'Jira-ID'] = $row }
    }
    foreach ($row in $allEpics) { $epicMergeMap[$row.'Jira-ID'] = $row }
    $allEpics = [System.Collections.Generic.List[object]]::new()
    foreach ($val in $epicMergeMap.Values) { $allEpics.Add($val) }

    # Blocked: Episoden aktualisierter Issues komplett ersetzen
    $updatedKeys = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($ep in $allBlocked) { [void]$updatedKeys.Add($ep.'Jira-ID') }
    $mergedBlocked = [System.Collections.Generic.List[object]]::new()
    foreach ($row in @($existingData.sheets.JiraBlockermanagement)) {
        if ($row -and $row.'Jira-ID' -and -not $updatedKeys.Contains($row.'Jira-ID')) {
            $mergedBlocked.Add($row)
        }
    }
    foreach ($ep in $allBlocked) { $mergedBlocked.Add($ep) }
    $allBlocked = $mergedBlocked

    if ($existingFile -ne $outFile) {
        Remove-Item $existingFile -Force -ErrorAction SilentlyContinue
        Write-Host "  Alte Datei entfernt: $(Split-Path $existingFile -Leaf)"
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 9. SquadDaten aus Config aufbauen
# ─────────────────────────────────────────────────────────────────────────────
$squadDaten = [System.Collections.Generic.List[object]]::new()
foreach ($squad in $config.squads) {
    $row = [ordered]@{ "Squad" = $squad.name }
    if ($squad.PSObject.Properties['capacity']) {
        foreach ($prop in $squad.capacity.PSObject.Properties) {
            $row[$prop.Name] = $prop.Value
        }
    }
    $squadDaten.Add([PSCustomObject]$row)
}

# ─────────────────────────────────────────────────────────────────────────────
# 9. JSON-Output schreiben
# ─────────────────────────────────────────────────────────────────────────────
$output = [ordered]@{
    meta   = [ordered]@{
        exportDate  = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
        syncMode    = if ($lastSync) { "incremental" } else { "full" }
        syncFrom    = $lastSync
        source      = "Jira"
        version     = "1"
        baseUrl     = $baseUrl
        totalIssues = $allStories.Count + $allEpics.Count
    }
    sheets = [ordered]@{
        JiraStories           = $allStories.ToArray()
        JiraEpics             = $allEpics.ToArray()
        JiraBlockermanagement = $allBlocked.ToArray()
        SquadDaten            = $squadDaten.ToArray()
    }
}

Write-Host ""
Write-Host "  Schreibe Output: $outFile"
$output | ConvertTo-Json -Depth 20 | Set-Content -Path $outFile -Encoding UTF8

Write-Host ""
Write-Host "=================================================="
Write-Host "  Export erfolgreich abgeschlossen! ($syncMode)"
Write-Host "  $($allStories.Count) Stories | $($allEpics.Count) Epics | $($allBlocked.Count) Blocked-Episoden | $($squadDaten.Count) Squads"
Write-Host "  Datei: $outFile"
Write-Host "=================================================="
Write-Host ""
