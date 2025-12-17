"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
// Pastikan path ini sesuai dengan lokasi firebase.js Anda
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
  const [activeTab, setActiveTab] = useState('chat'); // Pilihan: 'chat', 'events', 'fees'
  
  // Data Komunitas
  const [communityData, setCommunityData] = useState(null);
  const [isMember, setIsMember] = useState(false); 
  const [loading, setLoading] = useState(true);

  // Data Chat
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const dummyDiv = useRef(null);

  // --- 1. CEK LOGIN & DATA KOMUNITAS (REALTIME) ---
  useEffect(() => {
    // Cek User Login
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/'); 
        return;
      }
      setUser(currentUser);
    });

    if (!communityId) return;

    // Ambil Data Komunitas & Cek Member secara Realtime
    const communityRef = doc(db, "communities", communityId);
    const unsubCommunity = onSnapshot(communityRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCommunityData(data);
        
        // Cek apakah UID user ada di dalam array 'members'
        // Gunakan optional chaining (?.) untuk mencegah error jika user/members belum ada
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

  // --- 2. AMBIL CHAT (REALTIME) ---
  useEffect(() => {
    if (!communityId) return;

    // Hanya ambil chat jika user sedang membuka tab 'chat' (Opsional, biar hemat data)
    // Tapi untuk responsivitas, kita biarkan jalan terus di background tab ini
    const q = query(
      collection(db, "communities", communityId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubMsg = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return () => unsubMsg();
  }, [communityId]);

  // Auto scroll ke chat paling bawah
  useEffect(() => {
    if (activeTab === 'chat') {
        dummyDiv.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // --- 3. ACTIONS (SEND CHAT & JOIN) ---
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
        console.error("Error kirim pesan:", error);
    }
  };

  const handleJoinCommunity = async () => {
    if (!user) return;
    try {
      const communityRef = doc(db, "communities", communityId);
      await updateDoc(communityRef, {
        members: arrayUnion(user.uid)
      });
      alert("Berhasil bergabung!");
      // UI akan otomatis update karena kita pakai onSnapshot di atas
    } catch (error) {
      console.error("Gagal join:", error);
      alert("Gagal bergabung. Coba lagi.");
    }
  };

  // --- 4. RENDER UI ---
  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Memuat Data...</div>;

  return (
    // Container Utama (Tanpa Navbar, karena Navbar ada di Layout.js)
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-900 text-gray-100">
      
      {/* --- HEADER & TABS --- */}
      <div className="bg-gray-800 p-4 shadow-md border-b border-gray-700 shrink-0 z-10">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h1 className="text-xl font-bold text-blue-400">
                {communityData?.name || "Nama Komunitas"}
                </h1>
                <p className="text-gray-400 text-xs mt-1">
                {communityData?.description || "Deskripsi..."}
                </p>
            </div>
            <div className="text-xs bg-gray-700 px-3 py-1 rounded-full text-gray-300">
                 {communityData?.locationName || "Online"}
            </div>
        </div>

        {/* Menu Tab Navigasi */}
        <div className="flex space-x-6 text-sm font-medium border-b border-gray-700">
            <button 
                onClick={() => setActiveTab('chat')}
                className={`pb-2 transition-colors ${activeTab === 'chat' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
                💬 Chat Room
            </button>
            <button 
                onClick={() => setActiveTab('events')}
                className={`pb-2 transition-colors ${activeTab === 'events' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
                📅 Event & Tiket
            </button>
            <button 
                onClick={() => setActiveTab('fees')}
                className={`pb-2 transition-colors ${activeTab === 'fees' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400 hover:text-white'}`}
            >
                💰 Kas & Iuran
            </button>
        </div>
      </div>

      {/* --- KONTEN UTAMA (Berubah sesuai Tab) --- */}
      
      {/* 1. TAB CHAT */}
      {activeTab === 'chat' && (
        <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 mt-10 text-sm">Belum ada pesan. Mulailah mengobrol!</div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] md:max-w-md p-3 rounded-2xl shadow-sm ${
                            msg.senderId === user?.uid 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-gray-700 text-gray-200 rounded-tl-none'
                        }`}>
                            {msg.senderId !== user?.uid && (
                                <div className="text-[10px] text-blue-300 mb-1 font-bold">{msg.sender}</div>
                            )}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={dummyDiv}></div>
            </div>

            {/* Input Chat Area */}
            <div className="p-4 bg-gray-800 border-t border-gray-700 shrink-0">
                {isMember ? (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Tulis pesan..."
                            className="flex-1 p-3 rounded-full bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 transition"
                        />
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full shadow-lg transition">
                            ➤
                        </button>
                    </form>
                ) : (
                    <div className="text-center">
                        <p className="text-gray-400 text-xs mb-2">Anda harus bergabung untuk chat.</p>
                        <button onClick={handleJoinCommunity} className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-sm transition transform hover:scale-[1.01]">
                            GABUNG KOMUNITAS (JOIN)
                        </button>
                    </div>
                )}
            </div>
        </>
      )}

      {/* 2. TAB EVENT (Placeholder untuk fitur Event & Ticketing) */}
      {activeTab === 'events' && (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Jadwal Event</h2>
                {isMember && (
                    <button className="bg-blue-600 text-xs px-4 py-2 rounded hover:bg-blue-700 transition">
                        + Buat Event
                    </button>
                )}
            </div>
            
            {/* Contoh Tampilan Kosong */}
            <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-xl">
                <p className="text-gray-500 mb-2">Belum ada event yang aktif saat ini.</p>
                <p className="text-xs text-gray-600">Event dan Ticketing akan muncul di sini.</p>
            </div>
        </div>
      )}

      {/* 3. TAB IURAN (Placeholder untuk fitur Kas) */}
      {activeTab === 'fees' && (
        <div className="flex-1 p-6 overflow-y-auto bg-gray-900">
            <h2 className="text-xl font-bold text-white mb-6">Laporan Kas & Iuran</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
                    <p className="text-gray-400 text-xs uppercase mb-1">Saldo Kas Komunitas</p>
                    <p className="text-2xl font-bold text-green-400">Rp 0</p>
                </div>
                <div className="bg-gray-800 p-5 rounded-xl border border-gray-700">
                    <p className="text-gray-400 text-xs uppercase mb-1">Status Iuran Saya</p>
                    <p className="text-lg font-semibold text-yellow-400">Menunggu Data</p>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}