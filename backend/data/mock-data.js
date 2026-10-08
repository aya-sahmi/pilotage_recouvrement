const numeric = (value) => Number(value) || 0;

const managerRows = [
  {
    id: 1,
    nom: 'Martin',
    prenom: 'Sofia',
    photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    extension_3cx: '101',
    actif: true,
    commission: 142500,
    objectif: 120000,
    encaissement: 245000,
    taux: 118.75,
    appels: 94,
    duree_appels: 14800,
  },
  {
    id: 2,
    nom: 'Lemoine',
    prenom: 'Hugo',
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    extension_3cx: '102',
    actif: true,
    commission: 131400,
    objectif: 125000,
    encaissement: 231000,
    taux: 105.12,
    appels: 86,
    duree_appels: 13120,
  },
  {
    id: 3,
    nom: 'Dupont',
    prenom: 'Claire',
    photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
    extension_3cx: '103',
    actif: true,
    commission: 118900,
    objectif: 110000,
    encaissement: 214000,
    taux: 108.09,
    appels: 71,
    duree_appels: 11640,
  },
  {
    id: 4,
    nom: 'Bernard',
    prenom: 'Nicolas',
    photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    extension_3cx: '104',
    actif: false,
    commission: 84000,
    objectif: 105000,
    encaissement: 170000,
    taux: 80,
    appels: 46,
    duree_appels: 7300,
  },
];

const dossierRows = [
  { id: 1, gestionnaire_id: 1, statut: 'En cours', type_lot: 'Social', solde: 124500, telephone_normalise: '+33601020304', historique: 'Récupération en cours' },
  { id: 2, gestionnaire_id: 1, statut: 'Relance', type_lot: 'Foncier', solde: 94500, telephone_normalise: '+33611121314', historique: 'Premier contact' },
  { id: 3, gestionnaire_id: 2, statut: 'À traiter', type_lot: 'Télécom', solde: 78000, telephone_normalise: '+33621222324', historique: 'Nouveau dossier' },
  { id: 4, gestionnaire_id: 2, statut: 'En cours', type_lot: 'Social', solde: 116400, telephone_normalise: '+33631323334', historique: 'Revu le 14/04' },
  { id: 5, gestionnaire_id: 3, statut: 'Clos', type_lot: 'Banque', solde: 20000, telephone_normalise: '+33641424344', historique: 'Dossier clôturé' },
  { id: 6, gestionnaire_id: null, statut: 'Sans gestionnaire', type_lot: 'Assurance', solde: 34000, telephone_normalise: '+33651525354', historique: 'Nouveau' },
];

const appelRows = [
  { id: 1, call_id: 'CX-101', extension: '101', direction: 'inbound', numero_appelant: '+33601020304', numero_destinataire: '101', numero_client: '+33601020304', date_debut: '2026-10-08T09:15:00Z', date_fin: '2026-10-08T09:27:00Z', duree: 720, statut: 'answered', gestionnaire_id: 1 },
  { id: 2, call_id: 'CX-102', extension: '103', direction: 'outbound', numero_appelant: '+33621222324', numero_destinataire: '103', numero_client: '+33621222324', date_debut: '2026-10-08T10:00:00Z', date_fin: '2026-10-08T10:12:00Z', duree: 720, statut: 'answered', gestionnaire_id: 3 },
  { id: 3, call_id: 'CX-103', extension: '110', direction: 'inbound', numero_appelant: '+33699999999', numero_destinataire: '110', numero_client: '+33699999999', date_debut: '2026-10-08T11:40:00Z', date_fin: '2026-10-08T11:46:00Z', duree: 360, statut: 'missed', gestionnaire_id: null },
];

const dashboard = {
  totalCommission: 472800,
  totalEncaissement: 860200,
  totalObjectif: 460000,
  tauxGlobal: (472800 / 460000) * 100,
  totalDossiers: 142,
  soldeTotalPortefeuille: 5842000,
  totalAppels: 362,
  dureeTotaleAppels: 41280,
  trend: [
    { label: 'Jan', value: 72 },
    { label: 'Fév', value: 80 },
    { label: 'Mar', value: 78 },
    { label: 'Avr', value: 94 },
    { label: 'Mai', value: 90 },
    { label: 'Jui', value: 101 },
  ],
  byManager: managerRows.map((row) => ({
    name: `${row.prenom} ${row.nom}`,
    commission: row.commission,
    objectif: row.objectif,
    taux: row.taux,
  })),
};

const performance = {
  totalCommission: dashboard.totalCommission,
  totalObjectif: dashboard.totalObjectif,
  tauxGlobal: dashboard.tauxGlobal,
  ranking: managerRows
    .slice()
    .sort((a, b) => numeric(b.taux) - numeric(a.taux))
    .map((row, index) => ({
      rank: index + 1,
      manager: `${row.prenom} ${row.nom}`,
      photo_url: row.photo_url,
      commission: row.commission,
      objectif: row.objectif,
      taux: row.taux,
      appels: row.appels,
    })),
  kpis: {
    totalCommission: dashboard.totalCommission,
    totalObjectif: dashboard.totalObjectif,
    tauxGlobal: dashboard.tauxGlobal,
    totalAppels: dashboard.totalAppels,
  },
};

const classement = {
  enabled: false,
  message: 'Le classement général n\'est pas encore configuré. Importez ou configurez la table classement_general.',
  topManagers: [],
  rows: [],
};

const objectifs = {
  rows: managerRows.map((row) => ({
    id: row.id,
    name: `${row.prenom} ${row.nom}`,
    objectif: row.objectif,
    commission: row.commission,
    taux: row.taux,
    ecart: row.commission - row.objectif,
    progression: (row.commission / row.objectif) * 100,
    photo_url: row.photo_url,
  })),
};

const portefeuille = {
  totalDossiers: 142,
  soldeTotal: 5842000,
  byManager: managerRows.map((row) => ({
    name: `${row.prenom} ${row.nom}`,
    dossiers: 28 + row.id * 3,
    solde: row.encaissement,
  })),
  byStatus: [
    { name: 'En cours', value: 48 },
    { name: 'Relance', value: 31 },
    { name: 'À traiter', value: 22 },
    { name: 'Clos', value: 19 },
  ],
  byTypeLot: [
    { name: 'Social', value: 54 },
    { name: 'Foncier', value: 28 },
    { name: 'Télécom', value: 17 },
    { name: 'Banque', value: 11 },
  ],
  nouveauxDossiers: 19,
  dossiersSansGestionnaire: 6,
};

const controle = {
  issues: [
    { title: 'Gestionnaires sans extension 3CX', status: 'ATTENTION', count: 2 },
    { title: 'Gestionnaires sans photo', status: 'OK', count: 0 },
    { title: 'Dossiers sans gestionnaire', status: 'ATTENTION', count: 6 },
    { title: 'Dossiers avec téléphone invalide', status: 'ERREUR', count: 14 },
    { title: 'Doublons potentiels', status: 'ATTENTION', count: 3 },
    { title: 'Lignes Excel en erreur', status: 'ERREUR', count: 8 },
    { title: 'Appels non rattachés', status: 'ERREUR', count: 1 },
    { title: 'Gestionnaires dans Excel inconnus', status: 'OK', count: 0 },
  ],
};

const gestionnaires = {
  rows: managerRows.map((row) => ({
    id: row.id,
    nom: row.nom,
    prenom: row.prenom,
    photo_url: row.photo_url,
    extension_3cx: row.extension_3cx,
    actif: row.actif,
  })),
};

const threeCx = {
  kpis: {
    totalAppels: dashboard.totalAppels,
    dureeTotale: dashboard.dureeTotaleAppels,
    tauxRattachement: 93,
    appelsNonRattaches: 8,
  },
  calls: appelRows,
  nonRattaches: appelRows.filter((call) => !call.gestionnaire_id),
  byManager: managerRows.map((row) => ({
    id: row.id,
    name: `${row.prenom} ${row.nom}`,
    totalAppels: row.appels,
    duree: row.duree_appels,
  })),
};

const historique = {
  periods: [
    { label: 'Jan', commission: 310000, encaissement: 520000, objectif: 280000, taux: 110, appels: 214, portefeuille: 4200 },
    { label: 'Fév', commission: 330000, encaissement: 555000, objectif: 300000, taux: 110, appels: 232, portefeuille: 4350 },
    { label: 'Mar', commission: 350000, encaissement: 590000, objectif: 320000, taux: 109, appels: 245, portefeuille: 4500 },
    { label: 'Avr', commission: 395000, encaissement: 630000, objectif: 360000, taux: 109.7, appels: 289, portefeuille: 4700 },
    { label: 'Mai', commission: 430000, encaissement: 712000, objectif: 410000, taux: 104.9, appels: 320, portefeuille: 5000 },
    { label: 'Jui', commission: 472800, encaissement: 860200, objectif: 460000, taux: 102.78, appels: 362, portefeuille: 5842 },
  ],
};

const imports = {
  rows: [
    { id: 1, nom_fichier: 'performance_2026_06.xlsx', date_import: '2026-06-12T09:40:00Z', lignes: 128, importees: 128, erreurs: 0, statut: 'OK' },
    { id: 2, nom_fichier: 'portefeuille_2026_06.xlsx', date_import: '2026-06-13T13:00:00Z', lignes: 420, importees: 410, erreurs: 10, statut: 'ATTENTION' },
  ],
};

module.exports = {
  dashboard,
  performance,
  classement,
  objectifs,
  portefeuille,
  controle,
  gestionnaires,
  threeCx,
  historique,
  imports,
  managerRows,
  dossierRows,
  appelRows,
};
