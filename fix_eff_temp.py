import sys

filepath = r'E:\projects\plugins\eff\admin\js\eff-colors.js'
outpath = r'E:\projects\plugins\eff\fix_eff_result.txt'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

results = []

# Detect line ending
if '\r\n' in content:
    nl = '\r\n'
    results.append("Line endings: CRLF")
else:
    nl = '\n'
    results.append("Line endings: LF")

t4 = '\t' * 4
t5 = '\t' * 5
t6 = '\t' * 6

old = (
    t4 + "var targetRow = el ? el.closest('.eff-color-row') : null;" + nl +
    nl +
    t4 + "if (targetRow && targetRow.getAttribute('data-var-id') !== _drag.varId) {"
)

new = (
    t4 + "var targetRow = el ? el.closest('.eff-color-row') : null;" + nl +
    nl +
    t4 + "// Auto-expand a collapsed category block when the drag ghost enters it," + nl +
    t4 + "// so cross-category drops can show a row-level drop indicator." + nl +
    t4 + "if (!targetRow && el) {" + nl +
    t5 + "var hoverBlock = el.closest('.eff-category-block');" + nl +
    t5 + "if (hoverBlock && hoverBlock.getAttribute('data-collapsed') === 'true') {" + nl +
    t6 + "hoverBlock.setAttribute('data-collapsed', 'false');" + nl +
    t6 + "// Re-probe now that the rows are visible." + nl +
    t6 + "_drag.ghost.style.display = 'none';" + nl +
    t6 + "var el2 = document.elementFromPoint(e.clientX, e.clientY);" + nl +
    t6 + "_drag.ghost.style.display = '';" + nl +
    t6 + "var newRow = el2 ? el2.closest('.eff-color-row') : null;" + nl +
    t6 + "if (newRow) { targetRow = newRow; }" + nl +
    t5 + "}" + nl +
    t4 + "}" + nl +
    nl +
    t4 + "if (targetRow && targetRow.getAttribute('data-var-id') !== _drag.varId) {"
)

if old in content:
    new_content = content.replace(old, new, 1)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    results.append("SUCCESS: replacement applied")
else:
    results.append("ERROR: old string not found")
    # Show lines around 1968
    lines = content.splitlines()
    for i in range(1965, 1973):
        results.append(f"Line {i+1}: {repr(lines[i])}")

with open(outpath, 'w', encoding='utf-8') as f:
    f.write('\n'.join(results) + '\n')
