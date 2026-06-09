import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Nurse, QueueItem } from '../types';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function NurseApp({ onBack }: { onBack: () => void }) {
  const [nurse, setNurse] = useState<Nurse | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [triaging, setTriaging] = useState<any | null>(null);
  const [sym, setSym] = useState('');
  const [urgency, setUrgency] = useState<'N' | 'U' | 'E' | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const pwd = fd.get('pwd') as string;
    
    const { data } = await supabase.from('nurses').select('*').eq('email', email).eq('pwd', pwd).eq('active', true).maybeSingle();
    
    if (data) {
      setNurse(data);
      loadQueue(data);
    } else {
      alert('Credenciais inválidas');
    }
  };

  const loadQueue = async (activeNurse = nurse) => {
    if (!activeNurse) return;
    const { data } = await supabase
      .from('queue')
      .select('*, doctors(name)')
      .eq('status', 'waiting')
      .eq('priority', 'AGUARDANDO TRIAGEM')
      .eq('hospital_id', activeNurse.hospital_id)
      .order('created_at', { ascending: true });
    setQueue(data || []);
  };

  useEffect(() => {
    if (nurse) {
      loadQueue(nurse);
      const channel = supabase.channel('nurse-q')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, () => {
          loadQueue(nurse);
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [nurse]);

  const submitTriage = async () => {
    if (!urgency || !sym) return alert('Preencha os sintomas e classifique o risco!');
    
    const priorities = { N: { p: 'NORMAL', l: 3 }, U: { p: 'URGENTE', l: 2 }, E: { p: 'EMERGÊNCIA', l: 1 } };
    const { p, l } = priorities[urgency];
    
    const { error } = await supabase.from('queue').update({
      sym, priority: p, kind: urgency, level: l, nurse_id: nurse!.id
    }).eq('id', triaging.id);

    if (!error) {
      setTriaging(null);
    } else {
      alert('Erro ao salvar triagem: ' + error.message);
    }
  };

  if (!nurse) {
     return (
      <div className="min-h-screen bg-[#07101f] text-slate-100 flex flex-col items-center pt-12 px-6">
        <div className="w-full max-w-md bg-[#0d1e35] p-6 rounded-2xl border border-teal-500/20">
          <h2 className="text-2xl font-bold mb-1 text-white">Enfermagem</h2>
          <p className="text-sm text-slate-400 mb-6">Login exclusivo para triagem</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input required name="email" placeholder="E-mail profissional (ou COREN)" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <input required name="pwd" type="password" placeholder="Senha" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={onBack} className="p-3 bg-transparent border border-white/10 rounded-xl text-slate-300 w-1/3">Voltar</button>
              <button type="submit" className="p-3 bg-teal-500 text-slate-900 font-bold rounded-xl w-2/3 hover:bg-teal-400">Acessar Triagem</button>
            </div>
          </form>
        </div>
      </div>
     );
  }

  if (triaging) {
     return (
        <div className="min-h-screen bg-[#07101f] text-slate-100 flex flex-col items-center p-6">
          <div className="w-full max-w-md">
             <div className="flex items-center mb-6 gap-3">
               <button onClick={() => setTriaging(null)} className="p-2 rounded-full border border-white/10"><ArrowLeft size={20} /></button>
               <h2 className="text-xl font-bold text-white">Avaliação do Paciente</h2>
             </div>

             <div className="bg-[#0d1e35] p-5 rounded-2xl border border-teal-500/20 mb-6">
                <div className="text-xl text-teal-400 font-bold">{triaging.name || triaging.patient_name}</div>
                <div className="text-sm text-slate-400 mb-4">Para: {triaging.doctors?.name || triaging.doc_name}</div>

                <textarea
                  value={sym}
                  onChange={(e) => setSym(e.target.value)}
                  placeholder="Descreva os sintomas relatados..."
                  className="w-full h-32 p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400 mb-6"
                />

                <div className="text-sm font-bold text-white mb-3">Classificação de Risco</div>
                <div className="grid grid-cols-3 gap-2 mb-6">
                  <button onClick={() => setUrgency('N')} className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-colors ${urgency === 'N' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-[#122540] border-white/10 text-slate-400'}`}>
                    <span className="text-xl">🟢</span><span className="text-[10px] font-bold uppercase">Normal</span>
                  </button>
                  <button onClick={() => setUrgency('U')} className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-colors ${urgency === 'U' ? 'bg-amber-500/20 border-amber-500 text-amber-500' : 'bg-[#122540] border-white/10 text-slate-400'}`}>
                    <span className="text-xl">🟡</span><span className="text-[10px] font-bold uppercase">Urgente</span>
                  </button>
                  <button onClick={() => setUrgency('E')} className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-colors ${urgency === 'E' ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-[#122540] border-white/10 text-slate-400'}`}>
                    <span className="text-xl">🔴</span><span className="text-[10px] font-bold uppercase">Emergência</span>
                  </button>
                </div>

                <button onClick={submitTriage} className="w-full p-4 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400">
                  <CheckCircle2 className="inline mr-2" size={20} /> Concluir e Enviar
                </button>
             </div>
          </div>
        </div>
     );
  }

  const HOSP_NAMES: Record<string, string> = {
    hosp_central: 'Unidade Central',
    hosp_iguatemi: 'Unidade Iguatemi',
    hosp_orla: 'Unidade Orla'
  };

  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100 flex flex-col items-center p-6">
      <div className="w-full max-w-xl">
         <div className="flex justify-between items-center bg-[#0d1e35] p-4 rounded-2xl border border-teal-500/20 mb-6 shadow-md">
           <div className="font-syne font-bold text-teal-400">
             Fila<span className="text-white">Fácil</span> 
             <span className="text-xs text-slate-400 ml-2 font-sans font-normal tracking-wide bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/10">
               {HOSP_NAMES[nurse.hospital_id] || nurse.hospital_id}
             </span>
           </div>
           <button onClick={onBack} className="text-xs border border-white/10 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer hover:bg-white/5 transition-all">Sair</button>
         </div>

         <h2 className="font-bold text-lg mb-4 text-white">Aguardando Triagem</h2>
         
         <div className="flex flex-col gap-3">
            {queue.length === 0 ? (
               <div className="p-8 text-center border border-white/5 bg-white/5 rounded-2xl text-slate-400 text-sm">Nenhum paciente aguardando triagem.</div>
            ) : queue.map(q => (
               <div key={q.id} className="bg-[#0d1e35] border border-white/10 p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white text-lg">{q.name || q.patient_name} <span className="font-normal text-sm text-slate-400">({q.age} anos)</span></div>
                    <div className="text-xs text-teal-400 mt-1">Para: {q.doctors?.name || q.doc_name}</div>
                  </div>
                  <button onClick={() => { setTriaging(q); setSym(''); setUrgency(null); }} className="bg-teal-500 text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shrink-0">Triar →</button>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}
