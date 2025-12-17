"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // Import Storage

export default function ProfilePage() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Ref untuk input file yang tersembunyi
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.push('/'); return; }
      try {
        const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (docSnap.exists()) setUserData(docSnap.data());
      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    });
    return () => unsubscribe();
  }, [router]);

  // LOGIC UPLOAD FOTO
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validasi sederhana (Max 2MB)
    if (file.size > 2 * 1024 * 1024) return alert("Ukuran file maksimal 2MB!");

    setUploading(true);
    try {
        // 1. Buat referensi storage: profile_pictures/UID
        const storageRef = ref(storage, `profile_pictures/${userData.uid}`);
        
        // 2. Upload file
        await uploadBytes(storageRef, file);
        
        // 3. Ambil URL download
        const url = await getDownloadURL(storageRef);

        // 4. Update Firestore User
        await updateDoc(doc(db, "users", userData.uid), {
            photoURL: url
        });

        // 5. Update UI lokal
        setUserData({ ...userData, photoURL: url });
        alert("Foto profil berhasil diperbarui!");

    } catch (error) {
        console.error("Upload Gagal:", error);
        alert("Gagal mengupload foto.");
    } finally {
        setUploading(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  if (loading) return <div className="h-screen bg-[#313338] text-white flex items-center justify-center">Memuat...</div>;

  return (
    <div className="min-h-screen bg-[#313338] flex items-center justify-center p-4 font-sans text-gray-100">
      
      <div className="bg-[#1E1F22] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-[#2B2D31]">
        
        <div className="h-32 bg-[#5865F2] relative">
             <button onClick={() => router.push('/dashboard')} className="absolute top-4 left-4 bg-black/30 hover:bg-black/50 text-white px-3 py-1 rounded text-xs font-bold transition backdrop-blur-sm z-10">⬅ Kembali</button>
        </div>

        <div className="px-6 pb-6 relative">
            
            {/* AVATAR SECTION (KLIK UNTUK GANTI) */}
            <div className="absolute -top-12 left-6 group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                <div className="w-24 h-24 rounded-full bg-[#313338] p-2 relative">
                    
                    {/* TAMPILAN FOTO ATAU INISIAL */}
                    {userData?.photoURL ? (
                         <img src={userData.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-[#313338]" />
                    ) : (
                        <div className="w-full h-full rounded-full bg-[#5865F2] flex items-center justify-center text-3xl font-bold text-white border-4 border-[#313338]">
                            {userData?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                    )}

                    {/* Overlay Edit Icon saat Hover */}
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition m-2">
                        <span className="text-xs font-bold text-white">Ubah</span>
                    </div>

                    {/* Indikator Loading Upload */}
                    {uploading && (
                        <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center m-2">
                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
                {/* Input File Tersembunyi */}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>

            <div className="flex justify-end pt-4">
                <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition">Log Out</button>
            </div>

            <div className="mt-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    {userData?.username}
                    <span className="text-gray-400 text-lg font-normal">#{userData?.uid?.slice(0,4)}</span>
                </h1>
                
                <div className="mt-6 space-y-4">
                    <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#1F2023]">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">EMAIL</h3>
                        <p className="text-sm text-white font-mono">{userData?.email}</p>
                    </div>
                    <div className="bg-[#2B2D31] p-3 rounded-lg border border-[#1F2023]">
                        <h3 className="text-xs font-bold text-gray-400 uppercase mb-1">KOTA</h3>
                        <p className="text-sm text-white">{userData?.city}</p>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}