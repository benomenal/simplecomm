"use client";
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- 1. DEFINISI CUSTOM ICON ---

// Icon untuk USER (Gambar Orang / Lokasi Saya)
const userIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/9131/9131529.png', // Gambar Orang (Pin Merah)
  iconSize: [45, 45], // Ukuran ikon
  iconAnchor: [22, 45], // Titik tumpu ikon (tengah bawah)
  popupAnchor: [0, -40], // Posisi popup relatif terhadap ikon
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Icon untuk KOMUNITAS (Gambar Gedung / Perkumpulan)
const communityIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1256/1256650.png', // Gambar Komunitas (Pin Biru)
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41]
});


// Komponen Helper untuk menggeser kamera peta
function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, 13); // Zoom level
  return null;
}

export default function MapComponent({ userCity, communities }) {
  const [center, setCenter] = useState([-6.200000, 106.816666]); // Default Jakarta
  const [markers, setMarkers] = useState([]);

  // Fungsi Geocoding (Ubah Alamat -> Koordinat)
  const getCoordinates = async (address) => {
    try {
      // Gunakan Nominatim OpenStreetMap (Gratis)
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
      return null;
    } catch (error) {
      console.error("Gagal cari lokasi:", address);
      return null;
    }
  };

  useEffect(() => {
    const initMap = async () => {
      // 1. Cari Koordinat User (Untuk Center Map & Marker User)
      if (userCity) {
        const userCoords = await getCoordinates(userCity);
        if (userCoords) setCenter(userCoords);
      }

      // 2. Cari Koordinat Semua Komunitas (Untuk Marker Komunitas)
      const newMarkers = [];
      // Batasi agar tidak terlalu banyak request jika data banyak (Demo limit 10)
      const limitedCommunities = communities.slice(0, 15); 
      
      for (const comm of limitedCommunities) {
        if (comm.address) {
          // Delay kecil agar tidak dianggap spam oleh API Nominatim
          await new Promise(r => setTimeout(r, 200)); 
          const coords = await getCoordinates(comm.address);
          if (coords) {
            newMarkers.push({ ...comm, position: coords });
          }
        }
      }
      setMarkers(newMarkers);
    };

    initMap();
  }, [userCity, communities]);

  return (
    <MapContainer center={center} zoom={13} style={{ height: "400px", width: "100%", borderRadius: "10px", zIndex: 0 }}>
      <ChangeView center={center} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* 2. MARKER USER (Pakai userIcon) */}
      <Marker position={center} icon={userIcon}>
         <Popup>
            <div className="text-center">
                <strong className="text-red-600">LOKASI KAMU</strong><br/>
                {userCity || "Jakarta"}
            </div>
         </Popup>
      </Marker>

      {/* 3. MARKER KOMUNITAS (Pakai communityIcon) */}
      {markers.map((m, idx) => (
        <Marker key={idx} position={m.position} icon={communityIcon}>
          <Popup>
            <div className="text-center">
                <strong className="text-blue-600 font-bold text-sm uppercase">{m.name}</strong><br />
                <span className="text-xs text-gray-600">{m.address}</span><br/>
                <span className="text-[10px] bg-blue-100 px-2 py-0.5 rounded text-blue-800">{m.category || 'Umum'}</span>
            </div>
          </Popup>
        </Marker>
      ))}

    </MapContainer>
  );
}