const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: SCOPES,
});

const SPREADSHEET_ID = process.env.SHEET_ID;

async function getClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

async function addUser(sheetName, name) {
  const sheets = await getClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[name]],
    },
  });
}

async function listUsers(sheetName) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });
  return res.data.values?.flat() || [];
}

async function clearSheet(sheetName) {
  const sheets = await getClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });
}

async function clearAllSheets() {
  await clearSheet("國戰");
  await clearSheet("請假");
  console.log("✅ 已清空所有名單！");
}


module.exports = { addUser, listUsers, clearSheet };
