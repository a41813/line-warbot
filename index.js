// ✅ 簡易全域鎖定機制（請放在 index.js 最上面）
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

// ✅ 用法：在所有會寫入 Google Sheet 的地方包裹這個鎖

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

  const nameResult = await getDisplayName(userId);
  const nameToSave = nameResult.name;
  const nameToShow = nameResult.error
    ? `❗ 請先私訊 LeoGPT 啟用暱稱功能 👇\nhttps://line.me/R/ti/p/@484cdicd\n（ID: ${userId}）`
    : nameResult.name;

  let replyMsg = "";

  if (/^國戰\+\d+$/.test(message.text)) {
    await withSheetLock(async () => {
      const match = message.text.match(/^國戰\+(\d+)$/);
      const count = parseInt(match[1], 10);

      if (count < 1 || count > 12) {
        replyMsg = "⚠️ 報名數量需介於 1~12 之間";
      } else if (nameResult.error) {
        replyMsg = nameToShow;
      } else {
        const formattedName = `${nameToSave}(${count})`;
        const warList = await listUsers("國戰");
        const leaveList = await listUsers("請假");

        if (warList.includes(formattedName)) {
          replyMsg = `⚠️ ${formattedName} 已在國戰名單中`;
        } else if (leaveList.includes(formattedName)) {
          replyMsg = `⚠️ ${formattedName} 已在請假名單中`;
        } else {
          const result = await addUser("國戰", formattedName);
          replyMsg = result.success
            ? `✅ ${nameToShow} 已加入國戰（共 ${count} 名）`
            : `⚠️ ${nameToShow} ${result.reason}`;
        }
      }
    })();
  } else {
    await withSheetLock(async () => {
      switch (message.text) {
        case "請假+1": {
          if (nameResult.error) {
            replyMsg = nameToShow;
            break;
          }
          const result = await addUser("請假", nameToSave);
          replyMsg = result.success
            ? `✅ ${nameToShow} 已請假`
            : `⚠️ ${nameToShow} ${result.reason}`;
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
      }
    })();
  }

  if (replyMsg) {
    await replyToLine(replyToken, replyMsg);
  }
}
