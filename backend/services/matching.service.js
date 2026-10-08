const { query } = require('../config/database');

async function attachCallsToDossiers(calls = []) {
  if (!calls.length) {
    return { updated: 0, unmatched: 0 };
  }

  let updated = 0;
  const unmatched = [];

  for (const call of calls) {
    try {
      const phone = String(call.numero_client || call.numero_appelant || '').replace(/\D/g, '');
      const { rows } = await query(
        "SELECT id, telephone_normalise FROM dossiers WHERE telephone_normalise = $1 LIMIT 2",
        [phone]
      );

      if (rows.length === 1) {
        updated += 1;
        await query(
          'UPDATE appels_3cx SET dossier_id = $1, communication_non_rattachee = false WHERE call_id = $2',
          [rows[0].id, call.call_id]
        );
      } else if (rows.length > 1) {
        unmatched.push({ call_id: call.call_id, reason: 'Multiple dossier matches' });
      } else {
        unmatched.push({ call_id: call.call_id, reason: 'No match' });
      }
    } catch (error) {
      unmatched.push({ call_id: call.call_id, reason: error.message });
    }
  }

  return { updated, unmatched };
}

module.exports = {
  attachCallsToDossiers,
};
