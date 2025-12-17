// src/app/faq/page.js
"use client";

import Navbar from '@/components/Navbar';

export default function FaqPage() {
  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
        <h1>Frequently Asked Questions (FAQ)</h1>
        
        <div style={{ marginTop: '20px' }}>
          <h3>Apa itu SimpleComm?</h3>
          <p>SimpleComm adalah platform komunitas untuk mengatur event dan berdiskusi.</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3>Bagaimana cara membuat komunitas?</h3>
          <p>Anda perlu login terlebih dahulu, lalu klik tombol "Buat Komunitas" di Dashboard.</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h3>Apakah aplikasi ini gratis?</h3>
          <p>Ya, aplikasi ini 100% gratis untuk digunakan.</p>
        </div>
      </div>
    </div>
  );
}