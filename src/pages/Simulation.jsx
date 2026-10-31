import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Loader2, AlertCircle, FileJson, FormInput, ChevronDown, ChevronUp } from 'lucide-react';
import { SCENARIOS } from '../scenarios';
import { predict } from '../api';
import { addCase } from '../storage';

const DEFAULTS = {
  peserta_id: '',
  tanggal_lahir: '',
  tanggal_kunjungan: '',
  tanggal_pulang: '',
  jenis_kelamin: 2,
  tahun_sampel: 2024,
  hubungan_keluarga: 99,
  kelas_rawat: 99,
  segmen_peserta: 99,
  status_kepesertaan: 99,
  provinsi_peserta: 99,
  kabupaten_peserta: 9999,
  provinsi_fktp: 99,
  kabupaten_fktp: 9999,
  jenis_fktp: 99,
  tipe_fktp: 99,
  tingkat_fktp: 99,
  poli_fktp: 99,
  kepemilikan_fktp: 99,
  provinsi_fkrtl: 99,
  kabupaten_fkrtl: 9999,
  jenis_fkrtl: 99,
  tipe_fkrtl: 99,
  tingkat_fkrtl: 99,
  poli_fkrtl: 99,
  kepemilikan_fkrtl: 99,
  kelas_fkrtl: 9,
  status_pulang_fkrtl: 99,
  biaya_tagih: 0,
  biaya_verifikasi: 0,
  inacbgs_kelompok: 99,
  inacbgs_tipe: 99,
  inacbgs_spesifikasi: 99,
  inacbgs_keparahan: 99,
  jenis_kunjungan_fktp: 99,
  diagnosa_fktp: '',
  diagnosa_fkrtl: '',
  frekuensi_hari_itu: 1,
};

const MAIN_FIELDS = [
  { key: 'peserta_id', label: 'ID Peserta', type: 'text' },
  { key: 'tanggal_lahir', label: 'Tanggal Lahir', type: 'date' },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin', type: 'select', options: [[1, 'Laki-laki'], [2, 'Perempuan']] },
  { key: 'tahun_sampel', label: 'Tahun Sampel', type: 'number' },
  { key: 'tanggal_kunjungan', label: 'Tanggal Kunjungan', type: 'date' },
  { key: 'tanggal_pulang', label: 'Tanggal Pulang', type: 'date' },
  { key: 'frekuensi_hari_itu', label: 'Frekuensi Hari Itu', type: 'number' },
  { key: 'diagnosa_fktp', label: 'Diagnosa FKTP (ICD-10)', type: 'text' },
  { key: 'diagnosa_fkrtl', label: 'Diagnosa FKRTL (ICD-10)', type: 'text' },
  { key: 'kabupaten_fktp', label: 'Kabupaten FKTP', type: 'number' },
  { key: 'kabupaten_fkrtl', label: 'Kabupaten FKRTL', type: 'number' },
  { key: 'kabupaten_peserta', label: 'Kabupaten Peserta', type: 'number' },
  { key: 'provinsi_fktp', label: 'Provinsi FKTP', type: 'number' },
  { key: 'provinsi_fkrtl', label: 'Provinsi FKRTL', type: 'number' },
  { key: 'provinsi_peserta', label: 'Provinsi Peserta', type: 'number' },
  { key: 'biaya_tagih', label: 'Biaya Tagih', type: 'number' },
  { key: 'biaya_verifikasi', label: 'Biaya Verifikasi', type: 'number' },
];

const ADVANCED_FIELDS = [
  'hubungan_keluarga', 'kelas_rawat', 'segmen_peserta', 'status_kepesertaan',
  'jenis_fktp', 'tipe_fktp', 'tingkat_fktp', 'poli_fktp', 'kepemilikan_fktp',
  'jenis_fkrtl', 'tipe_fkrtl', 'tingkat_fkrtl', 'poli_fkrtl', 'kepemilikan_fkrtl',
  'kelas_fkrtl', 'status_pulang_fkrtl', 'inacbgs_kelompok', 'inacbgs_tipe',
  'inacbgs_spesifikasi', 'inacbgs_keparahan', 'jenis_kunjungan_fktp',
];

function Field({ field, value, onChange }) {
  const base = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary';
  if (field.type === 'select') {
    return (
      <select value={value} onChange={(e) => onChange(field.key, Number(e.target.value))} className={base}>
        {field.options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type}
      value={value ?? ''}
      onChange={(e) => {
        const raw = e.target.value;
        if (field.type === 'number') onChange(field.key, raw === '' ? '' : Number(raw));
        else onChange(field.key, raw);
      }}
      className={base}
    />
  );
}

export default function Simulation() {
  const [mode, setMode] = useState('form');
  const [scenario, setScenario] = useState('normal');
  const [form, setForm] = useState({ ...DEFAULTS, ...SCENARIOS.normal.payload });
  const [jsonText, setJsonText] = useState(JSON.stringify(SCENARIOS.normal.payload, null, 2));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const updateField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleScenario = (key) => {
    setScenario(key);
    const payload = { ...DEFAULTS, ...SCENARIOS[key].payload };
    setForm(payload);
    setJsonText(JSON.stringify(payload, null, 2));
    setError('');
  };

  const switchMode = (next) => {
    if (next === 'json') {
      setJsonText(JSON.stringify(form, null, 2));
    } else {
      try {
        const parsed = JSON.parse(jsonText);
        setForm({ ...DEFAULTS, ...parsed });
      } catch {
        // keep current form if json invalid
      }
    }
    setMode(next);
  };

  const handleAnalyze = async () => {
    setError('');
    let payload;
    try {
      payload = mode === 'json' ? JSON.parse(jsonText) : form;
    } catch {
      setError('JSON tidak valid. Periksa format payload.');
      return;
    }
    if (!payload.tanggal_lahir || !payload.tanggal_kunjungan || !payload.tanggal_pulang) {
      setError('Tanggal lahir, kunjungan, dan pulang wajib diisi.');
      return;
    }
    setLoading(true);
    try {
      const result = await predict(payload);
      const id = payload.peserta_id || `CASE-${Date.now()}`;
      addCase({ id, waktu: new Date().toISOString(), payload, result, verdict: null });
      navigate('/dashboard');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.response?.data?.error || e?.message || 'Gagal menghubungi API NIKITA.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-primary mb-1">Simulasi Input</h1>
        <p className="text-sm text-gray-600 mb-4">
          Isi parameter transaksi via form, atau edit JSON langsung.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center">
          <label className="text-sm font-medium text-gray-700">Skenario</label>
          <select
            value={scenario}
            onChange={(e) => handleScenario(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>

          <div className="sm:ml-auto flex rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => switchMode('form')}
              className={`px-3 py-2 text-sm flex items-center gap-1 ${mode === 'form' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <FormInput size={14} /> Form
            </button>
            <button
              type="button"
              onClick={() => switchMode('json')}
              className={`px-3 py-2 text-sm flex items-center gap-1 ${mode === 'json' ? 'bg-primary text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              <FileJson size={14} /> JSON
            </button>
          </div>
        </div>

        {mode === 'form' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MAIN_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <Field field={f} value={form[f.key]} onChange={updateField} />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Parameter lanjutan
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                {ADVANCED_FIELDS.map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{key}</label>
                    <input
                      type="number"
                      value={form[key] ?? ''}
                      onChange={(e) => updateField(key, e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
            className="w-full h-96 font-mono text-xs border border-gray-300 rounded-md p-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 text-danger text-sm bg-red-50 border border-red-200 rounded-md p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {loading ? 'Menganalisis...' : 'Analyze via NIKITA API'}
          </button>
        </div>
      </div>
    </div>
  );
}