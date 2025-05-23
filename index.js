const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { addUser, listUsers, clearAllSheets } = require("./sheets");
const app = express();

app.use(bodyParser.json());

const LINE_TOKEN = process.env.LINE_TOKEN;

// 🔧 提供檢查用首頁，避免 Railway 誤砍容器
app.get("/", (req, res) => {
  res.send("Hello from LINE Warbot!");
});

// ✅ 清空名單
app.get("/clear", async (req, res) => {
  await clearAllSheets();
  res.send("清空完成 ✅");
});

// ✅ 快速回應 webhook，避免 LINE timeout
app.post("/webhook", (req, res) => {
  console.log("📩 Webhook received");
  res.send("OK"); // 先快速回應 LINE

  const event = req.body.events?.[0];
  if (!event || event.type !== "message") return;

  handleEvent(event).catch(console.error);
});

// ✅ 主邏輯處理（支援所有群組，無限制）
async function handleEvent(event) {
  const { replyToken, message, source } = event;
  const groupId = source.groupId || "";
  const userId = source.userId;

  if (!replyToken) return;

  const displayName = await getDisplayName(userId);
  let replyMsg = "";

  switch (message.text) {
    case "國戰+1":
      await addUser("國戰", displayName);
      replyMsg = `✅ ${displayName} 已加入國戰`;
      break;

    case "請假+1":
      await addUser("請假", displayName);
      replyMsg = `✅ ${displayName} 已請假`;
      break;

    case "國戰名單": {
      const warList = await listUsers("國戰");
      const leaveList = await listUsers("請假");
      replyMsg = `📋 國戰名單\n\n🟩 國戰+1：\n${warList.map(n => "🔸 " + n).join("\n") || "（無）"}\n\n🟨 請假+1：\n${leaveList.map(n => "🔸 " + n).join("\n") || "（無）"}`;
      break;
    }

    case "查ID":
      replyMsg = `👁️ 群組 ID：${groupId}`;
      break;

    default:
      replyMsg = ""; // 不處理其他訊息
  }

  if (replyMsg) {
    await replyToLine(replyToken, replyMsg);
  }
}

// ✅ 使用 LINE API 抓取暱稱
async function getDisplayName(userId) {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
    });
    return res.data.displayName || userId;
  } catch (err) {
    console.error("❌ 抓暱稱失敗，使用 userId 當替代");
    return userId;
  }
}

// ✅ 發送訊息到 LINE
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

// ✅ 啟動伺服器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});