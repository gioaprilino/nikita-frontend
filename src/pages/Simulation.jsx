import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Loader2,
  AlertCircle,
  FileJson,
  FormInput,
  SlidersHorizontal,
  RefreshCw,
  X,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  User,
  Calendar,
  Stethoscope,
  DollarSign,
  MapPin,
  Copy,
  Check,
  Sparkles,
  Info,
  AlertTriangle
} from 'lucide-react';
import { SCENARIOS } from '../scenarios';
import { predict } from '../api';
import { addCase } from '../storage';

// 37 Canonical Fields strictly matching backend TransactionRequest schema
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

const ADVANCED_FIELDS = [
  'hubungan_keluarga', 'kelas_rawat', 'segmen_peserta', 'status_kepesertaan',
  'jenis_fktp', 'tipe_fktp', 'tingkat_fktp', 'poli_fktp', 'kepemilikan_fktp',
  'jenis_fkrtl', 'tipe_fkrtl', 'tingkat_fkrtl', 'poli_fkrtl', 'kepemilikan_fkrtl',
  'kelas_fkrtl', 'status_pulang_fkrtl', 'inacbgs_kelompok', 'inacbgs_tipe',
  'inacbgs_spesifikasi', 'inacbgs_keparahan', 'jenis_kunjungan_fktp',
];

// Heuristic pattern definitions strictly matching preprocessor.py in nikita-api
const POLA_KEHAMILAN = ['O', 'Z34', 'Z37'];
const POLA_PROSTAT = ['N40', 'C61'];
const POLA_DEGENERATIF = ['I10', 'E11', 'I25'];

function matchPrefix(kode, prefixes) {
  if (!kode || typeof kode !== 'string') return false;
  const upper = kode.trim().toUpperCase();
  return prefixes.some((p) => upper.startsWith(p));
}

const SCENARIO_DESCRIPTIONS = {
  normal: {
    tag: 'Normal / Valid',
    color: 'emerald',
    icon: ShieldCheck,
    summary: 'Profil peserta selaras: diagnosa ISPA/follow-up, wilayah faskes satu kabupaten, tanpa anomali medis.',
    indicator: 'Klaim valid memenuhi aturan medis & konsistensi spasial BPJS.',
  },
  priaHamil: {
    tag: 'Fraud Anomali Medis',
    color: 'rose',
    icon: ShieldAlert,
    summary: 'Pasien laki-laki tercatat dengan diagnosa Obstetri/Kehamilan (O42). Memicu is_gender_mismatch.',
    indicator: 'Indikasi fraud peminjaman kartu BPJS atau manipulasi identitas peserta.',
  },
  spasial: {
    tag: 'Fraud Anomali Spasial',
    color: 'amber',
    icon: MapPin,
    summary: 'Perbedaan kabupaten FKTP (7405) vs FKRTL (7471). Memicu is_spatial_anomaly pada XGBoost.',
    indicator: 'Indikasi anomali rujukan lintas wilayah atau klaim fasilitas fiktif.',
  },
  pediatrik: {
    tag: 'Fraud Anomali Usia',
    color: 'purple',
    icon: AlertTriangle,
    summary: 'Pasien anak (<10 tahun) dengan diagnosa penyakit degeneratif lansia (E11 Diabetes).',
    indicator: 'Memicu is_age_mismatch (pola degeneratif I10/E11/I25 pada usia anak).',
  },
};

/**
 * Sanitasi & transform payload sebelum dikirim ke API NIKITA
 * Memastikan tidak ada field liar (extra='forbid') dan tipe data sesuai schemas.py TransactionRequest
 */
function prepareBackendPayload(raw) {
  const toInt = (v, fallback = 99) => {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : Math.trunc(n);
  };

  const toFloat = (v, fallback = 0.0) => {
    if (v === '' || v === null || v === undefined) return fallback;
    const n = Number(v);
    return isNaN(n) ? fallback : Math.max(0.0, n);
  };

  const toCleanStr = (v, maxLen = 10) => {
    if (!v || typeof v !== 'string') return null;
    const trimmed = v.trim().toUpperCase();
    return trimmed ? trimmed.slice(0, maxLen) : null;
  };

  return {
    peserta_id: raw.peserta_id ? String(raw.peserta_id).trim().slice(0, 64) : null,
    tanggal_lahir: raw.tanggal_lahir,
    tanggal_kunjungan: raw.tanggal_kunjungan,
    tanggal_pulang: raw.tanggal_pulang,
    jenis_kelamin: Number(raw.jenis_kelamin) === 1 ? 1 : 2,
    tahun_sampel: toInt(raw.tahun_sampel, 2024),
    hubungan_keluarga: toInt(raw.hubungan_keluarga, 99),
    kelas_rawat: toInt(raw.kelas_rawat, 99),
    segmen_peserta: toInt(raw.segmen_peserta, 99),
    status_kepesertaan: toInt(raw.status_kepesertaan, 99),
    provinsi_peserta: toInt(raw.provinsi_peserta, 99),
    kabupaten_peserta: toInt(raw.kabupaten_peserta, 9999),
    provinsi_fktp: toInt(raw.provinsi_fktp, 99),
    kabupaten_fktp: toInt(raw.kabupaten_fktp, 9999),
    jenis_fktp: toInt(raw.jenis_fktp, 99),
    tipe_fktp: toInt(raw.tipe_fktp, 99),
    tingkat_fktp: toInt(raw.tingkat_fktp, 99),
    poli_fktp: toInt(raw.poli_fktp, 99),
    kepemilikan_fktp: toInt(raw.kepemilikan_fktp, 99),
    provinsi_fkrtl: toInt(raw.provinsi_fkrtl, 99),
    kabupaten_fkrtl: toInt(raw.kabupaten_fkrtl, 9999),
    jenis_fkrtl: toInt(raw.jenis_fkrtl, 99),
    tipe_fkrtl: toInt(raw.tipe_fkrtl, 99),
    tingkat_fkrtl: toInt(raw.tingkat_fkrtl, 99),
    poli_fkrtl: toInt(raw.poli_fkrtl, 99),
    kepemilikan_fkrtl: toInt(raw.kepemilikan_fkrtl, 99),
    kelas_fkrtl: toInt(raw.kelas_fkrtl, 9),
    status_pulang_fkrtl: toInt(raw.status_pulang_fkrtl, 99),
    biaya_tagih: toFloat(raw.biaya_tagih, 0),
    biaya_verifikasi: toFloat(raw.biaya_verifikasi, 0),
    inacbgs_kelompok: toInt(raw.inacbgs_kelompok, 99),
    inacbgs_tipe: toInt(raw.inacbgs_tipe, 99),
    inacbgs_spesifikasi: toInt(raw.inacbgs_spesifikasi, 99),
    inacbgs_keparahan: toInt(raw.inacbgs_keparahan, 99),
    jenis_kunjungan_fktp: toInt(raw.jenis_kunjungan_fktp, 99),
    diagnosa_fktp: toCleanStr(raw.diagnosa_fktp, 10),
    diagnosa_fkrtl: toCleanStr(raw.diagnosa_fkrtl, 10),
    frekuensi_hari_itu: Math.min(100, Math.max(1, toInt(raw.frekuensi_hari_itu, 1))),
  };
}

export default function Simulation() {
  const [mode, setMode] = useState('form');
  const [scenario, setScenario] = useState('normal');
  const [form, setForm] = useState({ ...DEFAULTS, ...SCENARIOS.normal.payload });
  const [jsonText, setJsonText] = useState(JSON.stringify(SCENARIOS.normal.payload, null, 2));
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const updateField = (key, val) => {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (mode === 'json') {
        setJsonText(JSON.stringify(next, null, 2));
      }
      return next;
    });
  };

  const handleScenario = (key) => {
    if (!SCENARIOS[key]) return;
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
        // Biarkan form lama jika JSON tidak valid
      }
    }
    setMode(next);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setError('');
    } catch {
      setError('Format JSON tidak valid. Periksa penulisan tanda kurung dan koma.');
    }
  };

  // Live Heuristics strictly matching nikita-api preprocessor.py logic
  const heuristics = useMemo(() => {
    let numericAge = -1;
    let ageLabel = '-';
    if (form.tanggal_lahir && form.tanggal_kunjungan) {
      const b = new Date(form.tanggal_lahir);
      const v = new Date(form.tanggal_kunjungan);
      if (!isNaN(b.getTime()) && !isNaN(v.getTime())) {
        let diffYears = v.getFullYear() - b.getFullYear();
        const m = v.getMonth() - b.getMonth();
        if (m < 0 || (m === 0 && v.getDate() < b.getDate())) diffYears--;
        numericAge = diffYears;
        ageLabel = `${diffYears} Thn`;
      }
    }

    let losLabel = '-';
    if (form.tanggal_kunjungan && form.tanggal_pulang) {
      const k = new Date(form.tanggal_kunjungan);
      const p = new Date(form.tanggal_pulang);
      if (!isNaN(k.getTime()) && !isNaN(p.getTime())) {
        const diffMs = p.getTime() - k.getTime();
        const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
        losLabel = days >= 0 ? `${days} Hari` : 'Tgl Invalid';
      }
    }

    // 1. Gender Mismatch Rule (preprocessor.py: POLA_KEHAMILAN & POLA_PROSTAT)
    const sex = Number(form.jenis_kelamin);
    const hamil = matchPrefix(form.diagnosa_fktp, POLA_KEHAMILAN) || matchPrefix(form.diagnosa_fkrtl, POLA_KEHAMILAN);
    const prostat = matchPrefix(form.diagnosa_fktp, POLA_PROSTAT) || matchPrefix(form.diagnosa_fkrtl, POLA_PROSTAT);
    const isGenderMismatch = (sex === 1 && hamil) || (sex === 2 && prostat);

    // 2. Spatial Anomaly Rule (preprocessor.py: kab_fktp > 0 and kab_fkrtl > 0 and kab_fktp != kab_fkrtl)
    const kabFktp = Number(form.kabupaten_fktp);
    const kabFkrtl = Number(form.kabupaten_fkrtl);
    const isSpatialAnomaly = kabFktp > 0 && kabFkrtl > 0 && kabFktp !== 9999 && kabFkrtl !== 9999 && kabFktp !== kabFkrtl;

    // 3. Age Mismatch Rule (preprocessor.py: 0 <= usia < 10 and degeneratif)
    const degeneratif = matchPrefix(form.diagnosa_fktp, POLA_DEGENERATIF) || matchPrefix(form.diagnosa_fkrtl, POLA_DEGENERATIF);
    const isAgeMismatch = numericAge >= 0 && numericAge < 10 && degeneratif;

    // Financial Metrics
    const tagih = Number(form.biaya_tagih) || 0;
    const verif = Number(form.biaya_verifikasi) || 0;
    const diffCost = tagih - verif;
    const ratio = tagih > 0 ? (verif / tagih).toFixed(2) : '1.00';

    return {
      ageLabel,
      numericAge,
      losLabel,
      isGenderMismatch,
      isSpatialAnomaly,
      isAgeMismatch,
      diffCost,
      ratio,
    };
  }, [form]);

  const handleAnalyze = async () => {
    setError('');
    let rawPayload;
    try {
      rawPayload = mode === 'json' ? JSON.parse(jsonText) : form;
    } catch {
      setError('Format JSON tidak valid. Periksa tanda koma dan kurung kurawal.');
      return;
    }

    // Sanitasi data agar sesuai kontrak TransactionRequest (extra='forbid')
    const payload = prepareBackendPayload(rawPayload);

    // Validasi konsistensi lokal selaras dengan schemas.py model_validator
    if (!payload.tanggal_lahir || !payload.tanggal_kunjungan || !payload.tanggal_pulang) {
      setError('Tanggal lahir, kunjungan, dan pulang wajib diisi.');
      return;
    }
    if (new Date(payload.tanggal_lahir) > new Date(payload.tanggal_kunjungan)) {
      setError('Validasi Konsistensi: tanggal_lahir tidak boleh setelah tanggal_kunjungan.');
      return;
    }
    if (new Date(payload.tanggal_pulang) < new Date(payload.tanggal_kunjungan)) {
      setError('Validasi Konsistensi: tanggal_pulang tidak boleh sebelum tanggal_kunjungan.');
      return;
    }
    if (heuristics.numericAge > 130) {
      setError('Validasi Konsistensi: usia peserta melebihi 130 tahun.');
      return;
    }
    if (payload.tahun_sampel < 2000 || payload.tahun_sampel > 2100) {
      setError('Validasi Konsistensi: tahun_sampel harus antara 2000 hingga 2100.');
      return;
    }

    setLoading(true);
    try {
      const result = await predict(payload);
      const id = payload.peserta_id || `CASE-${Date.now()}`;
      addCase({ id, waktu: new Date().toISOString(), payload, result, verdict: null });
      navigate('/dashboard');
    } catch (e) {
      let msg = 'Gagal menghubungi API NIKITA. Pastikan server backend aktif di port 8000.';
      if (e?.response?.data) {
        const data = e.response.data;
        if (Array.isArray(data.detail)) {
          // Format pesan error Pydantic agar user-friendly
          msg = data.detail.map((err) => `${err.loc?.slice(1).join('.') || 'input'}: ${err.msg}`).join('; ');
        } else if (typeof data.detail === 'string') {
          msg = data.detail;
        } else if (data.error) {
          msg = `${data.error}: ${JSON.stringify(data.detail || '')}`;
        }
      } else if (e?.message) {
        msg = e.message;
      }
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const activeScenarioMeta = SCENARIO_DESCRIPTIONS[scenario] || SCENARIO_DESCRIPTIONS.normal;
  const ScenarioIcon = activeScenarioMeta.icon;

  return (
    <div className="h-full w-full flex flex-col p-2 sm:p-2.5 lg:p-3 overflow-y-auto lg:overflow-hidden select-none">
      {/* Top Header & Simulation Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-base font-bold text-slateText tracking-tight flex items-center gap-2">
              <span>Simulasi Input Transaksi</span>
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20">
                Deteksi Real-Time
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 leading-none mt-0.5">
              Uji parameter klaim terhadap model machine learning deteksi fraud BPJS Kesehatan
            </p>
          </div>
        </div>

        {/* Skenario Selector + Form/JSON Toggle */}
        <div className="flex items-center gap-2">
          {/* Quick Scenario Pills */}
          <div className="flex items-center bg-white rounded-lg p-0.5 border border-border shadow-2xs">
            <span className="text-[10.5px] font-medium text-slate-400 px-1.5 hidden sm:inline">Skenario:</span>
            {Object.entries(SCENARIOS).map(([key, s]) => {
              const isActive = scenario === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleScenario(key)}
                  className={`px-2 py-0.5 text-xs rounded-md font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Form vs JSON Toggle */}
          <div className="flex items-center bg-white rounded-lg p-0.5 border border-border shadow-2xs">
            <button
              type="button"
              onClick={() => switchMode('form')}
              className={`px-2.5 py-0.5 text-xs rounded-md font-medium flex items-center gap-1 transition-all ${
                mode === 'form'
                  ? 'bg-primary text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FormInput size={12} />
              <span>Form</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('json')}
              className={`px-2.5 py-0.5 text-xs rounded-md font-medium flex items-center gap-1 transition-all ${
                mode === 'json'
                  ? 'bg-primary text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileJson size={12} />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main 2-Column Content Area */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2 sm:gap-2.5 lg:gap-3">
        {/* ================= LEFT COLUMN: Form Input Transaksi (68% ~ 8 cols) ================= */}
        <div className="col-span-12 lg:col-span-8 flex flex-col h-full min-h-0 bg-white rounded-xl border border-border shadow-xs overflow-hidden">
          {mode === 'form' ? (
            <div className="flex-1 min-h-0 flex flex-col justify-between p-2.5 lg:p-3">
              {/* Form Groups Container - 5 Categories optimized for 100vh display */}
              <div className="space-y-1.5 lg:space-y-2">
                {/* 1. Identitas Peserta */}
                <div className="bg-slate-50/70 rounded-lg p-2 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                      <User size={12} className="text-primary" />
                      1. Identitas Peserta
                    </span>
                    <span className="text-[10px] text-slate-400">PSTV01, PSTV03, PSTV05, PSTV16</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">ID Peserta</label>
                      <input
                        type="text"
                        value={form.peserta_id ?? ''}
                        onChange={(e) => updateField('peserta_id', e.target.value)}
                        placeholder="NORMAL-001"
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Tanggal Lahir</label>
                      <input
                        type="date"
                        value={form.tanggal_lahir ?? ''}
                        onChange={(e) => updateField('tanggal_lahir', e.target.value)}
                        className="w-full h-[31px] px-1.5 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Jenis Kelamin</label>
                      <select
                        value={form.jenis_kelamin}
                        onChange={(e) => updateField('jenis_kelamin', Number(e.target.value))}
                        className="w-full h-[31px] px-1.5 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      >
                        <option value={1}>1 - Laki-laki</option>
                        <option value={2}>2 - Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Tahun Sampel</label>
                      <input
                        type="number"
                        value={form.tahun_sampel ?? ''}
                        onChange={(e) => updateField('tahun_sampel', e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* 2 & 3. Informasi Kunjungan & Diagnosis (Side by Side in 12-Col Grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  {/* 2. Informasi Kunjungan (7 cols) */}
                  <div className="sm:col-span-7 bg-slate-50/70 rounded-lg p-2 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                        <Calendar size={12} className="text-primary" />
                        2. Informasi Kunjungan
                      </span>
                      <span className="text-[10px] text-slate-400">FKP03, FKL04, Frekuensi</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Tgl Kunjungan</label>
                        <input
                          type="date"
                          value={form.tanggal_kunjungan ?? ''}
                          onChange={(e) => updateField('tanggal_kunjungan', e.target.value)}
                          className="w-full h-[31px] px-1.5 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Tgl Pulang</label>
                        <input
                          type="date"
                          value={form.tanggal_pulang ?? ''}
                          onChange={(e) => updateField('tanggal_pulang', e.target.value)}
                          className="w-full h-[31px] px-1.5 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Frekuensi Hari Itu</label>
                        <input
                          type="number"
                          value={form.frekuensi_hari_itu ?? ''}
                          onChange={(e) =>
                            updateField('frekuensi_hari_itu', e.target.value === '' ? '' : Number(e.target.value))
                          }
                          className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Informasi Diagnosis (5 cols) */}
                  <div className="sm:col-span-5 bg-slate-50/70 rounded-lg p-2 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                        <Stethoscope size={12} className="text-primary" />
                        3. Informasi Diagnosis
                      </span>
                      <span className="text-[10px] text-slate-400">FKP14A, FKL17A</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Diagnosa FKTP</label>
                        <input
                          type="text"
                          value={form.diagnosa_fktp ?? ''}
                          onChange={(e) => updateField('diagnosa_fktp', e.target.value)}
                          placeholder="J06"
                          className="w-full h-[31px] px-2 text-xs font-mono uppercase rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Diagnosa FKRTL</label>
                        <input
                          type="text"
                          value={form.diagnosa_fkrtl ?? ''}
                          onChange={(e) => updateField('diagnosa_fkrtl', e.target.value)}
                          placeholder="Z09"
                          className="w-full h-[31px] px-2 text-xs font-mono uppercase rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Informasi Wilayah (CSS Grid 3 Kolom x 2 Baris) */}
                <div className="bg-slate-50/70 rounded-lg p-2 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                      <MapPin size={12} className="text-primary" />
                      4. Informasi Wilayah Faskes & Peserta
                    </span>
                    <span className="text-[10px] text-slate-400">Kode Wilayah Kemendagri / BPJS</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {/* Baris 1: Kabupaten */}
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Kabupaten FKTP (FKP06)</label>
                      <input
                        type="number"
                        value={form.kabupaten_fktp ?? ''}
                        onChange={(e) =>
                          updateField('kabupaten_fktp', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Kabupaten FKRTL (FKL06)</label>
                      <input
                        type="number"
                        value={form.kabupaten_fkrtl ?? ''}
                        onChange={(e) =>
                          updateField('kabupaten_fkrtl', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Kabupaten Peserta (PSTV10)</label>
                      <input
                        type="number"
                        value={form.kabupaten_peserta ?? ''}
                        onChange={(e) =>
                          updateField('kabupaten_peserta', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>

                    {/* Baris 2: Provinsi */}
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Provinsi FKTP (FKP05)</label>
                      <input
                        type="number"
                        value={form.provinsi_fktp ?? ''}
                        onChange={(e) =>
                          updateField('provinsi_fktp', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Provinsi FKRTL (FKL05)</label>
                      <input
                        type="number"
                        value={form.provinsi_fkrtl ?? ''}
                        onChange={(e) =>
                          updateField('provinsi_fkrtl', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Provinsi Peserta (PSTV09)</label>
                      <input
                        type="number"
                        value={form.provinsi_peserta ?? ''}
                        onChange={(e) =>
                          updateField('provinsi_peserta', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Informasi Biaya */}
                <div className="bg-slate-50/70 rounded-lg p-2 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10.5px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                      <DollarSign size={12} className="text-primary" />
                      5. Informasi Biaya Tagihan (IDR)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Rasio: {heuristics.ratio} | Selisih: Rp {Number(heuristics.diffCost).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Biaya Tagih (FKL47)</label>
                      <input
                        type="number"
                        value={form.biaya_tagih ?? ''}
                        onChange={(e) =>
                          updateField('biaya_tagih', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-semibold text-slate-600 mb-0.5">Biaya Verifikasi (FKL48)</label>
                      <input
                        type="number"
                        value={form.biaya_verifikasi ?? ''}
                        onChange={(e) =>
                          updateField('biaya_verifikasi', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full h-[31px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Bar of Form */}
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between mt-1 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedModal(true)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 hover:text-primary hover:bg-slate-100 px-2 py-1 rounded-md border border-border transition"
                  >
                    <SlidersHorizontal size={12} className="text-primary" />
                    <span>Parameter Lanjutan (21)</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScenario(scenario)}
                    title="Kembalikan nilai ke skenario terpilih"
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 px-1.5 py-1 rounded-md hover:bg-slate-100 transition"
                  >
                    <RefreshCw size={11} />
                    <span className="hidden sm:inline">Reset Skenario</span>
                  </button>
                </div>

                <div className="text-[10.5px] text-slate-400">
                  Total 37 Parameter Transaksi Siap (17 Utama + 21 Sekunder)
                </div>
              </div>
            </div>
          ) : (
            /* ================= JSON CODE EDITOR MODE ================= */
            <div className="flex-1 min-h-0 flex flex-col p-2.5">
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <FileJson size={14} className="text-primary" />
                  <span className="font-semibold text-slateText text-xs">Raw JSON Payload</span>
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">
                    TransactionRequest
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleFormatJson}
                    className="px-2 py-0.5 rounded border border-border text-[11px] text-slate-600 hover:bg-slate-50 transition"
                  >
                    Format JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="px-2 py-0.5 rounded border border-border text-[11px] text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1 transition"
                  >
                    {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    <span>{copied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                spellCheck={false}
                className="flex-1 min-h-0 w-full font-mono text-xs rounded-lg p-2.5 bg-slate-900 text-emerald-400 focus:outline-none focus:ring-1 focus:ring-primary border border-slate-700 resize-none leading-relaxed"
              />

              <div className="pt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>Payload akan disanitasi otomatis sebelum diprediksi oleh XGBoost model NIKITA.</span>
                <button
                  type="button"
                  onClick={() => setShowAdvancedModal(true)}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <SlidersHorizontal size={11} />
                  <span>Daftar Parameter Lengkap</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN: Ringkasan Parameter & Skenario Insight (32% ~ 4 cols) ================= */}
        <div className="col-span-12 lg:col-span-4 flex flex-col h-full min-h-0 gap-2 sm:gap-2.5">
          {/* Card 1: Skenario & Karakteristik Fraud */}
          <div className="bg-white rounded-xl border border-border p-2.5 sm:p-3 shadow-xs shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={12} className="text-primary" />
                Skenario & Heuristik Kasus
              </span>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  activeScenarioMeta.color === 'emerald'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : activeScenarioMeta.color === 'rose'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : activeScenarioMeta.color === 'purple'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {activeScenarioMeta.tag}
              </span>
            </div>

            <div className="flex items-start gap-2 mb-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
              <div
                className={`p-1.5 rounded-md shrink-0 ${
                  activeScenarioMeta.color === 'emerald'
                    ? 'bg-emerald-100 text-emerald-700'
                    : activeScenarioMeta.color === 'rose'
                    ? 'bg-rose-100 text-rose-700'
                    : activeScenarioMeta.color === 'purple'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                <ScenarioIcon size={16} />
              </div>
              <div className="text-xs">
                <div className="font-semibold text-slateText leading-tight">{SCENARIOS[scenario]?.label}</div>
                <div className="text-slate-500 text-[11px] leading-snug mt-0.5">
                  {activeScenarioMeta.summary}
                </div>
              </div>
            </div>

            <div className="text-[10.5px] text-slate-600 bg-primary/5 rounded-md p-1.5 border border-primary/10 flex items-start gap-1.5">
              <Info size={12} className="text-primary mt-0.5 shrink-0" />
              <span>{activeScenarioMeta.indicator}</span>
            </div>
          </div>

          {/* Card 2: Ringkasan Parameter & Live Audit Signals */}
          <div className="bg-white rounded-xl border border-border p-2.5 sm:p-3 shadow-xs flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  Live Audit Features (41 Fitur)
                </span>
                <span className="text-[10px] text-slate-400">Selaras Preprocessor</span>
              </div>

              {/* Parameter Metrics Grid */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-medium">Usia Saat Kunjungan</div>
                  <div className="text-xs font-bold text-slateText mt-0.5">{heuristics.ageLabel}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                  <div className="text-[10px] text-slate-400 font-medium">Durasi Rawat (FKL04-03)</div>
                  <div className="text-xs font-bold text-slateText mt-0.5">{heuristics.losLabel}</div>
                </div>
              </div>

              {/* 3 Core Fraud Signals from preprocessor.py */}
              <div className="space-y-1 mb-2">
                {/* 1. is_gender_mismatch */}
                <div
                  className={`flex items-center justify-between px-2 py-1 rounded-md border text-xs ${
                    heuristics.isGenderMismatch
                      ? 'bg-rose-50/80 border-rose-200 text-rose-800'
                      : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                  }`}
                >
                  <span className="text-[10.5px] font-medium flex items-center gap-1.5">
                    {heuristics.isGenderMismatch ? (
                      <AlertCircle size={12} className="text-rose-600 shrink-0" />
                    ) : (
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    )}
                    is_gender_mismatch
                  </span>
                  <span className="text-[10px] font-semibold">
                    {heuristics.isGenderMismatch ? 'Anomali Medis (1)' : 'Valid (0)'}
                  </span>
                </div>

                {/* 2. is_spatial_anomaly */}
                <div
                  className={`flex items-center justify-between px-2 py-1 rounded-md border text-xs ${
                    heuristics.isSpatialAnomaly
                      ? 'bg-amber-50/80 border-amber-200 text-amber-800'
                      : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                  }`}
                >
                  <span className="text-[10.5px] font-medium flex items-center gap-1.5">
                    {heuristics.isSpatialAnomaly ? (
                      <MapPin size={12} className="text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    )}
                    is_spatial_anomaly
                  </span>
                  <span className="text-[10px] font-semibold">
                    {heuristics.isSpatialAnomaly ? 'Beda Kab FKTP-FKRTL (1)' : 'Kabupaten Sama (0)'}
                  </span>
                </div>

                {/* 3. is_age_mismatch */}
                <div
                  className={`flex items-center justify-between px-2 py-1 rounded-md border text-xs ${
                    heuristics.isAgeMismatch
                      ? 'bg-purple-50/80 border-purple-200 text-purple-800'
                      : 'bg-emerald-50/50 border-emerald-100 text-emerald-800'
                  }`}
                >
                  <span className="text-[10.5px] font-medium flex items-center gap-1.5">
                    {heuristics.isAgeMismatch ? (
                      <AlertTriangle size={12} className="text-purple-600 shrink-0" />
                    ) : (
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    )}
                    is_age_mismatch
                  </span>
                  <span className="text-[10px] font-semibold">
                    {heuristics.isAgeMismatch ? 'Anak Degeneratif (1)' : 'Sesuai Usia (0)'}
                  </span>
                </div>

                {/* Financial Summary */}
                <div className="flex items-center justify-between px-2 py-1 rounded-md bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-[10.5px] font-medium text-slate-600 flex items-center gap-1.5">
                    <DollarSign size={12} className="text-slate-500 shrink-0" />
                    Klaim FKL47 vs FKL48
                  </span>
                  <span className="text-[10.5px] font-semibold text-slateText">
                    Rp {Number(form.biaya_tagih || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message if Any */}
            {error && (
              <div className="mb-2 flex items-start gap-1.5 text-danger text-[11px] bg-rose-50 border border-rose-200 rounded-lg p-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0 text-danger" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* Primary Action Button */}
            <div className="pt-1.5 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full h-10 bg-primary hover:bg-[#065287] active:scale-[0.99] text-white rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Menganalisis Model NIKITA...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} className="fill-current" />
                    <span>Jalankan Analisis Fraud</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
                <span>Model: XGBoost + Tree Rules</span>
                <span className="font-mono">API: /api/v1/predict</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ADVANCED PARAMETERS MODAL (21 Fields) ================= */}
      {showAdvancedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-border shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-slateText">Parameter Lanjutan (21 Field Sekunder)</h3>
                  <p className="text-[11px] text-slate-500">
                    Konfigurasi atribut sekunder faskes, kode INA-CBGs, dan kepesertaan sesuai schema TransactionRequest
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdvancedModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ADVANCED_FIELDS.map((key) => (
                  <div key={key} className="bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                    <label className="block text-[10.5px] font-medium text-slate-600 mb-0.5 truncate" title={key}>
                      {key.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="number"
                      value={form[key] ?? ''}
                      onChange={(e) =>
                        updateField(key, e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full h-[30px] px-2 text-xs rounded-md border border-border bg-white text-slateText focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-2.5 border-t border-border bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">21 parameter tersimpan di state form</span>
              <button
                type="button"
                onClick={() => setShowAdvancedModal(false)}
                className="px-4 py-1.5 bg-primary hover:bg-[#065287] text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}