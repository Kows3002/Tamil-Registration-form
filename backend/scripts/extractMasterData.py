#!/usr/bin/env python3
"""Convert the supplied Tamil Nadu master-data sources to validated JSON.

Source files are read only. The generated JSON is disposable and rebuilt for each import.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from xml.etree import ElementTree as ET

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / 'data' / 'master-source'
DEFAULT_OUTPUT = ROOT / 'data' / 'generated' / 'master-data.json'
EXCEL_NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
            'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

# English names keyed by official LGD district code, from the Tamil Nadu Rural
# Development & Panchayat Raj Directorate district-code list.
DISTRICT_ENGLISH_BY_LGD_CODE = {
    '528': 'Kancheepuram', '543': 'Tiruvallur', '524': 'Cuddalore', '550': 'Viluppuram',
    '549': 'Vellore', '547': 'Tiruvannamalai', '538': 'Salem', '534': 'Namakkal',
    '525': 'Dharmapuri', '527': 'Erode', '523': 'Coimbatore', '541': 'The Nilgiris',
    '540': 'Thanjavur', '533': 'Nagapattinam', '544': 'Tiruvarur', '545': 'Tiruchirappalli',
    '530': 'Karur', '535': 'Perambalur', '536': 'Pudukkottai', '532': 'Madurai',
    '542': 'Theni', '526': 'Dindigul', '537': 'Ramanathapuram', '551': 'Virudhunagar',
    '539': 'Sivagangai', '546': 'Tirunelveli', '548': 'Thoothukkudi', '529': 'Kanniyakumari',
    '531': 'Krishnagiri', '560': 'Ariyalur', '578': 'Tiruppur', '296956': 'Tenkasi',
    '296959': 'Kallakurichi', '296974': 'Chengalpattu', '296957': 'Ranipet',
    '296958': 'Tirupathur', '299380': 'Mayiladuthurai',
}


class HtmlTables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self.table_index = -1
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == 'table':
            self.tables.append([])
            self.table_index += 1
        elif tag == 'tr' and self.table_index >= 0:
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ('td', 'th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if any(self.row):
                self.tables[self.table_index].append(self.row)
            self.row = None
        elif tag == 'table':
            self.table_index = -1


def clean_text(value) -> str:
    value = str(value or '').replace('_x000D_', ' ').replace('\r', ' ').replace('\n', ' ')
    return ' '.join(value.split()).strip()


def read_html_xls(path: Path) -> list[list[str]]:
    parser = HtmlTables()
    parser.feed(path.read_text(encoding='utf-8-sig', errors='replace'))
    if not parser.tables or not parser.tables[0]:
        raise ValueError(f'No HTML table found in {path.name}')
    return [[clean_text(value) for value in row] for row in parser.tables[0]]


def read_xlsx(path: Path, wanted_sheet='Sheet1') -> list[list[str]]:
    ns_main = '{' + EXCEL_NS['m'] + '}'
    ns_rel = '{' + EXCEL_NS['r'] + '}'
    with zipfile.ZipFile(path) as workbook:
        book = ET.fromstring(workbook.read('xl/workbook.xml'))
        rels = ET.fromstring(workbook.read('xl/_rels/workbook.xml.rels'))
        targets = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
        sheet = next((s for s in book.findall('m:sheets/m:sheet', EXCEL_NS)
                      if s.attrib['name'] == wanted_sheet), None)
        if sheet is None:
            raise ValueError(f'Sheet {wanted_sheet} is missing in {path.name}')
        target = targets[sheet.attrib[ns_rel + 'id']].lstrip('/')
        sheet_path = target if target.startswith('xl/') else 'xl/' + target
        shared = []
        if 'xl/sharedStrings.xml' in workbook.namelist():
            strings = ET.fromstring(workbook.read('xl/sharedStrings.xml'))
            shared = [''.join(t.text or '' for t in item.findall('.//m:t', EXCEL_NS))
                      for item in strings.findall('m:si', EXCEL_NS)]
        root = ET.fromstring(workbook.read(sheet_path))
        rows = []
        for row in root.findall('.//m:sheetData/m:row', EXCEL_NS):
            values = []
            for cell in row.findall('m:c', EXCEL_NS):
                ref = cell.attrib['r']
                column = re.match(r'[A-Z]+', ref).group(0)
                index = 0
                for letter in column:
                    index = index * 26 + ord(letter) - 64
                index -= 1
                while len(values) <= index:
                    values.append('')
                value = cell.find('m:v', EXCEL_NS)
                inline = cell.find('m:is', EXCEL_NS)
                if cell.attrib.get('t') == 's' and value is not None:
                    values[index] = shared[int(value.text)]
                elif cell.attrib.get('t') == 'inlineStr' and inline is not None:
                    values[index] = ''.join(t.text or '' for t in inline.findall('.//m:t', EXCEL_NS))
                elif value is not None:
                    values[index] = value.text or ''
            if any(values):
                rows.append([clean_text(value) for value in values])
        return rows


def rowdicts(rows, expected_headers, filename):
    if not rows:
        raise ValueError(f'Empty source: {filename}')
    actual = [clean_text(x).casefold() for x in rows[0]]
    if actual != expected_headers:
        raise ValueError(f'Unexpected columns in {filename}: {rows[0]}')
    return [dict(zip(expected_headers, row)) for row in rows[1:] if any(row)]


def required_code(record, key):
    value = clean_text(record.get(key))
    if not re.fullmatch(r'\d+', value):
        return ''
    return value


def read_pdf_assemblies(path: Path):
    records, tamil_chunks = [], 0
    reader = PdfReader(str(path))
    for page_number, page in enumerate(reader.pages, start=1):
        chunks = []

        def visit(text, cm, tm, font, size):
            if text.strip():
                chunks.append((tm[4], tm[5], text))

        page.extract_text(visitor_text=visit)
        for x, y, text in chunks:
            if x < 200 and re.match(r'^\s*[A-Za-z]', text):
                name = clean_text(text)
                if name.casefold() not in ('english tamil', 'assembly constituency name'):
                    records.append({'name': name, 'nameTamil': None,
                                    'sourceOrder': len(records) + 1,
                                    'sourcePage': page_number})
            elif x >= 200 and re.search(r'[\u0b80-\u0bff]', text):
                tamil_chunks += 1
    names = [unicodedata.normalize('NFKC', r['name']).casefold() for r in records]
    duplicates = [name for name, count in Counter(names).items() if count > 1]
    if duplicates:
        raise ValueError(f'Duplicate assembly names without source numbers: {duplicates[:10]}')
    for record, name in zip(records, names):
        record['sourceKey'] = 'english-name:' + name
        record['officialNumber'] = None
        record['officialCode'] = None
    issues = []
    if not records:
        issues.append('Assembly constituency PDF yielded no names.')
    issues.append('Assembly PDF Tamil glyph encoding is not extractable reliably; Tamil labels were left empty.')
    issues.append('Assembly PDF contains no official constituency numbers or codes.')
    return records, issues, {'pages': len(reader.pages), 'englishNames': len(records),
                             'tamilChunks': tamil_chunks}


def read_post_offices(path: Path):
    reader = PdfReader(str(path))
    records, invalid_lines, duplicate_lines, seen = [], [], [], set()
    row_pattern = re.compile(
        r'^(?P<office>.+?)\s+(?P<pin>[1-9]\d{5})\s+'
        r'(?P<delivery>Delivery|Non-Delivery)\s+(?P<type>\S+)\s+'
        r'(?P<circle>.*?)\s+Circle\s+(?P<region>.*?)\s+'
        r'(?P<division>.+?Division)\s*$', re.IGNORECASE)
    for page in reader.pages:
        text = page.extract_text() or ''
        for line in text.splitlines():
            line = clean_text(line)
            if not re.search(r'(?<!\d)[1-9]\d{5}(?!\d)', line):
                continue
            match = row_pattern.match(line)
            if not match:
                invalid_lines.append(line)
                continue
            item = {key: clean_text(value) for key, value in match.groupdict().items()}
            item['pincode'] = item.pop('pin')
            item['deliveryStatus'] = item.pop('delivery')
            item['officeType'] = item.pop('type')
            item['circle'] = re.sub(r'\s+', ' ', item['circle']).strip()
            if item['deliveryStatus'].casefold() not in ('delivery', 'non-delivery'):
                invalid_lines.append(line)
                continue
            stable = '\x1f'.join(item[k] for k in ('office', 'pincode', 'deliveryStatus',
                                                   'officeType', 'circle', 'region', 'division'))
            if stable in seen:
                duplicate_lines.append(line)
                continue
            seen.add(stable)
            item['name'] = item.pop('office')
            item['sourceKey'] = hashlib.sha256(stable.encode('utf-8')).hexdigest()
            records.append(item)
    return records, {'pages': len(reader.pages), 'postOfficeRows': len(records),
                     'invalidRows': len(invalid_lines), 'duplicateRows': len(duplicate_lines),
                     'invalidSamples': invalid_lines[:5], 'duplicateSamples': duplicate_lines[:5]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source = args.source_dir.resolve()
    for filename in ('block_tamil.xls', 'village_tamil.xls', 'district_abstract_tamil.xls',
                     'dist_blk_vill_hab_tamil_new.xlsx', 'Assembly_Constituency_Name.pdf',
                     'post and pincode list.pdf'):
        if not (source / filename).is_file():
            raise FileNotFoundError(f'Missing supplied master source: {source / filename}')

    issues = []
    block_rows = rowdicts(read_html_xls(source / 'block_tamil.xls'),
                          ['lgd district code', 'district name', 'lgd block code', 'block name'],
                          'block_tamil.xls')
    village_rows = rowdicts(read_html_xls(source / 'village_tamil.xls'),
                            ['lgd district code', 'district name', 'lgd block code', 'block name',
                             'lgd village code', 'village name'], 'village_tamil.xls')
    habitat_rows = rowdicts(read_xlsx(source / 'dist_blk_vill_hab_tamil_new.xlsx'),
                            ['lgd dcode', 'district name', 'lgd bcode', 'block name', 'lgd pvcode',
                             'village vname', 'habitation code', 'habitation name'],
                            'dist_blk_vill_hab_tamil_new.xlsx')
    abstract_rows = read_html_xls(source / 'district_abstract_tamil.xls')
    expected = {'districts': 0, 'blocks': 0, 'villagePanchayats': 0, 'habitations': 0}
    for row in abstract_rows[3:]:
        if len(row) >= 5 and row[0].isdigit():
            expected['districts'] += 1
            expected['blocks'] += int(row[2])
            expected['villagePanchayats'] += int(row[3])
            expected['habitations'] += int(row[4])

    district_names = {}
    for row in block_rows:
        code, name = required_code(row, 'lgd district code'), clean_text(row['district name'])
        if not code or not name:
            continue
        if code in district_names and district_names[code] != name:
            issues.append(f'District code {code} has conflicting Tamil names in block source.')
        district_names[code] = name
    unmapped_district_codes = sorted(set(district_names) - set(DISTRICT_ENGLISH_BY_LGD_CODE))
    if unmapped_district_codes:
        raise ValueError(f'No verified English district name for LGD code(s): {", ".join(unmapped_district_codes)}')
    districts = [{'code': code, 'nameTamil': name,
                  'nameEnglish': DISTRICT_ENGLISH_BY_LGD_CODE.get(code, '')}
                 for code, name in district_names.items()]
    districts.sort(key=lambda x: int(x['code']))
    if len(districts) != expected['districts']:
        issues.append(f'District abstract has {expected["districts"]} rows but LGD block source resolves to {len(districts)} districts.')

    blocks, block_codes, invalid_blocks = [], set(), []
    for row in block_rows:
        code, parent, name = (required_code(row, 'lgd block code'),
                              required_code(row, 'lgd district code'), clean_text(row['block name']))
        if not code or not parent or not name or parent not in district_names:
            invalid_blocks.append(row)
            continue
        if code in block_codes:
            issues.append(f'Duplicate LGD block code {code}; duplicate source rows were skipped.')
            continue
        block_codes.add(code)
        blocks.append({'code': code, 'districtCode': parent, 'nameTamil': name})
    block_by_code = {b['code']: b for b in blocks}

    villages, village_by_code, invalid_villages = [], {}, []
    for row in village_rows:
        code, parent_district, parent_block = (required_code(row, 'lgd village code'),
                                               required_code(row, 'lgd district code'),
                                               required_code(row, 'lgd block code'))
        name = clean_text(row['village name'])
        if not code or not parent_district or not parent_block or not name:
            invalid_villages.append(row)
            continue
        block = block_by_code.get(parent_block)
        if not block or block['districtCode'] != parent_district:
            invalid_villages.append(row)
            continue
        item = {'code': code, 'districtCode': parent_district,
                'blockCode': parent_block, 'nameTamil': name}
        if code in village_by_code:
            if village_by_code[code] != item:
                issues.append(f'LGD village code {code} has conflicting records; all versions were skipped.')
                village_by_code.pop(code, None)
            else:
                issues.append(f'Duplicate LGD village code {code}; duplicate source row was skipped.')
            continue
        village_by_code[code] = item
    villages = list(village_by_code.values())
    if invalid_blocks:
        issues.append(f'{len(invalid_blocks)} block source rows lacked a code, name, or valid district parent.')
    if invalid_villages:
        issues.append(f'{len(invalid_villages)} village source rows lacked a code/name or valid block relationship.')

    combined_village_names = {}
    for row in habitat_rows:
        code = required_code(row, 'lgd pvcode')
        if code:
            combined_village_names.setdefault(code, clean_text(row['village vname']))
    name_conflicts = [(code, village_by_code[code]['nameTamil'], combined_village_names[code])
                      for code in village_by_code.keys() & combined_village_names.keys()
                      if village_by_code[code]['nameTamil'] != combined_village_names[code]]
    if name_conflicts:
        issues.append(f'{len(name_conflicts)} village Tamil names conflict between village_tamil.xls and combined workbook; village_tamil.xls is used for the Village Panchayat master.')

    habitat_source_keys, habitations, invalid_habitations, duplicate_habitations = set(), [], [], 0
    parent_code_mismatches = []
    for row_number, row in enumerate(habitat_rows, start=2):
        dcode, bcode = required_code(row, 'lgd dcode'), required_code(row, 'lgd bcode')
        vcode, hcode = required_code(row, 'lgd pvcode'), required_code(row, 'habitation code')
        name = clean_text(row['habitation name'])
        item_key = (vcode, hcode)
        village = village_by_code.get(vcode)
        if not vcode or not hcode or not name:
            invalid_habitations.append({'row': row_number, 'districtCode': dcode, 'blockCode': bcode,
                                        'villagePanchayatCode': vcode, 'habitationCode': hcode,
                                        'nameTamil': name})
            continue
        if not village:
            invalid_habitations.append({'row': row_number, 'districtCode': dcode, 'blockCode': bcode,
                                        'villagePanchayatCode': vcode, 'habitationCode': hcode,
                                        'nameTamil': name, 'reason': 'LGD village code is missing from village_tamil.xls'})
            continue
        authoritative_district = village['districtCode']
        authoritative_block = village['blockCode']
        if dcode != authoritative_district or bcode != authoritative_block:
            parent_code_mismatches.append({'row': row_number, 'villagePanchayatCode': vcode,
                                           'sourceDistrictCode': dcode, 'sourceBlockCode': bcode,
                                           'villageFileDistrictCode': authoritative_district,
                                           'villageFileBlockCode': authoritative_block})
        if item_key in habitat_source_keys:
            duplicate_habitations += 1
            continue
        habitat_source_keys.add(item_key)
        source_key = ':'.join(item_key)
        habitations.append({'sourceKey': source_key, 'code': hcode,
                            'districtCode': authoritative_district, 'blockCode': authoritative_block,
                            'villagePanchayatCode': vcode, 'nameTamil': name,
                            'sourceDistrictCode': dcode if dcode != authoritative_district else None,
                            'sourceBlockCode': bcode if bcode != authoritative_block else None})
    if invalid_habitations:
        issues.append(f'{len(invalid_habitations)} habitation row(s) were skipped for missing required data or parent relationship.')
    if duplicate_habitations:
        issues.append(f'{duplicate_habitations} duplicate habitation compound key(s) were skipped.')
    if parent_code_mismatches:
        issues.append(f'{len(parent_code_mismatches)} combined-workbook district/block codes differ from the source row for the same unique LGD village code; parent relationships were resolved only by that official village code.')
    if expected['habitations'] != len(habitations):
        issues.append(f'District abstract total is {expected["habitations"]} habitations; {len(habitations)} complete unique habitation rows are supplied.')

    assemblies, assembly_issues, assembly_metrics = read_pdf_assemblies(source / 'Assembly_Constituency_Name.pdf')
    issues.extend(assembly_issues)
    posts, post_metrics = read_post_offices(source / 'post and pincode list.pdf')
    if post_metrics['invalidRows']:
        issues.append(f'{post_metrics["invalidRows"]} postal rows could not be parsed and were skipped.')
    if post_metrics['duplicateRows']:
        issues.append(f'{post_metrics["duplicateRows"]} duplicate postal rows were skipped.')
    pincodes = sorted({record['pincode'] for record in posts})

    village_name_map = {r['code']: r['nameTamil'] for r in villages}
    parent_issues = []
    if any(b['districtCode'] not in district_names for b in blocks):
        parent_issues.append('block -> district')
    if any(v['blockCode'] not in block_by_code for v in villages):
        parent_issues.append('villagePanchayat -> block')
    if any(h['villagePanchayatCode'] not in village_name_map for h in habitations):
        parent_issues.append('habitation -> villagePanchayat')
    if parent_issues:
        issues.append('Unresolved parent relationships remain: ' + ', '.join(parent_issues))

    data = {
        'sourceFiles': ['block_tamil.xls', 'district_abstract_tamil.xls',
                        'village_tamil.xls', 'dist_blk_vill_hab_tamil_new.xlsx',
                        'Assembly_Constituency_Name.pdf', 'post and pincode list.pdf'],
        'expectedTotals': expected,
        'records': {'districts': districts, 'blocks': blocks, 'villagePanchayats': villages,
                    'habitations': habitations, 'assemblyConstituencies': assemblies,
                    'postOffices': posts, 'pincodes': [{'code': code} for code in pincodes]},
        'metrics': {
            'districts': {'sourceRows': len(district_names), 'valid': len(districts), 'invalid': 0},
            'blocks': {'sourceRows': len(block_rows), 'valid': len(blocks), 'invalid': len(invalid_blocks)},
            'villagePanchayats': {'sourceRows': len(village_rows), 'valid': len(villages), 'invalid': len(invalid_villages), 'nameConflicts': len(name_conflicts)},
            'habitations': {'sourceRows': len(habitat_rows), 'valid': len(habitations), 'invalid': len(invalid_habitations), 'duplicates': duplicate_habitations, 'parentCodeMismatches': len(parent_code_mismatches)},
            'assemblyConstituencies': assembly_metrics,
            'postOffices': post_metrics,
            'pincodes': {'uniqueCodes': len(pincodes)},
        },
        'dataIssues': issues,
        'invalidHabitations': invalid_habitations,
        'parentCodeMismatches': parent_code_mismatches,
        'villageNameConflicts': [{'code': code, 'villageTamilFile': left, 'combinedWorkbook': right}
                                 for code, left, right in name_conflicts],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(json.dumps({'output': str(args.output), 'counts': {key: len(value) for key, value in data['records'].items()},
                      'expectedTotals': expected, 'metrics': data['metrics'],
                      'dataIssues': issues, 'invalidHabitations': invalid_habitations[:10],
                      'parentCodeMismatchSamples': parent_code_mismatches[:5],
                      'villageNameConflicts': data['villageNameConflicts']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Master-data extraction failed: {error}', file=sys.stderr)
        raise
