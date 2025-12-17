"use client";
import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
// PERBAIKAN: Gunakan 3 titik (../../../) bukan 4
import { db, auth } from '../../../lib/firebase'; 
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
// PERBAIKAN: Gunakan 3 titik (../../../)
import Navbar from '../../../components/Navbar'; 

export default function CommunityPage() {
  const params = useParams(); 
  const communityId = params.id;
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [communityData, setCommunityData] = useState(null);
  const [isMember, setIsMember] = useState(false); 
  const [loading, setLoading] = useState(true);

  const dummyDiv = useRef(null);

  // 1. Cek User Login & Data Komunitas
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/');
        return;
      }
      setUser(currentUser);

      if (communityId) {
        const docRef = doc(db, "communities", communityId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCommunityData(data);
          
          if (data.members && data.members.includes(currentUser.uid)) {
            setIsMember(true);
          } else {
            setIsMember(false);
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [communityId, router]);

  // 2. Ambil Chat Realtime
  useEffect(() => {
    if (!communityId) return;

    const q = query(
      collection(db, "communities", communityId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      dummyDiv.current?.scrollIntoView({ behavior: 'smooth' });
    });

    return () => unsubscribe();
  }, [communityId]);

  // 3. Fungsi Kirim Pesan
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !isMember) return; 

    await addDoc(collection(db, "communities", communityId, "messages"), {
      text: newMessage,
      sender: user.displayName || user.email,
      senderId: user.uid,
      createdAt: serverTimestamp(),
      photoURL: user.photoURL || null
    });

    setNewMessage('');
  };

  // 4. Fungsi Join
  const handleJoinCommunity = async () => {
    if (!user) return;

    try {
      const communityRef = doc(db, "communities", communityId);
      await updateDoc(communityRef, {
        members: arrayUnion(user.uid)
      });
      setIsMember(true); 
      alert("Berhasil bergabung! Sekarang kamu bisa chat.");
    } catch (error) {
      console.error("Gagal join:", error);
      alert("Gagal bergabung. Coba lagi.");
    }
  };

  if (loading) return <div className="p-10 text-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <Navbar />

      <div className="bg-gray-800 p-6 shadow-md border-b border-gray-700 mt-16">
        <h1 className="text-2xl font-bold text-blue-400">
          {communityData?.name || "Nama Komunitas"}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {communityData?.description || "Deskripsi komunitas..."}
        </p>
        <div className="mt-2 text-xs text-gray-500">
          📍 Lokasi: {communityData?.locationName || "Indonesia"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-xs md:max-w-md p-3 rounded-lg shadow ${
              msg.senderId === user?.uid 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-gray-700 text-gray-200 rounded-tl-none'
            }`}>
              <div className="text-xs opacity-75 mb-1 font-bold">
                {msg.sender}
              </div>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={dummyDiv}></div>
      </div>

      <div className="p-4 bg-gray-800 border-t border-gray-700">
        {isMember ? (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Tulis pesan..."
              className="flex-1 p-3 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition"
            >
              Kirim
            </button>
          </form>
        ) : (
          <div className="text-center">
            <p className="mb-3 text-gray-400 text-sm">
              Kamu harus bergabung dengan komunitas ini untuk mulai mengobrol.
            </p>
            <button 
              onClick={handleJoinCommunity}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg transform transition hover:scale-105"
            >
              GABUNG KOMUNITAS INI (JOIN)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}