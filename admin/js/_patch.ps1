$file = 'E:\projects\plugins\eff\admin\js\aff-panel-right.js'
$src = [System.IO.File]::ReadAllText($file)

# Detect line endings
$crlf = $src.Contains("`r`n")
$nl = if ($crlf) { "`r`n" } else { "`n" }

Write-Host "CRLF: $crlf"

# Edit 4a: add 'var syncHandler;' before AFF.Modal.open in _openSyncOptionsDialog
$old4a = "_openSyncOptionsDialog: function () {" + $nl + "`t`t`t" + "AFF.Modal.open({"
$new4a = "_openSyncOptionsDialog: function () {" + $nl + "`t`t`t" + "var syncHandler;" + $nl + "`t`t`t" + "AFF.Modal.open({"
if ($src.Contains($old4a)) {
    $src = $src.Replace($old4a, $new4a)
    Write-Host "Edit 4a: OK"
} else {
    Write-Host "Edit 4a: NOT FOUND"
}

# Edit 4b: add onClose to sync modal (after the Sync footer closing + </div>,' before });)
$old4b = "`t`t`t`t" + "+ '</div>'," + $nl + "`t`t`t" + "});"
# There are two such patterns (one for _openSyncOptionsDialog, one elsewhere)
# Target specifically the one in _openSyncOptionsDialog by using aff-sync-confirm context
$old4b = "id=`"aff-sync-confirm`">Sync</button>'" + $nl + "`t`t`t`t`t" + "+ '</div>'," + $nl + "`t`t`t" + "});"
$new4b = "id=`"aff-sync-confirm`">Sync</button>'" + $nl + "`t`t`t`t`t" + "+ '</div>'," + $nl + "`t`t`t`t" + "onClose: function () { document.removeEventListener('click', syncHandler); }," + $nl + "`t`t`t" + "});"
if ($src.Contains($old4b)) {
    $src = $src.Replace($old4b, $new4b)
    Write-Host "Edit 4b: OK"
} else {
    Write-Host "Edit 4b: NOT FOUND"
    # Try alternate indent
    $old4b2 = "id=`"aff-sync-confirm`">Sync</button>'" + $nl + "`t`t`t`t" + "+ '</div>'," + $nl + "`t`t`t" + "});"
    $new4b2 = "id=`"aff-sync-confirm`">Sync</button>'" + $nl + "`t`t`t`t" + "+ '</div>'," + $nl + "`t`t`t`t" + "onClose: function () { document.removeEventListener('click', syncHandler); }," + $nl + "`t`t`t" + "});"
    if ($src.Contains($old4b2)) {
        $src = $src.Replace($old4b2, $new4b2)
        Write-Host "Edit 4b (alt): OK"
    } else {
        Write-Host "Edit 4b (alt): NOT FOUND EITHER"
    }
}

# Edit 4c: change syncHandler's closing }); to }; and add addEventListener
# This is the }); at end of document.addEventListener('click', syncHandler = function(e){...});
# Now that we renamed it to syncHandler = function(e){, we need to close with }; + add addEventListener
$old4c = "AFF.PanelTop._syncFromElementor({});" + $nl + "`t`t`t`t`t" + "}" + $nl + "`t`t`t`t" + "}" + $nl + "`t`t`t" + "}" + $nl + "`t`t`t" + "});" + $nl + "`t`t" + "},"
$new4c = "AFF.PanelTop._syncFromElementor({});" + $nl + "`t`t`t`t`t" + "}" + $nl + "`t`t`t`t" + "}" + $nl + "`t`t`t" + "}" + $nl + "`t`t`t" + "};" + $nl + "`t`t`t" + "document.addEventListener('click', syncHandler);" + $nl + "`t`t" + "},"
if ($src.Contains($old4c)) {
    $src = $src.Replace($old4c, $new4c)
    Write-Host "Edit 4c: OK"
} else {
    Write-Host "Edit 4c: NOT FOUND"
    # Try without the extra tab on }
    $old4c2 = "AFF.PanelTop._syncFromElementor({});" + $nl + "`t`t`t`t" + "}" + $nl + "`t`t`t" + "}" + $nl + "`t`t`t" + "});" + $nl + "`t`t" + "},"
    $new4c2 = "AFF.PanelTop._syncFromElementor({});" + $nl + "`t`t`t`t" + "}" + $nl + "`t`t`t" + "}" + $nl + "`t`t`t" + "};" + $nl + "`t`t`t" + "document.addEventListener('click', syncHandler);" + $nl + "`t`t" + "},"
    if ($src.Contains($old4c2)) {
        $src = $src.Replace($old4c2, $new4c2)
        Write-Host "Edit 4c (alt): OK"
    } else {
        Write-Host "Edit 4c (alt): NOT FOUND EITHER"
    }
}

[System.IO.File]::WriteAllText($file, $src)
Write-Host "File saved."
