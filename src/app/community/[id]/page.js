"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
// Pastikan path ini benar
import { db, auth } from '../../../lib/firebase'; 
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function CommunityPage() {
  const params = useParams(); 
  const communityId = params.id;
  const router = useRouter();

  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState(null);
  // UPDATE: Menambahkan opsi tab 'forum'
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'events' | 'fees' | 'forum'
  
  const [communityData, setCommunityData] = useState(null);
  const [isMember, setIsMember] = useState(false); 
  const [loading, setLoading] = useState(true);

  // Data Chat
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const dummyDiv = useRef(null);

  // --- 1. CEK LOGIN & DATA KOMUNITAS ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/'); 
        return;
      }
      setUser(currentUser);
    });

    if (!communityId) return;

    const communityRef = doc(db, "communities", communityId);
    const unsubCommunity = onSnapshot(communityRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCommunityData(data);
        if (auth.currentUser && data.members?.includes(auth.currentUser.uid)) {
          setIsMember(true);
        } else {
          setIsMember(false);
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubCommunity();
    };
  }, [communityId, router]);

  // --- 2. AMBIL CHAT ---
  useEffect(() => {
    if (!communityId) return;
    const q = query(
      collection(db, "communities", communityId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubMsg = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubMsg();
  }, [communityId]);

  // Auto scroll chat
  useEffect(() => {
    if (activeTab === 'chat') {
        dummyDiv.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // --- 3. ACTIONS ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !isMember) return; 

    try {
        await addDoc(collection(db, "communities", communityId, "messages"), {
            text: newMessage,
            sender: user.displayName || user.email,
            senderId: user.uid,
            createdAt: serverTimestamp(),
            photoURL: user.photoURL || null
        });
        setNewMessage('');
    } catch (error) {
        console.error("Error:", error);
    }
  };

  const handleJoinCommunity = async () => {
    if (!user) return;
    try {
      const communityRef = doc(db, "communities", communityId);
      await updateDoc(communityRef, { members: arrayUnion(user.uid) });
      alert("Berhasil bergabung!");
    } catch (error) {
      alert("Gagal bergabung.");
    }
  };

  // --- 4. RENDER UI ---
  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Memuat...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-gray-100">
      
      {/* HEADER & TABS */}
      <div className="bg-gray-800 p-4 shadow-md border-b border-gray-700 shrink-0 z-10">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h1 className="text-xl font-bold text-blue-400">{communityData?.name}</h1>
                <p className="text-gray-400 text-xs mt-1">{communityData?.description}</p>
            </div>
            <div className="text-xs bg-gray-700 px-3 py-1 rounded-full text-gray-300">
                 {communityData?.locationName || "Online"}
            </div>
        </div>

        {/* --- MENU TAB (4 MENU) --- */}
        <div className="flex space-x-4 text-sm font-medium border-b border-gray-700 overflow-x-auto">
            {['chat', 'events', 'fees', 'forum'].map((tab) => (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-2 px-2 whitespace-nowrap transition-colors ${
                        activeTab === tab 
                        ? 'border-b-2 border-blue-500 text-blue-400' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                >
                    {tab === 'chat' && '💬 Chat Room'}
                    {tab === 'events' && '📅 Event'}
                    {tab === 'fees' && '💰 Kas/Iuran'}
                    {tab === 'forum' && '🤖 Q&A & AI'} 
                </button>
            ))}
        </div>
      </div>

      {/* --- KONTEN UTAMA --- */}
      
      {/* 1. TAB CHAT */}
      {activeTab === 'chat' && (
        <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-md p-3 rounded-2xl shadow-sm ${
                            msg.senderId === user?.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-700 text-gray-200 rounded-tl-none'
                        }`}>
                            {msg.senderId !== user?.uid && <div className="text-[10px] text-blue-300 mb-1 font-bold">{msg.sender}</div>}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={dummyDiv}></div>
            </div>
            <div className="p-4 bg-gray-800 border-t border-gray-700 shrink-0">
                {isMember ? (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Tulis pesan..." className="flex-1 p-3 rounded-full bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" />
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full shadow-lg">➤</button>
                    </form>
                ) : (
                    <button onClick={handleJoinCommunity} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-sm">GABUNG (JOIN)</button>
                )}
            </div>
        </>
      )}

      {/* 2. TAB EVENT */}
      {activeTab === 'events' && (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-900 text-center">
            <h2 className="text-xl font-bold text-white mb-4">📅 Jadwal Event</h2>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-10">
                <p className="text-gray-500">List Event & Ticketing akan muncul di sini.</p>
            </div>
        </div>
      )}

      {/* 3. TAB IURAN */}
      {activeTab === 'fees' && (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-900 text-center">
            <h2 className="text-xl font-bold text-white mb-4">💰 Laporan Kas</h2>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-10">
                <p className="text-gray-500">Data Iuran anggota akan muncul di sini.</p>
            </div>
        </div>
      )}

      {/* 4. TAB FORUM & AI (Ini Fitur Tanya Jawab yang Anda Maksud) */}
      {activeTab === 'forum' && (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">🤖 Tanya Jawab & AI</h2>
                <button className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-4 py-2 rounded transition">
                    + Buat Pertanyaan Baru
                </button>
            </div>
            
            {/* List Pertanyaan (Placeholder) */}
            <div className="space-y-4">
                {/* Contoh Tampilan Postingan Forum */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 hover:border-purple-500 transition cursor-pointer">
                    <h3 className="font-bold text-blue-400 mb-1">Bagaimana cara upload bukti transfer?</h3>
                    <p className="text-gray-400 text-sm mb-3">Saya bingung tombolnya ada di mana ya...</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="bg-gray-700 px-2 py-0.5 rounded text-white">2 Jawaban</span>
                        <span className="text-purple-400 font-bold">✓ Dijawab oleh AI</span>
                    </div>
                </div>

                 <div className="text-center mt-10 text-gray-600 text-sm">
                    <p>Fitur ini akan terhubung ke <code>api/ask-ai</code> Anda.</p>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}