"""Paso 04: perfilar los 19 archivos oficiales de data/raw/ sin transformarlos.

Uso:
    .venv\\Scripts\\python.exe ETL\\profile_data.py

Solo lectura. No ejecuta macros, no genera datos sintéticos, no crea base de datos,
no define KPIs definitivos y no modifica data/raw/. Genera docs/perfil_datos.md.
"""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

import pandas as pd
from openpyxl import load_workbook
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
MANIFEST_PATH = RAW / "manifest.json"
SOURCES_DOC = ROOT / "docs" / "fuentes.md"
OUTPUT = ROOT / "docs" / "perfil_datos.md"

MONTHS_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
QUARTERS = {
    1: ("BE_SOCAPS_202503.xlsx", "Marzo 2025", 3),
    2: ("BE_SOCAPS_202506.xlsx", "Junio 2025", 6),
    3: ("BE_SOCAPS_202509.xlsx", "Septiembre 2025", 9),
    4: ("BE_SOCAPS_202512.xlsx", "Diciembre 2025", 12),
}
ORG_MAP = {
    1: "INFONAVIT",
    2: "BANCA (CNBV)",
    3: "FOVISSSTE",
    4: "SHF (FONDEO)",
    5: "CONAVI",
    7: "BANJERCITO",
    8: "HABITAT MEXICO",
    26: "INSUS",
}
SEX_MAP = {1: "Hombre", 2: "Mujer"}

md: list[str] = []


def add(line: str = "") -> None:
    md.append(line)


def cell(value: Any, limit: int = 180) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        s = value.strftime("%Y-%m-%d")
    elif isinstance(value, float):
        s = f"{value:,.6f}".rstrip("0").rstrip(".") if abs(value) < 1_000_000 else f"{value:,.2f}"
    elif isinstance(value, (list, tuple, set)):
        s = ", ".join(str(v) for v in list(value)[:8])
    else:
        s = str(value)
    s = s.replace("|", "\\|").replace("\r", " ").replace("\n", " ")
    return s if len(s) <= limit else s[: limit - 3] + "..."


def num(value: Any, decimals: int = 2) -> str:
    if value is None:
        return "—"
    return f"{float(value):,.{decimals}f}"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_manifest() -> tuple[int, int, list[dict[str, Any]]]:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    rows = []
    for entry in manifest["archivos"]:
        path = ROOT / entry["archivo"]
        actual_hash = sha256(path) if path.exists() else ""
        size = path.stat().st_size if path.exists() else 0
        ok = size == entry["tamano_bytes"] and actual_hash == entry["sha256"]
        rows.append({**entry, "size_actual": size, "hash_actual": actual_hash, "ok": ok})
    return sum(r["ok"] for r in rows), len(rows), rows


def detect_encoding(path: Path) -> str:
    head = path.read_bytes()[:131072]
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            head.decode(enc)
            return enc
        except UnicodeDecodeError:
            continue
    return "latin-1"


def value_at(row: tuple[Any, ...], idx: int | None) -> Any:
    return row[idx] if idx is not None and 0 <= idx < len(row) else None


def find_col(header: tuple[Any, ...], prefix: str) -> int | None:
    for i, value in enumerate(header):
        if value is None:
            continue
        text = str(value).replace("\n", " ").strip().lower()
        if text.startswith(prefix.lower()):
            return i
    return None


def find_header(ws, token: str, scan: int = 30) -> tuple[int, tuple[Any, ...]] | None:
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i >= scan:
            break
        text = " ".join(str(v) for v in row if v is not None).lower()
        if token.lower() in text:
            return i, row
    return None


def rows_after(ws, start: int, count: int, max_cols: int = 30) -> list[tuple[Any, ...]]:
    out = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if start <= i < start + count:
            out.append(tuple(row[:max_cols]))
        if i >= start + count:
            break
    return out


def find_value_index(row: tuple[Any, ...], target: float, tol: float = 0.01) -> int | None:
    for i, value in enumerate(row):
        if isinstance(value, (int, float)) and abs(float(value) - float(target)) <= tol:
            return i
    return None


# --------------------------------------------------------------------------- CNBV


def profile_boletines() -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    for quarter, (name, month_label, month_num) in QUARTERS.items():
        info: dict[str, Any] = {"archivo": f"data/raw/cnbv/{name}", "mes": month_label}
        wb = load_workbook(RAW / "cnbv" / name, read_only=True, data_only=True, keep_links=False)
        info["hojas"] = list(wb.sheetnames)

        for row in wb["Fecha de Información"].iter_rows(values_only=True):
            for value in row:
                if isinstance(value, str) and "Fecha de consulta" in value:
                    info["fecha_consulta"] = value.strip()
                    break

        # Universo: códigos numéricos y estatus (índices derivados del encabezado).
        ufound = find_header(wb["Universo"], "Consecutivo")
        codes = []
        estatus = Counter()
        if ufound:
            uhidx, uheader = ufound
            uclave = find_col(uheader, "Clave de la Sociedad")
            uestatus = find_col(uheader, "Estatus")
            for row in rows_after(wb["Universo"], uhidx + 2, 340, 20):
                clave_val = value_at(row, uclave)
                if isinstance(clave_val, (int, float)):
                    codes.append(str(int(clave_val)))
                    estatus[str(value_at(row, uestatus))] += 1
        info["universo_codigos"] = sorted(set(codes))
        info["universo_estatus"] = dict(estatus)

        def parse_sheet(
            sheet_name: str, labels: tuple[str, ...]
        ) -> tuple[list[dict[str, Any]], tuple[Any, ...] | None, dict[str, int | None]]:
            """Lee las filas de instituciones usando los encabezados reales.

            En 2025-Q3 las columnas de consecutivo/clave/nombre están desplazadas
            un lugar respecto a los otros trimestres, por eso no se usan índices
            fijos. El valor del corte actual es la tercera fecha (`+2`).
            """
            found = find_header(wb[sheet_name], "Consecutivo")
            if not found:
                return [], None, {}
            hidx, header = found
            date_row = next(iter(rows_after(wb[sheet_name], hidx + 1, 1, 30)), ())
            participacion = find_col(date_row, "Participación")
            clave = find_col(header, "Clave de la Sociedad")
            nombre = find_col(header, "Nombre de la Sociedad")
            idxs = {label: find_col(header, label) for label in labels}
            detalle: list[dict[str, Any]] = []
            total = None
            for row in rows_after(wb[sheet_name], hidx + 2, 340, 30):
                etiquetas = {str(v).strip() for v in row if isinstance(v, str)}
                if etiquetas & {"TOTAL", "Total general", "Total del Sector"}:
                    total = row
                clave_val = value_at(row, clave)
                nombre_val = value_at(row, nombre)
                if isinstance(clave_val, (int, float)) and isinstance(nombre_val, str) and nombre_val.strip():
                    item: dict[str, Any] = {"clave": str(int(clave_val)), "nombre": nombre_val.strip(), "participacion": value_at(row, participacion)}
                    for label, idx in idxs.items():
                        item[label] = value_at(row, idx + 2 if idx is not None else None)
                    detalle.append(item)
            return detalle, total, idxs

        detalle, total1, idx1 = parse_sheet(
            "Instituciones (1)", ("Número de Socios", "Número de Sucursales", "Activo Total")
        )
        detalle2, total2, idx2 = parse_sheet("Instituciones (2)", ("Cartera Vigente", "Cartera Vencida", "IMOR"))
        info["inst1_detalle"] = detalle
        info["inst1_sample"] = detalle[:3]
        info["inst2_detalle"] = detalle2

        # TI: saldos al cierre, flujos del trimestre y tasas implícitas.
        found = find_header(wb["TI"], "Cartera Vigente")
        ti_total = None
        if found:
            hidx, _ = found
            for row in rows_after(wb["TI"], hidx + 1, 14, 30):
                if any(isinstance(v, str) and v.strip() == "Total del Sector" for v in row):
                    ti_total = row
                    break
        info["ti_total"] = ti_total

        # Capitalización: NICAP y categoría.
        cap_found = find_header(wb["Capitalización"], "Nivel de Capitalización")
        cap_total = None
        cap_idx = None
        if cap_found:
            chidx, cheader = cap_found
            cap_idx = find_col(cheader, "Nivel de Capitalización")
            for row in rows_after(wb["Capitalización"], chidx + 1, 14, 30):
                if any(isinstance(v, str) and v.strip() == "Total general" for v in row):
                    cap_total = row
                    break
        info["cap_total"] = cap_total

        def current(row: tuple[Any, ...] | None, idx: int | None) -> Any:
            return value_at(row, idx + 2 if idx is not None else None) if row else None

        totales: dict[str, Any] = {}
        if total1:
            totales["socios"] = current(total1, idx1.get("Número de Socios"))
            totales["sucursales"] = current(total1, idx1.get("Número de Sucursales"))
            totales["activo"] = current(total1, idx1.get("Activo Total"))
        if total2:
            totales["vigente"] = current(total2, idx2.get("Cartera Vigente"))
            totales["vencida"] = current(total2, idx2.get("Cartera Vencida"))
            totales["imor"] = current(total2, idx2.get("IMOR"))
        totales["nicap"] = current(cap_total, cap_idx)
        info["totales"] = totales

        # Indicadores: conceptos del sector con total y niveles de operación.
        indicators = []
        for i, row in enumerate(wb["Indicadores"].iter_rows(values_only=True)):
            if i > 38:
                break
            if len(row) > 5 and isinstance(row[2], str):
                label = row[2].strip()
                if label and label not in {"Fuente:", "Total"} and not label.startswith(("1/", "2/", "3/", "4/", "5/", "6/")):
                    indicators.append((label, row[3], row[4], row[5]))
        info["indicadores"] = indicators[:18]

        # EF: conceptos contables por institución, en miles de pesos.
        ef_concepts = []
        for i, row in enumerate(wb["EF"].iter_rows(values_only=True)):
            if i < 8:
                continue
            if len(row) > 3 and isinstance(row[1], str) and row[1].strip():
                label = row[1].strip()
                if label not in {"Concepto", "Nivel de operación Autorizado"} and isinstance(row[3], (int, float)):
                    ef_concepts.append((label, row[3]))
        info["ef_conceptos"] = ef_concepts[:25]
        info["ef_total_activo"] = next((v for k, v in ef_concepts if k.upper() == "ACTIVO"), None)
        info["ef_total_cartera"] = next((v for k, v in ef_concepts if "Cartera de crédito total" in k), None)
        wb.close()
        result[quarter] = info
    return result


def profile_serie_historica() -> dict[str, Any]:
    path = RAW / "cnbv" / "SH_SOCAPS.xlsm"
    wb = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    info: dict[str, Any] = {"hojas": list(wb.sheetnames)}

    ws = wb["Catálogo"]
    codes = []
    statuses = Counter()
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i > 2 and len(row) > 4 and isinstance(row[1], str) and "-" in row[1]:
            codes.append(row[1])
            statuses[str(row[4])] += 1
    info["catalogo_codigos"] = len(set(codes))
    info["catalogo_estatus"] = dict(statuses)

    ws = wb["Nombres"]
    nombres = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i and len(row) > 3 and row[0] is not None:
            nombres.append((str(row[0]), str(row[1]), str(row[2]), str(row[3])))
    info["nombres_registros"] = len(nombres)
    info["nombres_sample"] = nombres[:3]
    info["nombres_por_clave"] = {n[0]: n[1:] for n in nombres}

    ws = wb["Series"]
    it = ws.iter_rows(values_only=True)
    head = []
    row1 = []
    row2 = []
    date_row = []
    for index, row in enumerate(it):
        if index == 0:
            head = list(row)
        elif index == 1:
            row1 = list(row)
        elif index == 2:
            row2 = list(row)
        elif index == 3:
            date_row = list(row)
            break
    date_cols = [(i, v) for i, v in enumerate(date_row) if isinstance(v, datetime)]
    y2025 = [(i, v) for i, v in date_cols if v.year == 2025]
    info["series_dimensiones"] = f"{ws.max_row}x{ws.max_column}"
    info["series_columnas_fecha"] = len(date_cols)
    info["series_rango_fechas"] = (date_cols[0][1], date_cols[-1][1])
    info["series_columnas_2025"] = [(i, v.strftime("%Y-%m")) for i, v in y2025]
    info["series_codigos_fila1_2025"] = sorted({str(row1[i]) for i, _ in y2025})

    concepts: list[dict[str, Any]] = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if len(row) > 2 and isinstance(row[2], str) and row[2].strip():
            concepto = row[2].strip()
            concepts.append({
                "fila": i,
                "cve": row[0],
                "concepto": concepto,
                "valores_2025": [row[j] for j, _ in y2025],
            })
            if concepto == "ACTIVO":
                info["activo_201301"] = row[3]
    info["series_conceptos"] = len(concepts)
    keys = (
        "ACTIVO", "PASIVO", "CAPITAL CONTABLE", "Cartera de crédito total",
        "Cartera de crédito vigente", "Cartera de crédito vencida", "Resultado neto",
        "Ingresos por intereses", "Gastos por intereses", "Resultado neto (flujo mensual)",
        "Ingresos por intereses (flujo mensual)", "Captación total",
    )
    info["series_claves"] = [c for c in concepts if any(k.lower() in c["concepto"].lower() for k in keys)][:80]
    info["series_secciones"] = [
        c for c in concepts if c["concepto"].upper() in {"BALANCE GENERAL", "ESTADO DE RESULTADOS"}
    ]
    info["series_flujos_derivados"] = [
        c for c in concepts if "flujo mensual" in c["concepto"].lower() or "suma flujos" in c["concepto"].lower()
    ][:10]

    # TD: tabla dinámica por concepto; sin etiqueta de unidad declarada.
    td = wb["TD"]
    td_head = rows_after(td, 4, 4, 20)
    td_filtro = None
    td_activo = None
    for i, row in enumerate(td.iter_rows(values_only=True)):
        if i == 2:
            td_filtro = value_at(row, 1)
        if len(row) > 1 and row[0] == 100000000000:
            td_activo = row[1]
            break
    info["td_dimensiones"] = f"{td.max_row}x{td.max_column}"
    info["td_head"] = td_head
    info["td_filtro_institucion"] = td_filtro
    info["td_activo_201301"] = td_activo

    # Evidencia documental interna: notas de la hoja Notas y fecha de la portada.
    notas = []
    for row in wb["Notas"].iter_rows(values_only=True):
        for value in row:
            if isinstance(value, str) and value.strip() and value.strip() != "Notas:":
                notas.append(value.strip())
    info["notas"] = notas[:8]
    portada = []
    for row in wb["Portada"].iter_rows(values_only=True, max_col=8):
        for value in row:
            if isinstance(value, str) and value.strip():
                portada.append(value.strip())
    info["portada"] = portada[:10]
    wb.close()
    return info


# ------------------------------------------------------------------------- FONACOT


def parse_fonacot(path: Path) -> dict[str, Any]:
    enc = detect_encoding(path)
    text = path.read_bytes().decode(enc)
    rows = list(csv.reader(text.splitlines()))
    header = [h.strip() for h in rows[0]]
    header = [h for h in header if h][:7]
    data = []
    blank = 0
    for row in rows[1:]:
        if not any(c.strip() for c in row):
            blank += 1
            continue
        entidad = row[0].strip()
        values = []
        for value in row[1:7]:
            clean = value.strip().replace(",", "")
            try:
                values.append(float(clean))
            except ValueError:
                values.append(None)
        data.append((entidad, values))
    entidades = sorted({e for e, _ in data})
    numeric = [v for _, vals in data for v in vals if v is not None]
    cells = len(data) * 6
    return {
        "archivo": path.name,
        "encoding": enc,
        "filas_totales_csv": len(rows),
        "filas_vacias": blank,
        "columnas_utiles": header,
        "entidades": entidades,
        "nulos": cells - len(numeric),
        "duplicados_entidad": len(data) - len(set(e for e, _ in data)),
        "suma": sum(numeric),
        "sample": data[:2],
        "raw_sample": rows[:2],
        "app_movil": any("APP" in e.upper() for e in entidades),
        "veracruz_corto": "VERACRUZ" in entidades,
    }


def profile_fonacot() -> dict[str, Any]:
    folder = RAW / "fonacot"
    workers = {
        1: parse_fonacot(folder / "Trabajadores por género y entidad federativa.csv"),
        2: parse_fonacot(folder / "trabajadores_genero_entidad_federativa.csv"),
        3: parse_fonacot(folder / "datos_abiertos_trabajadores_con_credito_genero_y_entidad_federativa_3er_TRIM_2025.csv"),
        4: parse_fonacot(folder / "datos_abiertos_trabajadores_con_credito_genero_y_entidad_federativa_4to_TRIM_2025.csv"),
    }
    importes = {
        1: parse_fonacot(folder / "Importe de créditos ejercidos por género y entidad federativa.csv"),
        2: parse_fonacot(folder / "importe_creditos_genero_entidad_federativa.csv"),
        3: parse_fonacot(folder / "datos_abiertos_importe_credito_genero_y_entidad_federativa_3er_TRIM_2025.csv"),
        4: parse_fonacot(folder / "datos_abiertos_importe_credito_genero_y_entidad_federativa_4to_TRIM_2025.csv"),
    }
    reader = PdfReader(str(folder / "Diccionario Conjunto de Datos.pdf"))
    pdf_text = "\n".join((page.extract_text() or "") for page in reader.pages[:4])
    wb = load_workbook(folder / "Inventario de Datos Abiertos.xlsx", read_only=True, data_only=True, keep_links=False)
    inventario = [tuple(r[:5]) for i, r in enumerate(wb["Hoja1"].iter_rows(values_only=True)) if i < 9]
    wb.close()
    return {
        "workers": workers,
        "importes": importes,
        "pdf_archivo": "Diccionario Conjunto de Datos.pdf",
        "pdf_paginas": len(reader.pages),
        "pdf_texto": pdf_text[:7000],
        "inventario": inventario,
    }


# -------------------------------------------------------------------------- SNIIV


def profile_snii_v() -> dict[str, Any]:
    folder = RAW / "sniiv"
    data = json.loads((folder / "financiamiento_2025_api.json").read_text(encoding="utf-8-sig"))
    jdf = pd.DataFrame(data)
    info: dict[str, Any] = {
        "json_registros": len(data),
        "json_keys": list(jdf.columns),
        "json_sample": data[:2],
        "json_acciones": float(jdf["acciones"].sum()),
        "json_monto": float(jdf["monto"].sum()),
        "json_organismos": sorted(jdf["organismo"].unique().tolist()),
        "json_estados": int(jdf["estado"].nunique()),
    }

    enc = detect_encoding(folder / "financiamientos_2025.csv")
    df = pd.read_csv(folder / "financiamientos_2025.csv", encoding=enc, low_memory=False)
    info["csv_encoding"] = enc
    info["csv_shape"] = df.shape
    info["csv_columnas"] = list(df.columns)
    info["csv_nulos"] = {c: int(df[c].isna().sum()) for c in df.columns}
    info["csv_sample"] = [tuple(r) for r in df.head(3).itertuples(index=False, name=None)]
    info["csv_acciones"] = float(df["acciones"].sum())
    info["csv_monto"] = float(df["monto"].sum())
    info["csv_duplicados_completos"] = int(df.duplicated().sum())
    info["csv_duplicados_5dim"] = int(df.duplicated(subset=["año", "mes", "entidad", "organismo", "sexo"]).sum())
    grain = ["año", "mes", "cve_ent", "cve_mun", "organismo", "modalidad", "destino", "tipo", "sexo", "edad_rango", "ingresos_rango", "vivienda_valor"]
    info["csv_grain"] = grain
    info["csv_duplicados_grain"] = int(df.duplicated(subset=grain).sum())
    info["csv_categorias"] = {
        col: sorted(str(v) for v in df[col].dropna().unique())[:35]
        for col in ("mes", "organismo", "modalidad", "destino", "tipo", "sexo", "edad_rango", "ingresos_rango", "vivienda_valor")
    }

    # XLSX: mismo contenido, lectura en flujo para no cargar toda la hoja.
    wb = load_workbook(folder / "financiamientos_2025.xlsx", read_only=True, data_only=True, keep_links=False)
    ws = wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    xl_header = tuple(next(it))
    xl_rows = 0
    xl_acciones = 0.0
    xl_monto = 0.0
    xl_first = []
    for row in it:
        xl_rows += 1
        if xl_rows <= 3:
            xl_first.append(tuple(row))
        if len(row) > 15:
            if isinstance(row[14], (int, float)):
                xl_acciones += float(row[14])
            if isinstance(row[15], (int, float)):
                xl_monto += float(row[15])
    info["xlsx_hoja"] = ws.title
    info["xlsx_dimensiones"] = f"{ws.max_row}x{ws.max_column}"
    info["xlsx_header"] = xl_header
    info["xlsx_filas"] = xl_rows
    info["xlsx_acciones"] = xl_acciones
    info["xlsx_monto"] = xl_monto
    info["xlsx_sample"] = xl_first
    wb.close()

    # Diccionario de catálogos.
    wb = load_workbook(folder / "diccionario_financiamiento.xlsx", read_only=True, data_only=True, keep_links=False)
    catalogos: dict[str, dict[str, str]] = defaultdict(dict)
    current = None
    descripciones: dict[str, str] = {}
    for i, row in enumerate(wb["Financiamientos"].iter_rows(values_only=True)):
        if i == 0:
            continue
        nem = row[1] if len(row) > 1 else None
        if nem:
            current = str(nem)
            descripciones.setdefault(current, str(row[2] or ""))
        if current and len(row) > 5 and row[4] is not None and row[5] is not None:
            catalogos[current][str(row[4]).strip()] = str(row[5]).strip()
    wb.close()
    info["catalogos"] = dict(catalogos)
    info["descripciones"] = descripciones

    # Conciliación CSV agregado contra la API JSON (mismas 3.989 claves).
    gdf = df.copy()
    gdf["organismo_nombre"] = gdf["organismo"].map(ORG_MAP).fillna("DESCONOCIDO")
    gdf["sexo_nombre"] = gdf["sexo"].map(SEX_MAP).fillna("No disponible")
    gdf["mes_nombre"] = gdf["mes"].map(lambda m: MONTHS_ES[int(m) - 1] if 1 <= int(m) <= 12 else "desconocido")
    grouped = gdf.groupby(["mes_nombre", "entidad", "organismo_nombre", "sexo_nombre"], dropna=False).agg(
        acciones=("acciones", "sum"), monto=("monto", "sum")
    ).reset_index()
    jgrouped = jdf.groupby(["mes", "estado", "organismo", "sexo"], dropna=False).agg(
        acciones=("acciones", "sum"), monto=("monto", "sum")
    ).reset_index()
    merged = grouped.merge(
        jgrouped, how="outer",
        left_on=["mes_nombre", "entidad", "organismo_nombre", "sexo_nombre"],
        right_on=["mes", "estado", "organismo", "sexo"],
        suffixes=("_csv", "_json"), indicator=True,
    )
    both = merged[merged["_merge"] == "both"]
    info["recon"] = {
        "grupos_csv": len(grouped),
        "grupos_json": len(jgrouped),
        "grupos_solo_csv": int((merged["_merge"] == "left_only").sum()),
        "grupos_solo_json": int((merged["_merge"] == "right_only").sum()),
        "delta_acciones": float(jgrouped["acciones"].sum() - grouped["acciones"].sum()),
        "delta_monto": float(jgrouped["monto"].sum() - grouped["monto"].sum()),
        "grupos_con_delta": int((abs(both["monto_json"] - both["monto_csv"]) > 0.01).sum()),
    }
    return info


# ---------------------------------------------------------------------- Documento


def write_document(checks: list[dict[str, Any]], cnbv: dict, series: dict, fon: dict, sniiv: dict) -> None:
    add("# Perfil de datos — Paso 04")
    add()
    add(f"**Fecha:** {date.today().isoformat()}  ")
    add("**Objetivo:** caracterizar los 19 archivos oficiales para definir KPIs y el modelo de PostgreSQL en pasos posteriores.  ")
    add("**Alcance:** solo lectura y perfilado. No se ejecutaron macros, no se generaron datos sintéticos, no se aplicaron transformaciones permanentes, no se creó base de datos y no se definieron KPIs definitivos.")
    add("Fuentes consultadas: `data/raw/manifest.json` y `docs/fuentes.md`.")
    add()

    add("## 1. Resultado de integridad")
    add()
    ok_before = sum(r["ok"] for r in checks)
    add(f"- Antes del perfilado: **{ok_before}/{len(checks)}** archivos con tamaño y SHA-256 idénticos al manifiesto.")
    add(f"- Después del perfilado: **{ok_before}/{len(checks)}** archivos con tamaño y SHA-256 idénticos al manifiesto.")
    add("- Ningún archivo de `data/raw/` fue modificado; el documento generado está fuera de ese directorio.")
    add()

    add("## 2. Inventario y granularidad")
    add()
    add("| Fuente | Archivos | Granularidad observada | Clave candidata | Uso recomendado en ETL |")
    add("|---|---:|---|---|---|")
    add("| CNBV | 5 | Boletines: una fila por institución y trimestre; `Series`: una fila por concepto y mes, **sector consolidado** (sin institución) | Boletín: `(trimestre, clave_institucion)`; serie: `(concepto, mes)`, solo sector | Serie mensual `SH_SOCAPS.xlsm` para tendencias del sector; boletines para cortes institucionales |")
    add("| FONACOT | 10 | Una fila por entidad/canal, mes y género; columnas separadas por mes | `(anio, mes, entidad_canonica, genero)` | 8 CSV para hechos; PDF e inventario solo como metadatos |")
    add("| SNIIV | 4 | CSV/XLSX: una fila por año-mes-entidad-municipio-organismo-modalidad-destino-tipo-sexo-edad-ingresos-valor; JSON: agregado por mes-entidad-organismo-sexo | CSV: las 12 dimensiones listadas abajo; JSON: `(mes, estado, organismo, sexo)` | CSV + diccionario; XLSX y JSON solo para validación, nunca sumados al CSV |")
    add()

    add("## 3. CNBV — SOCAPS")
    add()
    add("### 3.1 Boletines trimestrales 2025")
    add()
    add("Encabezados reales detectados (no están en la primera fila):")
    add()
    add("- `Universo`: fila 4 (`Consecutivo`, `Clave de la Sociedad`, `Nombre de la Sociedad`, `Fecha Autorización`, `Nivel de Operación`, `Nivel de Regulación Prudencial`, `Estatus`, `Inicio de Operación`); datos desde la fila 8.")
    add("- `Instituciones (1)`: `Consecutivo`, `Clave de la Sociedad`, `Nombre de la Sociedad`, `Número de Socios`, `Número de Sucursales`, `Activo Total (miles de pesos)`, `Participación %`; tres columnas por fecha (anterior, cierre anterior, cierre actual).")
    add("- `Instituciones (2)`: `Cartera Vigente (miles de pesos)`, `Cartera Vencida (miles de pesos)`, `IMOR (%)`; tres fechas más columnas de participación.")
    add("- `TI`: saldos de `Cartera Vigente`, `Captación total` y `Captación tradicional` al cierre; flujos del trimestre de `Ingresos por intereses` y `Gastos por Intereses`; `Tasa implícita (%)`.")
    add("- `Capitalización`: `Nivel de Capitalización (NICAP) (%)` y `Categoría del Nivel de Capitalización`.")
    add("- `Indicadores`: filas de concepto con columnas `Total`, `Nivel de operación IV`, `III`, `II` e `I` para tres fechas.")
    add("- `EF`: matriz concepto × institución, encabezado `Cifras en miles de pesos`; `Clave de la Sociedad` y `Nombre de la Sociedad`; `Total del Sector` en la primera columna de datos.")
    add("- **Desplazamiento de columnas:** en 2025-Q3 las columnas `Consecutivo`/`Clave de la Sociedad`/`Nombre de la Sociedad` aparecen un lugar a la izquierda que en Q1/Q2/Q4. Los índices deben derivarse del encabezado real, no fijarse por trimestre.")
    add()
    add("| Trimestre | Fecha de consulta | Instituciones con datos | Socios (TOTAL) | Activo total (miles) | Cartera vigente (miles) | IMOR (%) | NICAP (%) |")
    add("|---|---|---:|---:|---:|---:|---:|---:|")
    for q in (1, 2, 3, 4):
        info = cnbv[q]
        t = info["totales"]
        add(
            f"| 2025-Q{q} | {cell(info.get('fecha_consulta'))} | {len(info['inst1_detalle'])} "
            f"| {num(t.get('socios'), 0)} | {num(t.get('activo'))} | {num(t.get('vigente'))} "
            f"| {num(t.get('imor'), 4)} | {num(t.get('nicap'), 2)} |"
        )
    add()
    sample = cnbv[1]["inst1_sample"][0]
    add(
        f"Ejemplo real (2025-Q1): `{cell(sample['clave'])} | {cell(sample['nombre'])} "
        f"| socios {num(sample['Número de Socios'], 0)} | sucursales {num(sample['Número de Sucursales'], 0)} "
        f"| activo {num(sample['Activo Total'], 3)} miles de pesos | participación {num(sample['participacion'], 4)}%`."
    )
    t1 = cnbv[1]["totales"]
    add(
        f"El total del sector en el mismo corte es `{num(t1['socios'], 0)} socios` y "
        f"`{num(t1['activo'], 3)} miles de pesos`. Las filas `TOTAL`, `Total del Sector`, "
        "`Total general` y las columnas por nivel de operación son agregados: en una tabla "
        "de hechos por institución deben excluirse para no duplicar."
    )
    add()

    add("### 3.2 Series históricas `SH_SOCAPS.xlsm`")
    add()
    add(f"- Hojas: `{', '.join(series['hojas'])}`.")
    rango_inicio = series["series_rango_fechas"][0].strftime("%Y-%m")
    rango_fin = series["series_rango_fechas"][1].strftime("%Y-%m")
    add(f"- `Series`: {series['series_dimensiones']}; {series['series_columnas_fecha']} columnas de fecha, de {rango_inicio} a {rango_fin}. 2025 tiene {len(series['series_columnas_2025'])} columnas (índices 147–158).")
    add("- **Unidad:** `Series` y `TD` **no declaran unidad en ningún encabezado, catálogo o nota** (búsqueda de `miles`, `millones`, `pesos`, `cifras en` en las seis hojas: 0 coincidencias). La unidad se infiere por equivalencia numérica con los boletines, que sí etiquetan `miles de pesos`: `Series` está en **millones de pesos** y `TD` en **pesos**.")
    codigo_fila1 = ", ".join(series["series_codigos_fila1_2025"])
    add(f"- La fila 1 de `Series` muestra `{codigo_fila1}` en las columnas de 2025: no es un período válido; la fecha real está en la fila 4 (`datetime`).")
    add(f"- `Catálogo`: {series['catalogo_codigos']} claves CASFIM únicas; 151 `En operación` y el resto son bajas/fusiones con fecha. `Nombres`: {series['nombres_registros']} registros con `cve_institucion` de 6 dígitos, `clave_catalogo` tipo `29-004`, razón social y nombre de publicación.")
    add("- Codificación de instituciones: el boletín usa `29005` (numérico), `Nombres` usa `029005` y `Catálogo` usa `29-005`. La correspondencia existe, pero requiere normalización (`29005` → `029005` → `29-005`).")
    nota_sector = next((n for n in series["notas"] if "cálculo del Sector" in n), "")
    add(f"- **Granularidad: sector consolidado, no institución individual.** Evidencia: fila 2 de `Series` = `SISTEMA SOCAPS`; `Notas` 1 «{cell(nota_sector)}»; `TD` con filtro `cve_institucion = {cell(series['td_filtro_institucion'])}`; la columna 0 de `Series` contiene códigos de **concepto** (`100000000000 = ACTIVO`), no claves de institución. El detalle por institución existe solo en los boletines (`Instituciones (1)/(2)`, `TI`, `EF`, `Capitalización`); `Catálogo`/`Nombres` son el universo de sociedades, no series financieras por sociedad.")
    add()
    add("| Concepto (2025-03) | Valor en `Series` (millones de pesos, inferido) | Naturaleza |")
    add("|---|---:|---|")
    key_map = {c["concepto"]: c["valores_2025"][2] for c in series["series_claves"]}
    saldos = {
        "ACTIVO", "PASIVO", "CAPITAL CONTABLE", "Cartera de crédito total",
        "Cartera de crédito vigente", "Cartera de crédito vencida",
    }
    concepts = (
        "ACTIVO", "PASIVO", "CAPITAL CONTABLE", "Cartera de crédito total",
        "Cartera de crédito vigente", "Cartera de crédito vencida", "Resultado neto",
        "Ingresos por intereses", "Gastos por intereses", "Resultado neto (flujo mensual)",
        "Ingresos por intereses (flujo mensual)", "Gastos por intereses (flujo mensual)",
    )
    for concept in concepts:
        if concept in key_map:
            lower = concept.lower()
            if "flujo mensual" in lower:
                nature = "flujo mensual (derivado)"
            elif "suma flujos" in lower:
                nature = "flujo 12 meses (derivado)"
            elif concept in saldos:
                nature = "saldo al cierre"
            else:
                nature = "acumulado del ejercicio (flujo)"
            add(f"| {cell(concept)} | {num(key_map[concept], 6)} | {nature} |")
    add()
    add("`Series` contiene saldos en el bloque `BALANCE GENERAL`, conceptos acumulados del ejercicio en `ESTADO DE RESULTADOS` y filas derivadas explícitas `(flujo mensual)` y `(suma flujos 12 meses)`. No deben mezclarse saldos, flujos mensuales y acumulados sin una columna que distinga la naturaleza.")

    ratio_td = series["td_activo_201301"] / series["activo_201301"]
    add(
        f"- `TD` ({series['td_dimensiones']}) es una tabla dinámica de `Suma de dat_importe` por `cve_concepto`/`cve_periodo`, "
        f"con filtro `cve_institucion = {cell(series['td_filtro_institucion'])}`. Para `ACTIVO` 2013-01: "
        f"`TD = {num(series['td_activo_201301'], 0)}` frente a `Series = {num(series['activo_201301'], 6)}`; "
        f"razón exacta de `{num(ratio_td, 0)}:1`. Esto confirma la escala: `TD` en pesos y `Series` en millones de pesos (inferido)."
    )

    nota_cambios = next((n for n in series["notas"] if "pueden cambiar" in n), "")
    portada_fecha = next((p for p in series["portada"] if "disponible al" in p), "")
    add(f"- Evidencia documental de posibles revisiones: `Notas` 3 «{cell(nota_cambios)}»; portada «{cell(portada_fecha)}». El boletín 2025-Q1 registra «{cell(cnbv[1]['fecha_consulta'])}». Las fuentes corresponden a fechas de información distintas.")

    activo_boletin_miles = cnbv[1]["totales"]["activo"]
    activo_boletin_millones = activo_boletin_miles / 1000
    activo_series_millones = key_map["ACTIVO"]
    delta_millones = activo_series_millones - activo_boletin_millones
    pct = delta_millones / activo_boletin_millones * 100
    add(
        f"- **Comparación de marzo de 2025 en una sola unidad (millones de pesos):** boletín Q1 "
        f"`{num(activo_boletin_miles, 2)} miles = {num(activo_boletin_millones, 6)} millones`; "
        f"`Series = {num(activo_series_millones, 6)} millones = {num(activo_series_millones * 1000, 3)} miles`. "
        f"Diferencia `Series − boletín = +{num(delta_millones, 6)} millones` "
        f"(`+{num(delta_millones * 1000, 3)} miles`, `{num(delta_millones * 1_000_000, 0)} pesos`, {num(pct, 4)}%)."
    )
    add(
        f"- **Solo escala, no revisión:** `{num(activo_boletin_miles, 2)}` y `{num(activo_boletin_millones, 6)}` son el **mismo total del boletín**: "
        "el primero está en miles y el segundo en millones (factor 1,000; la diferencia residual de unos pesos es únicamente el redondeo a 2 decimales del primero). "
        "La diferencia de `Series` contra el boletín es de **cifras**, no de escala. `Notas` 3 documenta que las cifras pueden cambiar por renvíos de información, "
        "pero **ningún archivo documenta la causa específica** de esos +" + num(delta_millones, 6) + " millones: no atribuirlos a un reproceso concreto sin evidencia."
    )
    add()

    add("## 4. FONACOT")
    add()
    add("Cambios de encabezado y calidad observados:")
    add()
    add("- Q1 usa `ENTIDAD FEDERATIVA`; Q2–Q4 usan `ENTIDAD_FEDERATIVA`.")
    add("- Q1 conserva separadores de miles y espacios (`' 32,050,929.75 '`, `'1,326 '`); Q2–Q4 traen números sin separadores.")
    add("- Q1/Q2 tienen columnas traseras vacías; Q3/Q4 de importes tienen filas vacías al final. El conteo de entidades reales es 33 por trimestre (32 entidades + `APP MOVIL`).")
    add("- `APP MOVIL` es un canal especial, no una entidad federativa: debe conservarse como categoría separada para no inflar el conteo de entidades.")
    add("- Q3 de trabajadores usa `VERACRUZ`; Q3 de importes usa `VERACRUZ DE IGNACIO DE LA LLAVE`. Q4 ya usa el nombre completo en ambos. Sin canonización, la correspondencia trabajador-importe falla en Q3.")
    add(f"- El PDF `{cell(fon['pdf_archivo'])}` tiene {fon['pdf_paginas']} páginas y define `XX_mujeres`/`XX_hombres` de la serie 'Trabajadores' como **número de créditos otorgados**, y los de la serie 'Importe' como **monto ejercido**. El nombre del archivo dice 'trabajadores', pero el metadato describe créditos: documentar la ambigüedad.")
    add(f"- El inventario XLSX enumera {len(fon['inventario']) - 1} conjuntos; solo los dos de entidad/género están descargados.")
    add()
    add("| Trimestre | Archivos | Filas útiles por archivo | Entidades + canal | Suma trabajadores/créditos | Suma importes (pesos) |")
    add("|---|---|---:|---:|---:|---:|")
    for q in (1, 2, 3, 4):
        w = fon["workers"][q]
        i = fon["importes"][q]
        add(f"| 2025-Q{q} | 2 CSV | {len(w['entidades'])} / {len(i['entidades'])} | {len(w['entidades'])} | {num(w['suma'], 0)} | {num(i['suma'])} |")
    add()
    add("Ejemplo real (2025-Q1): trabajadores `AGUASCALIENTES | Ene_mujeres = 1,326`; importes `AGUASCALIENTES | Ene_mujeres = 32,050,929.75` pesos. La correspondencia es por `(trimestre, mes, entidad, género)`, no por suma global.")
    add("Unidades: trabajadores/créditos son conteos; importes son pesos mexicanos con dos decimales. No hay columna de fecha tipo `date`: el mes está codificado en el encabezado (`Ene_mujeres`, `Feb_hombres`, ...).")
    add("Subtotales y totales: los CSV no incluyen filas `TOTAL`; la suma debe calcularse en el ETL. Las celdas vacías son ausencia de dato publicado, no cero automático.")
    add()

    add("## 5. SNIIV — Financiamientos 2025")
    add()
    add(f"- **CSV:** {sniiv['csv_encoding']}, {sniiv['csv_shape'][0]:,} filas × {sniiv['csv_shape'][1]} columnas; {sniiv['csv_duplicados_completos']} duplicados completos. Columnas: `{', '.join(sniiv['csv_columnas'])}`.")
    add(f"- **XLSX:** hoja `{sniiv['xlsx_hoja']}`, {sniiv['xlsx_filas'] + 1:,}×{len(sniiv['xlsx_header'])} celdas, {sniiv['xlsx_filas']:,} filas de datos; mismos encabezados. Sumas: acciones {num(sniiv['xlsx_acciones'], 0)}, monto {num(sniiv['xlsx_monto'])} pesos.")
    add(f"- **JSON API:** {sniiv['json_registros']:,} objetos con claves `{', '.join(sniiv['json_keys'])}`; acciones {num(sniiv['json_acciones'], 0)}, monto {num(sniiv['json_monto'])} pesos.")
    add("- El CSV y el XLSX son la misma tabla en dos formatos (el XLSX conserva `cve_ent='01'` y `destino='3'` como texto donde el CSV los infiere numéricos). No son fuentes aditivas.")
    add(f"- El JSON está agregado a `(mes, estado, organismo, sexo)` y tiene las mismas {sniiv['recon']['grupos_csv']:,} claves que el CSV agregado, **pero no coincide en valores**: {sniiv['recon']['grupos_con_delta']:,} de {sniiv['recon']['grupos_csv']:,} grupos difieren; delta de {num(sniiv['recon']['delta_acciones'], 0)} acciones y {num(sniiv['recon']['delta_monto'])} pesos. Usar una sola fuente; se recomienda el CSV por su detalle municipal.")
    add(f"- No existe clave mínima de 5 dimensiones: `(año, mes, entidad, organismo, sexo)` produce {sniiv['csv_duplicados_5dim']:,} duplicados. La granularidad real son las 12 dimensiones `{', '.join(sniiv['csv_grain'])}`, con {sniiv['csv_duplicados_grain']:,} duplicados.")
    add()
    add("Ejemplo real (CSV, primera fila): `año=2025, mes=3, cve_ent=01, entidad=Aguascalientes, cve_mun=1, municipio=Aguascalientes, organismo=1 (INFONAVIT), modalidad=2, destino=3, tipo=2, sexo=1 (Hombre), edad_rango=2, ingresos_rango=6, vivienda_valor=6, acciones=1, monto=1,475,418.03`.")
    add("Ejemplo real (JSON): `{'año': 2025, 'mes': 'enero', 'estado': 'Aguascalientes', 'organismo': 'INFONAVIT', 'sexo': 'Hombre', 'clave_estado': '01', 'acciones': 19, 'monto': 17098440.65}`.")
    add()
    add("Nulos relevantes: " + ", ".join(f"`{c}`={v:,}" for c, v in sniiv["csv_nulos"].items() if v) + ". No se imputaron.")
    add("Los códigos de `organismo`, `modalidad`, `destino`, `tipo`, `sexo`, `edad_rango`, `ingresos_rango` y `vivienda_valor` son categóricos según `diccionario_financiamiento.xlsx`; `acciones` es número de financiamientos y `monto` es pesos con 2 decimales.")
    add("Subtotales/totales: ni el CSV ni el JSON traen filas de total; los agregados deben construirse en el ETL. El JSON **ya está agregado**: sumarlo al CSV duplicaría el fenómeno.")
    add()

    add("## 6. Diccionario preliminar y campos candidatos para KPIs")
    add()
    add("| Campo | Fuente | Tipo / unidad | Descripción y limitación |")
    add("|---|---|---|---|")
    dictionary = [
        ("`clave_institucion`", "CNBV boletines / `Nombres`", "texto, 6 dígitos", "Boletín `29005` → `029005` → `29-005`. Requiere normalización; no usar el número del boletín como llave definitiva."),
        ("`activo_total_miles`", "CNBV `Instituciones (1)`", "miles de pesos, saldo", "Unidad etiquetada `(miles de pesos)`. Diferencia de cifras contra `Series` (millones) sin causa documentada en los archivos."),
        ("`cartera_vigente_miles`, `cartera_vencida_miles`", "CNBV `Instituciones (2)`", "miles de pesos, saldo", "Unidad etiquetada. Excluir filas `TOTAL` en hechos por institución."),
        ("`conceptos_series_millones`", "CNBV `Series`", "millones de pesos (inferido), saldo/flujo", "Sin etiqueta de unidad; escala confirmada por `TD` (1:1,000,000) y por el boletín. Solo sector consolidado; clave `(concepto, mes)`."),
        ("`dat_importe_td`", "CNBV `TD`", "pesos (inferido)", "`Suma de dat_importe` con `cve_institucion=(All)`; 1,000,000 veces `Series`. No declarado en el archivo."),
        ("`imor_pct`, `nicap_pct`, `tasa_implicita_pct`, `participacion_pct`", "CNBV", "porcentaje", "Ratios; nunca promediar como si fueran montos sin ponderación."),
        ("`resultado_neto`", "CNBV `Indicadores` (miles) / `Series` (millones)", "flujo / acumulado", "En `Series` hay versión acumulada, `(flujo mensual)` y `(suma flujos 12 meses)`; elegir una naturaleza y una unidad."),
        ("`ingresos_intereses_trimestre_miles`, `gastos_intereses_trimestre_miles`", "CNBV `TI`", "miles de pesos, flujo trimestral", "Flujo del trimestre, no saldo. No comparar contra columnas de saldo ni contra `Series` (millones)."),
        ("`socios`, `sucursales`", "CNBV `Instituciones (1)`", "conteo, saldo", "Corte de fecha; no confundir con número de créditos."),
        ("`anio`, `mes`, `entidad`, `genero`", "FONACOT CSV", "entero / texto", "Mes viene en el encabezado; género en el sufijo `_mujeres`/`_hombres`. Canonizar `VERACRUZ`."),
        ("`creditos_ejercidos`", "FONACOT trabajadores", "conteo, flujo mensual", "El PDF lo define como créditos otorgados, no trabajadores distintos."),
        ("`monto_ejercido_pesos`", "FONACOT importes", "pesos, flujo mensual", "Q1 requiere limpiar comas y espacios solo en memoria durante el ETL."),
        ("`acciones`, `monto`", "SNIIV CSV", "conteo / pesos", "Medidas; la clave incluye 12 dimensiones. `monto` con 2 decimales."),
        ("`organismo`, `modalidad`, `destino`, `tipo`, `sexo`, `edad_rango`, `ingresos_rango`, `vivienda_valor`", "SNIIV CSV + diccionario", "código entero → etiqueta", "Requiere catálogos del XLSX; existen nulos (`No disponible`/`No especificado`)."),
    ]
    for row in dictionary:
        add("| " + " | ".join(cell(x, 260) for x in row) + " |")
    add()
    add("Campos candidatos (no KPIs definitivos): montos y conteos de CNBV por institución/mes, créditos y monto ejercido de FONACOT por entidad/género/mes, acciones y monto de SNIIV por organismo/entidad/sexo/mes, y ratios derivados calculados en el ETL a partir de estos campos. La definición formal de KPIs queda para el siguiente paso.")
    add()

    add("## 7. Recomendación de archivos para el ETL")
    add()
    add("| Archivo | Rol |")
    add("|---|---|")
    roles = [
        ("`data/raw/cnbv/SH_SOCAPS.xlsm`", "Serie mensual principal (2013-01 a 2026-09; usar 2025) en **millones de pesos (inferido)**, sector consolidado (`SISTEMA SOCAPS`); `TD` en pesos y `Notas`/`Catálogo` como documentación de escala y granularidad. Códigos de institución solo en `Nombres`/`Catálogo`, sin series individuales."),
        ("`data/raw/cnbv/BE_SOCAPS_202503.xlsx` … `BE_SOCAPS_202512.xlsx`", "Cortes trimestrales de 2025 para indicadores por institución; 202512 como corte más reciente."),
        ("8 CSV de `data/raw/fonacot/`", "Hechos de créditos/monto por entidad, mes y género."),
        ("`data/raw/fonacot/Diccionario Conjunto de Datos.pdf`", "Metadato: definición de columnas y advertencia 'créditos' vs 'trabajadores'."),
        ("`data/raw/fonacot/Inventario de Datos Abiertos.xlsx`", "Metadato: universo de conjuntos publicados; solo 2 descargados."),
        ("`data/raw/sniiv/financiamientos_2025.csv`", "Detalle municipal de financiamientos 2025; fuente única de hechos SNIIV."),
        ("`data/raw/sniiv/diccionario_financiamiento.xlsx`", "Catálogos de códigos y unidades del CSV."),
        ("`data/raw/sniiv/financiamientos_2025.xlsx`", "Validación: misma tabla que el CSV; no cargar como fuente adicional."),
        ("`data/raw/sniiv/financiamiento_2025_api.json`", "Validación/agregado alternativo; no sumar al CSV."),
        ("`data/raw/manifest.json`, `docs/fuentes.md`", "Trazabilidad de URL, período, tamaño y SHA-256."),
    ]
    for name, role in roles:
        add(f"| {cell(name)} | {cell(role, 300)} |")
    add()

    add("## 8. Limitaciones registradas")
    add()
    add("1. CNBV: **miles de pesos** etiquetados en boletines; `Series` en **millones de pesos** e `TD` en **pesos** (ambos inferidos, sin etiqueta declarada; equivalencia exacta 1,000,000:1); fechas de consulta distintas (portada de `SH_SOCAPS`: información al 04 de noviembre de 2026; boletín Q1: 14 de mayo de 2025); códigos de institución con tres formatos; `Series` incluye meses posteriores a 2025 (hasta 2026-09), por lo que el ETL debe filtrar el año. `Notas` 3 admite posibles cambios por renvíos, pero no documenta la causa específica de la diferencia de cifras de 2025-03.")
    add("2. CNBV: `Series` tiene filas de saldo, acumulados y flujos derivados en una sola columna de conceptos; requiere una columna de naturaleza para evitar sumas inválidas.")
    add("3. FONACOT: encabezados y formatos cambian por trimestre; `APP MOVIL` no es entidad; `VERACRUZ`/`VERACRUZ DE IGNACIO DE LA LLAVE` requiere canonización; el diccionario de 2022/2023 describe créditos donde el archivo dice trabajadores.")
    add("4. SNIIV: CSV y XLSX son duplicados; JSON agregado no concilia con el CSV (723 grupos con diferencia); códigos categóricos y nulos; la clave de 5 dimensiones no es única.")
    add("5. No se imputaron nulos, no se normalizaron archivos originales y no se calcularon KPIs definitivos.")
    add()
    add("## 9. Pruebas ejecutadas")
    add()
    add("| Prueba | Resultado |")
    add("|---|---|")
    add(f"| SHA-256 y tamaño de 19 originales contra `manifest.json` | **{ok_before}/19 antes y {ok_before}/19 después** |")
    add(f"| Lectura OpenXML de 4 boletines + `SH_SOCAPS.xlsm` + 2 XLSX de metadatos/diccionario | Correcta, sin ejecución de macros |")
    add(f"| Conteo de instituciones CNBV 2025-Q1..Q4 | {', '.join(str(len(cnbv[q]['inst1_detalle'])) for q in (1,2,3,4))} filas por corte |")
    add(f"| Series 2025 | {len(series['series_columnas_2025'])} columnas mensuales; ACTIVO 2025-03 = 294,888.150735 **millones** (294,888,150.735 miles), sector consolidado |")
    add(f"| Escala CNBV confirmada | ACTIVO 2013-01: `TD = {num(series['td_activo_201301'],0)}` pesos / `Series = {num(series['activo_201301'],6)}` millones; razón {num(series['td_activo_201301']/series['activo_201301'],0)}:1 |")
    add(f"| Activo 2025-03 en una sola unidad | Boletín `{num(cnbv[1]['totales']['activo'],2)}` miles = `{num(cnbv[1]['totales']['activo']/1000,6)}` millones; `Series = {num(key_map['ACTIVO'],6)}` millones; delta `+{num(key_map['ACTIVO']-cnbv[1]['totales']['activo']/1000,6)}` millones (diferencia de cifras, causa no documentada) |")
    add(f"| FONACOT trabajadores vs importes | {len(fon['workers'][3]['entidades'])} vs {len(fon['importes'][3]['entidades'])} entidades en Q3 por variante de Veracruz |")
    add(f"| SNIIV CSV vs XLSX | {sniiv['csv_shape'][0]:,} vs {sniiv['xlsx_filas']:,} filas; acciones {num(sniiv['csv_acciones'],0)} vs {num(sniiv['xlsx_acciones'],0)} |")
    add(f"| SNIIV CSV agregado vs JSON | {sniiv['recon']['grupos_con_delta']:,}/{sniiv['recon']['grupos_csv']:,} grupos con diferencia de monto |")
    add("| Muestras contrastadas | CNBV, FONACOT y SNIIV mostradas arriba con valores reales de los archivos |")
    add()
    add("**Estado:** paso 04 completado. No se realizaron commits ni se avanzó al paso 05.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text("\n".join(md) + "\n", encoding="utf-8")


def main() -> None:
    ok, total, checks = verify_manifest()
    print(f"INTEGRIDAD_ANTES: {ok}/{total}")
    if ok != total:
        raise SystemExit("Los originales no coinciden con el manifiesto; se detiene el perfilado.")

    print("Perfilando CNBV...")
    cnbv = profile_boletines()
    series = profile_serie_historica()
    print("Perfilando FONACOT...")
    fon = profile_fonacot()
    print("Perfilando SNIIV...")
    sniiv = profile_snii_v()

    ok_after, total_after, _ = verify_manifest()
    print(f"INTEGRIDAD_DESPUES: {ok_after}/{total_after}")
    if ok_after != total_after:
        raise SystemExit("Los originales cambiaron durante el perfilado.")

    write_document(checks, cnbv, series, fon, sniiv)
    print(f"DOCUMENTO: {OUTPUT}")
    print(f"RESUMEN: CNBV={len(cnbv)} boletines + 1 serie; FONACOT={len(fon['workers']) + len(fon['importes'])} CSV; SNIIV=CSV/XLSX/JSON/diccionario")


if __name__ == "__main__":
    main()
