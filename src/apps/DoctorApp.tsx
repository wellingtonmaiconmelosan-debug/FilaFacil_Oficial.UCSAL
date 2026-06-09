import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Doctor, QueueItem } from '../types';
import { PlusCircle, List, History, UserPlus, FileText, CheckCircle2 } from 'lucide-react';

export default function DoctorApp({ onBack }: { onBack: () => void }) {
  const [doc, setDoc] = useState<Doctor | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [active, setActive] = useState<QueueItem | null>(null);
  const [obs, setObs] = useState('');
  
  // Tab states: 0 = General, 1 = Add Patient, 2 = History
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  // Form states for manual registration
  const [mName, setMName] = useState('');
  const [mAge, setMAge] = useState('');
  const [mSym, setMSym] = useState('');
  const [mUrgency, setMUrgency] = useState<'N' | 'U' | 'E' | null>(null);

  // History states
  const [history, setHistory] = useState<QueueItem[]>([]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const pwd = fd.get('pwd') as string;
    
    const { data } = await supabase.from('doctors').select('*').eq('email', email).eq('pwd', pwd).eq('active', true).maybeSingle();
    
    if (data) {
      setDoc(data);
      loadQueue(data.id);
      loadHistory(data.id);
    } else {
      alert('Credenciais inválidas');
    }
  };

  const loadQueue = async (docId: string) => {
    const { data } = await supabase.from('queue').select('*')
      .eq('doc_id', docId)
      .neq('status', 'done')
      .neq('priority', 'AGUARDANDO TRIAGEM')
      .order('level').order('created_at').order('id');
    
    if (data) {
      setActive(data.find(q => q.status === 'calling') || null);
      setQueue(data.filter(q => q.status === 'waiting'));
    }
  };

  const loadHistory = async (docId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase.from('queue')
      .select('*')
      .eq('doc_id', docId)
      .eq('status', 'done')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    setHistory(data || []);
  };

  useEffect(() => {
    if (doc) {
      const channel = supabase.channel('doc-q')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `doc_id=eq.${doc.id}` }, () => {
          loadQueue(doc.id);
          loadHistory(doc.id);
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [doc]);

  const callNext = async () => {
    if (!queue.length) return;
    await supabase.from('queue').update({ status: 'calling' }).eq('id', queue[0].id);
  };

  const finish = async () => {
    if (!active || !doc) return;
    const { error } = await supabase.from('queue').update({ status: 'done', obs }).eq('id', active.id);
    if (!error) {
      setObs('');
      setActive(null);
      loadQueue(doc.id);
      loadHistory(doc.id);
      setTab(0);
    } else {
      alert('Erro ao finalizar atendimento: ' + error.message);
    }
  };

  const manualReg = async () => {
    if (!doc) return;
    if (!mName || !mAge || !mSym) return alert('Preencha os dados do paciente.');
    if (!mUrgency) return alert('Selecione a classificação de risco!');

    const priorities = {
      N: { p: 'NORMAL', l: 3 },
      U: { p: 'URGENTE', l: 2 },
      E: { p: 'EMERGÊNCIA', l: 1 }
    };
    const { p, l } = priorities[mUrgency];

    const { error } = await supabase.from('queue').insert({
      doc_id: doc.id,
      hospital_id: doc.hospital_id,
      name: mName,
      age: parseInt(mAge, 10),
      sym: mSym,
      priority: p,
      kind: mUrgency,
      level: l,
      status: 'waiting'
    });

    if (!error) {
      setMName('');
      setMAge('');
      setMSym('');
      setMUrgency(null);
      loadQueue(doc.id);
      setTab(0);
    } else {
      alert('Erro ao registrar na fila: ' + error.message);
    }
  };

  if (!doc) {
     return (
      <div className="min-h-screen bg-[#07101f] text-slate-100 flex flex-col items-center pt-12 px-6">
        <div className="w-full max-w-md bg-[#0d1e35] p-6 rounded-2xl border border-teal-500/20">
          <h2 className="text-2xl font-bold mb-1 text-white">Área Médica</h2>
          <p className="text-sm text-slate-400 mb-6">Acesso restrito aos profissionais</p>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input required name="email" placeholder="E-mail profissional" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <input required name="pwd" type="password" placeholder="Senha" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={onBack} className="p-3 bg-transparent border border-white/10 rounded-xl text-slate-300 w-1/3">Voltar</button>
              <button type="submit" className="p-3 bg-teal-500 text-slate-900 font-bold rounded-xl w-2/3 hover:bg-teal-400">Acessar Consultório</button>
            </div>
          </form>
        </div>
      </div>
     );
  }

  // Calculate stats for today
  const tTotal = history.length;
  const tEmerg = history.filter(h => h.kind === 'E').length;
  const tUrg = history.filter(h => h.kind === 'U').length;
  const tNorm = history.filter(h => h.kind === 'N').length;

  const days = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
  const months = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const d = new Date();
  const dateStr = `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} DE ${months[d.getMonth()]} DE ${d.getFullYear()}`;

  const HOSP_NAMES: Record<string, string> = {
    hosp_central: 'Unidade Central',
    hosp_iguatemi: 'Unidade Iguatemi',
    hosp_orla: 'Unidade Orla'
  };

  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100 flex flex-col items-center p-6">
      <div className="w-full max-w-2xl">
         {/* Top bar with branding, stats, exit */}
         <div className="flex justify-between items-center bg-[#0d1e35] p-4 rounded-2xl border border-teal-500/20 mb-4 shadow-lg">
           <div className="font-syne font-bold text-teal-400 text-xl">
             Fila<span className="text-white">Fácil</span> 
             <small className="text-xs font-sans text-slate-400 italic block mt-0.5">
               Dr(a). {doc.name} · <span className="text-teal-400 font-bold not-italic bg-teal-500/10 px-1.5 py-0.5 rounded text-[10px]">{HOSP_NAMES[doc.hospital_id] || doc.hospital_id}</span>
             </small>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex flex-col items-center bg-[#07101f] border border-white/10 px-3 py-1 rounded-lg">
                 <span className="text-teal-400 font-bold leading-none">{queue.length}</span>
                 <span className="text-[9px] text-slate-400 uppercase font-bold">Fila</span>
              </div>
              <button onClick={onBack} className="text-xs border border-white/10 px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">Sair</button>
           </div>
         </div>

         {/* Navigation Tabs aligned with style guide */}
         <div className="w-full border-b border-teal-500/10 mb-6 flex overflow-x-auto scrollbar-none gap-2">
           <button
             onClick={() => setTab(0)}
             className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
               tab === 0 ? 'text-teal-400 border-teal-400 font-bold' : 'text-slate-500 border-transparent hover:text-slate-300'
             }`}
           >
             <List size={16} /> Painel Geral
           </button>
           <button
             onClick={() => setTab(1)}
             className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
               tab === 1 ? 'text-teal-400 border-teal-400 font-bold' : 'text-slate-500 border-transparent hover:text-slate-300'
             }`}
           >
             <UserPlus size={16} /> + Novo Paciente
           </button>
           <button
             onClick={() => setTab(2)}
             className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
               tab === 2 ? 'text-teal-400 border-teal-400 font-bold' : 'text-slate-500 border-transparent hover:text-slate-300'
             }`}
           >
             <History size={16} /> 📄 Histórico
           </button>
         </div>

         {/* TAB MODULE CONTENT */}
         
         {/* TAB 0: PAINEL GERAL */}
         {tab === 0 && (
           <div className="animate-in fade-in active:scale-95 duration-200">
             {active ? (
                <div className="mb-8 p-6 bg-[#0d1e35] rounded-3xl border border-teal-500/30 shadow-xl">
                   <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-3">Em Atendimento</div>
                   <div className="bg-teal-500/5 border border-teal-500/20 rounded-2xl p-6 flex items-center gap-6 mb-4">
                      <div className="w-4 h-4 rounded-full bg-teal-400 animate-pulse shrink-0 shadow-[0_0_12px_#00c8c0]" />
                      <div>
                        <div className="text-2xl font-bold text-white mb-1">{active.name} <span className="font-normal text-slate-400 text-sm">({active.age} anos)</span></div>
                        <div className="text-sm text-slate-300 italic">{active.sym}</div>
                      </div>
                   </div>
                   <textarea
                     value={obs}
                     onChange={(e) => setObs(e.target.value)}
                     placeholder="Adicionar observações do prontuário (Opcional)..."
                     className="w-full h-24 p-3 rounded-xl bg-[#07101f] border border-white/10 text-white outline-none focus:border-teal-400 mb-4 text-sm"
                   />
                   <button onClick={finish} className="w-full p-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-400 transition-colors shadow-[0_4px_15px_rgba(239,68,68,0.3)] flex items-center justify-center gap-2">
                      <CheckCircle2 size={18} /> Salvar e Finalizar Atendimento
                   </button>
                </div>
             ) : (
                <div className="mb-8 border border-dashed border-teal-500/20 rounded-2xl p-10 text-center bg-[#0d1e35]/50 flex flex-col items-center">
                   <div className="text-5xl mb-4">☕</div>
                   <div className="text-slate-300 font-bold mb-1 text-base">Nenhum atendimento ocorrendo.</div>
                   <div className="text-xs text-slate-500 mb-6 font-medium">Aguardando chamada de paciente da triagem.</div>
                   <button 
                     onClick={callNext} 
                     disabled={!queue.length} 
                     className={`px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg text-sm tracking-wider flex items-center gap-2 ${
                       queue.length ? 'bg-teal-500 text-slate-900 hover:bg-teal-400 cursor-pointer shadow-teal-500/10' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                     }`}
                   >
                      🔔 Chamar Próximo da Fila
                   </button>
                </div>
             )}

             <div className="flex justify-between items-center mb-4">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Fila de Espera (Triados)</div>
                <div className="text-xs text-slate-400">{queue.length} pacientes</div>
             </div>

             <div className="flex flex-col gap-3">
                {queue.length === 0 ? (
                   <div className="p-8 text-center border border-white/5 bg-white/5 rounded-2xl text-slate-400 text-sm">A fila está vazia.</div>
                ) : queue.map((q, i) => (
                   <div key={q.id} className={`p-4 rounded-xl border flex justify-between items-center bg-[#0d1e35] transition-all hover:bg-[#122540] ${
                     q.kind === 'E' ? 'border-l-4 border-l-red-500 border-y-white/5 border-r-white/5' :
                     q.kind === 'U' ? 'border-l-4 border-l-amber-500 border-y-white/5 border-r-white/5' :
                     'border-l-4 border-l-emerald-500 border-y-white/5 border-r-white/5'
                   }`}>
                      <div className="flex items-center gap-4">
                         <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-400">{i + 1}</div>
                         <div>
                           <div className="font-bold text-white text-[15px]">{q.name} <span className="font-normal text-xs text-slate-400">({q.age} anos)</span></div>
                           <div className="text-xs text-slate-400 mt-1 line-clamp-1">{q.sym}</div>
                         </div>
                      </div>
                      <div className={`text-[9px] font-bold uppercase px-2 py-1 rounded-md shrink-0 block text-right max-w-fit ${
                         q.kind === 'E' ? 'bg-red-500/10 text-red-500' :
                         q.kind === 'U' ? 'bg-amber-500/10 text-amber-500' :
                         'bg-emerald-500/10 text-emerald-500'
                      }`}>{q.priority}</div>
                   </div>
                ))}
             </div>
           </div>
         )}

         {/* TAB 1: + NOVO PACIENTE (MANUAL REGISTRATION) */}
         {tab === 1 && (
           <div className="bg-[#0d1e35] p-6 rounded-2xl border border-teal-500/20 shadow-xl animate-in fade-in duration-200">
              <h3 className="font-bold text-lg mb-2 text-white">Adicionar Paciente Manualmente</h3>
              <p className="text-xs text-slate-400 mb-6">Para pacientes que entraram no consultório diretamente sem triagem externa.</p>
              
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1.5 block">Nome do Paciente</label>
                  <input 
                    required 
                    value={mName}
                    onChange={(e) => setMName(e.target.value)}
                    placeholder="Nome Completo" 
                    className="w-full p-3 rounded-xl bg-[#07101f] border border-teal-500/20 text-white outline-none focus:border-teal-400 text-sm" 
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1.5 block">Idade</label>
                  <input 
                    required 
                    type="number"
                    value={mAge}
                    onChange={(e) => setMAge(e.target.value)}
                    placeholder="Idade" 
                    className="w-full p-3 rounded-xl bg-[#07101f] border border-teal-500/20 text-white outline-none focus:border-teal-400 text-sm" 
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1.5 block">Sintomas / Queixa Principal</label>
                  <textarea 
                    required 
                    value={mSym}
                    onChange={(e) => setMSym(e.target.value)}
                    placeholder="Descreva as queixas aqui..." 
                    className="w-full h-24 p-3 rounded-xl bg-[#07101f] border border-teal-500/20 text-white outline-none focus:border-teal-400 text-sm resize-none" 
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase mb-1.5 block">Classificação de Risco</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setMUrgency('N')} 
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.1 transition-all cursor-pointer ${
                        mUrgency === 'N' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-[#07101f] border-white/5 text-slate-400'
                      }`}
                    >
                      <span className="text-xl">🟢</span>
                      <span className="text-[10px] font-bold uppercase">Normal</span>
                    </button>
                    <button 
                      onClick={() => setMUrgency('U')} 
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.1 transition-all cursor-pointer ${
                        mUrgency === 'U' ? 'bg-amber-500/10 border-amber-500 text-amber-500' : 'bg-[#07101f] border-white/5 text-slate-400'
                      }`}
                    >
                      <span className="text-xl">🟡</span>
                      <span className="text-[10px] font-bold uppercase">Urgente</span>
                    </button>
                    <button 
                      onClick={() => setMUrgency('E')} 
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.1 transition-all cursor-pointer ${
                        mUrgency === 'E' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-[#07101f] border-white/5 text-slate-400'
                      }`}
                    >
                      <span className="text-xl">🔴</span>
                      <span className="text-[10px] font-bold uppercase">Emergência</span>
                    </button>
                  </div>
                </div>

                <button onClick={manualReg} className="w-full mt-4 p-4 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 cursor-pointer shadow-lg shadow-teal-500/15">
                   Adicionar à Fila
                </button>
              </div>
           </div>
         )}

         {/* TAB 2: HISTÓRICO DE HOJE */}
         {tab === 2 && (
           <div className="animate-in fade-in duration-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3 block">Resumo de Hoje</div>
              
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-[#0d1e35] border border-teal-500/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-teal-400 font-syne">{tTotal}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Total Hoje</div>
                </div>
                <div className="bg-[#0d1e35] border border-teal-500/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-red-500 font-syne">{tEmerg}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Emergência</div>
                </div>
                <div className="bg-[#0d1e35] border border-teal-500/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-amber-500 font-syne">{tUrg}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Urgente</div>
                </div>
                <div className="bg-[#0d1e35] border border-teal-500/10 rounded-xl p-4 text-center">
                  <div className="text-2xl font-black text-emerald-500 font-syne">{tNorm}</div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Normal</div>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-4 border-b border-teal-500/10 pb-2">
                 {dateStr} · {tTotal} ATENDIMENTOS FINALIZADOS
              </div>

              <div className="flex flex-col gap-3">
                 {history.length === 0 ? (
                   <div className="p-8 text-center bg-white/5 border border-white/5 rounded-xl text-slate-400 text-sm">Nenhum atendimento finalizado hoje.</div>
                 ) : history.map(item => {
                   const time = new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                   return (
                     <div key={item.id} className={`bg-[#0d1e35] border border-white/10 p-5 rounded-2xl relative overflow-hidden ${
                       item.kind === 'E' ? 'border-l-4 border-l-red-500' :
                       item.kind === 'U' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-emerald-500'
                     }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="font-bold text-white text-base">{item.name}</span>
                            <span className="text-slate-400 text-xs ml-2">({item.age} anos)</span>
                          </div>
                          <span className="text-slate-500 text-xs font-mono">{time}</span>
                        </div>
                        
                        <div className="inline-block mb-3">
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${
                             item.kind === 'E' ? 'bg-red-500/10 text-red-500' :
                             item.kind === 'U' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                          }`}>{item.priority}</span>
                        </div>

                        <div className="text-xs text-slate-300 italic mb-3">{item.sym || 'Sem descrição clínico de entrada'}</div>

                        {item.obs && (
                          <div className="bg-teal-500/5 border border-teal-500/10 rounded-xl p-3 text-xs text-teal-400 flex flex-col gap-1 mt-2">
                            <span className="font-bold text-[10px] uppercase tracking-wider block">📄 Observação do Médico:</span>
                            <span className="italic block leading-relaxed">{item.obs}</span>
                          </div>
                        )}
                     </div>
                   );
                 })}
              </div>
           </div>
         )}
      </div>
    </div>
  );
}
