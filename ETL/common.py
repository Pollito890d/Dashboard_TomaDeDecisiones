"""Utilidades compartidas del ETL: manifiesto, decimales exactos y escritura atómica."""

import csv
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import unicodedata

ORIGINALES_ESPERADOS = 19


class EtlError(Exception):
    """Error de validación o lectura que debe detener la fuente sin escribir salidas."""


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def verify_manifest(settings):
    """Comprueba tamaño y SHA-256 de los 19 originales; devuelve {ruta_manifiesto: entrada}."""
    if not settings.manifest.is_file():
        raise EtlError('No existe el manifiesto de originales: ' + str(settings.manifest))
    manifest = json.loads(settings.manifest.read_text(encoding='utf-8'))
    files = [f for f in manifest['archivos'] if f['estado'] == 'validado']
    if len(files) != ORIGINALES_ESPERADOS or len({f['archivo'] for f in files}) != ORIGINALES_ESPERADOS:
        raise EtlError('El manifiesto no contiene 19 archivos validados distintos')
    for f in files:
        path = settings.raw(f['archivo'])
        if not path.is_file():
            raise EtlError('Falta archivo original: ' + f['archivo'])
        if path.stat().st_size != f['tamano_bytes'] or sha256_file(path) != f['sha256']:
            raise EtlError('Hash o tamaño distinto al manifiesto: ' + f['archivo'])
    return {f['archivo']: f for f in files}


def norm(value):
    """Texto comparable: sin acentos, minúsculas y espacios colapsados."""
    if value is None:
        return ''
    text = unicodedata.normalize('NFKD', str(value))
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', text).strip().casefold()


def to_decimal(value):
    """Convierte sin pérdida: los float de Excel usan su representación más corta (repr)."""
    if value is None or isinstance(value, bool):
        raise EtlError('Valor no numérico: ' + repr(value))
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        if value != value or value in (float('inf'), float('-inf')):
            raise EtlError('Valor no finito')
        return Decimal(repr(value))
    try:
        result = Decimal(str(value).strip())
    except InvalidOperation as exc:
        raise EtlError('Valor no numérico: ' + repr(value)) from exc
    if not result.is_finite():
        raise EtlError('Valor no finito')
    return result


NUMERO_CSV = re.compile(r'-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?')


def parse_csv_number(text):
    """Número de CSV oficial: admite espacios y separador de miles; vacío = None (nulo)."""
    clean = text.strip()
    if clean == '':
        return None
    if not NUMERO_CSV.fullmatch(clean):
        raise EtlError('Número con formato no reconocido: ' + repr(text))
    return Decimal(clean.replace(',', ''))


def fmt(value):
    """Representación determinista; None se exporta como campo vacío (NULL)."""
    if value is None:
        return ''
    if isinstance(value, Decimal):
        if value == 0:
            return '0'
        text = format(value, 'f')
        return text.rstrip('0').rstrip('.') if '.' in text else text
    return str(value)


def decimals(text):
    """Número de decimales de un valor exportado (para validar escala del esquema)."""
    return len(text.split('.', 1)[1]) if '.' in text else 0


def _atomic(path, write):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.' + path.name + '.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as stream:
            write(stream)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def write_csv(path, columns, rows):
    """CSV UTF-8, separador coma, salto LF. Los valores se escriben con fmt()."""
    def write(stream):
        writer = csv.writer(stream, lineterminator='\n')
        writer.writerow(columns)
        for row in rows:
            writer.writerow([fmt(row.get(c)) for c in columns])
    _atomic(path, write)


def write_json(path, data):
    _atomic(path, lambda s: (json.dump(data, s, ensure_ascii=False, indent=2, sort_keys=True), s.write('\n')))


@dataclass
class Output:
    """Descripción de una salida para el manifiesto (contrato de integración)."""
    nombre: str
    archivo: str
    grano: list
    columnas: list
    unidades: dict
    filas: int = 0
    tabla_destino: str = ''


@dataclass
class SourceResult:
    fuente: str
    entradas: list
    salidas: list
    rechazos: list = field(default_factory=list)
    conciliacion: dict = field(default_factory=dict)

    def reject(self, archivo, motivo, hoja='', fila='', columna='', valor=''):
        self.rechazos.append(dict(archivo=archivo, hoja=hoja, fila=fila, columna=columna,
                                  valor_original=valor, motivo=motivo))


RECHAZO_COLUMNAS = ['archivo', 'hoja', 'fila', 'columna', 'valor_original', 'motivo']
