import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const { pathname } = useLocation();
  const links = [
    { to: '/', label: 'Simulasi' },
    { to: '/dashboard', label: 'Dashboard Analis' },
  ];
  return (
    <header className="bg-primary text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <ShieldCheck size={22} />
          <span>NIKITA</span>
          <span className="text-xs font-normal opacity-80 hidden sm:inline">
            Deteksi Fraud Identitas BPJS
          </span>
        </div>
        <nav className="flex gap-1">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                pathname === l.to ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}