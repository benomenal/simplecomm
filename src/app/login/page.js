"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function ProfilePage() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debugLog, setDebugLog] = useState("Inisialisasi..."); // Utk melihat status di layar

  useEffect(() => {
    console.log("--- [STEP 1] Component Profile Mount ---");
    setDebugLog("Menunggu Autentikasi...");

    // 1. SAFETY TIMEOUT: Paksa berhenti loading setelah 5 detik jika macet
    const timer = setTimeout(() => {
        if (loading) {
            console.warn("--- [TIMEOUT] Waktu habis! ---");
            setDebugLog("Waktu habis (Timeout). Cek koneksi internet.");
            setLoading(false);
        }
    }, 5000);

    // 2. LISTENER AUTH
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log("--- [STEP 2] Auth State Change Detected ---", currentUser);

      if (!currentUser) {
        console.log("--- [STEP 3] User Null -> Redirect Login ---");
        router.push('/');
        return;
      }

      setDebugLog(`User ditemukan: ${currentUser.uid}. Mengambil data Firestore...`);
      console.log("--- [STEP 4] User UID:", currentUser.uid, "Mulai Fetch Firestore ---");

      try {
        const userRef = doc(db, "users", currentUser.uid);
        
        // Kita pakai Log sebelum dan sesudah request
        console.log("--- [STEP 5] Sedang request getDoc()... ---");
        const docSnap = await getDoc(userRef);
        console.log("--- [STEP 6] Respon getDoc diterima. Exists?", docSnap.exists());

        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("--- [STEP 7] Data User:", data);
          setUserData(data);
          setDebugLog("Data berhasil dimuat.");
        } else {
          console.error("--- [ERROR] Dokumen user tidak ada di 'users' collection! ---");
          setDebugLog("Error: Data user tidak ditemukan di database.");
        }

      } catch (err) {
        console.error("--- [CRITICAL ERROR] Gagal Fetch: ---", err);
        setDebugLog(`Error System: ${err.message}`);
      } finally {
        console.log("--- [STEP 8] Loading Dimatikan ---");
        setLoading(false);
      }
    });

    return () => {
        unsubscribe();
        clearTimeout(timer);
    };
  }, [router]);

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  // TAMPILAN LOADING
  if (loading) return (
    <div className="min-h-screen bg-[#313338] flex flex-col items-center justify-center text-white gap-4 p-4">
        <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-center">
            <p className="font-bold text-lg">Memuat Profil...</p>
            {/* Tampilkan Log Status Langsung di Layar agar ketahuan macet dimana */}
            <p className="text-xs text-yellow-400 mt-2 font-mono bg-black/30 p-2 rounded">
                Status: {debugLog}
            </p>
        </div>
        <button onClick={() => router.push('/dashboard')} className="mt-4 text-gray-400 hover:text-white text-sm underline">
            Paksa Kembali ke Dashboard
        </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#313338] flex items-center justify-center p-4 font-sans text-gray-100">
      
      <div className="bg-[#1E1F22] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-[#2B2D31]">
        
        <div className="h-32 bg-[#5865F2] relative">
             <button onClick={() => router.push('/dashboard')} className="absolute top-4 left-4 bg-black/30 hover:bg-black/50 text-white px-3 py-1 rounded text-xs font-bold transition backdrop-blur-sm z-10">
                ⬅ Kembali
            </button>
        </div>

        <div className="px-6 pb-6 relative">
            <div className="w-24 h-24 rounded-full bg-[#313338] p-2 absolute -top-12 left-6">
                <div className="w-full h-full rounded-full bg-[#5865F2] flex items-center justify-center text-3xl font-bold text-white">
                    {userData?.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-green-500 border-4 border-[#313338] rounded-full"></div>
            </div>

            <div className="flex justify-end pt-4">
                <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition">
                    Log Out
                </button>
            </div>

            <div className="mt-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    {userData?.username || "Guest"}
                    <span className="text-gray-400 text-lg font-normal">#{userData?.uid?.slice(0,4) || "0000"}</span>
                </h1>
                
                {/* Debug Info Jika Data Kosong tapi Loading Selesai */}
                {!userData && (
                    <div className="bg-red-900/50 text-red-200 p-3 rounded mt-4 text-xs border border-red-500">
                        Warning: Loading selesai tapi data user kosong. <br/>
                        Pesan Debug: {debugLog}
                    </div>
                )}

                <div className="mt-6 space-y-4">
                    <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#1F2023]">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">EMAIL</h3>
                        <p className="text-sm text-white">{userData?.email || "-"}</p>
                    </div>

                    <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#1F2023]">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">KOTA</h3>
                        <p className="text-sm text-white">{userData?.city || "-"}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#1F2023]">
                            <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">KOMUNITAS</h3>
                            <p className="text-sm text-white">{userData?.joinedCommIds?.length || 0}</p>
                        </div>
                        <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#1F2023]">
                            <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">GROUP</h3>
                            <p className="text-sm text-white">{userData?.communityGroups?.length || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}