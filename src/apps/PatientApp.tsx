import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Patient, QueueItem } from '../types';
import Map from '../components/Map';
import { 
  ArrowLeft, BellRing, MapPin, Building, ChevronRight, Check,
  Stethoscope, Baby, HeartPulse, Bone, Flower, Brain, Sparkles, Ambulance 
} from 'lucide-react';

const HOSPITALS = [
  {
    id: 'hosp_central',
    name: 'Hospital FilaFácil - Unidade Central',
    address: 'Av. Joana Angélica, 1200 - Nazaré, Salvador - BA',
    coords: [-12.9782, -38.5085] as [number, number],
  },
  {
    id: 'hosp_iguatemi',
    name: 'Hospital FilaFácil - Unidade Iguatemi',
    address: 'Av. Tancredo Neves, 148 - Caminho das Árvores, Salvador - BA',
    coords: [-12.9796, -38.4632] as [number, number],
  },
  {
    id: 'hosp_orla',
    name: 'Hospital FilaFácil - Unidade Orla',
    address: 'Av. Octávio Mangabeira, 2400 - Pituba, Salvador - BA',
    coords: [-12.9991, -38.4552] as [number, number],
  }
];

const SPECS = [
  { id: 'cg', n: 'Clínica Geral', icon: Stethoscope, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20' },
  { id: 'ped', n: 'Pediatria', icon: Baby, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'card', n: 'Cardiologia', icon: HeartPulse, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  { id: 'ort', n: 'Ortopedia', icon: Bone, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'gin', n: 'Ginecologia', icon: Flower, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  { id: 'neur', n: 'Neurologia', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'derm', n: 'Dermatologia', icon: Sparkles, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'urg', n: 'Urgência', icon: Ambulance, color: 'text-red-500', bg: 'bg-red-600/15 border-red-500/20' }
];

export default function PatientApp({ onBack }: { onBack: () => void }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selHospital, setSelHospital] = useState<typeof HOSPITALS[0]>(HOSPITALS[0]);
  const [docs, setDocs] = useState<any[]>([]);
  const [selDoc, setSelDoc] = useState<any>(null);
  const [queueItem, setQueueItem] = useState<QueueItem | null>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [dailySeq, setDailySeq] = useState<number>(1);

  // Form states to pre-populate and make editable
  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('filafacil_paciente');
    if (saved) {
      const p = JSON.parse(saved);
      setPatient(p);
      setFormName(p.name || '');
      setFormAge(p.age ? String(p.age) : '');
      setFormEmail(p.email || '');
      setFormPhone(p.phone || '');
    }
    
    // Check notification permission
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationsAllowed(true);
    }
  }, []);

  const requestNotifications = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationsAllowed(permission === "granted");
    if (permission === 'granted') {
      new Notification('Notificações Ativas', { body: 'Você será avisado quando chegar a sua vez!' });
    }
  };

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p = {
      name: fd.get('name') as string,
      age: parseInt(fd.get('age') as string, 10),
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
    };
    setPatient(p);
    localStorage.setItem('filafacil_paciente', JSON.stringify(p));
    setStep(2);
  };

  const loadDocs = async (specId: string) => {
    const { data } = await supabase.from('doctors').select('*').eq('spec_id', specId).eq('active', true).eq('hospital_id', selHospital.id);
    setDocs(data || []);
    setStep(4);
  };

  const enterQueue = async () => {
    if (!patient || !selDoc) return;
    const { data, error } = await supabase.from('queue').insert({
      doc_id: selDoc.id,
      hospital_id: selHospital.id,
      name: patient.name,
      age: patient.age,
      sym: `Aguardando avaliação em ${selHospital.name}...`,
      priority: 'AGUARDANDO TRIAGEM',
      kind: 'T',
      level: 4,
      status: 'waiting'
    }).select().single();

    if (!error && data) {
      setQueueItem(data);
      setStep(5);
    }
  };

  // Subscription & Tracking
  useEffect(() => {
    if (step === 5 && queueItem) {
      fetchPosition();
      fetchDailySeq(queueItem.id);
      
      const channel = supabase.channel('pac-q')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `id=eq.${queueItem.id}` }, (payload) => {
          setQueueItem(payload.new as QueueItem);
          fetchPosition();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue', filter: `doc_id=eq.${queueItem.doc_id}` }, () => {
          fetchPosition();
        })
        .subscribe();
      
      return () => { supabase.removeChannel(channel); };
    }
  }, [step, queueItem?.id]);

  const fetchDailySeq = async (itemId: number) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('queue')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('hospital_id', selHospital.id)
        .lte('id', itemId);

      if (!error && count !== null) {
        setDailySeq(count);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPosition = async () => {
    if (!queueItem) return;
    const { data } = await supabase.from('queue').select('id, status, priority, kind')
      .eq('doc_id', queueItem.doc_id)
      .in('status', ['waiting', 'calling'])
      .order('level', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    
    if (!data) return;
    
    const me = data.find(x => x.id === queueItem.id);
    if (!me) {
      setQueueStatus({ done: true });
      return;
    }
    
    const idxGeral = data.findIndex(x => x.id === queueItem.id);
    const myKindData = data.filter(x => x.kind === me.kind);
    const idxEstado = myKindData.findIndex(x => x.id === queueItem.id);

    const isCalling = me.status === 'calling';
    
    setQueueStatus({
      idxGeral,
      idxEstado,
      isCalling,
      untriaged: me.priority === 'AGUARDANDO TRIAGEM',
    });

    if (isCalling && notificationsAllowed) {
      new Notification('Sua Vez!', { body: `Você foi chamado no consultório do Dr(a). ${selDoc?.name}!` });
    }
  };

  // STEP 1: LOGIN
  if (step === 1) {
    return (
      <div className="min-h-screen bg-[#07101f] text-slate-100 flex flex-col items-center pt-12 px-6">
        <div className="w-full max-w-md bg-[#0d1e35] p-6 rounded-2xl border border-teal-500/20">
          <h2 className="text-2xl font-bold mb-1 text-white">Seus Dados</h2>
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-slate-400">Para solicitar sua ficha e notificações</p>
            {patient && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('filafacil_paciente');
                  setPatient(null);
                  setFormName('');
                  setFormAge('');
                  setFormEmail('');
                  setFormPhone('');
                }}
                className="text-xs text-red-400 hover:text-red-300 transition-colors hover:underline cursor-pointer"
              >
                Limpar Dados
              </button>
            )}
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input required name="name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Seu Nome Completo" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <input required name="age" type="number" value={formAge} onChange={(e) => setFormAge(e.target.value)} placeholder="Sua Idade" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <input required name="email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Seu E-mail" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <input required name="phone" type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="WhatsApp (ex: 71 99999-9999)" className="w-full p-3 rounded-xl bg-[#122540] border border-teal-500/30 text-white outline-none focus:border-teal-400" />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={onBack} className="p-3 bg-transparent border border-white/10 rounded-xl text-slate-300 w-1/3 cursor-pointer">Voltar</button>
              <button type="submit" className="p-3 bg-teal-500 text-slate-900 font-bold rounded-xl w-2/3 hover:bg-teal-400 cursor-pointer transition-colors">Continuar</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // STEP 2: HOSPITAL SELECTION
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#07101f] text-slate-100 p-6 flex flex-col items-center">
        <div className="w-full max-w-md">
          <div className="flex items-center mb-6 gap-3">
            <button onClick={onBack} className="p-2 rounded-full border border-white/10 cursor-pointer"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="text-xl font-bold text-white">Olá, {patient?.name.split(' ')[0]}</h2>
              <p className="text-sm text-slate-400 font-medium">Escolha a Unidade do Hospital</p>
            </div>
          </div>

          {/* Interactive Hospital Map preview for chosen hospital */}
          <div className="mb-4">
            <Map coords={selHospital.coords} name={selHospital.name} address={selHospital.address} />
          </div>

          <div className="flex flex-col gap-3">
            {HOSPITALS.map(h => {
              const selected = h.id === selHospital.id;
              return (
                <button
                  key={h.id}
                  onClick={() => setSelHospital(h)}
                  className={`p-4 rounded-xl border text-left flex gap-3 transition-all cursor-pointer ${
                    selected ? 'bg-teal-500/10 border-teal-500/60 shadow-lg' : 'bg-[#0d1e35] border-teal-500/10 hover:bg-[#122540]'
                  }`}
                >
                  <Building size={20} className={selected ? 'text-teal-400 shrink-0 mt-0.5' : 'text-slate-400 shrink-0 mt-0.5'} />
                  <div className="flex-1">
                    <div className="font-bold text-white flex items-center justify-between">
                      {h.name}
                      {selected && <Check size={16} className="text-teal-400" />}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{h.address}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <button onClick={() => setStep(3)} className="w-full mt-6 py-4 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 cursor-pointer shadow-lg shadow-teal-500/10 flex items-center justify-center gap-2">
            Confirmar Unidade <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: SPECIALTY SELECTION
  if (step === 3) {
    return (
      <div className="min-h-screen bg-[#07101f] text-slate-100 p-6 flex flex-col items-center">
        <div className="w-full max-w-md">
          <div className="flex items-center mb-6 gap-3">
            <button onClick={() => setStep(2)} className="p-2 rounded-full border border-white/10 cursor-pointer"><ArrowLeft size={20} /></button>
            <div>
              <h2 className="text-xl font-bold text-white">Especialidade</h2>
              <p className="text-xs text-slate-400 font-medium">Unidade: {selHospital.name}</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-4">Escolha o serviço médico necessário:</p>
          <div className="grid grid-cols-2 gap-3">
            {SPECS.map(s => {
              const IconComp = s.icon;
              return (
                <button 
                  key={s.id} 
                  onClick={() => loadDocs(s.id)} 
                  className="bg-[#0d1e35] p-5 rounded-2xl border border-teal-500/10 flex flex-col items-center justify-center gap-3 hover:bg-[#122540] hover:border-teal-500/30 active:scale-95 transition-all text-center cursor-pointer group"
                >
                  <div className={`p-3 rounded-xl ${s.bg} flex items-center justify-center transition-all group-hover:scale-110`}>
                    <IconComp className={`w-7 h-7 ${s.color}`} />
                  </div>
                  <span className="text-xs font-bold text-slate-200 tracking-wide">{s.n}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // STEP 4: DOCTOR SELECTION
  if (step === 4) {
    return (
      <div className="min-h-screen bg-[#07101f] text-slate-100 p-6 flex flex-col items-center">
        <div className="w-full max-w-md">
           <div className="flex items-center mb-6 gap-3">
            <button onClick={() => setStep(3)} className="p-2 rounded-full border border-white/10 cursor-pointer"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-bold text-white">Selecione o Médico</h2>
          </div>
          
          <div className="flex flex-col gap-3">
            {docs.length === 0 ? (
              <div className="text-center p-8 bg-[#0d1e35] rounded-xl text-slate-400">Nenhum médico disponível nesta especialidade.</div>
            ) : docs.map(d => (
              <button key={d.id} onClick={() => { setSelDoc(d); enterQueue(); }} className="bg-[#0d1e35] p-4 rounded-xl border border-teal-500/20 text-left flex justify-between items-center hover:bg-[#122540] transition-colors cursor-pointer">
                <div>
                  <div className="font-bold text-white">{d.name}</div>
                  <div className="text-sm text-slate-400 uppercase tracking-wider">{d.crm}</div>
                </div>
                <div className="text-teal-400 text-sm font-bold">Selecionar →</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // STEP 5: REMOTE DASHBOARD
  if (step === 5 && queueItem) {
    const isDone = queueStatus?.done;
    const isCalling = queueStatus?.isCalling;
    const isUntriaged = queueStatus?.untriaged;
    
    // Algoritmo Preditivo de Espera: ~15 minutos por paciente na sua frente (fila de estado).
    const estimatedMinutes = queueStatus ? (queueStatus.idxEstado * 15) : 0;

    return (
      <div className="min-h-screen bg-[#07101f] text-slate-100 p-6 flex flex-col items-center" style={{ background: 'radial-gradient(ellipse at top, #122540 0%, #07101f 80%)' }}>
        <div className="w-full max-w-md bg-[#0d1e35] rounded-3xl p-8 border border-teal-500/30 text-center relative overflow-hidden shadow-2xl mb-6">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-400" />
          
          <div className="text-xs text-teal-400 font-bold uppercase tracking-widest mb-1">{selHospital.name}</div>
          <div className="text-[10px] text-slate-400 uppercase mb-4 block leading-normal">{selHospital.address}</div>

          <div className="text-xs text-slate-400 uppercase tracking-wide block mb-1">Responsável Médica</div>
          <div className="text-sm font-bold text-white mb-6">Dr(a). {selDoc?.name}</div>
          
          <div className={`inline-block px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider mb-6 ${
            isUntriaged ? 'bg-white/10 text-white' :
            queueItem.kind === 'E' ? 'bg-red-500/10 text-red-500' :
            queueItem.kind === 'U' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
          }`}>
            {isUntriaged ? 'Aguardando Triagem' : queueItem.priority}
          </div>

          {/* Display ticket based on sequential position of registration today */}
          <div className={`text-6xl font-syne font-black mb-6 ${
            isUntriaged ? 'text-white' :
            queueItem.kind === 'E' ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)]' :
            queueItem.kind === 'U' ? 'text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'text-emerald-500 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]'
          }`}>
            {isUntriaged ? 'T-' : `${queueItem.kind}-`}{dailySeq.toString().padStart(3, '0')}
          </div>

          <div className="h-px w-full bg-white/5 mb-6" />

          {/* RASTREABILIDADE POSICIONAL & ALGORITMO PREDITIVO */}
          {!queueStatus ? (
             <div className="animate-pulse text-slate-400">Carregando sua posição...</div>
          ) : isDone ? (
            <div className="text-emerald-400 font-bold bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">✅ Atendimento Concluído!</div>
          ) : isCalling ? (
            <div className="text-emerald-400 font-bold bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-3 animate-bounce">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              É A SUA VEZ! VÁ AO CONSULTÓRIO.
            </div>
          ) : isUntriaged ? (
            <div className="text-slate-200">
               <div className="font-bold mb-2">🩺 Aguarde chamado para Triagem</div>
               <div className="text-sm bg-white/5 p-3 rounded-xl border border-white/10">Sua posição na Triagem: <span className="font-bold ml-1">{queueStatus.idxEstado + 1}º lugar</span></div>
               <div className="text-xs text-slate-400 mt-3 flex items-center justify-center gap-2">
                 <span>⏱️ Tempo estimado:</span>
                 <span className="font-bold text-white">~{queueStatus.idxEstado * 15} min</span>
               </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full">
              {queueStatus.idxGeral === 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-400 p-4 rounded-xl font-bold flex flex-col gap-1 items-center">
                   <span>⏱️ Você é o próximo!</span>
                   <span className="text-xs font-normal">Dirija-se à área próxima do consultório.</span>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 w-full">
                    <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Fila ({queueItem.priority})</div>
                      <div className="text-2xl font-bold">{queueStatus.idxEstado + 1}º</div>
                      <div className="text-xs text-slate-400 mt-1">{queueStatus.idxEstado} na sua frente</div>
                    </div>
                    <div className="flex-1 bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col justify-center">
                       <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Tempo Preditivo</div>
                       <div className="text-2xl font-bold text-emerald-400">~{estimatedMinutes}m</div>
                       <div className="text-[9px] text-slate-500 mt-1 uppercase">ALGORITMO DINÂMICO</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* NOTIFICATIONS CTA / STATUS */}
        {!notificationsAllowed && (
          <button onClick={requestNotifications} className="w-full max-w-md bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-xl mb-6 flex items-center justify-between hover:bg-indigo-500/20 transition-colors cursor-pointer">
             <div className="text-left w-2/3">
               <div className="font-bold text-indigo-400 text-sm">Notificar no Navegador</div>
               <div className="text-xs text-indigo-300">Evite espera física, avisamos quando for sua vez.</div>
             </div>
             <BellRing className="text-indigo-400 shrink-0" size={24} />
          </button>
        )}

        {/* MAP PORTAL */}
        <div className="w-full max-w-md text-left mb-6">
           <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-300 uppercase tracking-widest"><MapPin size={16} className="text-teal-400 shrink-0" /> Localização desta Unidade</div>
           <Map coords={selHospital.coords} name={selHospital.name} address={selHospital.address} />
        </div>

        <button onClick={onBack} className="w-full max-w-md p-4 bg-transparent border border-white/10 rounded-xl text-slate-400 font-bold hover:bg-white/5 transition-colors cursor-pointer">
          Sair do Painel
        </button>
      </div>
    );
  }

  return null;
}
