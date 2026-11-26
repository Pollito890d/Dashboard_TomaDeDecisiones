export default function DashboardFrame({ children }) {
  return (
    <div className="min-h-screen bg-[#ECEFF4] py-5 px-4 sm:px-6 lg:px-8 text-slate-800">
      {/* Contenedor Principal estilo Monitor de Escritorio (Patrón Z / F del Wireframe Figma) */}
      <div className="max-w-[1240px] mx-auto bg-[#F5F7FA] border border-slate-300/90 rounded-md shadow-sm p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
