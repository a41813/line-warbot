const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { addUser, listUsers, clearAllSheets, removeUserAll } = require("./sheets");
const app = express();

app.use(bodyParser.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const ALLOWED_GROUP_IDS = [
  "Cb22ae72338bf583aae36dfe420d90a7d",
  "Cac52c4b3e6dabd77d9260668950ea31c"
];

app.get("/", (req, res) => {
  res.send("Hello from LINE Warbot!");
});

app.get("/clear", async (req, res) => {
  await clearAllSheets();
  res.send("清空完成 ✅");
});

app.post("/webhook", (req, res) => {
  console.log("📩 Webhook received");
  res.send("OK");

  const event = req.body.events?.[0];
  if (!event || event.type !== "message") return;
  handleEvent(event).catch(console.error);
});

async function handleEvent(event) {
  const { replyToken, message, source } = event;
  const groupId = source.groupId || "";
  const userId = source.userId;

  if (!replyToken || !ALLOWED_GROUP_IDS.includes(groupId)) return;

  const nameResult = await getDisplayName(userId);
  const nameToSave = nameResult.name;
  const nameToShow = nameResult.error
    ? `❗ 請先私訊 LeoGPT 啟用暱稱功能 👇\nhttps://line.me/R/ti/p/@484cdicd\n（ID: ${userId}）`
    : nameResult.name;

  let replyMsg = "";

  if (/^國戰\+\d+$/.test(message.text)) {
    const match = message.text.match(/^國戰\+(\d+)$/);
    const count = parseInt(match[1], 10);

    if (count >= 1 && count <= 12) {
      const formattedName = count === 1 ? nameToSave : `${nameToSave}(${count})`;
      const warList = await listUsers("國戰");

      if (warList.includes(formattedName)) {
        replyMsg = `⚠️ ${formattedName} 已報名過`;
      } else {
        const result = await addUser("國戰", formattedName);
        replyMsg = result.success
          ? `✅ ${nameToShow} 已加入國戰（共 ${count} 名）`
          : `⚠️ ${nameToShow} ${result.reason}`;
      }
    } else {
      replyMsg = "⚠️ 報名數量需介於 1~12 之間";
    }
  } else {
    switch (message.text) {
      case "請假+1": {
        const result = await addUser("請假", nameToSave);
        replyMsg = result.success
          ? `✅ ${nameToShow} 已請假`
          : `⚠️ ${nameToShow} ${result.reason}`;
        break;
      }
      case "國戰名單": {
        const warList = await listUsers("國戰");
        const leaveList = await listUsers("請假");
        replyMsg = `📋 國戰名單\n\n🟩 國戰+1：\n${warList.map(n => "🔸 " + n).join("\n") || "（無）"}\n\n🟨 請假+1：\n${leaveList.map(n => "🔸 " + n).join("\n") || "（無）"}`;
        break;
      }
      case "查ID": {
        replyMsg = `👁️ 群組 ID：${groupId}`;
        break;
      }
      case "國戰取消": {
        const removed = await removeUserAll("國戰", nameToSave);
        replyMsg = removed
          ? `🗑️ ${nameToShow} 的國戰紀錄已取消`
          : `⚠️ ${nameToShow} 沒有在國戰名單中`;
        break;
      }
      case "請假取消": {
        const removed = await removeUserAll("請假", nameToSave);
        replyMsg = removed
          ? `🗑️ ${nameToShow} 的請假紀錄已取消`
          : `⚠️ ${nameToShow} 沒有在請假名單中`;
        break;
      }
    }
  }

  if (replyMsg) {
    await replyToLine(replyToken, replyMsg);
  }
}

async function getDisplayName(userId) {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${LINE_TOKEN}`,
      },
    });
    return {
      name: res.data.displayName || userId,
      error: false
    };
  } catch (err) {
    console.error("❌ 無法取得使用者暱稱：", err.message);
    return {
      name: userId,
      error: true
    };
  }
}

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot running on port ${PORT}`);
});