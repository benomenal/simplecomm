"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { collection, query, getDocs, getDoc, doc, addDoc, serverTimestamp, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import dynamic from 'next/dynamic';

const MapWithNoSSR = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => <div className="h-64 bg-[#2B2D31] animate-pulse rounded flex items-center justify-center text-gray-500">Memuat Peta...</div>
});

const CATEGORIES = [
  "Gaming", "Teknologi & Coding", "Otomotif & Mesin", "Masak & Kuliner", 
  "Traveling & Jalan-jalan", "Seni & Desain", "Olahraga & Kesehatan", 
  "Musik & Film", "Bisnis & Keuangan", "Pendidikan & Buku"
];

export default function Dashboard() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [allCommunities, setAllCommunities] = useState([]); 
  const [joinedCommunities, setJoinedCommunities] = useState([]); 
  const [myGroups, setMyGroups] = useState([]); 
  const [recommendedComms, setRecommendedComms] = useState([]);
  const [activeTab, setActiveTab] = useState('map');
  const [expandedGroupId, setExpandedGroupId] = useState(null); 

  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false); 
  
  // STATE INPUT BUAT KOMUNITAS (UPDATED)
  const [newComm, setNewComm] = useState({ 
      name: '', address: '', description: '', category: CATEGORIES[0],
      isDuesMandatory: false, // Wajib Iuran?
      duesAmount: '',         // Nominal
      duesDate: ''            // Tanggal Bayar
  });
  const [commImageFile, setCommImageFile] = useState(null);
  
  const [newGroup, setNewGroup] = useState({ name: '', selectedCommIds: [] }); 
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) { 
          router.push('/'); 
      } else {
          setLoading(false); 
          fetchDashboardData(currentUser);
      }
    });

    const safetyTimer = setTimeout(() => { if(loading) setLoading(false); }, 5000);
    return () => { unsubscribe(); clearTimeout(safetyTimer); }
  }, [router]);

  const fetchDashboardData = async (currentUser) => {
    setDataLoading(true);
    try {
        const docSnap = await getDoc(doc(db, "users", currentUser.uid));
        let currentUserData = null;
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            setUserData(currentUserData);
            setMyGroups(currentUserData.communityGroups || []); 
        }

        const q = query(collection(db, "communities"));
        const querySnapshot = await getDocs(q);
        const allComms = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllCommunities(allComms);

        if (currentUserData && currentUserData.joinedCommIds) {
            const joined = allComms.filter(c => currentUserData.joinedCommIds.includes(c.id));
            setJoinedCommunities(joined);
        }

        if (currentUserData) generateRecommendations(currentUserData, allComms);

    } catch (error) { console.error("ERROR Fetch Data:", error); } 
    finally { setDataLoading(false); }
  };

  const generateRecommendations = (user, allComms) => {
    const joinedIds = user.joinedCommIds || [];
    if (joinedIds.length === 0) { setRecommendedComms(allComms.slice(0, 3)); return; }
    const categoryCount = {};
    const joinedComms = allComms.filter(c => joinedIds.includes(c.id));
    joinedComms.forEach(c => { if(c.category) categoryCount[c.category] = (categoryCount[c.category] || 0) + 1; });
    let topCategory = Object.keys(categoryCount).reduce((a, b) => categoryCount[a] > categoryCount[b] ? a : b, null);
    let recommendations = allComms.filter(c => c.category === topCategory && !joinedIds.includes(c.id));
    if (recommendations.length < 3) {
        const others = allComms.filter(c => !joinedIds.includes(c.id) && c.category !== topCategory);
        recommendations = [...recommendations, ...others.slice(0, 3 - recommendations.length)];
    }
    setRecommendedComms(recommendations);
  };

  const handleCreateGroup = async (e) => {
      e.preventDefault();
      if(!newGroup.name || newGroup.selectedCommIds.length === 0) return alert("Nama dan minimal 1 komunitas wajib dipilih!");
      setIsCreating(true);
      try {
          const newGroupData = { id: Date.now().toString(), name: newGroup.name, communityIds: newGroup.selectedCommIds };
          await updateDoc(doc(db, "users", userData.uid), { communityGroups: arrayUnion(newGroupData) });
          setMyGroups([...myGroups, newGroupData]);
          setNewGroup({ name: '', selectedCommIds: [] });
          setIsGroupModalOpen(false);
          alert("Folder Group berhasil dibuat!");
      } catch (err) { console.error(err); alert("Gagal membuat group."); } finally { setIsCreating(false); }
  };

  const handleToggleCommSelection = (commId) => {
      if (newGroup.selectedCommIds.includes(commId)) { setNewGroup({ ...newGroup, selectedCommIds: newGroup.selectedCommIds.filter(id => id !== commId) }); } 
      else { setNewGroup({ ...newGroup, selectedCommIds: [...newGroup.selectedCommIds, commId] }); }
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if(!newComm.name || !newComm.address) return alert("Nama dan Alamat wajib diisi!");
    
    // Validasi Iuran
    if (newComm.isDuesMandatory) {
        if (!newComm.duesAmount || !newComm.duesDate) return alert("Jika iuran wajib, Nominal dan Tanggal harus diisi!");
    }

    setIsCreating(true);
    try {
        let photoURL = "";
        const docRef = await addDoc(collection(db, "communities"), {
            ...newComm,
            createdBy: userData.username,
            createdAt: serverTimestamp(),
            membersCount: 1,
            photoURL: "" 
        });

        if (commImageFile) {
            const imageRef = ref(storage, `community_icons/${docRef.id}`);
            await uploadBytes(imageRef, commImageFile);
            photoURL = await getDownloadURL(imageRef);
            await updateDoc(doc(db, "communities", docRef.id), { photoURL });
        }

        await updateDoc(doc(db, "users", userData.uid), { joinedCommIds: arrayUnion(docRef.id) });
        
        const newCommunityData = { id: docRef.id, ...newComm, createdBy: userData.username, photoURL };
        setAllCommunities([...allCommunities, newCommunityData]);
        setJoinedCommunities([...joinedCommunities, newCommunityData]);
        
        setNewComm({ name: '', address: '', description: '', category: CATEGORIES[0], isDuesMandatory: false, duesAmount: '', duesDate: '' });
        setCommImageFile(null);
        setIsModalOpen(false);
        alert("Komunitas berhasil dibuat!");
    } catch (error) { console.error(error); alert("Gagal membuat komunitas."); } finally { setIsCreating(false); }
  };

  const groupedCommIds = myGroups.flatMap(g => g.communityIds);
  const standaloneCommunities = joinedCommunities.filter(c => !groupedCommIds.includes(c.id));

  if (loading) return <div className="bg-[#313338] h-screen flex flex-col items-center justify-center text-white font-bold gap-4"><div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin"></div><p>Memuat Discord View...</p></div>;

  return (
    <div className="flex h-screen bg-[#313338] overflow-hidden font-sans text-gray-100">
      
      {/* SIDEBAR SERVER LIST */}
      <div className="w-[72px] bg-[#1E1F22] flex flex-col items-center py-3 gap-2 overflow-y-auto shrink-0 custom-scrollbar">
         <div className="group relative mb-2">
            <div onClick={() => setIsGroupModalOpen(true)} className="w-12 h-12 bg-[#5865F2] rounded-[16px] flex items-center justify-center text-white cursor-pointer hover:rounded-[12px] transition-all duration-200 shadow-md"><span className="text-xl">📁</span></div>
            <div className="absolute left-14 top-2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">Buat Folder Group</div>
        </div>
        <div className="w-8 h-[2px] bg-[#35363C] rounded-lg mb-1"></div>

        {dataLoading && joinedCommunities.length === 0 && <div className="w-12 h-12 bg-[#2B2D31] rounded-full animate-pulse"></div>}

         {myGroups.map((group) => (
            <div key={group.id} className="flex flex-col items-center gap-1">
                <div onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)} className={`group relative flex items-center justify-center w-12 h-12 rounded-[24px] cursor-pointer transition-all hover:rounded-[16px] ${expandedGroupId === group.id ? 'bg-[#5865F2] text-white rounded-[16px]' : 'bg-[#2B2D31] text-[#5865F2] hover:bg-[#5865F2] hover:text-white'}`}>
                    <div className="grid grid-cols-2 gap-0.5 p-2 w-full h-full items-center justify-center"><span className="col-span-2 text-[10px] font-bold text-center leading-none break-all">{group.name.substring(0,4)}</span></div>
                    <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">Group: {group.name}</div>
                </div>
                {expandedGroupId === group.id && (
                    <div className="flex flex-col gap-2 p-2 bg-[#2B2D31] rounded-xl my-1 border border-[#1E1F22]">
                        {group.communityIds.map(commId => {
                            const comm = allCommunities.find(c => c.id === commId);
                            if(!comm) return null;
                            return (
                                <div key={comm.id} onClick={() => router.push(`/community/${comm.id}`)} className="group/item relative cursor-pointer">
                                    {comm.photoURL ? <img src={comm.photoURL} className="w-10 h-10 rounded-full object-cover hover:rounded-xl transition-all" alt={comm.name} /> : <div className="w-10 h-10 rounded-full bg-[#313338] hover:bg-[#5865F2] flex items-center justify-center text-[10px] font-bold text-gray-200 group-hover/item:text-white transition border border-[#1E1F22]">{comm.name.substring(0, 2).toUpperCase()}</div>}
                                    <div className="absolute left-12 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/item:opacity-100 whitespace-nowrap z-50 pointer-events-none">{comm.name}</div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
         ))}

         {standaloneCommunities.map((comm) => (
            <div key={comm.id} onClick={() => router.push(`/community/${comm.id}`)} className="group relative flex items-center justify-center cursor-pointer">
                {comm.photoURL ? <img src={comm.photoURL} className="w-12 h-12 rounded-[24px] object-cover hover:rounded-[16px] transition-all" alt={comm.name} /> : <div className="flex items-center justify-center w-12 h-12 rounded-[24px] bg-[#313338] hover:bg-[#5865F2] hover:rounded-[16px] text-gray-200 hover:text-white transition-all"><span className="font-bold text-sm pointer-events-none">{comm.name.substring(0, 2).toUpperCase()}</span></div>}
                <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">{comm.name}</div>
            </div>
         ))}
         
         <div onClick={() => setIsModalOpen(true)} className="group relative w-12 h-12 rounded-[24px] bg-[#313338] flex items-center justify-center text-green-500 hover:bg-green-600 hover:text-white cursor-pointer transition-all hover:rounded-[16px] mt-2">
            <span className="text-2xl font-light">+</span>
             <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none">Buat Komunitas Baru</div>
        </div>
      </div>

      {/* SIDEBAR MENU TENGAH */}
      <div className="w-60 bg-[#2B2D31] flex flex-col rounded-tl-xl border-r border-[#1F2023] shrink-0">
         <div className="h-12 border-b border-[#1F2023] flex items-center px-4 shadow-sm"><h1 className="font-bold text-gray-200">Dashboard</h1></div>
         <div className="flex-1 p-2 space-y-1">
            <div onClick={() => setActiveTab('map')} className={`px-2 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 ${activeTab === 'map' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}>🗺️ <span>Peta Komunitas</span></div>
            <div onClick={() => setActiveTab('trending')} className={`px-2 py-2 rounded text-sm font-medium cursor-pointer flex items-center gap-2 ${activeTab === 'trending' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C] hover:text-gray-200'}`}>🔥 <span>Rekomendasi / Trending</span></div>
         </div>
         <div className="bg-[#232428] p-2 flex items-center gap-2 px-3">
            <div onClick={() => router.push('/profile')} className="relative cursor-pointer hover:opacity-80 transition group w-8 h-8 shrink-0" title="Lihat Profil">
                {userData?.photoURL ? <img src={userData.photoURL} className="w-8 h-8 rounded-full object-cover" alt="User" /> : <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{userData?.username?.[0]?.toUpperCase()}</div>}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#232428] rounded-full"></div>
            </div>
            <div className="flex-1 overflow-hidden"><div className="text-sm font-bold text-white truncate">{userData?.username}</div></div>
            <button onClick={() => auth.signOut()} className="text-gray-400 hover:text-red-400 p-1" title="Logout">🚪</button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 bg-[#313338] flex flex-col relative overflow-hidden">
         <div className="h-12 border-b border-[#26272D] flex items-center px-4 bg-[#313338] shadow-sm shrink-0">
            <span className="text-gray-400 mr-2">{activeTab === 'map' ? '📍' : '🔥'}</span>
            <span className="font-bold text-white">{activeTab === 'map' ? 'Peta Persebaran' : 'Rekomendasi Untukmu'}</span>
         </div>
         
         <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
            {dataLoading && <div className="mb-4 bg-blue-600/20 border border-blue-500/50 text-blue-200 text-xs px-4 py-2 rounded animate-pulse">Sedang memperbarui data komunitas...</div>}

            {activeTab === 'map' && (
                <>
                <div className="bg-[#1E1F22] p-1 rounded-lg shadow-lg mb-8 border border-[#26272D] overflow-hidden"><div className="relative z-0"><MapWithNoSSR userCity={userData?.city} communities={allCommunities} /></div></div>
                <h3 className="text-gray-300 font-bold mb-4 text-xs uppercase tracking-wide">Jelajahi Semua Komunitas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                    {allCommunities.length === 0 && !dataLoading && <p className="text-gray-500 text-sm">Tidak ada komunitas ditemukan.</p>}
                    {allCommunities.map(comm => (
                        <div key={comm.id} onClick={() => router.push(`/community/${comm.id}`)} className="bg-[#2B2D31] p-4 rounded-lg hover:bg-[#35373C] cursor-pointer transition border border-[#1E1F22] group hover:shadow-lg flex items-start gap-3">
                            {comm.photoURL ? <img src={comm.photoURL} className="w-12 h-12 rounded-full object-cover bg-black" alt="Icon" /> : <div className="w-12 h-12 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold shrink-0">{comm.name.substring(0, 2).toUpperCase()}</div>}
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-gray-100 group-hover:text-blue-400">{comm.name}</h4>
                                    {userData?.joinedCommIds?.includes(comm.id) && <span className="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded">Joined</span>}
                                </div>
                                <p className="text-xs text-gray-400 mb-1">📍 {comm.address}</p>
                                {comm.isDuesMandatory && <p className="text-[10px] text-yellow-400 mt-1">💰 Wajib Iuran: Rp {parseInt(comm.duesAmount).toLocaleString()}</p>}
                            </div>
                        </div>
                    ))}
                </div>
                </>
            )}
            
            {activeTab === 'trending' && (
                <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-bold text-white mb-2">Rekomendasi Komunitas</h2>
                    {recommendedComms.map((comm) => (
                        <div key={comm.id} className="bg-[#2B2D31] p-5 rounded-xl border border-[#1E1F22] flex items-center gap-4 hover:border-[#5865F2] transition group cursor-pointer mt-4" onClick={() => router.push(`/community/${comm.id}`)}>
                            {comm.photoURL ? <img src={comm.photoURL} className="w-16 h-16 rounded-full object-cover" alt="Icon" /> : <div className="w-16 h-16 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xl font-bold">{comm.name.substring(0, 2).toUpperCase()}</div>}
                            <div className="flex-1">
                                <h3 className="font-bold text-lg text-white">{comm.name}</h3>
                                <p className="text-sm text-gray-400">{comm.description}</p>
                            </div>
                            <button className="bg-[#248046] text-white px-4 py-2 rounded font-medium text-sm">Lihat</button>
                        </div>
                    ))}
                </div>
            )}
         </div>
      </div>

      {/* MODAL CREATE COMMUNITY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-[#313338] w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-6 custom-scrollbar">
                <h2 className="text-2xl font-bold text-white mb-4 text-center">Buat Komunitas</h2>
                <form onSubmit={handleCreateCommunity} className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-[#1E1F22] flex items-center justify-center overflow-hidden border border-gray-600">
                            {commImageFile ? <img src={URL.createObjectURL(commImageFile)} className="w-full h-full object-cover" alt="Preview" /> : <span className="text-xs text-gray-500 text-center px-1">No Icon</span>}
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ikon (Opsional)</label>
                            <input type="file" accept="image/*" onChange={(e) => setCommImageFile(e.target.files[0])} className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#5865F2] file:text-white hover:file:bg-[#4752C4]" />
                        </div>
                    </div>

                    <input type="text" className="w-full bg-[#1E1F22] text-white p-2.5 rounded text-sm outline-none" placeholder="Nama Komunitas" value={newComm.name} onChange={e => setNewComm({...newComm, name: e.target.value})} required />
                    
                    <select className="w-full bg-[#1E1F22] text-white p-2.5 rounded text-sm outline-none" value={newComm.category} onChange={e => setNewComm({...newComm, category: e.target.value})}>{CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>

                    <input type="text" className="w-full bg-[#1E1F22] text-white p-2.5 rounded text-sm outline-none" placeholder="Alamat / Kota" value={newComm.address} onChange={e => setNewComm({...newComm, address: e.target.value})} required />
                    <textarea className="w-full bg-[#1E1F22] text-white p-2.5 rounded text-sm outline-none" placeholder="Deskripsi" value={newComm.description} onChange={e => setNewComm({...newComm, description: e.target.value})} />
                    
                    {/* BAGIAN IURAN (BARU) */}
                    <div className="bg-[#2B2D31] p-3 rounded border border-[#1E1F22]">
                        <div className="flex items-center gap-2 mb-2">
                            <input type="checkbox" id="dues" checked={newComm.isDuesMandatory} onChange={e => setNewComm({...newComm, isDuesMandatory: e.target.checked})} className="w-4 h-4 accent-[#5865F2]" />
                            <label htmlFor="dues" className="text-sm font-bold text-gray-200">Wajib Iuran?</label>
                        </div>
                        
                        {newComm.isDuesMandatory && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Nominal Iuran (Rp)</label>
                                    <input type="number" className="w-full bg-[#1E1F22] text-white p-2 rounded text-sm outline-none" placeholder="Contoh: 50000" value={newComm.duesAmount} onChange={e => setNewComm({...newComm, duesAmount: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Jatuh Tempo (Setiap tanggal?)</label>
                                    <input type="number" min="1" max="31" className="w-full bg-[#1E1F22] text-white p-2 rounded text-sm outline-none" placeholder="Contoh: 10" value={newComm.duesDate} onChange={e => setNewComm({...newComm, duesDate: e.target.value})} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between pt-2">
                        <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 text-sm">Batal</button>
                        <button type="submit" disabled={isCreating} className="bg-[#5865F2] text-white px-6 py-2 rounded hover:bg-[#4752C4] text-sm font-bold">{isCreating ? 'Memproses...' : 'Buat'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODAL GROUP */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-[#313338] w-full max-w-md rounded-lg shadow-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 text-center">📁 Buat Folder Group</h2>
                <form onSubmit={handleCreateGroup} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nama Folder</label>
                        <input type="text" className="w-full bg-[#1E1F22] text-white p-2.5 rounded text-sm outline-none focus:ring-1 focus:ring-[#5865F2]" placeholder="Contoh: Game FPS" value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} required />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Pilih Komunitas ({newGroup.selectedCommIds.length})</label>
                        <div className="bg-[#1E1F22] rounded p-2 max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                            {joinedCommunities.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Kamu belum join komunitas apapun.</p>}
                            {joinedCommunities.map(comm => (
                                <div key={comm.id} onClick={() => handleToggleCommSelection(comm.id)} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${newGroup.selectedCommIds.includes(comm.id) ? 'bg-[#5865F2] text-white' : 'hover:bg-[#35373C] text-gray-300'}`}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${newGroup.selectedCommIds.includes(comm.id) ? 'border-white bg-white' : 'border-gray-500'}`}>
                                        {newGroup.selectedCommIds.includes(comm.id) && <div className="w-2 h-2 bg-[#5865F2] rounded-full"></div>}
                                    </div>
                                    <span className="text-sm font-medium truncate">{comm.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between pt-4 border-t border-[#1E1F22] mt-2">
                        <button type="button" onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-white text-sm">Batal</button>
                        <button type="submit" disabled={isCreating} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 text-sm font-bold shadow">{isCreating ? 'Menyimpan...' : 'Simpan Group'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}