export default function ContextMetric({ etiqueta, valor, nota }) {
  return (
    <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
      <div className="text-[10px] text-slate-500">{etiqueta}</div>
      <div className="mt-1 text-sm font-bold text-slate-900">{valor}</div>
      {nota && <div className="text-[10px] text-slate-400 mt-0.5">{nota}</div>}
    </div>
  );
}
