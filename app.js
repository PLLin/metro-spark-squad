/* ==========================================================================
   1. 狀態與常數設定
   ========================================================================== */
/**
 * 隨機產生一個限時任務 (包含隨機名稱、站點、特約類型與點數)
 */
function generateRandomQuest(id = "default-quest") {
  // 定義 3 組固定的任務主題與分類的配對，確保標題、內容與店家類型 100% 吻合！
  const questPool = [
    { title: "雙人週末出遊", category: "咖啡廳☕", baseReward: 250 },
    { title: "地下鐵尋寶趣", category: "文創選物🎨", baseReward: 80 },
    { title: "夜市美食聚點", category: "飲料店🥤", baseReward: 150 }
  ];
  
  const stations = ["中山", "台大醫院", "行天宮", "忠孝復興", "西門"];
  
  // 隨機挑選一組主題配對
  const selectedTheme = questPool[Math.floor(Math.random() * questPool.length)];
  // 隨機挑選車站
  const randomStation = stations[Math.floor(Math.random() * stations.length)];
  
  // 隨機微調點數 (+- 20pt，保持趣味性)
  const offset = (Math.floor(Math.random() * 5) - 2) * 10; // -20, -10, 0, 10, 20
  const finalReward = Math.max(50, selectedTheme.baseReward + offset);
  
  return {
    id: id,
    title: selectedTheme.title,
    station: randomStation,
    category: selectedTheme.category,
    reward: finalReward,
    step: 1, // 預設步驟：1 (尚未出站)
    timerSeconds: 10800, // 3小時
    riders: [],
    invitees: [],
    isExpanded: true
  };
}

const STATE = {
  personalPoints: 5820,
  vaultPoints: 12480,
  vaultTarget: 15000,
  members: [
    { name: "我", phone: "0912345678", gender: "男", age: 28, points: 5820, color: "bg-blue", max: 6500 },
    { name: "楊小芸 (伴侶)", phone: "0987654321", gender: "女", age: 25, points: 4310, color: "bg-pink", max: 6500 },
    { name: "陳阿明 (好友)", phone: "0976543210", gender: "男", age: 30, points: 2350, color: "bg-green", max: 6500 }
  ],
  questActive: true,
  // 進行中的任務列表，支持多個任務同時進行
  activeQuests: [
    generateRandomQuest("default-quest")
  ],
  questTimerSeconds: 8073, // 2小時14分33秒
  simulatedTripUnlocked: false,
  questReward: 250, // 共同任務的基礎點數獎勵
  questStation: "中山", // 預設任務之目標站
  questCategory: "咖啡廳☕", // 預設任務之指定特約店家類型
};

// SVG 圓環總長度 2 * pi * r = 2 * 3.14159 * 70 ≈ 439.8
const DASH_ARRAY = 439.8;

/* ==========================================================================
   2. 初始化與事件綁定
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initRealtimeClock();
  initTimer();
  renderMemberList();
  renderSimCompanions();
  renderActiveQuests(); // 初始渲染進行中任務卡
  updatePointsUI(false); // 初始更新介面，不播放音效/動畫

  // 步驟 2 摺疊面板展開收合 (動態卡片內已各自綁定，此處僅預設載入)
  renderCooperativeShopsForQuest(STATE.activeQuests[0]); 

  // 頁籤切換
  window.switchTab = (tabId) => {
    document.querySelectorAll(".app-view").forEach(view => {
      view.classList.remove("active");
    });
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.remove("active");
    });

    const targetView = document.getElementById(`view-${tabId}`);
    if (targetView) targetView.classList.add("active");

    // 尋找對應的按鈕
    const targetBtn = Array.from(document.querySelectorAll(".nav-item")).find(btn => 
      btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(tabId)
    );
    if (targetBtn) targetBtn.classList.add("active");

    // 如果切換到任務頁面，消掉紅點
    if (tabId === 'quest') {
      document.getElementById("nav-quest-dot").classList.remove("active");
    }
  };

  // 綁定整合型核心機制試用按鈕
  document.getElementById("btn-interactive-vault").addEventListener("click", () => {
    switchTab('vault');
    setTimeout(() => {
      document.getElementById("invite-modal").style.display = "flex";
      document.getElementById("invite-name").value = "王大同";
      document.getElementById("invite-phone").value = "0987654321";
      document.getElementById("invite-gender").value = "男";
      document.getElementById("invite-age").value = "30";
      document.getElementById("invite-relation").value = "戰友";
    }, 200);
  });

  document.getElementById("btn-interactive-quest").addEventListener("click", () => {
    // 取得當前第一個任務 (初始任務) 進行動態試用
    let target = STATE.activeQuests[0];
    if (!target) {
      target = generateRandomQuest("default-quest");
      STATE.activeQuests.push(target);
    }
    
    target.step = 1; // 重置為步驟 1
    
    // 收合其他所有任務，展開當前任務
    STATE.activeQuests.forEach(q => {
      q.isExpanded = (q.id === target.id);
    });
    renderActiveQuests();

    switchTab('home');
    setTimeout(() => {
      // 同步設定終點站為該任務的目標站點
      document.getElementById("sim-start-station").value = "台北車站";
      
      const endSelector = document.getElementById("sim-end-station");
      if (endSelector) {
        // 尋找對應的選項並選中它
        for (let i = 0; i < endSelector.options.length; i++) {
          if (endSelector.options[i].value.includes(target.station)) {
            endSelector.selectedIndex = i;
            break;
          }
        }
      }
      
      // 自動選取第二位成員 (楊小芸) 模擬雙人同行
      const checkboxes = document.querySelectorAll('input[name="sim-companion-check"]');
      if (checkboxes.length >= 2) {
        checkboxes[0].checked = true;
        checkboxes[1].checked = true;
        checkboxes[1].parentElement.classList.add("checked");
        for (let i = 2; i < checkboxes.length; i++) {
          checkboxes[i].checked = false;
          checkboxes[i].parentElement.classList.remove("checked");
        }
      }
      triggerRideSimulation();
    }, 200);
  });

  document.getElementById("btn-interactive-vision").addEventListener("click", () => {
    let quest = STATE.activeQuests[0];
    if (!quest) {
      quest = generateRandomQuest("default-quest");
      STATE.activeQuests.push(quest);
    }
    
    // 強制將該任務設為步驟三，以供收據驗證展示
    quest.step = 3;
    
    // 收合其他所有任務，展開當前任務
    STATE.activeQuests.forEach(q => {
      q.isExpanded = (q.id === quest.id);
    });
    renderActiveQuests();

    switchTab('quest');
    setTimeout(() => {
      triggerReceiptSimulation(quest.id);
    }, 300);
  });

  document.getElementById("btn-sim-commute").addEventListener("click", triggerCommuteSimulation);

  // 步驟四：滿額結算模擬
  document.getElementById("btn-interactive-settle").addEventListener("click", () => {
    switchTab('vault');
    setTimeout(() => {
      // 模擬增加點數使其超過目標
      const amountToAdd = 15050 - STATE.vaultPoints;
      addPoints(amountToAdd, 0); // 增加點數，將會自動觸發達標彈窗
    }, 200);
  });

  // 結算確認按鈕
  document.getElementById("btn-confirm-settlement").addEventListener("click", resetDemoToInitial);

  // 綁定 App 內按鈕
  document.getElementById("btn-trigger-route").addEventListener("click", triggerRideSimulation);

  // 邀請彈窗
  const inviteBtn = document.getElementById("btn-invite-member");
  if (inviteBtn) {
    inviteBtn.addEventListener("click", () => {
      document.getElementById("invite-modal").style.display = "flex";
    });
  }
  document.getElementById("btn-close-invite").addEventListener("click", closeInviteModal);
  document.getElementById("btn-cancel-invite").addEventListener("click", closeInviteModal);
  document.getElementById("btn-submit-invite").addEventListener("click", submitInvite);

  // 編輯成員屬性彈窗事件綁定
  document.getElementById("btn-close-edit-member").addEventListener("click", () => {
    document.getElementById("edit-member-modal").style.display = "none";
  });
  document.getElementById("btn-cancel-edit-member").addEventListener("click", () => {
    document.getElementById("edit-member-modal").style.display = "none";
  });
  document.getElementById("btn-submit-edit-member").addEventListener("click", () => {
    const idx = parseInt(document.getElementById("edit-member-index").value);
    const name = document.getElementById("edit-member-name").value.trim();
    const phone = document.getElementById("edit-member-phone").value.trim();
    const gender = document.getElementById("edit-member-gender").value;
    const ageVal = document.getElementById("edit-member-age").value.trim();
    const age = parseInt(ageVal);
    
    if (!name) {
      alert("請輸入姓名！");
      return;
    }
    if (!phone || !/^09\d{8}$/.test(phone)) {
      alert("請輸入正確的手機號碼 (格式：09xxxxxxxx)！");
      return;
    }
    if (isNaN(age) || age < 1 || age > 120) {
      alert("請輸入正確的年齡 (1 ~ 120)！");
      return;
    }
    
    // 更新成員屬性
    const m = STATE.members[idx];
    m.name = name;
    m.phone = phone;
    m.gender = gender;
    m.age = age;
    
    document.getElementById("edit-member-modal").style.display = "none";
    showToast("修改成功", `✨ 成員 ${name} 的屬性已成功更新！`, "teal");
    
    renderMemberList();
    renderSimCompanions(); // 更新首頁模擬器中的姓名
    renderActiveQuests(); // 更新任務大廳中的姓名
  });

  // 任務推薦區接受任務 (事件委派，支援動態重新整理)
  const recommendedQuestsContainer = document.getElementById("recommended-quests-container");
  if (recommendedQuestsContainer) {
    recommendedQuestsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-accept-quest");
      if (btn) {
        const title = btn.getAttribute("data-title");
        const points = btn.getAttribute("data-points");
        const station = btn.getAttribute("data-station");
        const category = btn.getAttribute("data-category") || "咖啡廳☕";
        
        acceptNewQuest(title, points, station, category);
        
        // 接受完畢後，即時重新隨機換推薦任務！
        renderRecommendedQuests();
      }
    });
  }

  // 初始渲染推薦任務
  renderRecommendedQuests();

  // 初始化時間顯示
  updateStatusTime();
  setInterval(updateStatusTime, 30000); // 每半分鐘更新狀態列時間

});

/* ==========================================================================
   3. 模擬功能核心邏輯
   ========================================================================== */

/**
 * 模擬乘車出站：觸發 AI 分析與解鎖任務
 */
function triggerRideSimulation() {
  updateIsland("正在分析通勤軌跡...", "active purple");
  showToast("捷運動態票證偵測", "系統收到捷運卡進站/出站信號...", "teal");

  // 首頁欄位數據讀取
  const startSt = document.getElementById("sim-start-station").value;
  const endSt = document.getElementById("sim-end-station").value;
  
  // 取得所選的乘車隊員 (多選核取方塊)
  const checkedBoxes = Array.from(document.querySelectorAll('input[name="sim-companion-check"]:checked'));
  const riderIndices = checkedBoxes.map(cb => parseInt(cb.value));
  const riderCount = riderIndices.length;
  
  // 提取乾淨的終點站名 (例如 "台大醫院 (R09)" -> "台大醫院")
  const cleanEndSt = endSt.trim().split(" ")[0];

  setTimeout(() => {
    // 檢查是否有匹配該目的地站點的進行中任務
    const matchingQuest = STATE.activeQuests.find(q => q.station === cleanEndSt);
    if (!matchingQuest) {
      const riderNames = riderIndices.map(idx => STATE.members[idx].name.split(" ")[0]).join("、");
      const totalPoints = 15 * riderCount;
      
      if (riderCount === 1) {
        // 普通個人通勤，發放基礎個人通勤回饋！
        updateIsland("個人通勤 +15 pt", "active success");
        showToast("個人通勤點數發放", `偵測到單人出站，發放基礎回饋 +15 pt。`, "teal");
        addPoints(15, 0);
        
        // 寫入金庫明細交易日誌
        insertVaultLog("個人通勤回饋 (我)", `剛剛 · ${startSt} ➔ ${endSt}`, "+15 pt", "positive", "fa-train-subway", "bg-light-green", "text-green");
      } else {
        // 多人同行通勤，發放每人基礎回饋！
        updateIsland(`👥 同行出站 +${totalPoints} pt`, "active success");
        showToast("捷運同行回饋", `偵測到 ${riderCount} 人同行出站，發放每人基礎回饋 +15 pt (共 +${totalPoints} pt)！`, "teal");
        
        // 每一位乘車隊員增加點數
        riderIndices.forEach(idx => {
          addPoints(15, idx);
        });
        
        // 寫入金庫明細交易日誌 (包含同行所有人姓名)
        insertVaultLog(`捷運同行回饋 (${riderNames})`, `剛剛 · ${startSt} ➔ ${endSt}`, `+${totalPoints} pt`, "positive", "fa-people-group", "bg-light-green", "text-green");
      }
      return;
    }
    
    // 找到尚未出站的任務 (step === 1)
    const targetQuest = STATE.activeQuests.find(q => q.station === cleanEndSt && q.step === 1);
    if (!targetQuest) {
      showToast("重複搭乘", `您已完成該站點 (${cleanEndSt}) 的乘車出站步驟！請直接前往步驟三上傳收據。`, "gold");
      updateIsland("⚠️ 重複搭乘", "active danger");
      return;
    }

    // 只有在多人同行 (riderCount > 1) 時，才能解鎖共同出站任務步驟！
    if (riderCount > 1) {
      const countPrefix = riderCount === 2 ? "雙人" : (riderCount === 3 ? "三人" : "多人");
      updateIsland(`👥 偵測到${countPrefix}同行意圖 (94%)`, "active purple");
      showToast("Vertex AI 驗證成功", `結合票證軌跡比對，已解鎖「${targetQuest.title}」之特約商家步驟！`, "purple");
      
      // 更新任務狀態與點數獎勵
      targetQuest.step = 3;
      targetQuest.timerSeconds = 7200 + Math.floor(Math.random() * 3600); // 隨機倒數 2.x 小時
      
      // 根據實際乘車人數提升獎勵點數！
      targetQuest.reward = riderCount === 2 ? 250 : (riderCount === 3 ? 400 : 550);
      targetQuest.riders = riderIndices.map(idx => STATE.members[idx].name);
      
      // 自動將該更新的任務展開，其它任務收起
      STATE.activeQuests.forEach(q => {
        q.isExpanded = (q.id === targetQuest.id);
      });

      // 重新渲染所有的進行中任務卡
      renderActiveQuests();

      // 顯示任務大廳導覽列紅點提示
      const navDot = document.getElementById("nav-quest-dot");
      if (navDot) navDot.classList.add("active");

      // 根據實際人數，每人發放基礎通勤回饋 +15 pt (共 +30 / +45 pt)
      const baseCommutePoints = 15 * riderCount;
      riderIndices.forEach(idx => {
        addPoints(15, idx);
      });

      // 寫入金庫明細交易日誌 (包含同行所有人姓名，顯示獲得的乘車基礎回饋)
      const riderNames = riderIndices.map(idx => STATE.members[idx].name.split(" ")[0]).join("、");
      insertVaultLog(`戰隊共同出站 (${riderNames})`, `剛剛 · ${startSt} ➔ ${endSt} 乘車抵達`, `+${baseCommutePoints} pt`, "positive", "fa-people-group", "bg-light-purple", "text-purple");

      // 自動切換到任務頁籤，讓使用者方便看
      setTimeout(() => {
        switchTab("quest");
      }, 1000);
    } else {
      // 個人通勤：不推進共同任務，只發放基本通勤點數並提示
      updateIsland("個人通勤 +15 pt", "active success");
      showToast("個人通勤點數發放", `偵測到單人出站，發放基礎回饋 +15 pt。`, "teal");
      showToast("未滿足同行條件", `⚠️ 本次出站為個人通勤，未滿足「共同出站」之任務條件。請在乘車時勾選同行戰友！`, "gold");
      addPoints(15, 0); // 加 15 點給個人(成員0)

      // 記錄本次出站的單人成員，以便在步驟一卡片上顯示其為 已出站 ✓
      targetQuest.riders = riderIndices.map(idx => STATE.members[idx].name);
      renderActiveQuests(); // 重新更新任務列表顯示狀態
      
      // 寫入金庫明細交易日誌
      insertVaultLog("個人通勤回饋 (我)", `剛剛 · ${startSt} ➔ ${endSt}`, "+15 pt", "positive", "fa-train-subway", "bg-light-green", "text-green");
    }
  }, 1500);
}

/**
 * 模擬上傳收據：Gemini Vision 辨識與金庫點數注入
 */
/**
 * 模擬上傳收據：Gemini Vision 辨識與金庫點數注入 (支持多任務參數)
 */
function triggerReceiptSimulation(questId) {
  // 如果沒有指定 ID，自動尋找目前第一個在步驟三的任務
  let targetQuestId = questId;
  if (!targetQuestId) {
    const defaultQuest = STATE.activeQuests.find(q => q.step === 3);
    if (defaultQuest) {
      targetQuestId = defaultQuest.id;
    } else {
      showToast("提示", "目前沒有進行中或待驗證收據的任務。請先模擬乘車以解鎖任務！", "gold");
      return;
    }
  }

  const quest = STATE.activeQuests.find(q => q.id === targetQuestId);
  if (!quest) return;

  // 顯示該卡片底下的掃描覆蓋動畫，並隱藏上傳按鈕區域
  const wrapper = document.getElementById("upload-wrapper-" + quest.id);
  const overlay = document.getElementById("scanning-overlay-" + quest.id);
  const logText = document.getElementById("ai-log-text-" + quest.id);
  if (wrapper) wrapper.style.display = "none";
  if (overlay) overlay.style.display = "flex";
  
  // 模擬 Gemini AI 逐步辨識日誌
  const cat = quest.category || "咖啡廳☕";
  let shopKeyword = "角樂園咖啡 (特約咖啡廳)";
  let itemKeyword = "招牌黑糖拿鐵與手工焦糖布丁";
  
  if (cat.includes("飲料店")) {
    shopKeyword = "吾桐號 (特約飲料店)";
    itemKeyword = "特選杏仁凍五桐茶與凍頂烏龍";
  } else if (cat.includes("文創選物") || cat.includes("文創")) {
    shopKeyword = "小月子商號 (特約選物店)";
    itemKeyword = "原創印花布包、手寫手帳選物組";
  }

  const rewardVal = quest.reward || 250;
  const logs = [
    "[17:10:01] [Vertex AI] 啟動 Gemini 1.5 Flash 多模態視覺模型...",
    "[17:10:02] [Gemini Vision] 載入影像位元流... 辨識為收據發票格式。",
    `[17:10:02] [Gemini Vision] 掃描文字中：擷取關鍵字「${shopKeyword}」、「${quest.station}店」...`,
    `[17:10:03] [Gemini Vision] 偵測到交易金額「$320」、消費項目「${itemKeyword}」...`,
    `[17:10:03] [Gemini Vision] 比對消費時間與${quest.station}站出站時間，吻合度 99%！`,
    `[17:10:04] [Vertex AI] 任務條件判定：同行乘車出站 ＋ 指定「${cat}」特約商家消費 ＝ 條件完全滿足！`,
    `[17:10:04] [系統核發] 發放金庫點數獎勵：+${rewardVal} pt 批准送出。`
  ];

  let currentLogIdx = 0;
  if (logText) logText.innerText = "";
  
  const logInterval = setInterval(() => {
    if (logText && currentLogIdx < logs.length) {
      logText.innerText += logs[currentLogIdx] + "\n";
      logText.scrollTop = logText.scrollHeight;
      currentLogIdx++;
    }
  }, 400);

  // 3秒後完成辨識
  setTimeout(() => {
    clearInterval(logInterval);
    if (overlay) overlay.style.display = "none";
    if (wrapper) wrapper.style.display = "block";
    
    // 標註該任務為完成
    quest.step = 4;
    renderActiveQuests();

    // 動態島顯示成功
    updateIsland(`✓ Gemini 驗證成功！+${rewardVal} pt`, "active success");
    showToast("Gemini 審核通過", `多模態視覺比對成功！任務完成，+${rewardVal} pt 已注入金庫。`, "purple");

    // 金庫點數增加
    addPoints(rewardVal, 0); 

    // 播放點數飄浮特效
    const uploadBtn = document.querySelector(`.btn-upload-receipt[data-id="${quest.id}"]`);
    if (uploadBtn) spawnFloatingPoints(`+${rewardVal} pt`, uploadBtn);
    
    // 增加一筆入點明細到金庫
    insertVaultLog(`任務完成：${quest.title}`, "剛剛 · Gemini 視覺審核收據通過", `+${rewardVal} pt`, "positive", "fa-wand-magic-sparkles", "bg-light-purple", "text-purple");

    // 4秒後將任務從列表中淡出移除
    setTimeout(() => {
      STATE.activeQuests = STATE.activeQuests.filter(q => q.id !== quest.id);
      renderActiveQuests();
    }, 4000);

  }, 3200);
}

/**
 * 模擬日常通勤入點 (+15 pt)
 */
function triggerCommuteSimulation() {
  updateIsland("個人通勤 +15 pt", "active success");
  showToast("乘車回饋", "通勤出站成功，發放 +15 pt 回饋。", "teal");
  addPoints(15, 0); // 加 15 點給成員 0
  
  // 飄浮字體
  const homeBtn = document.getElementById("btn-trigger-route");
  spawnFloatingPoints("+15 pt", homeBtn);

  // 金庫入點明細
  insertVaultLog("捷運搭乘回饋 (我)", "剛剛 · 台北車站 → 中山站", "+15 pt", "positive", "fa-train-subway", "bg-light-green", "text-green");
}

/* ==========================================================================
   4. UI 渲染與點數更新動畫 (Dynamic Score & UI Updates)
   ========================================================================== */

/**
 * 動態增加點數並播放遞增動畫
 */
function addPoints(amount, memberIndex) {
  const targetPersonal = STATE.personalPoints + amount;
  const targetVault = STATE.vaultPoints + amount;

  // 個人點數遞增動畫
  animateNumber("home-personal-points", STATE.personalPoints, targetPersonal, " pt", 400);
  STATE.personalPoints = targetPersonal;

  // 金庫點數遞增動畫
  animateNumber("vault-points-display", STATE.vaultPoints, targetVault, "", 500);
  STATE.vaultPoints = targetVault;

  // 更新成員的貢獻度
  STATE.members[memberIndex].points += amount;
  const memberPointsSpan = document.getElementById(`val-member-${memberIndex}`);
  if (memberPointsSpan) {
    animateNumber(`val-member-${memberIndex}`, STATE.members[memberIndex].points - amount, STATE.members[memberIndex].points, "", 400);
  }

  // 計算並更新進度環與條
  setTimeout(() => {
    updatePointsUI(true);
  }, 500);
}

/**
 * 更新進度環和所有進度條 UI
 */
function updatePointsUI(shouldAnimate) {
  // 1. 計算金庫達成率
  const percent = Math.min(Math.round((STATE.vaultPoints / STATE.vaultTarget) * 100), 100);
  document.getElementById("vault-percent-display").innerText = percent;
  
  const leftPoints = Math.max(STATE.vaultTarget - STATE.vaultPoints, 0);
  document.getElementById("vault-left-points").innerText = leftPoints.toLocaleString() + " pt";

  // 2. 更新圓環 SVG offset
  // dashoffset = DASH_ARRAY - (percent/100 * DASH_ARRAY)
  const offset = DASH_ARRAY - (percent / 100 * DASH_ARRAY);
  const circle = document.getElementById("vault-progress-circle");
  circle.style.strokeDashoffset = offset;

  // 3. 更新首頁個人總數
  document.getElementById("home-personal-points").innerHTML = `${STATE.personalPoints.toLocaleString()} <span class="unit">pt</span>`;

  // 4. 重新渲染成員列表以更新進度條
  renderMemberList();

  // 5. 檢查金庫是否已達標（超過 15,000 pt），如果是則觸發達標結算彈窗
  if (STATE.vaultPoints >= STATE.vaultTarget) {
    const modal = document.getElementById("settlement-modal");
    if (modal && modal.style.display !== "flex") {
      setTimeout(() => {
        showSettlementModal();
      }, 1000);
    }
  }
}

/**
 * 數字遞增動畫函數
 */
function animateNumber(elementId, start, end, suffix = "", duration = 600) {
  const obj = document.getElementById(elementId);
  if (!obj) return;
  
  const range = end - start;
  let startTime = null;

  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const currentVal = Math.floor(progress * range + start);
    
    if (suffix.includes("unit")) {
      obj.innerHTML = `${currentVal.toLocaleString()} ${suffix}`;
    } else {
      obj.innerText = currentVal.toLocaleString() + suffix;
    }
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      if (suffix.includes("unit")) {
        obj.innerHTML = `${end.toLocaleString()} ${suffix}`;
      } else {
        obj.innerText = end.toLocaleString() + suffix;
      }
    }
  }

  window.requestAnimationFrame(step);
}

/* ==========================================================================
   5. 視窗小工具、定時器與通知系統
   ========================================================================== */

/**
 * 動態島狀態變更器
 */
function updateIsland(message, typeClasses = "active") {
  const island = document.getElementById("phone-dynamic-island");
  const islandText = island.querySelector(".island-text");
  const statusBar = document.querySelector(".phone-status-bar");
  
  island.className = `dynamic-island ${typeClasses}`;
  islandText.innerText = message;

  if (statusBar && typeClasses.includes("active")) {
    statusBar.classList.add("island-active");
  }

  // 3.5秒後收回動態島
  setTimeout(() => {
    island.className = "dynamic-island";
    islandText.innerText = "系統運作中";
    if (statusBar) {
      statusBar.classList.remove("island-active");
    }
  }, 4500);
}

/**
 * 頂部浮動 Toast 系統
 */
function showToast(title, message, type = "teal") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast-item ${type}`;
  
  let icon = "fa-info-circle";
  if (type === "purple") icon = "fa-wand-magic-sparkles";
  if (type === "teal") icon = "fa-train-subway";
  if (type === "gold") icon = "fa-circle-exclamation";

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div class="toast-body">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;

  container.appendChild(toast);

  // 4秒後淡出，然後移除
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

/**
 * 產生飄浮數字動畫
 */
function spawnFloatingPoints(text, targetElement) {
  const rect = targetElement.getBoundingClientRect();
  const phoneViewport = document.querySelector(".app-viewport");
  const viewportRect = phoneViewport.getBoundingClientRect();

  const floating = document.createElement("div");
  floating.className = "floating-points";
  floating.innerText = text;

  // 計算相對於 viewport 的絕對位置
  const x = rect.left - viewportRect.left + (rect.width / 2) - 20;
  const y = rect.top - viewportRect.top - 10;

  floating.style.left = `${x}px`;
  floating.style.top = `${y}px`;

  phoneViewport.appendChild(floating);

  setTimeout(() => {
    floating.remove();
  }, 1500);
}

/**
 * 手態插入一筆金庫交易日誌
 */
function insertVaultLog(title, timeDesc, pointsStr, typeClass, iconClass, bgClass, textClass) {
  const logList = document.getElementById("vault-log-list");
  const logItem = document.createElement("div");
  logItem.className = "log-item";
  
  logItem.innerHTML = `
    <div class="log-icon ${bgClass}"><i class="fa-solid ${iconClass} ${textClass}"></i></div>
    <div class="log-text">
      <strong>${title}</strong>
      <span>${timeDesc}</span>
    </div>
    <div class="log-points ${typeClass}">${pointsStr}</div>
  `;

  logList.insertBefore(logItem, logList.firstChild);
}

/**
 * 限時任務計時器
 */
function initTimer() {
  setInterval(() => {
    if (STATE.activeQuests) {
      STATE.activeQuests.forEach(quest => {
        if (quest.timerSeconds > 0) {
          quest.timerSeconds--;
          const timerText = document.getElementById(`quest-timer-text-${quest.id}`);
          if (timerText) {
            const hrs = Math.floor(quest.timerSeconds / 3600);
            const mins = Math.floor((quest.timerSeconds % 3600) / 60);
            const secs = quest.timerSeconds % 60;
            const pad = (num) => String(num).padStart(2, "0");
            timerText.innerText = `剩餘 ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
          }
        }
      });
    }
  }, 1000);
}

/**
 * 狀態列時間即時更新
 */
function updateStatusTime() {
  const timeSpans = document.querySelectorAll(".phone-status-bar .time");
  const now = new Date();
  const hrs = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  
  timeSpans.forEach(span => {
    span.innerText = `${hrs}:${mins}`;
  });
}

/**
 * 模擬接受新任務
 */
function acceptNewQuest(title, points, station, category = "咖啡廳☕") {
  // 檢查是否已經有同站點的進行中任務
  const isDuplicate = STATE.activeQuests.some(q => q.station === station);
  if (isDuplicate) {
    showToast("重複任務", `⚠️ 您已經有此站點 (${station}) 的進行中任務，請先完成它！`, "gold");
    return;
  }

  // 收合其他所有進行中任務
  STATE.activeQuests.forEach(q => {
    q.isExpanded = false;
  });

  const newQuest = {
    id: "quest-" + Date.now(),
    title: title,
    station: station,
    category: category,
    reward: parseInt(points) || 250,
    step: 1,
    timerSeconds: 3600 * 3, // 預設 3 小時
    riders: [],
    invitees: [],
    isExpanded: true // 新任務預設展開
  };
  STATE.activeQuests.push(newQuest);

  showToast("任務接受成功", `限時任務「${title}」已加入您的進行清單！`, "purple");
  updateIsland(`已接受：${title}`, "active purple");

  renderActiveQuests(); // 重新渲染進行中任務列表
  
  // 觸發模擬乘車動作，將首頁終點站同步設為此任務目標站
  const endSelector = document.getElementById("sim-end-station");
  if (endSelector) {
    // 找出匹配的 option 並選中它
    for (let i = 0; i < endSelector.options.length; i++) {
      if (endSelector.options[i].value.includes(station)) {
        endSelector.selectedIndex = i;
        break;
      }
    }
  }

  // 觸發模擬乘車動作，將首頁終點站同步設為此任務目標站
  document.getElementById("sim-end-station").value = station;

  // 提示切換到首頁來模擬搭乘，或者點擊控制台的乘車模擬
  setTimeout(() => {
    showToast("引導", `請點擊首頁「模擬乘車出站」，模擬雙人抵達${station}站以自動解鎖前兩步驟！`, "gold");
  }, 1200);
}

/* ==========================================================================
   6. 邀請彈窗互動
   ========================================================================== */
function closeInviteModal() {
  document.getElementById("invite-modal").style.display = "none";
}

function submitInvite() {
  const name = document.getElementById("invite-name").value.trim() || "受邀人";
  const phone = document.getElementById("invite-phone").value.trim();
  const relation = document.getElementById("invite-relation").value;
  const gender = document.getElementById("invite-gender").value;
  const ageVal = document.getElementById("invite-age").value.trim();
  const age = ageVal ? parseInt(ageVal) : (20 + Math.floor(Math.random() * 15));
  
  if (!phone || !/^09\d{8}$/.test(phone)) {
    alert("請輸入正確的手機號碼 (格式：09xxxxxxxx)！");
    return;
  }
  if (ageVal && (isNaN(age) || age < 1 || age > 120)) {
    alert("請輸入正確的年齡 (1 ~ 120)！");
    return;
  }

  closeInviteModal();
  updateIsland("邀請函發送中...", "active purple");
  showToast("邀請發送中", `已發送邀請簡訊給 ${name} (${phone})。`, "teal");

  setTimeout(() => {
    // 模擬好友接受邀請
    updateIsland(`🎉 ${name} 已加入金庫`, "active success");
    showToast("成員已加入", `🎉 ${name} 接受了邀請，攜帶點數加入「快閃戰隊金庫」！`, "purple");
    
    // 將新好友加入金庫成員列表
    const initials = name.charAt(0);
    const newPoints = 1200 + Math.floor(Math.random() * 800); // 隨機攜帶 1200-2000 點
    const color = STATE.members.length % 2 === 0 ? "bg-orange" : "bg-green";
    
    STATE.members.push({
      name: `${name} (${relation})`,
      phone: phone,
      gender: gender,
      age: age,
      points: newPoints,
      color: color,
      max: 6500
    });
    
    // 更新金庫總點數 (累加好友帶入的點數)
    const targetVault = STATE.vaultPoints + newPoints;
    animateNumber("vault-points-display", STATE.vaultPoints, targetVault, "", 600);
    STATE.vaultPoints = targetVault;
    
    // 渲染更新後的金庫成員列表與模擬乘車核取方塊
    renderMemberList();
    renderSimCompanions();
    
    // 寫入交易日誌
    insertVaultLog(`${name} 攜點加入金庫 (${relation})`, "剛剛 · 成功連結", `+${newPoints.toLocaleString()} pt`, "positive", "fa-user-plus", "bg-light-gold", "text-gold");
    
      // 尋找對應被邀請的任務 ID
      const targetQuestId = STATE.currentInvitingQuestId || "default-quest";
      const targetQuest = STATE.activeQuests.find(q => q.id === targetQuestId);
      
      if (targetQuest && targetQuest.step === 3) {
        let newTitle = targetQuest.title;
        let newReward = 400;
        
        if (targetQuest.title.startsWith("雙人")) {
          newTitle = targetQuest.title.replace("雙人", "三人");
          newReward = 400;
        } else if (targetQuest.title.startsWith("三人")) {
          newTitle = targetQuest.title.replace("三人", "四人");
          newReward = 550;
        } else {
          newTitle = "共同" + targetQuest.title;
          newReward = 600;
        }
        
        targetQuest.title = newTitle;
        targetQuest.reward = newReward;
        targetQuest.invitees.push(name); // 加到邀請名單
        
        showToast("任務獎勵提升！", `👥 由於新成員 ${name} 共同參與，任務獎勵提高至 +${newReward} pt！`, "purple");
      }
      
      renderActiveQuests(); // 重新渲染所有的進行中任務卡
  }, 2200);
}

/**
 * 動態渲染金庫成員列表
 */
function renderMemberList() {
  const list = document.getElementById("vault-member-list");
  if (!list) return;
  list.innerHTML = "";
  
  // 1. 渲染既有成員
  STATE.members.forEach((m, idx) => {
    const initials = m.name.charAt(0);
    const mPercent = Math.min(Math.round((m.points / m.max) * 100), 100);
    const item = document.createElement("div");
    item.className = "member-item";
    
    const genderStr = m.gender || "男";
    const ageStr = m.age ? `${m.age}歲` : "25歲";
    
    item.innerHTML = `
      <div class="member-avatar ${m.color}">${initials}</div>
      <div class="member-info">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="member-name" style="font-weight: 700; color: var(--text-dark);">${m.name}</span>
          <span style="font-size: 0.58rem; color: var(--text-muted); background-color: #f1f1f1; padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 2px;">
            ${genderStr} · ${ageStr}
          </span>
          <a href="javascript:void(0)" class="btn-edit-member" data-index="${idx}" style="color: var(--primary-teal); font-size: 0.72rem; margin-left: 2px; text-decoration: none; cursor: pointer;" title="編輯成員屬性"><i class="fa-solid fa-pen"></i></a>
        </div>
        <div class="member-progress-container" style="margin-top: 4px;">
          <div class="member-progress-bar ${m.color}" style="width: ${mPercent}%"></div>
        </div>
      </div>
      <div class="member-points">
        <span class="val" id="val-member-${idx}">${m.points.toLocaleString()}</span> <span class="unit">pt</span>
      </div>
    `;
    list.appendChild(item);
  });

  // 重新綁定編輯成員點擊事件
  list.querySelectorAll(".btn-edit-member").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-index"));
      const m = STATE.members[idx];
      
      document.getElementById("edit-member-index").value = idx;
      document.getElementById("edit-member-name").value = m.name;
      document.getElementById("edit-member-phone").value = m.phone || "";
      document.getElementById("edit-member-gender").value = m.gender || "男";
      document.getElementById("edit-member-age").value = m.age || 25;
      
      document.getElementById("edit-member-modal").style.display = "flex";
    });
  });

  // 2. 渲染顯眼的邀請入口卡片（虛線邊框與高亮按鈕效果）
  const inviteItem = document.createElement("div");
  inviteItem.className = "member-item invite-squad-trigger";
  inviteItem.style.cursor = "pointer";
  inviteItem.style.border = "2px dashed var(--primary-teal)";
  inviteItem.style.backgroundColor = "rgba(0, 137, 123, 0.03)";
  inviteItem.style.borderRadius = "12px";
  inviteItem.style.padding = "0.75rem";
  inviteItem.style.marginTop = "0.8rem";
  inviteItem.style.transition = "all var(--transition-fast)";
  inviteItem.style.display = "flex";
  inviteItem.style.alignItems = "center";
  inviteItem.style.gap = "10px";
  
  inviteItem.innerHTML = `
    <div class="member-avatar" style="background: rgba(0, 137, 123, 0.1); border: 2px dashed var(--primary-teal); color: var(--primary-teal); font-weight: 700; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;"><i class="fa-solid fa-plus"></i></div>
    <div class="member-info" style="flex-grow: 1;">
      <span class="member-name" style="color: var(--primary-teal); font-weight: 700; font-size: 0.85rem; display: block;">+ 邀請成員加入金庫</span>
      <span style="font-size: 0.68rem; color: var(--text-muted); display: block; margin-top: 2px;">合力眾籌點數，即時加碼多人任務獎勵！</span>
    </div>
    <i class="fa-solid fa-chevron-right" style="color: var(--primary-teal); font-size: 0.8rem; margin-right: 4px;"></i>
  `;
  
  inviteItem.addEventListener("click", () => {
    document.getElementById("invite-name").value = "";
    document.getElementById("invite-phone").value = "";
    document.getElementById("invite-gender").value = "男";
    document.getElementById("invite-age").value = "";
    document.getElementById("invite-relation").value = "家庭";
    document.getElementById("invite-modal").style.display = "flex";
  });
  
  // 懸停特效
  inviteItem.addEventListener("mouseenter", () => {
    inviteItem.style.backgroundColor = "rgba(0, 137, 123, 0.08)";
    inviteItem.style.transform = "scale(1.01)";
  });
  inviteItem.addEventListener("mouseleave", () => {
    inviteItem.style.backgroundColor = "rgba(0, 137, 123, 0.03)";
    inviteItem.style.transform = "scale(1)";
  });

  list.appendChild(inviteItem);
}

/**
 * 顯示右上角電腦端時間
 */
function initRealtimeClock() {
  // 可擴充
}

/**
 * 動態渲染首頁「通勤模擬」的隊員多選核取方塊
 */
function renderSimCompanions() {
  const container = document.getElementById("sim-companions-list");
  if (!container) return;
  container.innerHTML = "";
  
  STATE.members.forEach((m, idx) => {
    const initials = m.name.charAt(0);
    const label = document.createElement("label");
    label.className = `sim-member-checkbox-label ${idx === 0 ? 'checked' : ''}`;
    
    // 我 (idx === 0) 預設勾選且禁用修改，因為它是自己
    const checkedAttr = idx === 0 ? "checked disabled" : "";
    
    label.innerHTML = `
      <input type="checkbox" name="sim-companion-check" value="${idx}" ${checkedAttr}>
      <span class="m-dot ${m.color}" style="width: 14px; height: 14px; font-size: 0.5rem; line-height: 14px;">${initials}</span>
      <span>${m.name.split(" ")[0]}</span>
    `;
    
    // 監聽勾選狀態，動態切換 class 樣式
    const checkbox = label.querySelector("input");
    checkbox.addEventListener("change", (e) => {
      label.classList.toggle("checked", e.target.checked);
    });
    
    container.appendChild(label);
  });
}

/**
 * 顯示金庫滿額分帳結算彈窗
 */
function showSettlementModal() {
  const modal = document.getElementById("settlement-modal");
  if (!modal) return;
  
  // 播放達標慶祝音效/震動 (模擬)
  updateIsland("🎉 金庫目標已達成！", "active success");
  showToast("恭喜！", "社群金庫眾籌目標 15,000 pt 已達成！即刻開啟分帳。", "purple");

  // 顯示金庫總額
  document.getElementById("settle-total-points").innerText = STATE.vaultPoints.toLocaleString() + " pt";
  
  // 計算每人平分金額
  const count = STATE.members.length;
  const share = Math.floor(STATE.vaultPoints / count);
  
  // 渲染分帳名單清單
  const listContainer = document.getElementById("settle-member-list");
  listContainer.innerHTML = "";
  
  STATE.members.forEach(m => {
    const initials = m.name.charAt(0);
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.padding = "6px 8px";
    row.style.backgroundColor = "#fff";
    row.style.borderRadius = "8px";
    row.style.border = "1px solid #eee";
    
    row.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px;">
        <span class="m-dot ${m.color}" style="width: 16px; height: 16px; font-size: 0.55rem; line-height: 16px;">${initials}</span>
        <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-dark);">${m.name.split(" ")[0]}</span>
      </div>
      <strong style="font-size: 0.72rem; color: var(--primary-teal);">+${share.toLocaleString()} <span style="font-size: 0.55rem; font-weight: normal; color: var(--text-muted);">pt</span></strong>
    `;
    listContainer.appendChild(row);
  });
  
  // 顯示彈窗
  modal.style.display = "flex";
}

/**
 * 結算完成，重置 Demo 為初始狀態
 */
function resetDemoToInitial() {
  // 1. 重置數據狀態
  STATE.personalPoints = 5820;
  STATE.vaultPoints = 12480;
  STATE.vaultTarget = 15000;
  STATE.members = [
    { name: "我", phone: "0912345678", gender: "男", age: 28, points: 5820, color: "bg-blue", max: 6500 },
    { name: "楊小芸 (伴侶)", phone: "0987654321", gender: "女", age: 25, points: 4310, color: "bg-pink", max: 6500 },
    { name: "陳阿明 (好友)", phone: "0976543210", gender: "男", age: 30, points: 2350, color: "bg-green", max: 6500 }
  ];
  STATE.questActive = true;
  STATE.questStep = 3;
  STATE.questStation = "中山";
  STATE.questTimerSeconds = 8073;
  STATE.questReward = 250;

  // 2. 重新渲染 UI 列表與同行隊員選擇核取方塊
  renderMemberList();
  renderSimCompanions();
  updatePointsUI(false);

  // 3. 隱藏結算彈窗
  document.getElementById("settlement-modal").style.display = "none";

  // 4. 重置任務大廳 UI 狀態為隨機產生的步驟 1 任務
  STATE.activeQuests = [
    generateRandomQuest("default-quest")
  ];
  renderActiveQuests();
  renderRecommendedQuests();

  // 重置首頁輸入值
  document.getElementById("sim-start-station").value = "台北車站";
  document.getElementById("sim-end-station").value = "中山";

  // 5. 清除任務導覽紅點
  document.getElementById("nav-quest-dot").classList.remove("active");

  // 7. 切換到金庫分頁，向使用者展示金庫已重置回 12,480 (83%) 狀態
  switchTab("vault");

  showToast("重置成功", "✨ 金庫已完成結算，演示環境已重置為初始狀態！", "teal");
  updateIsland("✨ 演示環境已重置", "active success");
}

/**
 * 合作店家資料庫 (5 個捷運站，各有 3 個分類，每個分類 3 家特約商店)
 */
const COOPERATIVE_SHOPS = {
  "中山": {
    "咖啡廳☕": [
      { name: "角樂園咖啡 Triangle Garden", desc: "老屋改建文青風，招牌黑糖拿鐵與手作布丁", promo: "出示票證享 9 折" },
      { name: "心中山 浮影書店", desc: "結合獨立書店的複合式精品老宅咖啡", promo: "消費贈送捷運點數 10 pt" },
      { name: "Melty Finger 甜點工坊", desc: "人氣馬卡龍名店，拿鐵配手作彩虹馬卡龍", promo: "滿 $200 現折 $20" }
    ],
    "飲料店🥤": [
      { name: "吾桐號 WooTea (中山店)", desc: "招牌杏仁凍五桐茶，濃郁茶香與 Q 彈凍飲", promo: "捷運點數折抵 5 pt/杯" },
      { name: "SOYA 特調茶飲 (中山概念店)", desc: "網紅評選全台第一名特調歐蕾奶茶", promo: "出示 App 免費加特製茶凍" },
      { name: "茶靜茶 Tea To Tea", desc: "台灣精品小農契作，在地現泡鮮奶茶專賣", promo: "全品項享 95 折" }
    ],
    "文創選物🎨": [
      { name: "Zikka W 雜貨舖", desc: "日系復古古著、原創插畫與手工飾品選物", promo: "消費即享 9 折並送 20 pt" },
      { name: "地衣谷物 Earthing Way", desc: "台灣在地手工藝陶瓷器皿與生活美學選物", promo: "消費滿 $500 贈限定小禮" },
      { name: "0516x1024 創意T恤", desc: "幽默原創插畫手繪 T-shirt 與個性文具周邊", promo: "買兩件享 85 折優惠" }
    ]
  },
  "台大醫院": {
    "咖啡廳☕": [
      { name: "BOTCH 咖啡 (城中店)", desc: "英倫復古工業風，平價精品手沖黑咖啡", promo: "憑當日乘車紀錄送手工餅乾" },
      { name: "La Cotta 義式咖啡", desc: "隱密寧靜的城中巷弄，精緻拿鐵與招牌手工蛋糕", promo: "點低消飲品現折 $15" },
      { name: "早夏咖啡 Café Macho", desc: "提供深夜手沖、輕食與台灣精釀啤酒的文青愛店", promo: "免收 10% 服務費" }
    ],
    "飲料店🥤": [
      { name: "得政 Oolong Tea Project (重慶店)", desc: "主打春烏龍與烘焙烏龍系列，清香醇厚", promo: "大杯飲品現折 $5" },
      { name: "九曜和茶 (台北城中店)", desc: "新起日式和風茶飲，主打極上和風奶茶與穀物茶", promo: "捷運點數兩倍回饋" },
      { name: "盯哥茶飲 (許昌店)", desc: "來自台東的特色茶飲，主打初鹿牧場鮮奶茶", promo: "第二杯半價優惠" }
    ],
    "文創選物🎨": [
      { name: "山民書局 (重慶南路店)", desc: "老字號巨型書局，精選圖書、進口文具與禮品", promo: "圖書與文具享 9 折優惠" },
      { name: "藝豐堂藝術選物", desc: "在地青年藝術家手工精緻器皿、明信片與工藝品", promo: "單筆滿 $1000 享 9 折" },
      { name: "臺灣博藝館文創商店", desc: "融合台灣特有種與歷史文物的特製文創設計產品", promo: "出示乘車票證享門票優惠" }
    ]
  },
  "行天宮": {
    "咖啡廳☕": [
      { name: "蛋宅 Egghouse", desc: "老宅抹茶戚風蛋糕代表，必點小山園濃抹茶拿鐵", promo: "甜點拿鐵套餐折 $20" },
      { name: "時常在別處", desc: "預約制手作限定水果戚風、精品單品黑咖啡", promo: "捷運集點合作特約商店" },
      { name: "Coppii Lumii living coffee 慢慢生活", desc: "熱門招牌肉桂捲、奶油鬆餅與大盤全日早午餐", promo: "消費滿 $300 贈美式咖啡券" }
    ],
    "飲料店🥤": [
      { name: "強森紅茶公司 (民生店)", desc: "紅茶專門店，推薦雨果那堤與煮濃紅茶那堤", promo: "出示捷運 App 免費加椰果/珍珠" },
      { name: "一沐月 (吉林店)", desc: "原創招牌粉粿黑糖奶茶，古早味台式經典手搖", promo: "支援捷運點數全額折抵" },
      { name: "麻吉茶坊 (行天宮店)", desc: "鮮果特調代表，推薦芝芝芒果與招牌楊枝甘露", promo: "自備環保杯享雙倍點數" }
    ],
    "文創選物🎨": [
      { name: "小月子商號 (行天宮店)", desc: "台灣本土設計生活雜誌、文青布包與手寫文具", promo: "消費享 9 折加贈 15 pt" },
      { name: "尋路選物店", desc: "精選台灣小農香氛、天然蠟燭、心靈牌卡與擺飾", promo: "消費滿 $800 送香氛體驗片" },
      { name: "行天宮創藝坊", desc: "現代設計風格防蚊御守、平安香包與傳統文創", promo: "憑乘車票證享 88 折" }
    ]
  },
  "忠孝復興": {
    "咖啡廳☕": [
      { name: "St.1 Cafe' 二街咖啡", desc: "台南精品烘豆名名店北上，必點精品拿鐵與可麗露", promo: "憑乘車紀錄現折 $15" },
      { name: "L'Appart 暴風泡芙", desc: "精緻法式甜點專賣，閃電泡芙與經典義式", promo: "購甜點送美式咖啡一杯" },
      { name: "Honey's Cafe", desc: "隱身二樓老屋，文青與學生深夜最愛的工作拿鐵", promo: "單點飲品即享 9 折" }
    ],
    "飲料店🥤": [
      { name: "謎客夏 Milksha (大安店)", desc: "天然綠光牧場鮮奶系列，推薦芋頭鮮奶", promo: "可用捷運點數折抵消費" },
      { name: "再躺5分鐘 (大安店)", desc: "滴妹人氣奶蓋茶，推薦招牌棉被午茉綠", promo: "點特調茶飲贈點數 10 pt" },
      { name: "珍煮母 (大安復興店)", desc: "濃厚黑糖珍珠鮮奶，純手工翻炒黑糖黑蜜", promo: "憑大眾運輸票證大杯折 $5" }
    ],
    "文創選物🎨": [
      { name: "呈品生活 (東區地下街店)", desc: "地下街文創長廊，精選文具雜貨、設計好書與好禮", promo: "誠品會員綁定加碼發點" },
      { name: "Fukuro Living 選品", desc: "代理歐美日系小眾設計服飾、生活實用設計配件", promo: "出示捷運卡享 95 折" },
      { name: "米肥兔 miffy 文創專賣", desc: "正版米飛兔聯名生活家居小物、帆布袋與公仔", promo: "精選療癒文創 9 折" }
    ]
  },
  "西門": {
    "咖啡廳☕": [
      { name: "蜜大咖啡 Fong Da", desc: "一甲子老字號，合桃酥、雞仔餅配經典老派虹吸", promo: "買伴手禮送濾掛包" },
      { name: "Chi Cafe' 町咖啡", desc: "西門老宅精品烘豆咖啡，主打手沖單品原豆", promo: "單品現磨咖啡現折 $20" },
      { name: "Cafe' Salida", desc: "紅樓露天庭園植栽風格，咖啡、調酒與精品輕食", promo: "下午茶時段享 9 折優惠" }
    ],
    "飲料店🥤": [
      { name: "幸運堂 (西門町總店)", desc: "招牌古法黑糖珍珠鮮奶，現炒珍珠", promo: "捷運金庫集點加碼 +15 pt" },
      { name: "老派銀魚 Goldfish", desc: "古早味綠豆沙牛奶，濃厚泰式奶茶與冬瓜檸檬", promo: "出示捷運 App 免費加粉條" },
      { name: "慢波島嶼紅茶 (西門店)", desc: "眷村風水果茶、紅豆粉粿鮮奶與蘭葉那堤", promo: "捷運點數一鍵全額折抵" }
    ],
    "文創選物🎨": [
      { name: "西門粉樓 創意市集區", desc: "台灣在地百家手作原創、皮革、手繪明信片", promo: "單筆滿 $500 折抵 $50" },
      { name: "萬載商業大樓 模玩選物", desc: "日系動漫公仔、ACG 文創手作與限定一番賞周邊", promo: "打卡贈送限定設計杯墊" },
      { name: "吉步力共和國 (西門店)", desc: "宮崎駿吉卜力工作室正版日系授權精品選物商店", promo: "單筆滿 $1000 贈限量環保袋" }
    ]
  }
};

/**
 * 根據任務目標站動態渲染步驟 2 的特約店家清單（僅顯示任務指定的特定類型）
 */
function renderCooperativeShopsForQuest(quest) {
  const accordion = document.getElementById(`cooperative-shops-accordion-${quest.id}`);
  if (!accordion) return;
  
  // 清理站名（如 "台大醫院站" 統一轉成 "台大醫院"）
  const cleanStation = quest.station ? quest.station.replace("站", "").trim() : "中山";
  const shopsData = COOPERATIVE_SHOPS[cleanStation];
  
  if (!shopsData) {
    accordion.innerHTML = `<p style="font-size: 0.68rem; color: var(--text-muted); text-align: center; padding: 10px 0;">本站暫無合作店家資訊。</p>`;
    return;
  }

  // 取得本次任務指定的分類名稱 (去除 Emoji 以便比對資料庫的 key，例如 "咖啡廳☕" 轉成 "咖啡廳")
  const targetCategoryClean = quest.category ? quest.category.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim() : "咖啡廳";
  
  // 找出資料庫中匹配的分類 key
  let matchedKey = null;
  for (const key of Object.keys(shopsData)) {
    const cleanKey = key.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
    if (cleanKey === targetCategoryClean) {
      matchedKey = key;
      break;
    }
  }
  
  if (!matchedKey || !shopsData[matchedKey]) {
    accordion.innerHTML = `<p style="font-size: 0.68rem; color: var(--text-muted); text-align: center; padding: 10px 0;">未找到指定類型的店家資訊。</p>`;
    return;
  }
  
  const list = shopsData[matchedKey];
  let html = `
    <div style="font-size: 0.65rem; font-weight: 800; color: #e91e63; margin-bottom: 0.5rem; background-color: #fce4ec; padding: 4px 8px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; width: 100%; box-sizing: border-box;">
      🎯 本次任務指定類型：${quest.category}
    </div>
    <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 4px;">
  `;
  
  list.forEach(shop => {
    html += `
        <div style="border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 4px; text-align: left;">
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-dark);">${shop.name}</div>
          <div style="font-size: 0.62rem; color: var(--text-muted); line-height: 1.35; margin-top: 1px;">${shop.desc}</div>
          <span style="font-size: 0.6rem; color: #e91e63; font-weight: 700; background-color: #fce4ec; padding: 2px 5px; border-radius: 4px; display: inline-block; margin-top: 3px;">🎁 ${shop.promo}</span>
        </div>
    `;
  });
  
  html += `</div>`;
  accordion.innerHTML = html;
}

/**
 * 核心：動態渲染所有進行中任務卡
 */
function renderActiveQuests() {
  const container = document.getElementById("active-quest-container");
  if (!container) return;
  
  const count = STATE.activeQuests.length;
  document.getElementById("quest-count-badge").innerText = `${count} 個進行中`;
  
  const noQuestContainer = document.getElementById("no-quest-container");
  if (count === 0) {
    container.innerHTML = "";
    if (noQuestContainer) noQuestContainer.style.display = "flex";
    return;
  }
  
  if (noQuestContainer) noQuestContainer.style.display = "none";
  
  let html = "";
  STATE.activeQuests.forEach(quest => {
    const hrs = Math.floor(quest.timerSeconds / 3600);
    const mins = Math.floor((quest.timerSeconds % 3600) / 60);
    const secs = quest.timerSeconds % 60;
    const pad = (num) => String(num).padStart(2, "0");
    const timerStr = `剩餘 ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    
    // 生成隊員狀態 HTML (若在步驟 1 且有部分成員已出站，動態呈現該成員已出站 ✓)
    let membersHtml = "";
    STATE.members.forEach(m => {
      const initials = m.name.charAt(0);
      const isRider = quest.riders.some(r => r.startsWith(m.name.split(" ")[0]));
      
      if (isRider) {
        membersHtml += `
          <div class="m-status-item status-completed">
            <span class="m-dot ${m.color}">${initials}</span>
            <span class="m-label">已出站 ✓</span>
          </div>
        `;
      } else {
        if (quest.step === 1) {
          membersHtml += `
            <div class="m-status-item status-riding">
              <span class="m-dot ${m.color}">${initials}</span>
              <span class="m-label">搭乘中 ➔</span>
            </div>
          `;
        } else {
          membersHtml += `
            <div class="m-status-item status-inactive">
              <span class="m-dot ${m.color}">${initials}</span>
              <span class="m-label">未參與</span>
            </div>
          `;
        }
      }
    });
    
    // 渲染被邀請的人 (如果是步驟 3 以上才渲染)
    if (quest.step >= 3) {
      quest.invitees.forEach(name => {
        const initials = name.charAt(0);
        membersHtml += `
          <div class="m-status-item status-completed">
            <span class="m-dot bg-orange">${initials}</span>
            <span class="m-label">已出站 ✓</span>
          </div>
        `;
      });
    }
    
    const step1Class = quest.step >= 3 ? "completed" : "current";
    const step1Icon = quest.step >= 3 ? '<i class="fa-solid fa-check"></i>' : "1";
    const step1Desc = quest.step >= 3 ? `共同搭乘捷運並於 ${quest.station} 站出站 (已完成)` : `共同搭乘捷運並於 ${quest.station} 站出站 (未完成)`;
    
    const step2Class = quest.step >= 3 ? "completed" : "";
    const step2Desc = quest.step >= 3 ? `前往${quest.station}商圈「${quest.category}」特約店家 (已抵達本站)` : `前往指定「${quest.category}」類型特約店家消費`;
    
    const step3Class = quest.step === 3 ? "current" : (quest.step > 3 ? "completed" : "");
    const step3Icon = quest.step > 3 ? '<i class="fa-solid fa-check"></i>' : "3";
    const step3Desc = `請上傳「${quest.category}」特約店家消費收據照片`;
    
    const step4Class = quest.step === 4 ? "completed" : "";
    const step4Icon = quest.step === 4 ? '<i class="fa-solid fa-check"></i>' : "4";
    
    const isExpanded = quest.isExpanded !== false;
    const bodyDisplay = isExpanded ? "block" : "none";
    const chevronIcon = isExpanded ? "fa-chevron-up" : "fa-chevron-down";

    html += `
      <div class="content-card border-purple" id="card-${quest.id}" style="margin-bottom: 1.2rem; position: relative;">
        <!-- 任務標頭：點選可展開或折疊卡片 -->
        <div class="quest-card-header" data-id="${quest.id}" style="cursor: pointer; user-select: none; padding: 0.2rem 0;">
          <div class="card-title" style="margin-bottom: 0.3rem; display: flex; justify-content: space-between; align-items: center;">
            <span class="badge-active-quest"><i class="fa-solid fa-clock"></i> 限時任務</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="quest-timer" id="quest-timer-text-${quest.id}">${timerStr}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);"><i class="fa-solid ${chevronIcon}"></i></span>
            </div>
          </div>

          <h3 class="quest-name" style="font-size: 0.95rem; font-weight: 800; margin: 0.2rem 0; display: flex; justify-content: space-between; align-items: center;">
            <span>${quest.title}</span>
            <span style="font-size: 0.72rem; color: var(--primary-purple); font-weight: 700; background-color: rgba(106, 27, 154, 0.05); padding: 2px 6px; border-radius: 4px;">+${quest.reward} pt</span>
          </h3>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-location-dot" style="color: var(--primary-purple); font-size: 0.68rem;"></i>
            <span>${quest.station}站 · ${quest.category}</span>
          </div>
        </div>

        <!-- 可收合任務主體 -->
        <div class="quest-card-body" id="body-${quest.id}" style="display: ${bodyDisplay}; margin-top: 0.6rem; border-top: 1px solid var(--border-color); padding-top: 0.6rem;">
          <p class="quest-intro-desc" style="font-size: 0.65rem; color: var(--text-muted); margin-bottom: 0.8rem; line-height: 1.45;">
            系統偵測票證意圖客製化生成，完成此同行任務以共享眾籌回饋。
          </p>

          <!-- 戰隊協作狀態 -->
          <div class="quest-team-status" style="margin-top: 0.8rem; background-color: #fafafa; border-radius: 12px; padding: 0.6rem; border: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span class="status-title" style="margin-bottom: 0; font-size: 0.72rem; font-weight: 700; color: var(--text-dark);"><i class="fa-solid fa-people-group"></i> 戰隊隊員狀態：</span>
              ${quest.step >= 3 ? `<a href="javascript:void(0)" class="quest-btn-invite" data-id="${quest.id}" style="font-size: 0.68rem; color: var(--primary-teal); font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 3px;"><i class="fa-solid fa-user-plus"></i> 邀請戰友加入</a>` : ''}
            </div>
            <div class="members-status-grid" style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${membersHtml}
            </div>
          </div>

          <!-- 四步驟進度條 -->
          <div class="quest-steps-wrapper" style="margin-top: 1rem; text-align: left;">
            <!-- 步驟 1 -->
            <div class="step-item ${step1Class}">
              <div class="step-icon">${step1Icon}</div>
              <div class="step-content">
                <strong>步驟 1: 共同出站</strong>
                <p>${step1Desc}</p>
              </div>
            </div>
            
            <!-- 步驟 2 -->
            <div class="step-item ${step2Class}" id="step-shop-section-${quest.id}">
              <div class="step-icon"><i class="fa-solid fa-store"></i></div>
              <div class="step-content" style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none;" class="btn-toggle-shops" data-id="${quest.id}">
                  <div>
                    <strong>步驟 2: 抵達並前往指定合作店家</strong>
                    <p id="step-2-desc-${quest.id}">${step2Desc}</p>
                  </div>
                  <span id="shops-arrow-${quest.id}" style="font-size: 0.62rem; color: var(--primary-purple); font-weight: 700; background-color: rgba(106, 27, 154, 0.05); padding: 4px 8px; border-radius: 20px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-chevron-down"></i> 推薦店家</span>
                </div>
                
                <div class="cooperative-shops-accordion" id="cooperative-shops-accordion-${quest.id}" style="display: none; margin-top: 0.6rem; background-color: #fafafa; border-radius: 8px; padding: 0.6rem; border: 1px solid #e0e0e0; max-height: 200px; overflow-y: auto;"></div>
              </div>
            </div>
            
            <!-- 步驟 3 -->
            <div class="step-item ${step3Class}" id="step-upload-section-${quest.id}">
              <div class="step-icon">${step3Icon}</div>
              <div class="step-content" style="width: 100%;">
                <strong>步驟 3: 上傳收據或消費拍照</strong>
                <p>${step3Desc}</p>
                
                <!-- 上傳按鈕區域 (掃描時隱藏) -->
                <div class="upload-box-wrapper mt-3" id="upload-wrapper-${quest.id}">
                  <div class="upload-dropzone btn-upload-receipt" data-id="${quest.id}">
                    <i class="fa-solid fa-camera"></i>
                    <span>點擊拍攝或上傳收據照片</span>
                    <span class="upload-sub">支援 Gemini Vision 智能秒級審核</span>
                  </div>
                  <input type="file" id="file-receipt-${quest.id}" accept="image/*" style="display: none;" class="file-receipt" data-id="${quest.id}">
                </div>

                <!-- 掃描處理中的動畫特效 (流式排版，取代上傳按鈕，不遮擋其他步驟) -->
                <div class="scanning-overlay" id="scanning-overlay-${quest.id}" style="display: none; position: relative; width: 100%; height: auto; min-height: 220px; background-color: rgba(13, 27, 42, 0.96); border-radius: 12px; margin-top: 10px; padding: 1rem; box-sizing: border-box; flex-direction: column; align-items: center; justify-content: center; color: #fff; overflow: hidden; z-index: 5;">
                  <div class="scan-bar" style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(to right, transparent, #ba68c8, #ba68c8, transparent); box-shadow: 0 0 10px #ba68c8; animation: scan 2s linear infinite;"></div>
                  <div class="spinner-container" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.4rem; color: #fff; margin-bottom: 8px;"></i>
                    <span style="font-size: 0.72rem; font-weight: 700; color: #fff;">Gemini Vision 審核中...</span>
                  </div>
                  <pre class="ai-console-log" id="ai-log-text-${quest.id}" style="width: 100%; max-height: 140px; overflow-y: auto; background-color: #1e1e1e; color: #a6e22e; font-family: monospace; font-size: 0.58rem; padding: 8px; border-radius: 8px; margin-top: 10px; text-align: left; white-space: pre-wrap; line-height: 1.4; box-sizing: border-box;"></pre>
                </div>
              </div>
            </div>
            
            <!-- 步驟 4 -->
            <div class="step-item ${step4Class}">
              <div class="step-icon">${step4Icon}</div>
              <div class="step-content">
                <strong>步驟 4: 自動派發點數</strong>
                <p>審核成功後，點數即時匯入金庫帳戶</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
  
  // 重新綁定事件
  STATE.activeQuests.forEach(quest => {
    // 綁定卡片展開/收合
    const cardHeader = container.querySelector(`.quest-card-header[data-id="${quest.id}"]`);
    if (cardHeader) {
      cardHeader.addEventListener("click", () => {
        const currentlyExpanded = quest.isExpanded !== false;
        quest.isExpanded = !currentlyExpanded;
        renderActiveQuests();
      });
    }

    const btnToggle = container.querySelector(`.btn-toggle-shops[data-id="${quest.id}"]`);
    if (btnToggle) {
      btnToggle.addEventListener("click", (e) => {
        e.stopPropagation(); // 阻止氣泡傳播，避免點擊裡面按鈕也觸發卡片折疊！
        const accordion = document.getElementById(`cooperative-shops-accordion-${quest.id}`);
        const arrow = document.getElementById(`shops-arrow-${quest.id}`);
        if (accordion.style.display === "none") {
          accordion.style.display = "block";
          renderCooperativeShopsForQuest(quest);
          arrow.innerHTML = `<i class="fa-solid fa-chevron-up"></i> 收合店家`;
        } else {
          accordion.style.display = "none";
          arrow.innerHTML = `<i class="fa-solid fa-chevron-down"></i> 推薦店家`;
        }
      });
    }
    
    const btnUpload = container.querySelector(`.btn-upload-receipt[data-id="${quest.id}"]`);
    const fileInput = container.querySelector(`.file-receipt[data-id="${quest.id}"]`);
    if (btnUpload && fileInput) {
      btnUpload.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }
    
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          triggerReceiptSimulation(quest.id);
        }
      });
    }
    
    const btnInvite = container.querySelector(`.quest-btn-invite[data-id="${quest.id}"]`);
    if (btnInvite) {
      btnInvite.addEventListener("click", (e) => {
        e.stopPropagation();
        STATE.currentInvitingQuestId = quest.id;
        openInviteModal();
      });
    }
  });
}

/**
 * 動態隨機生成與渲染推薦任務
 */
function renderRecommendedQuests() {
  const container = document.getElementById("recommended-quests-container");
  if (!container) return;
  
  // 定義 3 組任務主題與分類配對
  const questPool = [
    { title: "雙人週末出遊", category: "咖啡廳☕", baseReward: 250, iconClass: "fa-mug-hot", bgClass: "bg-orange" },
    { title: "地下鐵尋寶趣", category: "文創選物🎨", baseReward: 80, iconClass: "fa-map-location-dot", bgClass: "bg-orange" },
    { title: "夜市美食聚點", category: "飲料店🥤", baseReward: 150, iconClass: "fa-utensils", bgClass: "bg-red" }
  ];
  
  const stations = ["中山", "台大醫院", "行天宮", "忠孝復興", "西門"];
  let html = "";
  
  // 隨機抽選 2 個不重複的主題配對
  let selectedIndices = [];
  while (selectedIndices.length < 2) {
    const idx = Math.floor(Math.random() * questPool.length);
    if (!selectedIndices.includes(idx)) {
      selectedIndices.push(idx);
    }
  }
  
  // 隨機分配不重複的車站
  let selectedStations = [];
  selectedIndices.forEach(idx => {
    const theme = questPool[idx];
    
    // 篩選出目前尚未被其它推薦任務選取的車站
    let availableStations = stations.filter(s => !selectedStations.includes(s));
    
    // 儘量避開進行中的任務站點，增加多樣性
    let preferredStations = availableStations.filter(s => !STATE.activeQuests.some(q => q.station === s));
    if (preferredStations.length === 0) {
      preferredStations = availableStations; // 沒得選時就用剩餘可用的
    }
    
    const randomStation = preferredStations[Math.floor(Math.random() * preferredStations.length)];
    selectedStations.push(randomStation);
    
    // 微調點數
    const offset = (Math.floor(Math.random() * 5) - 2) * 10;
    const reward = Math.max(50, theme.baseReward + offset);
    
    html += `
      <div class="quest-recommend-item">
        <div class="quest-icon ${theme.bgClass}"><i class="fa-solid ${theme.iconClass}"></i></div>
        <div class="quest-desc">
          <div class="name">${theme.title}</div>
          <div class="loc"><i class="fa-solid fa-location-dot"></i> ${randomStation}站 · ${theme.category}</div>
        </div>
        <div class="quest-action">
          <span class="points">+${reward} pt</span>
          <button class="btn btn-xs btn-purple btn-accept-quest" 
            data-title="${theme.title}" 
            data-points="${reward}" 
            data-station="${randomStation}" 
            data-category="${theme.category}">接受</button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}
