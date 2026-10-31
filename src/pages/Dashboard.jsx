import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, RefreshCw, Inbox } from 'lucide-react';
import { loadCases } from '../storage';

export default function Dashboard() {
  const [cases, setCases] = useState([]);

  const refresh = () => setCases(loadCases());
  useEffect(() => {
    refresh();
    const onStorage = () => refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const statusColor = (status) => {
    if (status === 'Tinggi') return 'bg-red-100 text-danger';
    if (status === 'Sedang') return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-secondary';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Dashboard Analis</h1>
          <p className="text-sm text-gray-600">Antrean kasus hasil simulasi.</p>
        </div>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <RefreshCw size={14} /> Muat ulang
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {cases.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Inbox size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Belum ada kasus. Jalankan simulasi terlebih dahulu.</p>
            <Link to="/" className="text-primary text-sm hover:underline mt-2 inline-block">
              Ke halaman simulasi
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">ID Peserta</th>
                  <th className="text-left px-4 py-3 font-medium">Waktu</th>
                  <th className="text-left px-4 py-3 font-medium">Skor Risiko</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Verdik</th>
                  <th className="text-right px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.id}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(c.waktu).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {c.result.skor_risiko_relatif.toFixed(3)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(c.result.status)}`}>
                        {c.result.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.verdict ? (
                        <span
                          className={
                            c.verdict === 'fraud' ? 'text-danger font-medium' : 'text-secondary font-medium'
                          }
                        >
                          {c.verdict === 'fraud' ? 'Fraud' : 'Valid'}
                        </span>
                      ) : (
                        <span className="text-gray-400">Belum direview</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/case/${encodeURIComponent(c.id)}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Eye size={14} /> Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}