"use client";
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-blue-600 p-4 text-white shadow-md">
      <div className="max-w-6xl mx-auto flex justify-between items-center">
        <Link href="/" className="font-bold text-xl hover:text-blue-100">
          SimpleComm
        </Link>
        <div className="space-x-6 text-sm md:text-base font-medium">
          <Link href="/" className="hover:text-blue-200">Dashboard</Link>
          <Link href="/map" className="hover:text-blue-200">Peta</Link>
          <Link href="/faq" className="hover:text-blue-200">Tanya AI</Link>
          <button 
            onClick={handleLogout} 
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded transition"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}