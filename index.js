const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const { addUser, listUsers } = require("./sheets");
const app = express();

app.use(bodyParser.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const ALLOWED_GROUP_ID = process.env.ALLOWED_GROUP_ID;

// LINE 回覆訊息
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

// 快速回應 webhook，避免 timeout
app.post("/webhook", (req, res) => {
  res.send("OK"); // 回給 LINE，代表收到

  const event = req.body.events?.[0];
  if (!event || event.type !== "message") return;

  handleEvent(event).catch(console.error);
});

// 處理訊息邏輯
async function handleEvent(event) {
  const { replyToken, message, source } = event;
  const groupId = source.groupId || "";
  const userId = source.userId;

  if (!replyToken || groupId !== ALLOWED_GROUP_ID) return;

  const displayName = userId; // （之後升級 B 再抓暱稱）
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
