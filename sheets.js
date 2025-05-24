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

// ✅ 終極版：強制使用 clear + append 重建名單
async function removeUserAll(sheetName, name) {
  const sheets = await getClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  const rows = res.data.values || [];
  const originalLength = rows.length;

  const keyword = name.trim().toLowerCase();

  console.log(`🔍 嘗試刪除含有關鍵字 "${keyword}" 的所有資料`);
  console.log("📋 原始名單：", rows.map(r => r[0]));

  const newRows = rows.filter(row => {
    const raw = (row?.[0] || "").trim().toLowerCase();
    const isMatch = raw.includes(keyword);

    if (isMatch) {
      console.log(`🧽 強制移除：${row[0]}`);
    }

    return !isMatch;
  });

  // ✨ 重點：先 clear 再 append，保證更新
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:A`,
  });

  if (newRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:A`,
      valueInputOption: "RAW",
      requestBody: {
        values: newRows,
      },
    });
  }

  const changed = originalLength !== newRows.length;
  console.log("✅ 最終名單：", newRows.map(r => r[0]));
  console.log(`⚠️ 是否成功刪除？${changed}`);
  return changed;
}

module.exports = {
  addUser,
  listUsers,
  clearAllSheets,
  removeUserAll,
};