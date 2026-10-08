import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Gauge,
  Goal,
  LayoutDashboard,
  ListFilter,
  Maximize,
  Minimize,
  MonitorPlay,
  Pause,
  PhoneCall,
  Play,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function apiFetch(endpoint, options = {}) {
  const config = {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  };

  return fetch(`${API_BASE}${endpoint}`, config)
    .then(async (res) => {
      const payload = await res.json().catch(() => ({ success: false, message: 'Erreur serveur' }));
      if (!res.ok || payload.success === false) {
        throw new Error(payload.message || 'Erreur serveur');
      }
      return payload.data;
    });
}

const navigation = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Classement Général', to: '/classement', icon: TrophyIcon },
  { label: 'Performance', to: '/performance', icon: TrendingUp },
  { label: 'Objectifs', to: '/objectifs', icon: Goal },
  { label: '3CX', to: '/3cx', icon: PhoneCall },
  { label: 'Portefeuille', to: '/portefeuille', icon: BriefcaseBusiness },
  { label: 'Contrôle', to: '/controle', icon: ShieldCheck },
  { label: 'Imports', to: '/imports', icon: Upload },
  { label: 'Historique', to: '/historique', icon: BarChart3 },
  { label: 'Gestionnaires', to: '/gestionnaires', icon: Users },
  { label: 'Mode TV', to: '/tv', icon: MonitorPlay },
];

function TrophyIcon(props) {
  return <BarChart3 {...props} />;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat('fr-FR').format(Number(value || 0));
}

function formatTaux(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDuration(totalSeconds) {
  const seconds = Number(totalSeconds || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainder}s`;
  }

  return `${remainder}s`;
}

function getStatusClass(status) {
  if (!status) return 'bg-slate-700 text-slate-100';
  const normalized = String(status).toUpperCase();
  if (normalized.includes('OK')) return 'bg-emerald-500/15 text-emerald-300';
  if (normalized.includes('ATTENTION')) return 'bg-amber-500/15 text-amber-300';
  return 'bg-rose-500/15 text-rose-300';
}

function StatCard({ label, value, accent, subtitle, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.35)] backdrop-blur"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{label}</span>
        <div className={`rounded-xl border border-white/10 bg-gradient-to-br ${accent} p-2`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="text-4xl font-black tracking-tight text-white md:text-5xl">{value}</div>
      {subtitle ? <div className="mt-3 text-sm text-slate-300">{subtitle}</div> : null}
    </motion.div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300">Vue</p>
        <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>
      </div>
      {subtitle ? <div className="text-sm text-slate-300">{subtitle}</div> : null}
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 flex-col border-r border-white/10 bg-slate-950/80 p-5 lg:flex">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-violet-600 text-xl font-black text-white shadow-lg shadow-cyan-500/30">
          PR
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">Pilotage</div>
          <div className="text-lg font-black text-white">Recouvrement</div>
        </div>
      </div>

      <nav className="space-y-2">
        {navigation.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-white ring-1 ring-cyan-400/30'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 p-4">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-cyan-300" />
          <span className="text-sm font-medium text-cyan-200">Refresh 60s</span>
        </div>
      </div>
    </aside>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const isTvMode = pathname === '/tv';

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 ${isTvMode ? 'tv-mode' : ''}`}>
      <div className={`mx-auto flex min-h-screen ${isTvMode ? 'w-full max-w-none' : 'max-w-[2200px]'}`}>
        {!isTvMode && <Sidebar />}
        <main className={`flex-1 ${isTvMode ? 'min-w-0 p-0' : 'p-4 sm:p-6 xl:p-8'}`}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/classement" element={<ClassementPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/objectifs" element={<ObjectifsPage />} />
            <Route path="/3cx" element={<ThreeCXPage />} />
            <Route path="/portefeuille" element={<PortefeuillePage />} />
            <Route path="/controle" element={<ControlePage />} />
            <Route path="/imports" element={<ImportsPage />} />
            <Route path="/historique" element={<HistoriquePage />} />
            <Route path="/gestionnaires" element={<GestionnairesPage />} />
            <Route path="/tv" element={<TVPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState([]);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceUnavailable, setPerformanceUnavailable] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiFetch('/dashboard')
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch(() => setData(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    apiFetch('/performance')
      .then((payload) => {
        if (mounted) setRanking(payload.ranking || []);
      })
      .catch(() => {
        if (mounted) setPerformanceUnavailable(true);
      })
      .finally(() => mounted && setPerformanceLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const chartData = useMemo(() => {
    return ranking.slice(0, 10).map((row) => ({
      label: row.manager,
      commission: Number(row.commission || 0),
      objectif: Number(row.objectif || 0),
    }));
  }, [ranking]);

  if (loading) {
    return <div className="text-slate-300">Chargement du dashboard…</div>;
  }

  if (!data) {
    return <EmptyState title="Aucune donnée disponible" description="Importer un fichier ou vérifier la base Neon." />;
  }

  return (
    <>
      <SectionTitle title="Dashboard" subtitle="Vue globale du portefeuille" />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total commission" value={formatCurrency(data.totalCommission)} accent="from-cyan-500 to-blue-600" icon={Wallet} subtitle="Progression actuelle" />
        <StatCard label="Total encaissement" value={formatCurrency(data.totalEncaissement)} accent="from-violet-500 to-purple-600" icon={TrendingUp} subtitle="Évolution" />
        <StatCard label="Total objectif" value={formatCurrency(data.totalObjectif)} accent="from-amber-500 to-orange-600" icon={Goal} subtitle="Cible du mois" />
        <StatCard label="Taux global" value={formatTaux(data.tauxGlobal)} accent="from-emerald-500 to-teal-600" icon={Gauge} subtitle="Commission / objectif" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Performance actuelle par gestionnaire</h3>
              <p className="mt-1 text-sm text-slate-400">Commission réalisée comparée à l’objectif • Top 10 par taux d’atteinte</p>
            </div>
            <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">Vue actuelle</div>
          </div>
          <div className="h-[22rem]">
            {performanceLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Chargement des performances…</div>
            ) : performanceUnavailable ? (
              <div className="flex h-full items-center justify-center text-sm text-rose-300">Les performances n’ont pas pu être chargées.</div>
            ) : chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 12, left: 8, bottom: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="label" stroke="#94a3b8" angle={-30} textAnchor="end" interval={0} height={78} tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value, name) => [formatCurrency(value), name === 'commission' ? 'Commission' : 'Objectif']}
                  />
                  <Legend formatter={(value) => value === 'commission' ? 'Commission' : 'Objectif'} />
                  <Bar dataKey="objectif" name="objectif" radius={[6, 6, 0, 0]} fill="#818cf8" />
                  <Bar dataKey="commission" name="commission" radius={[6, 6, 0, 0]} fill="#22d3ee" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Aucune performance importée à afficher.</div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h3 className="mb-4 text-xl font-bold text-white">Indicateurs clés</h3>
          <div className="space-y-4">
            <InfoRow label="Nombre total de dossiers" value={formatNumber(data.totalDossiers)} />
            <InfoRow label="Solde total portefeuille" value={formatCurrency(data.soldeTotalPortefeuille)} />
            <InfoRow label="Nombre total d'appels" value={formatNumber(data.totalAppels)} />
            <InfoRow label="Durée totale des appels" value={formatDuration(data.dureeTotaleAppels)} />
          </div>
        </motion.div>
      </div>
    </>
  );
}

function ClassementPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiFetch('/classement')
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .catch(() => setData(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="text-slate-300">Chargement du classement…</div>;

  if (!data || data.enabled === false || !data.rows?.length) {
    return (
      <EmptyState
        title="Classement général non configuré"
        description="Importez un fichier de classement contenant les gestionnaires et leurs résultats pour afficher cet écran."
      />
    );
  }

  const topThree = data.topManagers || data.rows.slice(0, 3);
  const rest = data.rows.slice(3);

  return (
    <>
      <SectionTitle title="Classement Général" subtitle="Ordre de performance global" />
      <div className="grid gap-5 xl:grid-cols-3">
        {topThree.map((row, index) => (
          <motion.div key={row.id || row.manager || index} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className={`rounded-3xl border ${index === 0 ? 'border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 to-indigo-500/10' : 'border-white/10 bg-white/5'} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-2xl font-black text-white">#{index + 1}</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs uppercase tracking-[0.2em] text-slate-100">Top {index + 1}</span>
            </div>
            <div className="flex items-center gap-4">
              <img src={row.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e'} alt={row.manager || row.nom} className="h-20 w-20 rounded-2xl object-cover ring-2 ring-white/10" />
              <div>
                <div className="text-xl font-bold text-white">{row.manager || row.nom}</div>
                <div className="text-slate-300">Score: {row.score || row.taux || 0}%</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-4 grid grid-cols-[40px_1.2fr_0.8fr_0.8fr] gap-4 px-2 text-[10px] uppercase tracking-[0.28em] text-slate-400">
          <span>Rang</span>
          <span>Gestionnaire</span>
          <span>Score</span>
          <span>Résultat</span>
        </div>
        {rest.length ? rest.map((row, index) => (
          <div key={row.id || row.manager || index} className="mb-3 grid grid-cols-[40px_1.2fr_0.8fr_0.8fr] items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-3 text-white">
            <div className="text-lg font-bold text-cyan-300">#{index + 4}</div>
            <div className="flex items-center gap-3">
              <img src={row.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e'} alt={row.manager || row.nom} className="h-10 w-10 rounded-xl object-cover" />
              <span className="font-semibold">{row.manager || row.nom}</span>
            </div>
            <span>{row.score || row.taux || 0}%</span>
            <span>{formatCurrency(row.commission || 0)}</span>
          </div>
        )) : <div className="text-slate-400">Aucun autre gestionnaire.</div>}
      </div>
    </>
  );
}

function PerformancePage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch('/performance')
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return <EmptyState title="Performance indisponible" description="Aucune donnée de performance détectée." />;

  return (
    <>
      <SectionTitle title="Performance" subtitle="Classement décroissant sur le taux" />
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-4 grid grid-cols-[50px_1.3fr_0.8fr_0.9fr_0.9fr] gap-3 px-2 text-[10px] uppercase tracking-[0.28em] text-slate-400">
          <span>Rang</span>
          <span>Gestionnaire</span>
          <span>Commission</span>
          <span>Objectif</span>
          <span>Taux</span>
        </div>
        {data.ranking?.map((row) => (
          <div key={row.manager} className="mb-3 grid grid-cols-[50px_1.3fr_0.8fr_0.9fr_0.9fr] items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-3 text-white">
            <div className="text-xl font-black text-cyan-300">#{row.rank}</div>
            <div className="flex items-center gap-3">
              <img src={row.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e'} alt={row.manager} className="h-12 w-12 rounded-xl object-cover" />
              <span className="font-semibold">{row.manager}</span>
            </div>
            <span>{formatCurrency(row.commission)}</span>
            <span>{formatCurrency(row.objectif)}</span>
            <span className="font-bold text-emerald-300">{formatTaux(row.taux)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ObjectifsPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    apiFetch('/objectifs')
      .then((payload) => setRows(payload.rows || payload))
      .catch(() => setRows([]));
  }, []);

  return (
    <>
      <SectionTitle title="Objectifs" subtitle="Progression par gestionnaire" />
      <div className="space-y-4">
        {rows.length ? rows.map((row) => (
          <div key={row.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src={row.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e'} alt={row.name} className="h-12 w-12 rounded-xl object-cover" />
                <div>
                  <div className="font-bold text-white">{row.name}</div>
                  <div className="text-sm text-slate-300">{formatCurrency(row.commission)} / {formatCurrency(row.objectif)}</div>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">{formatTaux(row.taux)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${Math.min(100, Number(row.progression || 0))}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-300">
              <span>Écart: {formatCurrency(row.ecart)}</span>
              <span>Progression: {Number(row.progression || 0).toFixed(1)}%</span>
            </div>
          </div>
        )) : <EmptyState title="Aucune donnée d'objectifs" description="Aucun élément n'a été importé pour le moment." />}
      </div>
    </>
  );
}

function PortefeuillePage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch('/portefeuille')
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) return <EmptyState title="Portefeuille indisponible" description="Aucun portefeuille n'est encore disponible." />;

  return (
    <>
      <SectionTitle title="Portefeuille" subtitle="Analyse globale du portefeuille" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total dossiers" value={formatNumber(data.totalDossiers)} accent="from-cyan-500 to-blue-600" icon={BriefcaseBusiness} subtitle="Dossiers actifs" />
        <StatCard label="Solde total" value={formatCurrency(data.soldeTotal)} accent="from-violet-500 to-purple-600" icon={Wallet} subtitle="Montant du portefeuille" />
        <StatCard label="Nouveaux dossiers" value={formatNumber(data.nouveauxDossiers)} accent="from-amber-500 to-orange-600" icon={Building2} subtitle="Période récente" />
        <StatCard label="Dossiers non affectés" value={formatNumber(data.dossiersSansGestionnaire)} accent="from-rose-500 to-red-600" icon={ListFilter} subtitle="À traiter" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <CardList title="Par gestionnaire" rows={data.byManager || []} valueKey="dossiers" />
        <CardList title="Par statut" rows={data.byStatus || []} valueKey="value" />
      </div>
    </>
  );
}

function ControlePage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch('/controle')
      .then((payload) => setData(payload.issues || payload))
      .catch(() => setData([]));
  }, []);

  return (
    <>
      <SectionTitle title="Contrôle qualité" subtitle="Indicateurs de santé des données" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data || []).map((item) => (
          <div key={item.title} className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-white">{item.title}</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getStatusClass(item.status)}`}>{item.status}</span>
            </div>
            <div className="text-3xl font-black text-white">{item.count || 0}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function ImportsPage() {
  const [results, setResults] = useState([]);
  const [fileMap, setFileMap] = useState({ performance: null, portefeuille: null });

  useEffect(() => {
    apiFetch('/imports')
      .then((payload) => setResults(payload.rows || payload))
      .catch(() => setResults([]));
  }, []);

  const submitImport = async (type) => {
    const file = fileMap[type];
    if (!file) {
      alert('Veuillez sélectionner un fichier Excel.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    try {
      const imported = await apiFetch(`/imports/${type}`, {
        method: 'POST',
        body: formData,
      });
      const importedCount = Number(imported?.stats?.importees || 0);
      alert(`Import réussi : ${formatNumber(importedCount)} ligne(s) importée(s).`);
      const updated = await apiFetch('/imports');
      setResults(updated.rows || updated);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <>
      <SectionTitle title="Imports" subtitle="Import des fichiers Excel" />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-4 text-xl font-bold text-white">Type 1 : Performance</h3>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFileMap((prev) => ({ ...prev, performance: e.target.files?.[0] || null }))} className="mb-4 block w-full text-sm text-slate-300 file:mr-4 file:rounded-2xl file:border-0 file:bg-cyan-500 file:px-4 file:py-3 file:font-semibold file:text-slate-950" />
          <button onClick={() => submitImport('performance')} className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 font-bold text-white">Importer performance</button>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-4 text-xl font-bold text-white">Type 2 : Portefeuille</h3>
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFileMap((prev) => ({ ...prev, portefeuille: e.target.files?.[0] || null }))} className="mb-4 block w-full text-sm text-slate-300 file:mr-4 file:rounded-2xl file:border-0 file:bg-violet-500 file:px-4 file:py-3 file:font-semibold file:text-white" />
          <button onClick={() => submitImport('portefeuille')} className="rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-3 font-bold text-white">Importer portefeuille</button>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-4 grid grid-cols-[1.3fr_0.8fr_0.6fr_0.6fr_0.6fr] gap-3 px-2 text-[10px] uppercase tracking-[0.28em] text-slate-400">
          <span>Fichier</span>
          <span>Date</span>
          <span>Lignes</span>
          <span>Importées</span>
          <span>Statut</span>
        </div>
        {(results || []).map((row) => (
          <div key={`${row.nom_fichier}-${row.date_import}`} className="mb-3 grid grid-cols-[1.3fr_0.8fr_0.6fr_0.6fr_0.6fr] items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-3 text-white">
            <span>{row.nom_fichier}</span>
            <span>{row.date_import ? new Date(row.date_import).toLocaleDateString('fr-FR') : '—'}</span>
            <span>{row.nombre_lignes || row.lignes || 0}</span>
            <span>{row.lignes_importees || row.importees || 0}</span>
            <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-bold ${getStatusClass(row.statut)}`}>{row.statut || 'OK'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function ThreeCXPage() {
  const [kpi, setKpi] = useState(null);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    apiFetch('/3cx/kpi').then(setKpi).catch(() => setKpi(null));
    apiFetch('/3cx').then((payload) => setCalls(payload || [])).catch(() => setCalls([]));
  }, []);

  return (
    <>
      <SectionTitle title="3CX" subtitle="Suivi des appels et rattachement" />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total appels" value={formatNumber(kpi?.totalAppels || 0)} accent="from-cyan-500 to-blue-600" icon={PhoneCall} subtitle="Appels synchronisés" />
        <StatCard label="Durée totale" value={formatDuration(kpi?.dureeTotale || 0)} accent="from-violet-500 to-purple-600" icon={Gauge} subtitle="Temps de conversation" />
        <StatCard label="Appels non rattachés" value={formatNumber(kpi?.appelsNonRattaches || 0)} accent="from-rose-500 to-red-600" icon={CircleDashed} subtitle="À vérifier" />
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h3 className="mb-4 text-xl font-bold text-white">Appels récents</h3>
        <div className="space-y-3">
          {calls.slice(0, 8).map((call) => (
            <div key={call.call_id || call.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
              <div>
                <div className="font-semibold text-white">{call.numero_client || call.numero_appelant || '—'}</div>
                <div className="text-slate-400">{call.direction} • {call.statut || 'answered'}</div>
              </div>
              <div className="text-right">
                <div>{call.date_debut ? new Date(call.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                <div className="text-cyan-300">{formatDuration(call.duree || 0)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function HistoriquePage() {
  const [data, setData] = useState([]);

  useEffect(() => {
    apiFetch('/historique')
      .then((payload) => setData(payload.periods || payload))
      .catch(() => setData([]));
  }, []);

  return (
    <>
      <SectionTitle title="Historique" subtitle="Évolution sur la période" />
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-4 grid grid-cols-[0.7fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-2 text-[10px] uppercase tracking-[0.28em] text-slate-400">
          <span>Période</span>
          <span>Commission</span>
          <span>Encaissement</span>
          <span>Objectif</span>
          <span>Taux</span>
          <span>Appels</span>
        </div>
        {(data || []).map((row) => (
          <div key={row.label} className="mb-3 grid grid-cols-[0.7fr_1fr_1fr_1fr_1fr_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-3 text-white">
            <span className="font-semibold">{row.label}</span>
            <span>{formatCurrency(row.commission)}</span>
            <span>{formatCurrency(row.encaissement)}</span>
            <span>{formatCurrency(row.objectif)}</span>
            <span>{Number(row.taux || 0).toFixed(1)}%</span>
            <span>{formatNumber(row.appels)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function GestionnairesPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    apiFetch('/gestionnaires')
      .then((payload) => setItems(payload.rows || payload))
      .catch(() => setItems([]));
  }, []);

  return (
    <>
      <SectionTitle title="Gestionnaires" subtitle="Liste, statut et extensions 3CX" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(items || []).map((item) => (
          <div key={item.id || item.gestionnaire_id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex items-center gap-3">
              <img src={item.photo_url || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e'} alt={`${item.prenom || ''} ${item.nom || ''}`} className="h-16 w-16 rounded-2xl object-cover" />
              <div>
                <div className="font-bold text-white">{item.prenom || ''} {item.nom || ''}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">3CX {item.extension_3cx || '—'}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span>Statut</span>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.actif === false ? 'bg-rose-500/10 text-rose-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                {item.actif === false ? 'Inactif' : 'Actif'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const tvScreens = [
  { id: 'dashboard', label: 'Vue générale' },
  { id: 'podium', label: 'Le podium' },
  { id: 'last-three', label: 'Les trois derniers' },
  { id: 'performance', label: 'Performance' },
  { id: 'objectives', label: 'Objectifs' },
  { id: 'portfolio', label: 'Portefeuille' },
  { id: 'calls', label: 'Activité 3CX' },
];

function TVSlideHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.45em] text-cyan-300">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl">{title}</h1>
      {subtitle && <p className="mt-3 text-lg text-slate-400 md:text-xl">{subtitle}</p>}
    </div>
  );
}

function TVAvatar({ name, className = 'h-20 w-20' }) {
  const initials = String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-cyan-400/30 to-indigo-500/40 font-black text-white ${className}`}>
      {initials || '?'}
    </div>
  );
}

function TVRankingSlide({ variant }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiFetch('/classement')
      .then((payload) => mounted && setData(payload))
      .catch(() => mounted && setData(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="py-24 text-center text-xl text-slate-300">Chargement du classement…</div>;
  if (!data?.rows?.length) {
    return <EmptyState title="Classement indisponible" description="Importez un classement pour afficher les résultats en mode TV." />;
  }

  if (variant === 'podium') {
    const topThree = data.rows.slice(0, 3);
    const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
    const podiumHeights = {
      1: 'min-h-[52vh]',
      2: 'min-h-[40vh]',
      3: 'min-h-[34vh]',
    };

    return (
      <section className="flex min-h-[calc(100vh-10rem)] flex-col justify-center py-8">
        <TVSlideHeading eyebrow="Classement général" title="Le podium" subtitle="Les trois meilleures performances" />
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-end gap-5 sm:grid-cols-3 sm:gap-7">
          {podiumOrder.map((row, index) => {
            const isFirst = Number(row.rank) === 1;
            const rank = Number(row.rank || index + 1);
            return (
              <motion.div
                key={row.id || row.manager}
                initial={{ opacity: 0, y: 70, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.65, delay: index * 0.16, ease: 'easeOut' }}
                className={`relative flex ${podiumHeights[rank] || 'min-h-[34vh]'} flex-col items-center justify-center overflow-hidden rounded-[2rem] border p-6 text-center shadow-2xl ${
                  isFirst
                    ? 'border-amber-300/60 bg-gradient-to-b from-amber-300/25 via-amber-500/10 to-slate-900/80 shadow-amber-500/10 sm:-translate-y-8'
                    : rank === 2
                      ? 'border-slate-300/30 bg-gradient-to-b from-slate-300/15 to-slate-900/80'
                      : 'border-orange-300/30 bg-gradient-to-b from-orange-500/15 to-slate-900/80'
                }`}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black ${isFirst ? 'bg-amber-300 text-slate-950' : 'bg-white/10 text-white'}`}>
                  {rank}
                </div>
                <TVAvatar name={row.manager} className={isFirst ? 'h-28 w-28 text-3xl' : 'h-20 w-20 text-2xl'} />
                <h2 className={`mt-5 font-black text-white ${isFirst ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'}`}>{row.manager}</h2>
                <p className={`mt-3 font-black ${isFirst ? 'text-4xl text-amber-200' : 'text-3xl text-cyan-200'}`}>{formatTaux(row.score ?? row.taux)}</p>
                <p className="mt-2 text-sm uppercase tracking-[0.25em] text-slate-400">Taux d’atteinte</p>
                <p className="mt-4 text-base text-slate-300">{formatCurrency(row.commission)} de commission</p>
              </motion.div>
            );
          })}
        </div>
      </section>
    );
  }

  const lastThree = data.rows.slice(-3).reverse();
  return (
    <section className="flex min-h-[calc(100vh-10rem)] flex-col justify-center py-8">
      <TVSlideHeading eyebrow="Classement général" title="Les trois derniers" subtitle="Un accompagnement ciblé pour relancer la progression" />
      <div className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-3">
        {lastThree.map((row, index) => (
          <motion.div
            key={row.id || row.manager}
            initial={{ opacity: 0, x: 55 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: index * 0.14 }}
            className="rounded-[2rem] border border-rose-400/40 bg-gradient-to-br from-rose-500/20 via-red-950/50 to-slate-950 p-7 shadow-xl shadow-rose-950/30"
          >
            <div className="mb-7 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-[0.3em] text-rose-200">Rang #{row.rank}</span>
              <span className="rounded-full border border-rose-300/30 bg-rose-400/10 px-3 py-1 text-xs font-bold text-rose-200">À ACCOMPAGNER</span>
            </div>
            <TVAvatar name={row.manager} className="h-20 w-20 border-rose-300/30 bg-gradient-to-br from-rose-400/30 to-red-700/40 text-2xl" />
            <h2 className="mt-6 text-2xl font-black text-white md:text-3xl">{row.manager}</h2>
            <div className="mt-6 text-4xl font-black text-rose-200">{formatTaux(row.score ?? row.taux)}</div>
            <p className="mt-2 text-sm uppercase tracking-[0.25em] text-rose-100/60">Taux d’atteinte</p>
            <div className="mt-6 flex justify-between border-t border-rose-200/15 pt-4 text-sm text-slate-300">
              <span>Commission</span>
              <span className="font-bold text-white">{formatCurrency(row.commission)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function TVPerformanceSlide({ objectives = false }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiFetch('/performance')
      .then((payload) => mounted && setData(payload))
      .catch(() => mounted && setData(null));
    return () => {
      mounted = false;
    };
  }, []);

  if (!data) return <EmptyState title="Données indisponibles" description="Aucune donnée de performance n’est disponible pour cet écran." />;

  const rows = (data.ranking || []).slice(0, objectives ? 6 : 8);
  return (
    <section className="py-5">
      <TVSlideHeading
        eyebrow={objectives ? 'Suivi des objectifs' : 'Résultats de l’équipe'}
        title={objectives ? 'Progression des objectifs' : 'Performance'}
        subtitle={objectives ? 'Avancement de la commission par rapport aux objectifs' : 'Les meilleurs taux de réalisation'}
      />
      <div className="mx-auto mb-7 grid max-w-5xl gap-4 sm:grid-cols-3">
        {[
          { label: 'Commission', value: formatCurrency(data.kpis?.totalCommission), color: 'text-cyan-200' },
          { label: 'Objectif total', value: formatCurrency(data.kpis?.totalObjectif), color: 'text-violet-200' },
          { label: 'Atteinte globale', value: formatTaux(data.kpis?.tauxGlobal), color: 'text-emerald-200' },
        ].map((item) => (
          <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
            <p className={`mt-3 text-3xl font-black ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2">
        {rows.map((row, index) => {
          const progress = Math.max(0, Math.min(100, Number(row.taux || 0)));
          return (
            <motion.div
              key={row.manager}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-lg font-black text-cyan-300">#{row.rank}</span>
                  <span className="truncate text-lg font-bold text-white">{row.manager}</span>
                </div>
                <span className="text-xl font-black text-emerald-200">{formatTaux(row.taux)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.9, delay: index * 0.06 }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                />
              </div>
              <div className="mt-2 flex justify-between text-sm text-slate-400">
                <span>{formatCurrency(row.commission)}</span>
                <span>Objectif {formatCurrency(row.objectif)}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

function TVPortfolioSlide() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiFetch('/portefeuille')
      .then((payload) => mounted && setData(payload))
      .catch(() => mounted && setData(null));
    return () => {
      mounted = false;
    };
  }, []);

  if (!data) return <EmptyState title="Portefeuille indisponible" description="Les indicateurs du portefeuille n’ont pas pu être chargés." />;

  const managers = [...(data.byManager || [])].sort((a, b) => Number(b.dossiers || 0) - Number(a.dossiers || 0)).slice(0, 8);
  const maxDossiers = Math.max(1, ...managers.map((row) => Number(row.dossiers || 0)));
  return (
    <section className="py-8">
      <TVSlideHeading eyebrow="Vue portefeuille" title="Portefeuille dossiers" subtitle="Répartition et points d’attention" />
      <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Dossiers', value: formatNumber(data.totalDossiers), color: 'text-cyan-200' },
          { label: 'Solde total', value: formatCurrency(data.soldeTotal), color: 'text-violet-200' },
          { label: 'Nouveaux dossiers', value: formatNumber(data.nouveauxDossiers), color: 'text-amber-200' },
          { label: 'Non affectés', value: formatNumber(data.dossiersSansGestionnaire), color: 'text-rose-200' },
        ].map((item) => (
          <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
            <p className={`mt-3 text-3xl font-black ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-6 max-w-6xl rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-5 text-xl font-bold text-white">Principales répartitions par gestionnaire</h2>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {managers.map((row, index) => (
            <div key={row.name || index}>
              <div className="mb-2 flex justify-between gap-4 text-sm">
                <span className="truncate font-semibold text-slate-200">{row.name || row.label}</span>
                <span className="font-black text-cyan-200">{formatNumber(row.dossiers)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-400" style={{ width: `${Math.max(3, Number(row.dossiers || 0) / maxDossiers * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TVSlideContent({ screenId }) {
  switch (screenId) {
    case 'dashboard':
      return <DashboardPage />;
    case 'podium':
      return <TVRankingSlide variant="podium" />;
    case 'last-three':
      return <TVRankingSlide variant="last-three" />;
    case 'performance':
      return <TVPerformanceSlide />;
    case 'objectives':
      return <TVPerformanceSlide objectives />;
    case 'portfolio':
      return <TVPortfolioSlide />;
    case 'calls':
      return <ThreeCXPage />;
    default:
      return null;
  }
}

function TVPage() {
  const [screenIndex, setScreenIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fullscreenError, setFullscreenError] = useState('');
  const navigate = useNavigate();
  const activeScreen = tvScreens[screenIndex];

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => {
      setScreenIndex((current) => (current + 1) % tvScreens.length);
    }, 18000);
    return () => clearInterval(timer);
  }, [paused]);

  const changeScreen = (direction) => {
    setScreenIndex((current) => (current + direction + tvScreens.length) % tvScreens.length);
  };

  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFullscreenError('Le plein écran n’est pas autorisé par ce navigateur.');
    }
  };

  const leaveTVMode = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-black px-4 py-4 md:px-8 md:py-6">
      <header className="z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-lg font-black text-white shadow-lg shadow-cyan-500/20">PR</div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-300">Pilotage recouvrement • Mode TV</p>
            <h2 className="mt-1 text-xl font-black text-white md:text-2xl">{activeScreen.label}</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button aria-label="Écran précédent" onClick={() => changeScreen(-1)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-white transition hover:bg-white/15">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setPaused((value) => !value)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? 'Reprendre' : 'Pause'}
          </button>
          <button aria-label="Écran suivant" onClick={() => changeScreen(1)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-white transition hover:bg-white/15">
            <ChevronRight className="h-5 w-5" />
          </button>
          <button onClick={toggleFullscreen} className="flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            {isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          </button>
          <button onClick={leaveTVMode} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/15">
            <ArrowLeft className="h-4 w-4" />
            Quitter TV
          </button>
        </div>
      </header>

      {fullscreenError && <p role="alert" className="mt-3 text-right text-sm text-rose-300">{fullscreenError}</p>}

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen.id}
            initial={{ opacity: 0, x: 48, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -48, filter: 'blur(8px)' }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
            className="h-full"
          >
            <TVSlideContent screenId={activeScreen.id} />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-auto flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        <span>{paused ? 'Lecture en pause' : 'Défilement automatique'}</span>
        <div className="flex items-center gap-2">
          {tvScreens.map((screen, index) => (
            <button
              key={screen.id}
              aria-label={`Afficher ${screen.label}`}
              aria-current={index === screenIndex ? 'step' : undefined}
              onClick={() => setScreenIndex(index)}
              className={`h-2.5 rounded-full transition-all ${index === screenIndex ? 'w-9 bg-cyan-300' : 'w-2.5 bg-white/20 hover:bg-white/50'}`}
            />
          ))}
        </div>
        <span>{String(screenIndex + 1).padStart(2, '0')} / {String(tvScreens.length).padStart(2, '0')}</span>
      </footer>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center">
      <div>
        <div className="text-3xl font-black text-white">{title}</div>
        <p className="mt-2 max-w-xl text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function CardList({ title, rows = [], valueKey = 'value' }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 text-xl font-bold text-white">{title}</h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.name || row.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-2">
            <span className="text-slate-200">{row.name || row.label}</span>
            <span className="font-bold text-cyan-300">{row[valueKey] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-3">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
