import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, PlayCircle, LayoutDashboard, Activity } from 'lucide-react';

export default function Navbar() {
  const { pathname } = useLocation();
  const links = [
    { to: '/', label: 'Simulasi Input', icon: PlayCircle },
    { to: '/dashboard', label: 'Dashboard Analis', icon: LayoutDashboard },
  ];

  return (
    <header className="h-[58px] bg-primary text-white shadow-sm border-b border-[#065287]/50 shrink-0 z-30 select-none">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/25 flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight leading-tight">NIKITA</span>
              <span className="text-[10px] font-semibold bg-white/20 text-white px-1.5 py-0.5 rounded tracking-wide uppercase">
                Enterprise
              </span>
            </div>
            <span className="text-[11px] text-white/80 font-normal leading-none hidden sm:inline">
              Deteksi Fraud Identitas BPJS Kesehatan
            </span>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Engine indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/15 text-[11px] text-white/90 border border-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span>ML Inference Ready</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5">
            {links.map((l) => {
              const Icon = l.icon;
              const isActive = pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-white/25 text-white shadow-xs font-semibold'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}