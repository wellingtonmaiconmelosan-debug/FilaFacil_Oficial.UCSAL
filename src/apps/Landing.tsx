import { Activity, Stethoscope, UserRound, QrCode } from 'lucide-react';
import { useState } from 'react';

interface Props {
  onSelectRole: (role: 'PATIENT' | 'NURSE' | 'DOCTOR') => void;
}

export default function Landing({ onSelectRole }: Props) {
  const [showQr, setShowQr] = useState(false);

  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100 flex flex-col items-center justify-center p-6 text-center" style={{ background: 'radial-gradient(ellipse at 40% 0%, #0a2a45 0%, #07101f 65%)' }}>
      <div className="mb-4">
        <Activity size={56} className="text-teal-400" />
      </div>
      <h1 className="font-syne text-4xl font-extrabold mb-2 bg-gradient-to-r from-white to-teal-400 bg-clip-text text-transparent">FilaFácil</h1>
      <p className="text-slate-400 mb-8 max-w-sm">Gestão inteligente de atendimento e rastreamento de filas em tempo real</p>

      <button
        onClick={() => setShowQr(!showQr)}
        className="mb-8 px-4 py-2 rounded-full border border-teal-500/30 text-teal-300 text-sm font-semibold hover:bg-teal-500/10 transition-colors flex items-center gap-2"
      >
        <QrCode size={16} /> {showQr ? 'Ocultar QR Code' : 'Mostrar QR Code'}
      </button>

      {showQr && (
        <div className="bg-white p-4 rounded-2xl mb-8 animate-in fade-in slide-in-from-bottom-4">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https://wellingtonmaiconmelosan-debug.github.io/FilaFacil_Oficial.UCSAL/" alt="QR Code" className="w-32 h-32 rounded-lg" />
          <div className="text-slate-900 text-xs font-bold mt-3 tracking-widest">ACESSE O APP</div>
        </div>
      )}

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <RoleCard
          icon={<UserRound size={28} className="text-white" />}
          title="Sou Paciente"
          desc="Solicitar atendimento e senha"
          onClick={() => onSelectRole('PATIENT')}
          bg="bg-white/5 border-white/10"
          iconBg="bg-white/10"
        />
        <RoleCard
          icon={<Activity size={28} className="text-emerald-400" />}
          title="Enfermagem (Triagem)"
          desc="Classificar risco de pacientes"
          onClick={() => onSelectRole('NURSE')}
          bg="bg-emerald-500/5 border-emerald-500/10"
          iconBg="bg-emerald-500/20"
        />
        <RoleCard
          icon={<Stethoscope size={28} className="text-blue-400" />}
          title="Sou Médico"
          desc="Acessar consultório"
          onClick={() => onSelectRole('DOCTOR')}
          bg="bg-blue-500/5 border-blue-500/10"
          iconBg="bg-blue-500/20"
        />
      </div>
    </div>
  );
}

function RoleCard({ icon, title, desc, onClick, bg, iconBg }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 hover:-translate-y-1 hover:border-teal-500/30 hover:shadow-[0_8px_20px_-6px_rgba(20,184,166,0.15)] active:scale-95 cursor-pointer group ${bg}`}
    >
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${iconBg}`}>
        {icon}
      </div>
      <div>
        <div className="font-bold text-base transition-colors group-hover:text-teal-300">{title}</div>
        <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
      </div>
    </button>
  );
}
