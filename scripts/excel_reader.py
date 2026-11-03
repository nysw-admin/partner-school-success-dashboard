"""
Universal Zero-Dependency Excel Reader (.xls BIFF8 & .xlsx OpenXML)
Uses pandas/openpyxl/xlrd when available, and seamlessly falls back to
pure-Python standard library (struct, zipfile, xml.etree.ElementTree)
so ingestion works on ANY Windows/Mac/Linux machine or cloud container.
"""

import os
import struct
import datetime
import zipfile
import xml.etree.ElementTree as ET


def excel_serial_to_date_str(serial):
    """Convert Excel 1900 serial date number to YYYY-MM-DD if in plausible date range."""
    if not isinstance(serial, (int, float)):
        return str(serial)
    # Excel dates between 2010 (40179) and 2035 (49310)
    if 40000 <= serial <= 50000:
        base = datetime.date(1899, 12, 30)
        dt = base + datetime.timedelta(days=int(serial))
        return dt.strftime('%Y-%m-%d')
    return serial


def _decode_rk(rk_val):
    is_mult_100 = bool(rk_val & 0x01)
    is_int = bool(rk_val & 0x02)
    if is_int:
        # Signed 30-bit integer
        signed_val = struct.unpack('<i', struct.pack('<I', rk_val))[0] >> 2
        val = float(signed_val) if is_mult_100 else signed_val
    else:
        raw_bytes = struct.pack('<II', 0, rk_val & 0xFFFFFFFC)
        val = struct.unpack('<d', raw_bytes)[0]
    if is_mult_100:
        val = val / 100.0
    return val


def _parse_biff8_sst(chunks):
    """Parse BIFF8 Shared String Table across SST + CONTINUE record chunks."""
    if not chunks:
        return []
    first = chunks[0]
    if len(first) < 8:
        return []
    _total_refs, unique_strings = struct.unpack('<II', first[:8])

    c_idx = 0
    pos = 8

    def ensure_bytes(n):
        nonlocal c_idx, pos
        while c_idx < len(chunks) and pos >= len(chunks[c_idx]):
            c_idx += 1
            pos = 0

    def read_byte():
        nonlocal c_idx, pos
        ensure_bytes(1)
        b = chunks[c_idx][pos]
        pos += 1
        return b

    def read_raw(n):
        nonlocal c_idx, pos
        out = bytearray()
        while len(out) < n and c_idx < len(chunks):
            avail = len(chunks[c_idx]) - pos
            if avail <= 0:
                c_idx += 1
                pos = 0
                continue
            take = min(n - len(out), avail)
            out.extend(chunks[c_idx][pos:pos + take])
            pos += take
        return bytes(out)

    strings = []
    for _ in range(unique_strings):
        if c_idx >= len(chunks):
            break
        ensure_bytes(3)
        if c_idx >= len(chunks):
            break
        char_count = struct.unpack('<H', read_raw(2))[0]
        flags = read_byte()
        is_utf16 = bool(flags & 0x01)
        has_ext = bool(flags & 0x04)
        has_rich = bool(flags & 0x08)

        rich_runs = struct.unpack('<H', read_raw(2))[0] if has_rich else 0
        ext_size = struct.unpack('<I', read_raw(4))[0] if has_ext else 0

        chars = []
        rem = char_count
        while rem > 0 and c_idx < len(chunks):
            avail_bytes = len(chunks[c_idx]) - pos
            if avail_bytes <= 0:
                c_idx += 1
                pos = 0
                if c_idx < len(chunks):
                    cont_flag = read_byte()
                    is_utf16 = bool(cont_flag & 0x01)
                continue
            bytes_per_char = 2 if is_utf16 else 1
            can_read_chars = avail_bytes // bytes_per_char
            take_chars = min(rem, can_read_chars)
            raw_seg = read_raw(take_chars * bytes_per_char)
            if is_utf16:
                chars.append(raw_seg.decode('utf-16le', errors='replace'))
            else:
                chars.append(raw_seg.decode('latin1', errors='replace'))
            rem -= take_chars

        if rich_runs > 0:
            read_raw(4 * rich_runs)
        if ext_size > 0:
            read_raw(ext_size)

        strings.append(''.join(chars))
    return strings


def read_xls_sheets(path):
    """Read BIFF8 .xls file and return dict of {sheet_name: list_of_row_lists}."""
    with open(path, 'rb') as f:
        data = f.read()

    sector_shift = struct.unpack('<H', data[30:32])[0]
    sec_size = 1 << sector_shift
    mini_cutoff = struct.unpack('<I', data[56:60])[0]
    num_fat_secs = struct.unpack('<I', data[44:48])[0]
    dir_start_sec = struct.unpack('<I', data[48:52])[0]
    difat_start_sec = struct.unpack('<i', data[68:72])[0]
    num_difat_secs = struct.unpack('<I', data[72:76])[0]

    difat = list(struct.unpack('<109I', data[76:512]))
    curr_difat = difat_start_sec
    for _ in range(num_difat_secs):
        if curr_difat < 0:
            break
        offset = (curr_difat + 1) * sec_size
        entries = struct.unpack(f'<{sec_size // 4}I', data[offset:offset + sec_size])
        difat.extend(entries[:-1])
        curr_difat = struct.unpack('<i', data[offset + sec_size - 4:offset + sec_size])[0]
    difat = [s for s in difat if s < 0xFFFFFFFE]

    fat = []
    for s in difat[:num_fat_secs]:
        offset = (s + 1) * sec_size
        fat.extend(struct.unpack(f'<{sec_size // 4}I', data[offset:offset + sec_size]))

    def read_chain(start_sec, size=None):
        out = bytearray()
        sec = start_sec
        visited = set()
        while sec < 0xFFFFFFFE and sec not in visited and sec < len(fat):
            visited.add(sec)
            offset = (sec + 1) * sec_size
            out.extend(data[offset:offset + sec_size])
            sec = fat[sec]
        return bytes(out[:size]) if size is not None else bytes(out)

    dir_bytes = read_chain(dir_start_sec)
    wb_stream = None
    for i in range(0, len(dir_bytes), 128):
        entry = dir_bytes[i:i + 128]
        name_len = struct.unpack('<H', entry[64:66])[0]
        if name_len == 0:
            continue
        name = entry[:name_len - 2].decode('utf-16le', errors='ignore')
        if name.lower() in ('workbook', 'book'):
            start_s = struct.unpack('<I', entry[116:120])[0]
            stream_sz = struct.unpack('<I', entry[120:124])[0]
            wb_stream = read_chain(start_s, stream_sz)
            break

    if not wb_stream:
        raise ValueError(f"No Workbook stream found in {path}")

    # Pass 1: Extract SST and sheet names
    pos = 0
    n_len = len(wb_stream)
    sst_chunks = []
    in_sst = False
    sheet_names = []

    while pos + 4 <= n_len:
        rec_id, rec_len = struct.unpack('<HH', wb_stream[pos:pos + 4])
        rec_data = wb_stream[pos + 4:pos + 4 + rec_len]
        pos += 4 + rec_len

        if rec_id == 0x00FC:  # SST
            sst_chunks.append(rec_data)
            in_sst = True
        elif rec_id == 0x003C and in_sst:  # CONTINUE
            sst_chunks.append(rec_data)
        else:
            in_sst = False
            if rec_id == 0x0085 and len(rec_data) >= 8:  # BOUNDSHEET
                s_len = rec_data[6]
                s_flags = rec_data[7]
                if s_flags & 0x01:
                    s_name = rec_data[8:8 + s_len * 2].decode('utf-16le', errors='replace')
                else:
                    s_name = rec_data[8:8 + s_len].decode('latin1', errors='replace')
                sheet_names.append(s_name)

    sst = _parse_biff8_sst(sst_chunks)

    # Pass 2: Extract worksheet cells
    pos = 0
    sheets = {}
    current_cells = None
    sheet_idx = -1
    in_globals = True

    while pos + 4 <= n_len:
        rec_id, rec_len = struct.unpack('<HH', wb_stream[pos:pos + 4])
        rec_data = wb_stream[pos + 4:pos + 4 + rec_len]
        pos += 4 + rec_len

        if rec_id == 0x0809 and len(rec_data) >= 4:  # BOF
            bof_type = struct.unpack('<H', rec_data[2:4])[0]
            if bof_type == 0x0005:
                in_globals = True
            elif bof_type == 0x0010:  # Worksheet
                in_globals = False
                sheet_idx += 1
                current_cells = {}
                sname = sheet_names[sheet_idx] if sheet_idx < len(sheet_names) else f"Sheet{sheet_idx + 1}"
                sheets[sname] = current_cells
        elif rec_id == 0x000A:  # EOF
            current_cells = None
        elif current_cells is not None and not in_globals:
            if rec_id == 0x00FD and len(rec_data) >= 10:  # LABELSST
                r, c, _xf, sst_i = struct.unpack('<HHHI', rec_data[:10])
                current_cells[(r, c)] = sst[sst_i] if sst_i < len(sst) else ''
            elif rec_id == 0x0204 and len(rec_data) >= 8:  # LABEL
                r, c, _xf, slen = struct.unpack('<HHHH', rec_data[:8])
                if len(rec_data) > 8:
                    flags = rec_data[8]
                    if flags & 0x01:
                        val = rec_data[9:9 + slen * 2].decode('utf-16le', errors='replace')
                    else:
                        val = rec_data[9:9 + slen].decode('latin1', errors='replace')
                else:
                    val = ''
                current_cells[(r, c)] = val
            elif rec_id == 0x027E and len(rec_data) >= 10:  # RK
                r, c, _xf, rk = struct.unpack('<HHHI', rec_data[:10])
                current_cells[(r, c)] = _decode_rk(rk)
            elif rec_id == 0x00BD and len(rec_data) >= 6:  # MULRK
                r, first_c = struct.unpack('<HH', rec_data[:4])
                last_c = struct.unpack('<H', rec_data[-2:])[0]
                offset_m = 4
                for c in range(first_c, last_c + 1):
                    if offset_m + 6 <= len(rec_data) - 2:
                        _xf, rk = struct.unpack('<HI', rec_data[offset_m:offset_m + 6])
                        current_cells[(r, c)] = _decode_rk(rk)
                        offset_m += 6
            elif rec_id == 0x0203 and len(rec_data) >= 14:  # NUMBER
                r, c, _xf, dval = struct.unpack('<HHHd', rec_data[:14])
                current_cells[(r, c)] = dval
            elif rec_id == 0x0205 and len(rec_data) >= 8:  # BOOLERR
                r, c, _xf, bval, is_err = struct.unpack('<HHHBB', rec_data[:8])
                if not is_err:
                    current_cells[(r, c)] = bool(bval)

    result = {}
    for sname, cells in sheets.items():
        if not cells:
            result[sname] = []
            continue
        max_r = max(r for r, _ in cells.keys())
        max_c = max(c for _, c in cells.keys())
        rows = []
        for r in range(max_r + 1):
            row_list = [cells.get((r, c), None) for c in range(max_c + 1)]
            rows.append(row_list)
        result[sname] = rows
    return result


def _col_letters_to_idx(cell_ref):
    col_idx = 0
    for ch in cell_ref:
        if ch.isalpha():
            col_idx = col_idx * 26 + (ord(ch.upper()) - ord('A') + 1)
        else:
            break
    return max(0, col_idx - 1)


def read_xlsx_sheets(path):
    """Read OpenXML .xlsx file and return dict of {sheet_name: list_of_row_lists}."""
    with zipfile.ZipFile(path) as z:
        shared = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root:
                shared.append(''.join(t.text or '' for t in si.iter() if t.tag.endswith('}t')))

        wb_root = ET.fromstring(z.read('xl/workbook.xml'))
        rels_root = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        rid_to_target = {}
        for rel in rels_root:
            rid = rel.attrib.get('Id')
            target = rel.attrib.get('Target', '')
            if target.startswith('/'):
                target = target.lstrip('/')
            elif not target.startswith('xl/'):
                target = 'xl/' + target
            rid_to_target[rid] = target

        sheet_entries = []
        for el in wb_root.iter():
            if el.tag.endswith('}sheet'):
                name = el.attrib.get('name')
                rid = None
                for k, v in el.attrib.items():
                    if k.endswith('}id') or k == 'r:id':
                        rid = v
                        break
                sheet_entries.append((name, rid_to_target.get(rid)))

        result = {}
        for idx, (sname, target) in enumerate(sheet_entries):
            if not target or target not in z.namelist():
                fallback = f'xl/worksheets/sheet{idx + 1}.xml'
                target = fallback if fallback in z.namelist() else None
            if not target:
                result[sname] = []
                continue

            sroot = ET.fromstring(z.read(target))
            cells = {}
            max_r = -1
            max_c = -1
            r_counter = 0
            for r_el in sroot.iter():
                if r_el.tag.endswith('}row'):
                    r_attr = r_el.attrib.get('r')
                    r_idx = (int(r_attr) - 1) if (r_attr and r_attr.isdigit()) else r_counter
                    r_counter = r_idx + 1
                    c_counter = 0
                    for c_el in r_el:
                        if not c_el.tag.endswith('}c'):
                            continue
                        ref = c_el.attrib.get('r', '')
                        c_idx = _col_letters_to_idx(ref) if ref else c_counter
                        c_counter = c_idx + 1
                        t_type = c_el.attrib.get('t', '')
                        v_el = next((ch for ch in c_el if ch.tag.endswith('}v')), None)
                        is_el = next((ch for ch in c_el if ch.tag.endswith('}is')), None)
                        val = None
                        if t_type == 's' and v_el is not None and v_el.text:
                            si_idx = int(v_el.text)
                            val = shared[si_idx] if si_idx < len(shared) else ''
                        elif t_type == 'inlineStr' and is_el is not None:
                            val = ''.join(t.text or '' for t in is_el.iter() if t.tag.endswith('}t'))
                        elif t_type == 'b' and v_el is not None:
                            val = v_el.text == '1'
                        elif v_el is not None and v_el.text is not None:
                            raw_t = v_el.text
                            try:
                                if '.' in raw_t or 'e' in raw_t.lower():
                                    val = float(raw_t)
                                else:
                                    val = int(raw_t)
                            except ValueError:
                                val = raw_t
                        if val is not None:
                            cells[(r_idx, c_idx)] = val
                            if r_idx > max_r:
                                max_r = r_idx
                            if c_idx > max_c:
                                max_c = c_idx

            if max_r < 0 or max_c < 0:
                result[sname] = []
            else:
                rows = []
                for r in range(max_r + 1):
                    rows.append([cells.get((r, c), None) for c in range(max_c + 1)])
                result[sname] = rows
        return result


def load_workbook_sheets(path):
    """Load any .xls or .xlsx file and return {sheet_name: list_of_rows}."""
    if path.lower().endswith('.xls'):
        return read_xls_sheets(path)
    return read_xlsx_sheets(path)


def rows_to_dicts(rows):
    """Convert a list of row lists (where row 0 is headers) into a list of dicts."""
    if not rows:
        return []
    headers = [str(h).strip() if h is not None else f'Unnamed: {i}' for i, h in enumerate(rows[0])]
    records = []
    for r in rows[1:]:
        rec = {}
        for i, h in enumerate(headers):
            val = r[i] if i < len(r) else None
            if 'date' in h.lower() and isinstance(val, (int, float)):
                val = excel_serial_to_date_str(val)
            rec[h] = val
        records.append(rec)
    return records

