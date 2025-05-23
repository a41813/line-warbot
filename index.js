const { addUser, listUsers } = require("./sheets");
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const ALLOWED_GROUP_ID = process.env.ALLOWED_GROUP_ID;

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

app.post("/webhook", async (req, res) => {
  const event = req.body.events?.[0];
  if (!event || event.type !== "message") return res.send("Ignored");

  const replyToken = event.replyToken;
  const userId = event.source.userId;
  const groupId = event.source.groupId || "";

  if (groupId !== ALLOWED_GROUP_ID) return res.send("Group not allowed");

  const message = event.message.text;
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
    replyMsg = `📋 國戰名單\n\n🟩 國戰+1：\n${warList.map(n => `🔸 ${n}`).join("\n") || "（無）"}\n\n🟨 請假+1：\n${leaveList.map(n => `🔸 ${n}`).join("\n") || "（無）"}`;
    break;
  }

  case "查ID":
    replyMsg = `👁️ 群組 ID：${groupId}`;
    break;

  default:
    replyMsg = "";
}
  if (replyMsg) {
    await replyToLine(replyToken, replyMsg);
  }

  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot server running on port ${PORT}`);
});
