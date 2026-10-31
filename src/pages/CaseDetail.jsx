import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PolarAngleAxis,
} from 'recharts';
import { ArrowLeft, User, Calendar, Stethoscope, CheckCircle2, XCircle } from 'lucide-react';
import { getCase, updateVerdict } from '../storage';
import Toast from '../components/Toast';

function ageFromBirth(birth) {
  if (!birth) return '-';
  const b = new Date(birth);
  if (isNaN(b.getTime())) return '-';
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

function genderLabel(v) {
  if (v === 1) return 'Laki-laki';
  if (v === 2) return 'Perempuan';
  return '-';
}

function gaugeColor(score) {
  if (score > 0.7) return '#D32F2F';
  if (score < 0.4) return '#00A86B';
  return '#F59E0B';
}

export default function CaseDetail() {
  const { id } = useParams();
  const [cas, setCas] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setCas(getCase(decodeURIComponent(id)));
  }, [id]);

  if (!cas) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link to="/dashboard" className="text-primary hover:underline inline-flex items-center gap-1 mb-4">
          <ArrowLeft size={14} /> Kembali
        </Link>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          Kasus tidak ditemukan.
        </div>
      </div>
    );
  }

  const { payload, result } = cas;
  const score = result.skor_risiko_relatif;
  const gaugeData = [{ name: 'risk', value: Math.round(score * 100), fill: gaugeColor(score) }];
  const trackData = [{ name: 'track', value: 100, fill: '#E5E7EB' }];

  const handleVerdict = (verdict) => {
    updateVerdict(cas.id, verdict);
    setCas(getCase(cas.id));
    const label = verdict === 'fraud' ? 'Fraud' : 'Valid';
    setToast(`Kasus ditandai sebagai ${label}`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Link to="/dashboard" className="text-primary hover:underline inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Kembali ke Dashboard
      </Link>

      <h1 className="text-2xl font-bold text-primary mb-4">Detail Kasus: {cas.id}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: profile */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <User size={18} className="text-primary" /> Profil Peserta
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">ID Peserta</dt>
              <dd className="font-medium text-gray-800">{cas.id}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Gender</dt>
              <dd className="font-medium text-gray-800">{genderLabel(payload.jenis_kelamin)}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Usia</dt>
              <dd className="font-medium text-gray-800">{ageFromBirth(payload.tanggal_lahir)} tahun</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Tanggal Lahir</dt>
              <dd className="font-medium text-gray-800">{payload.tanggal_lahir}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Diagnosa FKTP</dt>
              <dd className="font-medium text-gray-800">{payload.diagnosa_fktp || '-'}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Diagnosa FKRTL</dt>
              <dd className="font-medium text-gray-800">{payload.diagnosa_fkrtl || '-'}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-2">
              <dt className="text-gray-500">Kabupaten FKTP / FKRTL</dt>
              <dd className="font-medium text-gray-800">
                {payload.kabupaten_fktp} / {payload.kabupaten_fkrtl}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Frekuensi Hari Itu</dt>
              <dd className="font-medium text-gray-800">{payload.frekuensi_hari_itu}</dd>
            </div>
          </dl>

          <div className="mt-5 text-xs text-gray-400 flex items-center gap-1">
            <Calendar size={12} /> Waktu analisis: {new Date(cas.waktu).toLocaleString('id-ID')}
          </div>
        </div>

        {/* Right: gauge + explainability + actions */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Skor Risiko</h2>
            <div className="flex items-center justify-center">
              <div className="relative w-56 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="100%"
                    barSize={18}
                    data={gaugeData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar
                      background={{ fill: '#E5E7EB' }}
                      dataKey="value"
                      cornerRadius={10}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold" style={{ color: gaugeColor(score) }}>
                    {(score * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-gray-500 mt-1">{result.status}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-md p-3">
                <div className="text-gray-500 text-xs">Skor Risiko (kalibrasi)</div>
                <div className="font-semibold text-gray-800">{result.skor_risiko.toFixed(3)}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-3">
                <div className="text-gray-500 text-xs">Skor Margin</div>
                <div className="font-semibold text-gray-800">{result.skor_margin.toFixed(3)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Stethoscope size={18} className="text-primary" /> Explainability
            </h2>
            <ul className="space-y-2">
              {result.alasan.map((a, i) => (
                <li key={i} className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-3">
                  {a}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Human-in-the-Loop</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tentukan keputusan akhir untuk kasus ini.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleVerdict('valid')}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-secondary text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-green-700 transition"
              >
                <CheckCircle2 size={16} /> Valid
              </button>
              <button
                onClick={() => handleVerdict('fraud')}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-danger text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-red-700 transition"
              >
                <XCircle size={16} /> Fraud
              </button>
            </div>
            {cas.verdict && (
              <p className="text-xs text-gray-500 mt-3 text-center">
                Verdik tersimpan: {cas.verdict === 'fraud' ? 'Fraud' : 'Valid'}
              </p>
            )}
          </div>
        </div>
      </div>

      <Toast
        message={toast}
        type={toast && toast.includes('Fraud') ? 'error' : 'success'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}