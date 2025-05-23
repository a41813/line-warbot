const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { addUser, listUsers, clearAllSheets } = require("./sheets");
const app = express();

app.use(bodyParser.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const ALLOWED_GROUP_IDS = [
  "Cb22ae72338bf583aae36dfe420d90a7d",
  "Cac52c4b3e6dabd77d9260668950ea31c"
];

// 預設根目錄（檢查用）
app.get("/", (req, res) => {
  res.send("Hello from LINE Warbot!");
});

// 清空名單
app.get("/clear", async (req, res) => {
  await clearAllSheets();
  res.send("清空完成 ✅");
});

// LINE webhook 接收
app.post("/webhook", (req, res) => {
  console.log("📩 Webhook received");
  res.send("OK");

  const event = req.body.events?.[0];
  if (!event || event.type !== "message") return;
  handleEvent(event).catch(console.error);
});

// 事件處理
async function handleEvent(event) {
  const { replyToken, message, source } = event;
  const groupId = source.groupId || "";
  const userId = source.userId;

  // ✅ 群組白名單限制
  if (!replyToken || !ALLOWED_GROUP_IDS.includes(groupId)) return;

  const displayName = await getDisplayName(userId);
  let replyMsg = "";

  switch (message.text) {
    case "國戰+1": {
      const result = await addUser("國戰", displayName);
      replyMsg = result.success
        ? `✅ ${displayName} 已加入國戰`
        : `⚠️ ${displayName} ${result.reason}`;
      break;
    }
    case "請假+1": {
      const result = await addUser("請假", displayName);
      replyMsg = result.success
        ? `✅ ${displayName} 已請假`
        : `⚠️ ${displayName} ${result.reason}`;
      break;
    }
    case "國戰名單": {
      const warList = await listUsers("國戰");
      const leaveList = await listUsers("請假");
      replyMsg = `📋 國戰名單\n\n🟩 國戰+1：\n${warList.map(n => "🔸 " + n).join("\n") || "（無）"}\n\n🟨 請假+1：\n${leaveList.map(n => "🔸 " + n).join("\n") || "（無）"}`;
      break;
    }
    case "查ID":
      replyMsg = `👁️ 群組 ID：${groupId}`;
      break;
  }

  if (replyMsg) {
    await replyToLine(replyToken, replyMsg);
  }
}

// 顯示暱稱（失敗時回傳提醒）
async function getDisplayName(userId) {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
    });
    return res.data.displayName || userId;
  } catch (err) {
    console.error("❌ 無法取得使用者暱稱：", err.message);
    return `❗ 請先私訊 LeoGPT 啟用暱稱功能 👇\nhttps://line.me/R/ti/p/@484cdicd\n（ID: ${userId}）`;
  }
}

// 傳送 LINE 訊息
async function replyToLine(replyToken, msg) {
  await axios.post(
    "https://api.line.me/v2/bot/message/reply",
    {
      replyToken,
      messages: [{ type: "text", text: msg }],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
    }
  );
}

// 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});