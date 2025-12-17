"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function Home() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  
  // State Input
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); 
  const [city, setCity] = useState(''); 
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // --- LOGIC AUTH (SAMA SEPERTI SEBELUMNYA) ---
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
        if (checkingAuth) setCheckingAuth(false);
    }, 4000);

    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(safetyTimer);
      if (user) {
        router.push('/dashboard');
      } else {
        setCheckingAuth(false);
      }
    });

    return () => { unsub(); clearTimeout(safetyTimer); };
  }, [router]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          username: username,
          email: email,
          city: city, 
          joinedCommIds: [], 
          createdAt: new Date()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      console.error(err);
      let msg = "Terjadi kesalahan.";
      if (err.code === 'auth/invalid-email') msg = "Format email salah.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') msg = "Email atau password salah.";
      if (err.code === 'auth/wrong-password') msg = "Password salah.";
      if (err.code === 'auth/email-already-in-use') msg = "Email sudah terdaftar.";
      if (err.code === 'auth/weak-password') msg = "Password minimal 6 karakter.";
      if (err.code === 'auth/network-request-failed') msg = "Gagal terhubung. Cek koneksi internet.";
      setError(msg);
      setLoading(false);
    }
  };

  if (checkingAuth) return (
    <div className="h-screen flex items-center justify-center bg-[#0F172A] text-white">
        <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-2xl"></div>
            <p className="text-sm font-medium text-gray-400 tracking-widest uppercase">Memulai Aplikasi...</p>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#0F172A] font-sans selection:bg-blue-500 selection:text-white overflow-hidden">
      
      {/* === BAGIAN KIRI: VISUAL (Hanya tampil di Layar Besar) === */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div 
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ backgroundImage: "url('https://images.pexels.com/photos/1000445/pexels-photo-1000445.jpeg')" }}
        ></div>
        
        {/* Overlay Gradient Elegan */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A] via-[#0F172A]/40 to-transparent"></div>
        <div className="absolute inset-0 bg-blue-900/20 mix-blend-overlay"></div>

        {/* Text Content */}
        <div className="relative z-10 p-12 text-white max-w-lg">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-2xl mb-8 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span className="text-3xl">🌏</span>
            </div>
            <h2 className="text-5xl font-bold leading-tight mb-6">
                Temukan Komunitas <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Impianmu</span>
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed border-l-4 border-blue-500 pl-4">
                Bergabunglah dengan ribuan orang, temukan hobi baru, hadiri event seru, dan bangun koneksi tanpa batas.
            </p>
        </div>
      </div>

      {/* === BAGIAN KANAN: FORMULIR === */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        
        {/* Dekorasi Background Abstrak (Blur) */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="w-full max-w-md relative z-10">
            
            {/* Header Form */}
            <div className="mb-10">
                <h1 className="text-3xl font-bold text-white mb-2">
                    {isRegister ? 'Mulai Petualangan 🚀' : 'Selamat Datang Kembali 👋'}
                </h1>
                <p className="text-slate-400">
                    {isRegister ? 'Isi data diri untuk membuat akun baru.' : 'Masukkan kredensial Anda untuk melanjutkan.'}
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 bg-red-500/10 border-l-4 border-red-500 text-red-200 p-4 rounded-r text-sm animate-in slide-in-from-top-2">
                    {error}
                </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
                
                {isRegister && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Username</label>
                            <input 
                                type="text" 
                                required 
                                className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-500"
                                placeholder="Jhon Doe"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kota</label>
                            <input 
                                type="text" 
                                required 
                                className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-500"
                                placeholder="Jakarta"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email Address</label>
                    <input 
                        type="email" 
                        required 
                        className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-500"
                        placeholder="nama@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                        {!isRegister && <span className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition">Lupa password?</span>}
                    </div>
                    <input 
                        type="password" 
                        required 
                        className="w-full bg-slate-800/50 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-500"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Memproses...
                        </span>
                    ) : (
                        isRegister ? 'Buat Akun Sekarang' : 'Masuk ke Dashboard'
                    )}
                </button>
            </form>

            {/* Footer Toggle */}
            <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                <p className="text-slate-400 text-sm">
                    {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}
                    <button 
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError('');
                        }} 
                        className="ml-2 text-blue-400 font-bold hover:text-blue-300 hover:underline transition"
                    >
                        {isRegister ? 'Login disini' : 'Daftar sekarang'}
                    </button>
                </p>
            </div>

        </div>
      </div>

    </div>
  );
}