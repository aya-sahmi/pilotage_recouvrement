const ExcelJS = require('exceljs');

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeHeader(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '')
    .replace(/(?!^)-/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = cleaned
      .replaceAll(thousandsSeparator, '')
      .replace(decimalSeparator, '.');
  } else {
    const separator = lastComma === -1 ? '.' : ',';
    const lastSeparator = Math.max(lastComma, lastDot);
    const decimalDigits = cleaned.length - lastSeparator - 1;

    if (lastSeparator !== -1 && decimalDigits > 0 && decimalDigits <= 2) {
      normalized = `${cleaned.slice(0, lastSeparator).replaceAll(separator, '')}.${cleaned.slice(lastSeparator + 1)}`;
    } else {
      normalized = cleaned.replaceAll(separator, '');
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getWorkbookRecords(sheet) {
  const headers = sheet.getRow(1).values.slice(1).map((value) => normalizeHeader(value));
  const records = [];

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record = {};
    row.values.slice(1).forEach((value, index) => {
      const header = headers[index];
      if (header) record[header] = value;
    });
    records.push({ record, rowNumber });
  });

  return { headers, records };
}

function invalidRankingWorkbook(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.error = 'INVALID_RANKING_WORKBOOK';
  return error;
}

function isTotalRow(value) {
  return normalizeHeader(value).startsWith('total');
}

function getRequiredField(record, fields) {
  return fields.map((field) => record[field]).find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

async function parseResponsablesRankingWorkbook(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw invalidRankingWorkbook('Le fichier Excel ne contient aucune feuille.');

  const { headers, records } = getWorkbookRecords(sheet);
  const nameHeader = ['nom_et_prenom', 'nom_prenom', 'nomprenom', 'responsable', 'nom'];
  const hasName = nameHeader.some((header) => headers.includes(header));
  const hasEncaissement = headers.includes('encaissement');
  const hasCommission = ['commission', 'commision', 'commission_srm'].some((header) => headers.includes(header));
  const hasObjectif = headers.includes('objectif');

  if (!hasName || !hasEncaissement || !hasCommission || !hasObjectif) {
    throw invalidRankingWorkbook('Colonnes requises : Nom et Prenom, Encaissement, Commission et Objectif.');
  }

  const rows = records.flatMap(({ record, rowNumber }) => {
    const rawName = getRequiredField(record, nameHeader);
    if (!rawName || isTotalRow(rawName)) return [];

    const encaissement = normalizeNumber(record.encaissement);
    const commission = normalizeNumber(getRequiredField(record, ['commission', 'commision', 'commission_srm']));
    const objectif = normalizeNumber(record.objectif);
    return [{
      nomAffichage: normalizeText(rawName),
      encaissement,
      commission,
      objectif,
      photoUrl: normalizeText(record.photo_url || record.photourl || ''),
      ligne: rowNumber,
    }];
  });

  if (!rows.length) throw invalidRankingWorkbook('Aucune ligne responsable importable n’a été trouvée.');

  return {
    rows,
    stats: { lignes: rows.length, importees: rows.length, erreurs: 0, statut: 'OK' },
  };
}

async function parseClientsRankingWorkbook(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw invalidRankingWorkbook('Le fichier Excel ne contient aucune feuille.');

  const { headers, records } = getWorkbookRecords(sheet);
  const nameHeader = ['nom_client', 'client', 'nom'];
  const hasName = nameHeader.some((header) => headers.includes(header));
  const hasEncaissement = headers.includes('encaissement');
  const hasCommission = ['commission_srm', 'commission', 'commision_srm'].some((header) => headers.includes(header));

  if (!hasName || !hasEncaissement || !hasCommission) {
    throw invalidRankingWorkbook('Colonnes requises : Nom client, Encaissement et Commission SRM.');
  }

  const rows = records.flatMap(({ record, rowNumber }) => {
    const rawName = getRequiredField(record, nameHeader);
    if (!rawName || isTotalRow(rawName)) return [];

    return [{
      nom: normalizeText(rawName),
      encaissement: normalizeNumber(record.encaissement),
      commissionSrm: normalizeNumber(getRequiredField(record, ['commission_srm', 'commission', 'commision_srm'])),
      photoUrl: normalizeText(record.photo_url || record.photourl || ''),
      ligne: rowNumber,
    }];
  });

  if (!rows.length) throw invalidRankingWorkbook('Aucune ligne client importable n’a été trouvée.');

  return {
    rows,
    stats: { lignes: rows.length, importees: rows.length, erreurs: 0, statut: 'OK' },
  };
}

function normalizeDate(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

async function parsePerformanceWorkbook(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const sheet = workbook.worksheets[0];
  const rows = [];

  const headerRow = sheet.getRow(1);
  const headers = headerRow.values.slice(1).map((value) => normalizeHeader(value));

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record = {};
    const values = row.values.slice(1);
    headers.forEach((header, index) => {
      record[header] = values[index];
    });

    const nomPrenom =
      record.nom_prenom ||
      record.nom_et_prenom ||
      record.nomprenom ||
      record.gestionnaire ||
      record.nom_prenom_ ||
      record.nom ||
      '';
    const encaissement = normalizeNumber(
      record.encaissement ?? record.encaissement_total ?? record.montant_encaisse ?? record.montant ?? 0
    );
    const commission = normalizeNumber(
      record.commission ?? record.commission_totale ?? record.total_commission ?? record.montant_commission ?? 0
    );
    const objectif = normalizeNumber(
      record.objectif ?? record.objectif_total ?? record.total_objectif ?? record.objectif_total_ ?? 0
    );
    const taux = normalizeNumber(record.taux ?? record.taux_percent ?? record.pourcentage ?? 0);

    if (!nomPrenom) return;

    rows.push({
      nomPrenom: normalizeText(nomPrenom),
      encaissement,
      commission,
      objectif,
      taux: objectif > 0 ? (commission / objectif) * 100 : taux,
      ligne: rowNumber,
    });
  });

  return {
    rows,
    stats: {
      lignes: rows.length,
      importees: rows.length,
      erreurs: 0,
      statut: rows.length ? 'OK' : 'VIDE',
    },
  };
}

async function parsePortefeuilleWorkbook(fileBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const sheet = workbook.worksheets[0];
  const rows = [];

  const headerRow = sheet.getRow(1);
  const headers = headerRow.values.slice(1).map((value) => normalizeHeader(value));

  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const record = {};
    const values = row.values.slice(1);
    headers.forEach((header, index) => {
      record[header] = values[index];
    });

    const idExterne = record.id_externe ?? record.id_externe_ ?? record.id ?? '';
    const nomClient = record.nom_clt_fr ?? record.nom_client ?? record.nom_clt ?? record.nom ?? '';
    const debiteur = record.debiteur ?? record.nom_debiteur ?? record.debiteur_ ?? '';
    const statut = record.statut ?? record.statut_dossier ?? record.statut_ ?? '';
    const solde = normalizeNumber(record.solde ?? record.solde_dossier ?? record.montant ?? 0);
    const cinDebiteur = record.ncin_debiteur ?? record.cin_debiteur ?? record.ncin ?? '';
    const dateReception = normalizeDate(record.date_reception ?? record.date_reception_ ?? record.date ?? '');
    const typeLot = record.type_lot ?? record.type_lot_ ?? record.type ?? '';
    const gestionnaireSource = record.nvx_gestionnaire ?? record.gestionnaire ?? record.gestionnaire_source ?? '';
    const responsable = record.responsable ?? record.responsable_dossier ?? record.responsable_ ?? '';
    const telephoneDebiteur = record.tel_deb_officiel ?? record.telephone_debiteur ?? record.telephone ?? '';
    const employeur = record.employeur_canss ?? record.employeur_client ?? record.employeur ?? '';
    const adresseEmployeur = record.adresse_employeur_cnss ?? record.adresse_employeur_client ?? record.adresse ?? '';
    const villeEmployeur = record.ville_employeur_cnss ?? record.ville_employeur_client ?? record.ville ?? '';
    const nombreTitre2 = record.nombretitre2 ?? record.nombre_titre2 ?? record.nb_titres ?? '';
    const historique = record.historique ?? record.commentaire ?? '';

    if (!nomClient && !debiteur && !idExterne) return;

    rows.push({
      id_externe: idExterne,
      nom_client: normalizeText(nomClient),
      debiteur: normalizeText(debiteur),
      statut: normalizeText(statut),
      solde,
      cin_debiteur: normalizeText(cinDebiteur),
      date_reception: normalizeText(dateReception),
      type_lot: normalizeText(typeLot),
      gestionnaire_id: null,
      nom_gestionnaire_source: normalizeText(gestionnaireSource),
      responsable: normalizeText(responsable),
      telephone_debiteur: normalizeText(telephoneDebiteur),
      telephone_normalise: String(telephoneDebiteur || '').replace(/\D/g, ''),
      employeur_client: normalizeText(employeur),
      adresse_employeur_client: normalizeText(adresseEmployeur),
      ville_employeur_client: normalizeText(villeEmployeur),
      nombre_titre2: normalizeText(nombreTitre2),
      historique: normalizeText(historique),
      ligne: rowNumber,
    });
  });

  return {
    rows,
    stats: {
      lignes: rows.length,
      importees: rows.length,
      erreurs: 0,
      statut: rows.length ? 'OK' : 'VIDE',
    },
  };
}

module.exports = {
  parsePerformanceWorkbook,
  parsePortefeuilleWorkbook,
  parseResponsablesRankingWorkbook,
  parseClientsRankingWorkbook,
};
