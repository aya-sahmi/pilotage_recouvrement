const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const {
  parseResponsablesRankingWorkbook,
  parseClientsRankingWorkbook,
} = require('../services/excel-import.service');

async function createWorkbook(headers, rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Classement');
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return workbook.xlsx.writeBuffer();
}

test('responsable ranking import reads amounts, optional photo URLs, and ignores total rows', async () => {
  const file = await createWorkbook(
    ['NOM ET PRENOM', 'ENCAISSEMENT', 'COMMISION', 'OBJECTIF', 'PHOTO URL'],
    [
      ['ECHAABI LAMIAA', '1 470 068.78', '162 789.61', '300 000.00', 'https://example.com/lamiaa.jpg'],
      ['Total', '1 470 068.78', '162 789.61', '300 000.00', ''],
    ]
  );

  const result = await parseResponsablesRankingWorkbook(file);

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].nomAffichage, 'ECHAABI LAMIAA');
  assert.equal(result.rows[0].encaissement, 1470068.78);
  assert.equal(result.rows[0].commission, 162789.61);
  assert.equal(result.rows[0].objectif, 300000);
  assert.equal(result.rows[0].photoUrl, 'https://example.com/lamiaa.jpg');
  assert.equal(result.stats.importees, 1);
});

test('client ranking import reads SRM commission, supports decimal comma, and ignores total rows', async () => {
  const file = await createWorkbook(
    ['NOM CLIENT', 'ENCAISSEMENT', 'COMMISSION SRM'],
    [
      ['AL AMANA', '68 372,07', '17 093,02'],
      ['ARDI', '1.234.567,89', '19.596,75'],
      ['Total', '68 372,07', '17 093,02'],
    ]
  );

  const result = await parseClientsRankingWorkbook(file);

  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].nom, 'AL AMANA');
  assert.equal(result.rows[0].encaissement, 68372.07);
  assert.equal(result.rows[0].commissionSrm, 17093.02);
  assert.equal(result.rows[1].encaissement, 1234567.89);
  assert.equal(result.rows[1].commissionSrm, 19596.75);
});

test('ranking imports reject workbooks missing required columns', async () => {
  const file = await createWorkbook(['NOM CLIENT', 'ENCAISSEMENT'], [['AL AMANA', 10]]);

  await assert.rejects(
    parseClientsRankingWorkbook(file),
    { statusCode: 400, error: 'INVALID_RANKING_WORKBOOK' }
  );
});
