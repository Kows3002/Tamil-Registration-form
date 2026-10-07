"""Read official English names without assuming that legacy codes are LGD codes."""
import json
import re
from pathlib import Path
from collections import defaultdict
from pypdf import PdfReader
from extractMasterData import read_html_xls, read_xlsx

root = Path(__file__).resolve().parents[1]
source = root / 'data' / 'master-source'
norm = lambda value: re.sub(r'[^a-z0-9]', '', str(value).lower())
blocks = {str(row[2]): row[3].strip().title() for row in read_html_xls(source / 'block_english.xls')[1:] if len(row) >= 4 and row[2].isdigit()}
villages = {}
village_keys = defaultdict(set)
for page in PdfReader(source / 'village_english.pdf').pages:
    for line in page.extract_text().splitlines():
        match = re.match(r'^(\d+)\s+(.+?)\s+(\d+)\s+(.+?)\s+(\d{5,8})\s+(.+)$', line.strip())
        if not match:
            continue
        district_code, district_name, block_code, block_name, code, name = match.groups()
        villages[code] = name.strip()
        village_keys[(norm(block_name), norm(name))].add(code)
habitations = {}
ambiguous = 0
for row in read_xlsx(source / 'dist_blk_vill_hab_english.xlsx', 'Sheet4')[2:]:
    if len(row) < 9 or not row[7].isdigit() or not row[8].strip():
        continue
    candidates = village_keys.get((norm(row[4]), norm(row[6])), set())
    if len(candidates) != 1:
        ambiguous += 1
        continue
    key = next(iter(candidates)) + ':' + row[7]
    name = row[8].strip()
    if key in habitations and habitations[key] != name:
        habitations[key] = None
    else:
        habitations[key] = name
habitations = {key: value for key, value in habitations.items() if value}
assert len(blocks) > 350 and len(villages) > 12000 and len(habitations) > 60000, 'Incomplete official English master extraction.'
output = root / 'data' / 'generated' / 'english-master-data.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'blocks': blocks, 'villages': villages, 'habitations': habitations}), encoding='utf-8')
print(json.dumps({'blocks': len(blocks), 'villages': len(villages), 'habitations': len(habitations), 'unmatchedLegacyRows': ambiguous}))
