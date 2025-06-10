const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = process.env.SHEET_ID;
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);

async function getClient() {
  const auth = new google.auth.JWT(
    GOOGLE_CREDENTIALS.client_email,
    null,
    GOOGLE_CREDENTIALS.private_key,
    SCOPES
  );
  return google.sheets({ version: "v4", auth });
}

async function addUser(sheetName, name) {
  const sheets = await getClient();
  const nameLower = name.trim().toLowerCase();

  const targetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });
  const targetList = targetRes.data.values?.flat() || [];

  if (targetList.includes(name)) {
    return { success: false, reason: "已在名單中，不能重複報名" };
  }

  const otherSheets = ["國戰", "請假", "進攻"].filter(s => s !== sheetName);
  for (const other of otherSheets) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${other}!A:A`,
    });
    const list = res.data.values?.flat().map(v => v.trim().toLowerCase()) || [];
    const isDuplicate = sheetName === "請假"
      ? list.includes(nameLower)
      : list.some(entry => entry.startsWith(nameLower + "("));
    if (isDuplicate) {
      return { success: false, reason: `已在 ${other} 名單中，請先取消` };
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    requestBody: { values: [[name]] },
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
  for (const name of ["國戰", "請假", "進攻"]) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A:A`,
    });
  }
}

async function removeUserAll(sheetName, name) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const rows = res.data.values || [];
  const target = name.trim().toLowerCase();
  const originalLength = rows.length;

  const newRows = rows.filter(row => {
    const cell = (row?.[0] || "").trim().toLowerCase();
    return sheetName === "請假"
      ? cell !== target
      : !cell.startsWith(target + "(");
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  if (newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
      valueInputOption: "RAW",
      requestBody: { values: newRows },
    });
  }

  return originalLength !== newRows.length;
}

async function getGameNameFromLineName(lineName) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `對照表!A:B`,
  });
  const rows = res.data.values || [];
  const target = lineName.trim().toLowerCase();
  for (const row of rows) {
    if ((row[0] || '').trim().toLowerCase() === target) {
      return row[1]?.trim() || lineName;
    }
  }
  return null;
}

module.exports = {
  addUser,
  listUsers,
  clearAllSheets,
  removeUserAll,
  getGameNameFromLineName,
};