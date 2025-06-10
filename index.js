const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const {
  addUser,
  listUsers,
  clearAllSheets,
  removeUserAll,
  getGameNameFromLineName,
} = require("./sheets");
const app = express();

app.use(bodyParser.json());

const LINE_TOKEN = process.env.LINE_TOKEN;
const ALLOWED_GROUP_IDS = [
  "Cb22ae72338bf583aae36dfe420d90a7d",
  "Cac52c4b3e6dabd77d9260668950ea31c"
];

let sheetLock = false;
function withSheetLock(asyncFn) {
  return async (...args) => {
    if (sheetLock) {
      console.log("⏳ Sheet 正在操作中，跳過此次請求");
      return;
    }
    sheetLock = true;
    try {
      return await asyncFn(...args);
    } finally {
      sheetLock = false;
    }
  };
}

app.get("/", (req, res) => {
  res.send("Hello from LINE Warbot!");
});

app.get("/clear", async (req, res) => {
  await withSheetLock(async () => {
    await clearAllSheets();
  })();
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
  if (!message || typeof message.text !== 'string') return;

  const nameResult = await getDisplayName(userId);
  const nameToSave = nameResult.name;
  const gameName = await getGameNameFromLineName(nameToSave);
  const displayName = gameName || nameToSave;
  const nameToShow = nameResult.error
    ? `❗ 請先私訊 LeoGPT 啟用暱稱功能 👇\nhttps://line.me/R/ti/p/@484cdicd\n（ID: ${userId}）`
    : displayName;

  let replyMsg = "";
  const text = message.text.replace("国战", "國戰")
                           .replace("请假", "請假")
                           .replace("名单", "名單")
                           .replace("进攻", "進攻");

  if (/^(國戰|進攻)\+\d+$/.test(text)) {
    await withSheetLock(async () => {
      const [type, num] = text.split("+");
      const count = parseInt(num, 10);
      if (count < 1 || count > 12) {
        replyMsg = "⚠️ 報名數量需介於 1~12 之間";
        return;
      }
      if (nameResult.error) {
        replyMsg = nameToShow;
        return;
      }

      const formattedName = `${displayName}(${count})`;
      const currentList = await listUsers(type);
      const otherLists = (await Promise.all(
        ["國戰", "進攻", "請假"].filter(s => s !== type).map(listUsers)
      )).flat();

      if (currentList.includes(formattedName)) {
        replyMsg = `⚠️ ${formattedName} 已在${type}名單中`;
      } else if (otherLists.some(n => n.startsWith(displayName))) {
        replyMsg = `⚠️ ${displayName} 已在其他名單中，請先取消`;
      } else {
        const result = await addUser(type, formattedName);
        replyMsg = result.success
          ? `✅ ${nameToShow} 已加入${type}（共 ${count} 名）`
          : `⚠️ ${nameToShow} ${result.reason}`;
      }
    })();
  } else {
    await withSheetLock(async () => {
      switch (text) {
        case "請假+1": {
          if (nameResult.error) {
            replyMsg = nameToShow;
            break;
          }
          const result = await addUser("請假", displayName);
          replyMsg = result.success
            ? `✅ ${nameToShow} 已請假`
            : `⚠️ ${nameToShow} ${result.reason}`;
          break;
        }
        case "國戰取消":
        case "進攻取消":
        case "請假取消": {
          const sheet = text.replace("取消", "");
          const removed = await removeUserAll(sheet, displayName);
          replyMsg = removed
            ? `🗑️ ${nameToShow} 的${sheet}紀錄已取消`
            : `⚠️ ${nameToShow} 沒有在${sheet}名單中`;
          break;
        }
        case "國戰名單": {
          const [warList, attackList, leaveList] = await Promise.all([
            listUsers("國戰"),
            listUsers("進攻"),
            listUsers("請假")
          ]);
          const format = (label, list) => `${label}（${list.length}）:\n${list.join("\n") || "（無）"}`;
          replyMsg = [format("國戰", warList), format("進攻", attackList), format("請假", leaveList)].join("\n\n");
          break;
        }
        case "查ID": {
          replyMsg = `👁️ 群組 ID：${groupId}`;
          break;
        }
      }
    })();
  }

  if (replyMsg) {
    await replyToLine(replyToken, replyMsg);
  }
}

async function getDisplayName(userId) {
  try {
    const res = await axios.get(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${LINE_TOKEN}` },
    });
    return { name: res.data.displayName || userId, error: false };
  } catch (err) {
    console.error("❌ 無法取得使用者暱稱：", err.message);
    return { name: userId, error: true };
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