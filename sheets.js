const { google } = require("googleapis");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = process.env.SHEET_ID;
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS);

// 建立 Sheets client
async function getClient() {
  const auth = new google.auth.JWT(
    GOOGLE_CREDENTIALS.client_email,
    null,
    GOOGLE_CREDENTIALS.private_key,
    SCOPES
  );

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

// 新增使用者（防止重複與交叉報名）
async function addUser(sheetName, name) {
  const otherSheet = sheetName === "國戰" ? "請假" : "國戰";
  const sheets = await getClient();

  const targetRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });
  const targetList = targetRes.data.values?.flat() || [];

  const otherRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${otherSheet}!A:A`,
  });
  const otherList = otherRes.data.values?.flat() || [];

  if (targetList.includes(name)) {
    return { success: false, reason: "已在名單中，不能重複報名" };
  }

  if (otherList.includes(name)) {
    return { success: false, reason: `已在 ${otherSheet} 名單中，請先取消` };
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[name]],
    },
  });

  return { success: true };
}

// 讀取使用者名單
async function listUsers(sheetName) {
  const sheets = await getClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  return res.data.values?.flat() || [];
}

// 清空兩張名單
async function clearAllSheets() {
  const sheets = await getClient();
  for (const name of ["國戰", "請假"]) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A:A`,
    });
  }
}

// ✅ 超強 debug + 防大小寫比對版
async function removeUserAll(sheetName, name) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const rows = res.data.values || [];
  const originalLength = rows.length;

  const targetPrefix = name.trim().toLowerCase() + "(";

  console.log(`🔍 開始嘗試刪除：${name}`);
  console.log("📋 目前名單：", rows.map(r => r[0]));

  const newRows = rows.filter(row => {
    const rawValue = row?.[0] || "";
    const cleanValue = rawValue.trim().toLowerCase();
    const isMatch = cleanValue.startsWith(targetPrefix);

    console.log(`👉 檢查：${rawValue} ➜ ${cleanValue} 是否以 ${targetPrefix} 開頭？結果：${isMatch}`);

    if (isMatch) {
      console.log(`🧽 移除中：${rawValue}`);
    }

    return !isMatch;
  });

  console.log("✅ 篩選後名單：", newRows.map(r => r[0]));

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    requestBody: {
      values: newRows,
    },
  });

  const changed = originalLength !== newRows.length;
  console.log(`⚠️ 是否成功刪除？${changed}`);
  return changed;
}

module.exports = {
  addUser,
  listUsers,
  clearAllSheets,
  removeUserAll,
};