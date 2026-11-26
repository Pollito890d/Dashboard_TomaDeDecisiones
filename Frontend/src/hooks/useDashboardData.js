import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cargarCnbv,
  cargarFonacot,
  cargarInstituciones,
  cargarSniiv,
  describirError,
  esCancelacion,
  loadDashboardData,
} from '../services/dashboardApi';

/**
 * Estado del tablero con actualización independiente por fuente.
 *
 * La carga inicial determina la selección a partir de las respuestas oficiales.
 * Después, cada filtro consulta únicamente su fuente; las cancelaciones
 * intencionales nunca se muestran como error y la última selección prevalece.
 */

const FUENTES = ['cnbv', 'instituciones', 'fonacot', 'sniiv'];
const CAMPOS = {
  cnbv: [
    'contratoVersion', 'indicadores', 'corte', 'periodo', 'serieAnual', 'bandasPorKpi',
    'fuenteCnbv', 'notaCnbv', 'sinDatosCnbv', 'periodosDisponiblesCnbv',
  ],
  instituciones: [
    'instituciones', 'corteInstituciones', 'trimestreInstituciones', 'limitadoInstituciones',
    'totalDevueltosInstituciones', 'notaInstituciones', 'sinDatosInstituciones',
    'fuenteInstituciones', 'claveSeisInstituciones',
  ],
  fonacot: [
    'fonacot', 'trimestreFonacot', 'anioFonacot', 'fuenteFonacot', 'sinDatosFonacot',
    'desgloseFonacot', 'entidadesFonacot',
  ],
  sniiv: [
    'sniiv', 'anioSniiv', 'fuenteSniiv', 'sinDatosSniiv', 'desgloseSniiv', 'entidadesSniiv',
  ],
};
const CARGADORES = {
  cnbv: cargarCnbv,
  instituciones: cargarInstituciones,
  fonacot: cargarFonacot,
  sniiv: cargarSniiv,
};

const estadosIniciales = () => Object.fromEntries(
  FUENTES.map((fuente) => [fuente, { datos: null, error: null, loading: true }]),
);

const seleccionarCampos = (origen, campos) =>
  Object.fromEntries(campos.map((campo) => [campo, origen?.[campo] ?? null]));

const firmasDe = (seleccion, revisiones) => {
  const s = seleccion ?? {};
  return {
    cnbv: `${s.periodo ?? ''}|${s.anio ?? ''}|${revisiones.cnbv}`,
    instituciones: [
      s.periodoInstitucional ?? '', s.trimestreInstitucional ?? '', s.anioInstitucional ?? '',
      s.claveSeis ?? '', s.limiteInstituciones ?? '', revisiones.instituciones,
    ].join('|'),
    fonacot: `${s.trimestreFonacot ?? ''}|${s.anioFonacot ?? ''}|${revisiones.fonacot}`,
    sniiv: `${s.anioSniiv ?? ''}|${revisiones.sniiv}`,
  };
};

export function useDashboardData(parametros = {}) {
  const claveParametros = JSON.stringify(parametros ?? {});
  const parametrosEstables = useMemo(() => JSON.parse(claveParametros), [claveParametros]);

  const [revisionBase, setRevisionBase] = useState(0);
  const [revisiones, setRevisiones] = useState({ cnbv: 0, instituciones: 0, fonacot: 0, sniiv: 0 });
  const [base, setBase] = useState({ data: null, error: null, loading: true });
  const [listo, setListo] = useState(false);
  const [estados, setEstados] = useState(estadosIniciales);
  const aplicadas = useRef(null);

  /* Carga inicial: una sola vez, salvo reintento explícito de todo. */
  useEffect(() => {
    const controlador = new AbortController();
    let activo = true;
    setListo(false);
    setBase((anterior) => ({ ...anterior, loading: true, error: null }));

    loadDashboardData({}, { signal: controlador.signal })
      .then((payload) => {
        if (!activo) return;
        setBase({ data: payload, error: null, loading: false });
        setListo(true);
      })
      .catch((fallo) => {
        if (!activo || esCancelacion(fallo)) return;
        setBase({ data: null, error: fallo, loading: false });
      });

    return () => {
      activo = false;
      controlador.abort();
    };
  }, [revisionBase]);

  const seleccionBase = base.data?.seleccion ?? null;
  const seleccion = useMemo(() => {
    if (!seleccionBase) return null;
    const overrides = Object.fromEntries(
      Object.entries(parametrosEstables).filter(
        ([, valor]) => valor !== undefined && valor !== null && valor !== '',
      ),
    );
    return { ...seleccionBase, ...overrides };
  }, [seleccionBase, parametrosEstables]);

  const firmas = useMemo(
    () => firmasDe(seleccion, revisiones),
    [seleccion, revisiones],
  );

  useEffect(() => {
    if (!listo) aplicadas.current = null;
  }, [listo]);

  /* Siembra los estados por fuente con la respuesta inicial ya recibida. */
  useEffect(() => {
    if (!listo || !base.data || aplicadas.current) return;
    setEstados(Object.fromEntries(FUENTES.map((fuente) => [
      fuente,
      {
        datos: seleccionarCampos(base.data, CAMPOS[fuente]),
        error: base.data.errores?.[fuente] ?? null,
        loading: false,
      },
    ])));
    // La siembra corresponde a la selección con la que se hizo el bootstrap.
    // Si el usuario cambió filtros mientras cargaba, esas fuentes se consultan
    // después en lugar de presentar cifras del corte anterior como vigentes.
    aplicadas.current = firmasDe(base.data.seleccion, revisiones);
  }, [listo, base.data, firmas, revisiones]);

  /* Solo se vuelve a consultar lo que cambió desde la última respuesta aplicada. */
  useEffect(() => {
    if (!listo || !seleccion || !aplicadas.current) return;
    const anteriores = aplicadas.current;
    const cambiadas = FUENTES.filter((fuente) => anteriores[fuente] !== firmas[fuente]);
    if (!cambiadas.length) return;

    const controlador = new AbortController();
    let activo = true;

    setEstados((previo) => {
      const siguiente = { ...previo };
      cambiadas.forEach((fuente) => {
        siguiente[fuente] = { ...siguiente[fuente], loading: true, error: null };
      });
      return siguiente;
    });

    Promise.allSettled(
      cambiadas.map((fuente) => CARGADORES[fuente](seleccion, { signal: controlador.signal })),
    ).then((resultados) => {
      if (!activo) return;
      const aplicadasAhora = { ...aplicadas.current };
      const actualizaciones = {};

      resultados.forEach((resultado, indice) => {
        const fuente = cambiadas[indice];
        if (resultado.status === 'fulfilled') {
          actualizaciones[fuente] = { datos: resultado.value, error: null, loading: false };
          aplicadasAhora[fuente] = firmas[fuente];
        } else if (!esCancelacion(resultado.reason)) {
          actualizaciones[fuente] = {
            datos: null,
            error: describirError(resultado.reason),
            loading: false,
          };
          // El error se muestra y se conserva la última respuesta válida, pero
          // no se reprograma automáticamente al cambiar otro filtro: solo se
          // reintenta si el usuario vuelve a pedirlo.
          aplicadasAhora[fuente] = firmas[fuente];
        }
      });

      aplicadas.current = aplicadasAhora;
      setEstados((previo) => {
        const siguiente = { ...previo };
        Object.entries(actualizaciones).forEach(([fuente, valor]) => {
          siguiente[fuente] = { ...valor, datos: valor.datos ?? siguiente[fuente].datos };
        });
        return siguiente;
      });
    });

    return () => {
      activo = false;
      controlador.abort();
    };
  }, [firmas, listo, seleccion]);

  const data = useMemo(() => {
    if (!base.data) return null;
    const resultado = { ...base.data };
    FUENTES.forEach((fuente) => {
      const porFuente = estados[fuente].datos;
      if (porFuente) Object.assign(resultado, porFuente);
    });

    const slices = estados.instituciones.datos;
    if (slices) {
      resultado.catalogos = {
        ...(resultado.catalogos ?? {}),
        instituciones: (slices.instituciones ?? []).map((fila) => ({
          claveSeis: fila.clave_seis,
          nombre: fila.institucion_nombre,
          corte: slices.corteInstituciones,
          trimestre: slices.trimestreInstituciones,
        })),
        totalInstitucionesDevueltas: slices.totalDevueltosInstituciones ?? 0,
        limitadoInstituciones: slices.limitadoInstituciones ?? false,
      };
    }

    resultado.errores = { ...(base.data.errores ?? {}) };
    FUENTES.forEach((fuente) => {
      const errorFuente = estados[fuente].error;
      if (errorFuente) resultado.errores[fuente] = errorFuente;
      else delete resultado.errores[fuente];
    });
    resultado.seleccion = seleccion ?? base.data.seleccion;
    return resultado;
  }, [base.data, estados, seleccion]);

  const cargando = useMemo(() => Object.fromEntries(
    FUENTES.map((fuente) => [fuente, Boolean(base.loading || estados[fuente].loading)]),
  ), [base.loading, estados]);

  const recargar = (fuente) => {
    if (!FUENTES.includes(fuente)) return;
    setRevisiones((anterior) => ({ ...anterior, [fuente]: anterior[fuente] + 1 }));
  };

  const recargarTodo = () => {
    setEstados(estadosIniciales());
    setRevisionBase((anterior) => anterior + 1);
  };

  return {
    data,
    error: base.error,
    loading: base.loading,
    cargando,
    seleccion,
    catalogos: data?.catalogos ?? null,
    recargar,
    recargarTodo,
  };
}

export default useDashboardData;
