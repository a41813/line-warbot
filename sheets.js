const { google } = require("googleapis");
const keys = require("./credentials.json"); // 你的 Google API 金鑰 JSON
const SPREADSHEET_ID = process.env.SHEET_ID;

async function getClient() {
  const auth = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  return google.sheets({ version: "v4", auth });
}

async function addUser(sheetName, name) {
  const sheets = await getClient();
  const rows = await listUsers(sheetName);

  const otherSheet = sheetName === "國戰" ? "請假" : "國戰";
  const otherRows = await listUsers(otherSheet);

  if (rows.includes(name)) {
    return { success: false, reason: "已在名單中" };
  }
  if (otherRows.includes(name)) {
    return { success: false, reason: "已在另一個名單中" };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[name]],
    },
  });

  return { success: true };
}

async function listUsers(sheetName) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  return res.data.values?.flat() || [];
}

async function clearAllSheets() {
  const sheets = await getClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "國戰!A:A",
  });
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "請假!A:A",
  });
}

async function removeUserAll(sheetName, baseName) {
  const sheets = await getClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  const sheetId = sheet?.properties.sheetId;

  if (!sheetId) throw new Error(`找不到 ${sheetName} 的 sheetId`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const rows = res.data.values?.flat() || [];
  const targets = rows
    .map((val, idx) => ({ val, idx }))
    .filter(entry => entry.val === baseName || entry.val.startsWith(`${baseName}(`));

  if (targets.length === 0) return false;

  const requests = targets
    .sort((a, b) => b.idx - a.idx)
    .map(entry => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: entry.idx,
          endIndex: entry.idx + 1
        }
      }
    }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests }
  });

  return true;
}

module.exports = {
  addUser,
  listUsers,
  clearAllSheets,
  removeUserAll
};