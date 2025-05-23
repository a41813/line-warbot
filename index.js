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

  switch (message) {
    case "國戰+1":
      replyMsg = `✅ ${userId} 已加入國戰（測試用）`;
      break;
    case "請假+1":
      replyMsg = `✅ ${userId} 已請假（測試用）`;
      break;
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
