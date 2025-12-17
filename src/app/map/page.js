// src/app/map/page.js
"use client"; 

import Navbar from '@/components/Navbar'; 
// Import komponen peta dengan dynamic import agar tidak error saat render di server
import dynamic from 'next/dynamic';

// Gunakan dynamic import untuk mematikan SSR (Server Side Rendering) khusus komponen ini
// Karena Leaflet butuh 'window' browser yang tidak ada di server
const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
  ssr: false,
  loading: () => <p>Memuat Peta...</p> // Teks saat loading
});

export default function MapPage() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px' }}>
        <h1>Halaman Peta Komunitas</h1>
        <p style={{ marginBottom: '20px' }}>Cari event dan komunitas di sekitarmu.</p>
        
        {/* Peta ditampilkan di sini */}
        <div style={{ border: '2px solid #ddd', borderRadius: '10px', overflow: 'hidden' }}>
           <MapComponent />
        </div>
      </div>
    </div>
  );
}