"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { 
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, 
  getDoc, doc, updateDoc, arrayUnion 
} from 'firebase/firestore';

// --- CHART JS SETUP ---
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
ChartJS.register(ArcElement, Tooltip, Legend);

export default function CommunityDetail() {
  const { id } = useParams();
  const router = useRouter();
  
  // DATA STATES
  const [commData, setCommData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [expenses, setExpenses] = useState([]); // State untuk Pengeluaran

  // User States
  const [username, setUsername] = useState('Anonim');
  const [userPhoto, setUserPhoto] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);

  // UI STATES
  const [activeChannel, setActiveChannel] = useState('chat'); // 'chat', 'events', 'faq', 'finance'
  const [msgInput, setMsgInput] = useState('');
  const [eventInput, setEventInput] = useState({ title: '', date: '' });
  const [faqInput, setFaqInput] = useState('');
  
  // FINANCE INPUT STATE (Admin Only)
  const [expenseInput, setExpenseInput] = useState({ title: '', amount: '', date: '', category: 'Operasional' });

  // AI State
  const [askMode, setAskMode] = useState('ai');
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    if(id) getDoc(doc(db, "communities", id)).then(snap => setCommData(snap.data()));

    const fetchUser = async () => {
       if(auth.currentUser) {
         const userRef = doc(db, "users", auth.currentUser.uid);
         const snap = await getDoc(userRef);
         if(snap.exists()) {
             const data = snap.data();
             setUsername(data.username);
             setUserPhoto(data.photoURL || null);
             if (data.joinedCommIds && data.joinedCommIds.includes(id)) {
                 setHasJoined(true);
             }
         }
       }
    };
    fetchUser();

    // Listeners
    const qMsg = query(collection(db, "messages"), where("communityId", "==", id), orderBy("createdAt", "asc"));
    const unsubMsg = onSnapshot(qMsg, snap => setMessages(snap.docs.map(d => d.data())));

    const qEvent = query(collection(db, "events"), where("communityId", "==", id), orderBy("date", "asc"));
    const unsubEvent = onSnapshot(qEvent, snap => setEvents(snap.docs.map(d => d.data())));

    const qFaq = query(collection(db, "faqs"), where("communityId", "==", id), orderBy("createdAt", "desc"));
    const unsubFaq = onSnapshot(qFaq, snap => setFaqs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Listener Pengeluaran (Finance)
    const qExp = query(collection(db, "expenses"), where("communityId", "==", id), orderBy("date", "desc"));
    const unsubExp = onSnapshot(qExp, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubMsg(); unsubEvent(); unsubFaq(); unsubExp(); };
  }, [id]);

  // --- ACTIONS ---
  const joinCommunity = async () => {
      if(!auth.currentUser) return alert("Login dulu!");
      try {
          await updateDoc(doc(db, "users", auth.currentUser.uid), { joinedCommIds: arrayUnion(id) });
          setHasJoined(true);
          alert(`Berhasil bergabung!`);
      } catch (e) { console.error(e); alert("Gagal bergabung."); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if(!msgInput.trim()) return;
    await addDoc(collection(db, "messages"), { communityId: id, user: username, userPhoto: userPhoto, text: msgInput, createdAt: serverTimestamp() });
    setMsgInput('');
  };

  const addEvent = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, "events"), { communityId: id, ...eventInput, createdAt: serverTimestamp() });
    setEventInput({ title: '', date: '' });
  };

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!faqInput.trim()) return;
    if (askMode === 'ai') {
        setLoadingAI(true);
        try {
            const res = await fetch('/api/ask-ai', { method: 'POST', body: JSON.stringify({ question: faqInput, communityName: commData?.name }) });
            const data = await res.json();
            await addDoc(collection(db, "faqs"), { communityId: id, question: faqInput, answer: data.answer, asker: username, type: 'AI', status: 'Finished', createdAt: serverTimestamp() });
        } catch (err) { alert("AI Error"); } finally { setLoadingAI(false); setFaqInput(''); }
    } else {
        await addDoc(collection(db, "faqs"), { communityId: id, question: faqInput, answer: "", asker: username, type: 'Human', status: 'On Hold', createdAt: serverTimestamp() });
        setFaqInput('');
    }
  };

  // --- FINANCE ACTION ---
  const addExpense = async (e) => {
      e.preventDefault();
      if (!expenseInput.amount || !expenseInput.title) return;
      
      await addDoc(collection(db, "expenses"), {
          communityId: id,
          title: expenseInput.title,
          amount: parseFloat(expenseInput.amount),
          date: expenseInput.date,
          category: expenseInput.category,
          addedBy: username,
          createdAt: serverTimestamp()
      });
      setExpenseInput({ title: '', amount: '', date: '', category: 'Operasional' });
      alert("Pengeluaran dicatat!");
  };

  // --- PREPARE CHART DATA ---
  const getChartData = () => {
      const categories = {};
      expenses.forEach(exp => {
          categories[exp.category] = (categories[exp.category] || 0) + exp.amount;
      });

      return {
          labels: Object.keys(categories),
          datasets: [{
              data: Object.values(categories),
              backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
              borderWidth: 0,
          }]
      };
  };

  const isCreator = commData?.createdBy === username;

  return (
    <div className="flex h-screen bg-[#313338] text-gray-100 overflow-hidden font-sans">
      
      {/* 1. SIDEBAR NAVIGASI */}
      <div className="w-60 bg-[#2B2D31] flex flex-col shrink-0 border-r border-[#1F2023]">
        <div className="h-12 px-4 flex items-center justify-between border-b border-[#1F2023] hover:bg-[#35373C] transition cursor-pointer shadow-sm">
            <div className="flex items-center gap-2 overflow-hidden">
                {commData?.photoURL && <img src={commData.photoURL} className="w-6 h-6 rounded-full object-cover shrink-0 bg-black" alt="Icon" />}
                <h1 className="font-bold text-white truncate max-w-[110px] text-sm">{commData?.name || 'Loading...'}</h1>
            </div>
            {!hasJoined && <button onClick={joinCommunity} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 shrink-0">Join</button>}
            {hasJoined && <span className="text-[10px] text-green-400 border border-green-400 px-1 rounded shrink-0">Joined</span>}
        </div>

        <div className="flex-1 p-2 space-y-0.5 mt-2">
            {['chat', 'events', 'faq', 'finance'].map(ch => (
                <div key={ch} onClick={() => setActiveChannel(ch)} className={`px-2 py-1.5 rounded flex items-center gap-2 cursor-pointer ${activeChannel === ch ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}>
                    <span className="text-xl text-gray-400">#</span> 
                    <span className="text-sm font-medium">
                        {ch === 'chat' && 'chat-umum'}
                        {ch === 'events' && 'jadwal-event'}
                        {ch === 'faq' && 'help-center'}
                        {ch === 'finance' && '💰 keuangan'}
                    </span>
                </div>
            ))}
        </div>

        <div className="bg-[#232428] p-2 flex items-center gap-2 px-3">
            <div onClick={() => router.push('/profile')} className="relative cursor-pointer hover:opacity-80 transition group shrink-0">
                {userPhoto ? <img src={userPhoto} className="w-8 h-8 rounded-full object-cover bg-black" alt="User" /> : <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{username[0].toUpperCase()}</div>}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#232428] rounded-full"></div>
            </div>
            <div className="flex-1 overflow-hidden">
                <div className="text-xs font-bold text-white truncate">{username}</div>
                <div className="text-[10px] text-gray-400">Online</div>
            </div>
            <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-xs">↩ Dashboard</button>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0">
        
        <div className="h-12 border-b border-[#26272D] flex items-center px-4 shrink-0 bg-[#313338] shadow-sm">
             <span className="text-2xl text-gray-400 mr-2">#</span>
             <div>
                <h3 className="font-bold text-white text-sm">
                    {activeChannel === 'chat' && 'chat-umum'}
                    {activeChannel === 'events' && 'jadwal-event'}
                    {activeChannel === 'faq' && 'help-center'}
                    {activeChannel === 'finance' && 'keuangan-komunitas'}
                </h3>
             </div>
        </div>

        {/* --- CONTENT: CHAT --- */}
        {activeChannel === 'chat' && (
            <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.map((m, idx) => (
                        <div key={idx} className="flex gap-3 hover:bg-[#2e3035] p-1 -mx-2 px-2 rounded group">
                            <div className="shrink-0 mt-0.5">
                                {m.userPhoto ? <img src={m.userPhoto} className="w-10 h-10 rounded-full object-cover bg-black" alt={m.user} /> : <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center font-bold text-white">{m.user[0].toUpperCase()}</div>}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-sm cursor-pointer hover:underline">{m.user}</span>
                                    <span className="text-[10px] text-gray-400">{m.createdAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-gray-300 text-sm leading-snug">{m.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 px-6 mb-2">
                    <form onSubmit={sendMessage} className="bg-[#383A40] rounded-lg p-2 flex items-center">
                        <input className="flex-1 bg-transparent text-gray-200 outline-none text-sm placeholder-gray-500" placeholder={`Kirim pesan ke #${activeChannel}`} value={msgInput} onChange={e => setMsgInput(e.target.value)} />
                        <button className="text-gray-400 hover:text-white px-2">➤</button>
                    </form>
                </div>
            </>
        )}

        {/* --- CONTENT: EVENTS --- */}
        {activeChannel === 'events' && (
            <div className="p-6 flex-1 overflow-y-auto">
                 <div className="bg-[#2B2D31] p-4 rounded mb-6 border border-[#1F2023]">
                    <h3 className="font-bold text-gray-200 mb-2 text-sm uppercase">Buat Jadwal Baru</h3>
                    <form onSubmit={addEvent} className="flex gap-2">
                        <input className="flex-1 bg-[#1E1F22] text-gray-200 text-sm p-2 rounded outline-none" placeholder="Nama Acara" value={eventInput.title} onChange={e => setEventInput({...eventInput, title: e.target.value})} required />
                        <input type="date" className="bg-[#1E1F22] text-gray-200 text-sm p-2 rounded outline-none" value={eventInput.date} onChange={e => setEventInput({...eventInput, date: e.target.value})} required />
                        <button className="bg-[#248046] hover:bg-[#1A6334] text-white px-4 rounded text-sm font-bold">Buat</button>
                    </form>
                 </div>
                 <div className="space-y-2">
                    {events.map((ev, idx) => (
                        <div key={idx} className="bg-[#2B2D31] p-3 rounded flex items-center gap-4 hover:bg-[#35373C] border border-[#2B2D31] hover:border-[#5865F2] transition">
                            <div className="bg-[#1E1F22] px-3 py-2 rounded text-center min-w-[70px]">
                                <span className="text-red-400 font-bold text-xs uppercase block">TGL</span>
                                <span className="text-white font-bold text-lg">{ev.date.split('-')[2]}</span>
                            </div>
                            <div>
                                <h4 className="text-white font-bold text-lg">{ev.title}</h4>
                                <p className="text-gray-400 text-xs">{ev.date} • Dibuat oleh Admin</p>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        )}

        {/* --- CONTENT: FINANCE (BARU) --- */}
        {activeChannel === 'finance' && (
             <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* 1. INFO IURAN */}
                <div className="bg-[#2B2D31] p-5 rounded-lg border border-[#1F2023] mb-6 flex justify-between items-center shadow-md">
                    <div>
                        <h3 className="text-gray-400 text-xs font-bold uppercase mb-1">Status Iuran Komunitas</h3>
                        {commData?.isDuesMandatory ? (
                            <div className="text-2xl font-bold text-white">
                                Rp {parseInt(commData.duesAmount).toLocaleString('id-ID')} 
                                <span className="text-sm font-normal text-gray-400 ml-2">/ bulan</span>
                            </div>
                        ) : (
                            <div className="text-xl font-bold text-green-400">Gratis / Sukarela</div>
                        )}
                    </div>
                    {commData?.isDuesMandatory && (
                        <div className="text-right">
                            <div className="text-xs text-red-400 font-bold uppercase">Jatuh Tempo</div>
                            <div className="text-lg font-bold text-white">Tanggal {commData.duesDate}</div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* 2. PIE CHART PENGELUARAN */}
                    <div className="bg-[#2B2D31] p-4 rounded-lg border border-[#1F2023] flex flex-col items-center">
                        <h3 className="text-gray-200 font-bold text-sm mb-4">Grafik Pengeluaran</h3>
                        {expenses.length > 0 ? (
                            <div className="w-64 h-64">
                                <Pie data={getChartData()} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: 'white' } } } }} />
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-gray-500 text-sm italic">Belum ada data pengeluaran.</div>
                        )}
                    </div>

                    {/* 3. INPUT FORM (ADMIN ONLY) & LIST */}
                    <div className="space-y-6">
                        {/* Form Input */}
                        {isCreator && (
                            <div className="bg-[#2B2D31] p-4 rounded-lg border border-[#1F2023]">
                                <h3 className="text-xs font-bold text-green-400 uppercase mb-3">🛠️ Admin: Catat Pengeluaran</h3>
                                <form onSubmit={addExpense} className="space-y-2">
                                    <input type="text" className="w-full bg-[#1E1F22] text-white p-2 rounded text-sm outline-none" placeholder="Judul (misal: Sewa Server)" value={expenseInput.title} onChange={e => setExpenseInput({...expenseInput, title: e.target.value})} required />
                                    <div className="flex gap-2">
                                        <input type="number" className="w-1/2 bg-[#1E1F22] text-white p-2 rounded text-sm outline-none" placeholder="Rp Nominal" value={expenseInput.amount} onChange={e => setExpenseInput({...expenseInput, amount: e.target.value})} required />
                                        <input type="date" className="w-1/2 bg-[#1E1F22] text-white p-2 rounded text-sm outline-none" value={expenseInput.date} onChange={e => setExpenseInput({...expenseInput, date: e.target.value})} required />
                                    </div>
                                    <select className="w-full bg-[#1E1F22] text-white p-2 rounded text-sm outline-none" value={expenseInput.category} onChange={e => setExpenseInput({...expenseInput, category: e.target.value})}>
                                        <option>Operasional</option>
                                        <option>Event</option>
                                        <option>Hadiah/Giveaway</option>
                                        <option>Lainnya</option>
                                    </select>
                                    <button className="w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded text-sm font-bold mt-2">Simpan</button>
                                </form>
                            </div>
                        )}

                        {/* List Riwayat */}
                        <div className="bg-[#2B2D31] rounded-lg border border-[#1F2023] overflow-hidden">
                            <div className="bg-[#1E1F22] p-3 text-xs font-bold text-gray-400 uppercase">Riwayat Pengeluaran Terakhir</div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {expenses.map(exp => (
                                    <div key={exp.id} className="p-3 border-b border-[#1F2023] hover:bg-[#35373C] flex justify-between items-center">
                                        <div>
                                            <div className="text-white text-sm font-bold">{exp.title}</div>
                                            <div className="text-[10px] text-gray-400">{exp.date} • {exp.category}</div>
                                        </div>
                                        <div className="text-red-400 text-sm font-bold">- Rp {exp.amount.toLocaleString('id-ID')}</div>
                                    </div>
                                ))}
                                {expenses.length === 0 && <div className="p-4 text-center text-xs text-gray-500">Kosong.</div>}
                            </div>
                        </div>
                    </div>

                </div>
             </div>
        )}

        {/* --- CONTENT: FAQ --- */}
        {activeChannel === 'faq' && (
             <div className="p-6 flex-1 overflow-y-auto">
                <div className="bg-[#2B2D31] p-4 rounded mb-6 border border-[#1F2023]">
                    <div className="flex gap-2 mb-2">
                        <button onClick={() => setAskMode('ai')} className={`text-xs px-3 py-1 rounded-full border ${askMode === 'ai' ? 'bg-[#5865F2] border-[#5865F2] text-white' : 'border-gray-600 text-gray-400'}`}>🤖 Tanya AI</button>
                        <button onClick={() => setAskMode('human')} className={`text-xs px-3 py-1 rounded-full border ${askMode === 'human' ? 'bg-[#5865F2] border-[#5865F2] text-white' : 'border-gray-600 text-gray-400'}`}>👥 Tanya Admin</button>
                    </div>
                    <form onSubmit={handleAsk}>
                        <textarea className="w-full bg-[#1E1F22] text-white p-2 rounded outline-none text-sm resize-none mb-2" rows="2" placeholder={askMode === 'ai' ? "AI akan menjawab..." : "Buat tiket..."} value={faqInput} onChange={e => setFaqInput(e.target.value)} required />
                        <button disabled={loadingAI} className="bg-[#5865F2] text-white px-4 py-1.5 rounded text-sm font-bold w-full hover:bg-[#4752C4]">{loadingAI ? 'Thinking...' : 'Kirim'}</button>
                    </form>
                </div>
                
                <div className="space-y-4">
                    {faqs.map(f => (
                        <div key={f.id} className="bg-[#2B2D31] p-4 rounded border-l-4 border-[#5865F2]">
                            <div className="flex justify-between mb-2">
                                <span className="text-xs text-[#5865F2] font-bold uppercase">{f.type} RESPONSE</span>
                                <span className={`text-[10px] px-2 rounded ${f.status === 'Finished' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>{f.status}</span>
                            </div>
                            <p className="font-bold text-white text-sm mb-2">Q: "{f.question}"</p>
                            <div className="bg-[#1E1F22] p-2 rounded text-gray-300 text-sm">
                                {f.answer || <span className="italic text-gray-500">Menunggu jawaban...</span>}
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        )}

      </div>
      
      {/* 3. MEMBER LIST (KANAN) */}
      <div className="w-60 bg-[#2B2D31] hidden lg:flex flex-col shrink-0 border-l border-[#1F2023] p-4">
          {commData?.photoURL && <div className="mb-4 flex justify-center"><img src={commData.photoURL} className="w-24 h-24 rounded-full object-cover border-4 border-[#1F2023]" /></div>}
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-4">INFO KOMUNITAS</h3>
          <div className="text-sm text-gray-300 mb-4">
              <p className="mb-1">📍 <span className="text-white">{commData?.address}</span></p>
              <p>🏷️ <span className="text-white">{commData?.category || 'Umum'}</span></p>
          </div>
          <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">DESKRIPSI</h3>
          <p className="text-xs text-gray-400 leading-relaxed">{commData?.description || "Tidak ada deskripsi."}</p>
      </div>

    </div>
  );
}