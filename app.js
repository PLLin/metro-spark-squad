/* ==========================================================================
   1. 狀態與常數設定
   ========================================================================== */
const STATE = {
  personalPoints: 5820,
  vaultPoints: 12480,
  vaultTarget: 15000,
  members: [
    { name: "我", points: 5820, color: "bg-blue", max: 6500 },
    { name: "楊小芸 (伴侶)", points: 4310, color: "bg-pink", max: 6500 },
    { name: "陳阿明 (好友)", points: 2350, color: "bg-green", max: 6500 }
  ],
  questActive: true,
  questStep: 3, // 當前步驟：3 (上傳收據)
  questTimerSeconds: 8073, // 2小時14分33秒
  simulatedTripUnlocked: false,
  questReward: 250, // 共同任務的基礎點數獎勵
  questStation: "中山", // 預設任務之目標站
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
  updatePointsUI(false); // 初始更新介面，不播放音效/動畫

  // 步驟 2 摺疊面板展開收合
  const toggleBtn = document.getElementById("btn-toggle-shops");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const accordion = document.getElementById("cooperative-shops-accordion");
      const arrow = document.getElementById("shops-arrow");
      if (accordion.style.display === "none") {
        accordion.style.display = "block";
        arrow.innerHTML = `<i class="fa-solid fa-chevron-up"></i> 收合店家`;
      } else {
        accordion.style.display = "none";
        arrow.innerHTML = `<i class="fa-solid fa-chevron-down"></i> 推薦店家`;
      }
    });
  }
  renderCooperativeShops("中山"); // 預設載入中山站合作店家

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
      btn.getAttribute("onclick").includes(tabId)
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
      document.getElementById("invite-relation").value = "戰友";
    }, 200);
  });

  document.getElementById("btn-interactive-quest").addEventListener("click", () => {
    switchTab('home');
    setTimeout(() => {
      // 自動設起點台北車站，終點中山站
      document.getElementById("sim-start-station").value = "台北車站";
      document.getElementById("sim-end-station").value = "中山";
      
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
    if (!STATE.questActive || STATE.questStep !== 3) {
      showToast("自動準備任務", "偵測到您尚未觸發任務，系統正在自動為您模擬出站...", "purple");
      switchTab('home');
      setTimeout(() => {
        document.getElementById("sim-start-station").value = "台北車站";
        document.getElementById("sim-end-station").value = "中山";
        
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
        // 捷運模擬約在 1.5 秒後分析完，自動切換至任務頁，在此 3 秒後自動啟動收據掃描！
        setTimeout(() => {
          triggerReceiptSimulation();
        }, 3200);
      }, 200);
    } else {
      switchTab('quest');
      setTimeout(() => {
        triggerReceiptSimulation();
      }, 300);
    }
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
  document.getElementById("btn-upload-receipt").addEventListener("click", () => {
    // 模擬觸發檔案上傳或拍照
    document.getElementById("file-receipt").click();
  });
  document.getElementById("file-receipt").addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      triggerReceiptSimulation();
    }
  });

  // 邀請彈窗
  const inviteBtn = document.getElementById("btn-invite-member");
  if (inviteBtn) {
    inviteBtn.addEventListener("click", () => {
      document.getElementById("invite-modal").style.display = "flex";
    });
  }
  if (document.getElementById("quest-btn-invite")) {
    document.getElementById("quest-btn-invite").addEventListener("click", () => {
      document.getElementById("invite-modal").style.display = "flex";
    });
  }
  document.getElementById("btn-close-invite").addEventListener("click", closeInviteModal);
  document.getElementById("btn-cancel-invite").addEventListener("click", closeInviteModal);
  document.getElementById("btn-submit-invite").addEventListener("click", submitInvite);



  // 接受任務按鈕
  document.querySelectorAll(".btn-accept-quest").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const title = e.currentTarget.getAttribute("data-title");
      const points = e.currentTarget.getAttribute("data-points");
      const station = e.currentTarget.getAttribute("data-station");
      acceptNewQuest(title, points, station);
    });
  });

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
    // 檢查是否有進行中的任務，若有，驗證進站目的地是否符合任務目標站
    if (STATE.questActive && STATE.questStep === 1) {
      if (cleanEndSt !== STATE.questStation) {
        showToast("路線不符", `⚠️ 乘車目的地（${cleanEndSt}）與任務目標站（${STATE.questStation}）不符！請重新選擇。`, "gold");
        updateIsland("⚠️ 路線不符已中止", "active danger");
        return;
      }
    }

    if (riderCount > 1) {
      // 隊員同行集點 (解鎖任務)
      const countPrefix = riderCount === 2 ? "雙人" : (riderCount === 3 ? "三人" : "多人");
      updateIsland(`👥 偵測到${countPrefix}同行意圖 (94%)`, "active purple");
      showToast("Vertex AI 生成任務", `結合歷史通勤特徵，動態解鎖「${countPrefix}週末${cleanEndSt}站出遊」限時任務！`, "purple");
      
      // 啟用任務狀態
      STATE.questActive = true;
      STATE.questStep = 3;
      STATE.questStation = cleanEndSt; // 記錄任務目標站
      STATE.questTimerSeconds = 7200 + Math.floor(Math.random() * 3600); // 隨機倒數 2.x 小時
      
      // 根據實際乘車人數調整點數獎勵
      STATE.questReward = riderCount === 2 ? 250 : (riderCount === 3 ? 400 : 550);
      
      // 重置任務步驟 UI 為出站完成狀態
      const steps = document.querySelectorAll(".step-item");
      steps[0].className = "step-item completed";
      steps[0].querySelector(".step-icon").innerHTML = '<i class="fa-solid fa-check"></i>';
      steps[0].querySelector(".step-content p").innerText = `共同搭乘捷運並於 ${cleanEndSt} 站出站 (已完成)`;
      
      steps[1].className = "step-item completed";
      steps[1].querySelector(".step-icon").innerHTML = '<i class="fa-solid fa-check"></i>';
      document.getElementById("step-2-desc").innerText = `前往${cleanEndSt}商圈合作店家 (已抵達本站)`;
      renderCooperativeShops(cleanEndSt); // 動態渲染終點站商家資訊

      steps[2].className = "step-item current";
      steps[2].querySelector(".step-icon").innerHTML = "3";
      
      steps[3].className = "step-item";
      steps[3].querySelector(".step-icon").innerHTML = "4";
      
      // 更新任務獎勵標記文字
      const rewardValSpan = document.getElementById("quest-reward-value");
      if (rewardValSpan) {
        rewardValSpan.innerHTML = `<i class="fa-solid fa-vault"></i> 注入金庫 +${STATE.questReward} <span class="unit">pt</span>`;
      }
      
      // 更新協作隊員狀態 (搭乘的顯示 已出站 ✓，未搭乘的顯示 未參與)
      const statusGrid = document.getElementById("quest-members-status-grid");
      if (statusGrid) {
        statusGrid.innerHTML = "";
        STATE.members.forEach((m, idx) => {
          const initials = m.name.charAt(0);
          const isRider = riderIndices.includes(idx);
          const statusText = isRider ? "已出站 ✓" : "未參與";
          const item = document.createElement("div");
          item.className = "m-status-item " + (isRider ? "status-completed" : "status-inactive");
          item.innerHTML = `
            <span class="m-dot ${m.color}">${initials}</span>
            <span class="m-label">${statusText}</span>
          `;
          statusGrid.appendChild(item);
        });
      }
      
      // 顯示任務區，隱藏空狀態
      document.getElementById("active-quest-container").style.display = "block";
      document.getElementById("no-quest-container").style.display = "none";
      document.getElementById("quest-count-badge").innerText = "1 個進行中";

      // 任務標題與說明文字更新
      document.getElementById("quest-title-text").innerText = `${countPrefix}週末${cleanEndSt}站出遊`;
      document.querySelector(".quest-intro-desc").innerText = `系統偵測到您與隊員的共同乘車意圖 (AI 信心值 94%)，已客製化生成此限時任務：`;
      
      // 手機下方導覽列紅點提示
      document.getElementById("nav-quest-dot").classList.add("active");
      
      // 自動切換到任務頁籤，讓使用者方便看
      setTimeout(() => {
        switchTab("quest");
      }, 1000);
    } else {
      // 個人通勤
      updateIsland("個人通勤 +15 pt", "active success");
      showToast("個人通勤點數發放", `偵測到單人出站，發放基礎回饋 +15 pt。`, "teal");
      addPoints(15, 0); // 加 15 點給個人(成員0)
    }
  }, 1500);
}

/**
 * 模擬上傳收據：Gemini Vision 辨識與金庫點數注入
 */
function triggerReceiptSimulation() {
  if (!STATE.questActive || STATE.questStep !== 3) {
    showToast("提示", "目前沒有進行中或待驗證收據的任務。請先模擬乘車以觸發任務！", "gold");
    return;
  }

  // 顯示掃描覆蓋動畫
  const overlay = document.getElementById("scanning-overlay");
  const logText = document.getElementById("ai-log-text");
  overlay.style.display = "flex";
  
  // 模擬 Gemini AI 逐步辨識日誌
  const rewardVal = STATE.questReward || 250;
  const logs = [
    "[17:10:01] [Vertex AI] 啟動 Gemini 1.5 Flash 多模態視覺模型...",
    "[17:10:02] [Gemini Vision] 載入影像位元流... 辨識為收據發票格式。",
    "[17:10:02] [Gemini Vision] 掃描文字中：擷取關鍵字「捷捷飲料店」、「中山店」...",
    "[17:10:03] [Gemini Vision] 偵測到交易金額「$320」、消費項目「雙人蜂蜜檸檬套餐」...",
    "[17:10:03] [Gemini Vision] 比對消費時間 2026-06-30 16:45，與出站時間 (16:32) 吻合度 99%！",
    "[17:10:04] [Vertex AI] 任務條件判定：雙人/多協作出站 ＋ 周邊商家消費 ＝ 條件完全滿足！",
    `[17:10:04] [系統核發] 發放金庫點數獎勵：+${rewardVal} pt 批准送出。`
  ];

  let currentLogIdx = 0;
  logText.innerText = "";
  
  const logInterval = setInterval(() => {
    if (currentLogIdx < logs.length) {
      logText.innerText += logs[currentLogIdx] + "\n";
      logText.scrollTop = logText.scrollHeight;
      currentLogIdx++;
    }
  }, 400);

  // 3秒後完成辨識
  setTimeout(() => {
    clearInterval(logInterval);
    overlay.style.display = "none";
    
    // 標註步驟 3 & 4 為完成
    const steps = document.querySelectorAll(".step-item");
    steps[2].className = "step-item completed";
    steps[2].querySelector(".step-icon").innerHTML = '<i class="fa-solid fa-check"></i>';
    
    steps[3].className = "step-item completed";
    steps[3].querySelector(".step-icon").innerHTML = '<i class="fa-solid fa-check"></i>';

    // 動態島顯示成功
    updateIsland(`✓ Gemini 驗證成功！+${rewardVal} pt`, "active success");
    showToast("Gemini 審核通過", `多模態視覺比對成功！任務完成，+${rewardVal} pt 已注入金庫。`, "purple");

    // 金庫點數增加
    addPoints(rewardVal, 0); // 這裡我們讓本人獲得，並更新金庫
    STATE.questStep = 4;
    STATE.questActive = false;
    document.getElementById("quest-count-badge").innerText = "已完成";

    // 播放點數飄浮特效
    const uploadBtn = document.getElementById("btn-upload-receipt");
    spawnFloatingPoints("+250 pt", uploadBtn);
    
    // 增加一筆入點明細到金庫
    insertVaultLog("任務完成：雙人中山出遊", "剛剛 · Gemini 視覺審核收據通過", "+250 pt", "positive", "fa-wand-magic-sparkles", "bg-light-purple", "text-purple");

    // 5秒後將任務大廳清空為無任務狀態
    setTimeout(() => {
      if (!STATE.questActive) {
        document.getElementById("active-quest-container").style.display = "none";
        document.getElementById("no-quest-container").style.display = "flex";
      }
    }, 6000);

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
  
  island.className = `dynamic-island ${typeClasses}`;
  islandText.innerText = message;

  // 3.5秒後收回動態島
  setTimeout(() => {
    island.className = "dynamic-island";
    islandText.innerText = "系統運作中";
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
  const timerText = document.getElementById("quest-timer-text");
  
  setInterval(() => {
    if (STATE.questActive && STATE.questTimerSeconds > 0) {
      STATE.questTimerSeconds--;
      
      const hrs = Math.floor(STATE.questTimerSeconds / 3600);
      const mins = Math.floor((STATE.questTimerSeconds % 3600) / 60);
      const secs = STATE.questTimerSeconds % 60;
      
      const pad = (num) => String(num).padStart(2, "0");
      timerText.innerText = `剩餘 ${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
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
function acceptNewQuest(title, points, station) {
  showToast("任務接受成功", `限時任務「${title}」已加入您的進行清單！`, "purple");
  updateIsland(`已接受：${title}`, "active purple");

  // 更新任務大廳，初接受時設定為第一步 (搭乘捷運)
  STATE.questActive = true;
  STATE.questStep = 1;
  STATE.questStation = station; // 儲存任務目標捷運站！
  STATE.questTimerSeconds = 3600 * 3; // 預設 3 小時
  STATE.questReward = parseInt(points) || 250;

  document.getElementById("active-quest-container").style.display = "block";
  document.getElementById("no-quest-container").style.display = "none";
  document.getElementById("quest-count-badge").innerText = "1 個進行中";

  document.getElementById("quest-title-text").innerText = title;
  
  // 更新任務獎勵標記文字
  const rewardValSpan = document.getElementById("quest-reward-value");
  if (rewardValSpan) {
    rewardValSpan.innerHTML = `<i class="fa-solid fa-vault"></i> 注入金庫 +${STATE.questReward} <span class="unit">pt</span>`;
  }

  // 重置步驟 UI (第一步為進行中，其它反白/未啟動)
  const steps = document.querySelectorAll(".step-item");
  steps[0].className = "step-item current";
  steps[0].querySelector(".step-icon").innerHTML = "1";
  steps[0].querySelector(".step-content p").innerText = `共同搭乘捷運並於 ${station} 站出站 (未完成)`;
  
  steps[1].className = "step-item";
  steps[1].querySelector(".step-icon").innerHTML = "2";
  document.getElementById("step-2-desc").innerText = `前往${station}商圈合作店家 (未抵達本站)`;
  renderCooperativeShops(station); // 渲染新目標站的店家
  document.getElementById("cooperative-shops-accordion").style.display = "none"; // 預設收合
  document.getElementById("shops-arrow").innerHTML = `<i class="fa-solid fa-chevron-down"></i> 推薦店家`;

  steps[2].className = "step-item";
  steps[2].querySelector(".step-icon").innerHTML = "3";
  steps[2].querySelector(".step-content p").innerText = "透過 Gemini 多模態 AI 自動辨識審核";

  steps[3].className = "step-item";
  steps[3].querySelector(".step-icon").innerHTML = "4";

  // 重置隊員狀態為搭乘中 (依據當前金庫所有成員)
  const statusGrid = document.getElementById("quest-members-status-grid");
  if (statusGrid) {
    statusGrid.innerHTML = "";
    STATE.members.forEach(m => {
      const initials = m.name.charAt(0);
      const item = document.createElement("div");
      item.className = "m-status-item status-riding";
      item.innerHTML = `
        <span class="m-dot ${m.color}">${initials}</span>
        <span class="m-label">搭乘中 ➔</span>
      `;
      statusGrid.appendChild(item);
    });
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
  
  if (!phone || !/^09\d{8}$/.test(phone)) {
    alert("請輸入正確的手機號碼 (格式：09xxxxxxxx)！");
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
    
    // 如果有進行中的共同任務，動態更新任務內容與獎勵！
    if (STATE.questActive && STATE.questStep === 3) {
      const activeQuestTitle = document.getElementById("quest-title-text");
      const currentTitle = activeQuestTitle.innerText;
      
      let newTitle = currentTitle;
      let newReward = 400;
      
      if (currentTitle.startsWith("雙人")) {
        newTitle = currentTitle.replace("雙人", "三人");
        newReward = 400;
      } else if (currentTitle.startsWith("三人")) {
        newTitle = currentTitle.replace("三人", "四人");
        newReward = 550;
      } else {
        newTitle = "共同" + currentTitle;
        newReward = 600;
      }
      
      // 更新任務標題與全局獎勵點數
      activeQuestTitle.innerText = newTitle;
      STATE.questReward = newReward;
      
      // 更新任務獎勵卡片上的文字
      const rewardValSpan = document.getElementById("quest-reward-value");
      rewardValSpan.innerHTML = `<i class="fa-solid fa-vault"></i> 注入金庫 +${newReward} <span class="unit">pt</span>`;
      
      // 動態將好友加進任務協作面板中
      const statusGrid = document.getElementById("quest-members-status-grid");
      const newItem = document.createElement("div");
      newItem.className = "m-status-item status-completed";
      newItem.innerHTML = `
        <span class="m-dot ${color}">${initials}</span>
        <span class="m-label">已出站 ✓</span>
      `;
      statusGrid.appendChild(newItem);
      
      showToast("任務獎勵提升！", `👥 由於新成員 ${name} 共同參與，任務獎勵提高至 +${newReward} pt！`, "purple");
    }
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
    item.innerHTML = `
      <div class="member-avatar ${m.color}">${initials}</div>
      <div class="member-info">
        <span class="member-name">${m.name}</span>
        <div class="member-progress-container">
          <div class="member-progress-bar ${m.color}" style="width: ${mPercent}%"></div>
        </div>
      </div>
      <div class="member-points">
        <span class="val" id="val-member-${idx}">${m.points.toLocaleString()}</span> <span class="unit">pt</span>
      </div>
    `;
    list.appendChild(item);
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
    { name: "我", points: 5820, color: "bg-blue", max: 6500 },
    { name: "楊小芸 (伴侶)", points: 4310, color: "bg-pink", max: 6500 },
    { name: "陳阿明 (好友)", points: 2350, color: "bg-green", max: 6500 }
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

  // 4. 重置任務大廳 UI 狀態為預設的步驟 3 (中山站)
  const steps = document.querySelectorAll(".step-item");
  steps[0].className = "step-item completed";
  steps[0].querySelector(".step-icon").innerHTML = '<i class="fa-solid fa-check"></i>';
  steps[0].querySelector(".step-content p").innerText = "共同搭乘捷運並於 中山 站出站 (已完成)";
  
  steps[1].className = "step-item completed";
  steps[1].querySelector(".step-icon").innerHTML = '<i class="fa-solid fa-check"></i>';
  document.getElementById("step-2-desc").innerText = "前往中山商圈合作店家 (已抵達本站)";
  renderCooperativeShops("中山");
  document.getElementById("cooperative-shops-accordion").style.display = "none"; // 預設收合
  document.getElementById("shops-arrow").innerHTML = `<i class="fa-solid fa-chevron-down"></i> 推薦店家`;

  steps[2].className = "step-item current";
  steps[2].querySelector(".step-icon").innerHTML = "3";
  steps[2].querySelector(".step-content p").innerText = "透過 Gemini 多模態 AI 自動辨識審核";

  steps[3].className = "step-item";
  steps[3].querySelector(".step-icon").innerHTML = "4";

  // 重置首頁輸入值
  document.getElementById("sim-start-station").value = "台北車站";
  document.getElementById("sim-end-station").value = "中山";

  // 5. 重置隊員狀態清單 (我、楊小芸，已完成)
  const statusGrid = document.getElementById("quest-members-status-grid");
  if (statusGrid) {
    statusGrid.innerHTML = `
      <div class="m-status-item status-completed">
        <span class="m-dot bg-blue">我</span>
        <span class="m-label">已出站 ✓</span>
      </div>
      <div class="m-status-item status-completed">
        <span class="m-dot bg-pink">楊</span>
        <span class="m-label">已出站 ✓</span>
      </div>
    `;
  }

  // 6. 清除任務導覽紅點
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
      { name: "角公園咖啡 Triangle Garden", desc: "老屋改建文青風，招牌黑糖拿鐵與手作布丁", promo: "出示票證享 9 折" },
      { name: "心中山 浮光書店", desc: "結合獨立書店的複合式精品老宅咖啡", promo: "消費贈送捷運點數 10 pt" },
      { name: "Melting Finger 甜點工坊", desc: "人氣馬卡龍名店，拿鐵配手作彩虹馬卡龍", promo: "滿 $200 現折 $20" }
    ],
    "飲料店🥤": [
      { name: "五桐號 WooTea (中山店)", desc: "招牌杏仁凍五桐茶，濃郁茶香與 Q 彈凍飲", promo: "捷運點數折抵 5 pt/杯" },
      { name: "SOMA 特調茶飲 (中山概念店)", desc: "網紅評選全台第一名特調歐蕾奶茶", promo: "出示 App 免費加特製茶凍" },
      { name: "茶敬茶 Tea To Tea", desc: "台灣精品小農契作，在地現泡鮮奶茶專賣", promo: "全品項享 95 折" }
    ],
    "文創選物🎨": [
      { name: "Zakka W 雜貨舖", desc: "日系復古古著、原創插畫與手工飾品選物", promo: "消費即享 9 折並送 20 pt" },
      { name: "地衣荒物 Earthing Way", desc: "台灣在地手工藝陶瓷器皿與生活美學選物", promo: "消費滿 $500 贈限定小禮" },
      { name: "0416x1024 創意T恤", desc: "幽默原創插畫手繪 T-shirt 與個性文具周邊", promo: "買兩件享 85 折優惠" }
    ]
  },
  "台大醫院": {
    "咖啡廳☕": [
      { name: "NOTCH 咖啡 (城中店)", desc: "英倫復古工業風，平價精品手沖黑咖啡", promo: "憑當日乘車紀錄送手工餅乾" },
      { name: "La Grotta 義式咖啡", desc: "隱密寧靜的城中巷弄，精緻拿鐵與招牌手工蛋糕", promo: "點低消飲品現折 $15" },
      { name: "早秋咖啡 Café Macho", desc: "提供深夜手沖、輕食與台灣精釀啤酒的文青愛店", promo: "免收 10% 服務費" }
    ],
    "飲料店🥤": [
      { name: "得正 Oolong Tea Project (重慶店)", desc: "主打春烏龍與烘焙烏龍系列，清香醇厚", promo: "大杯飲品現折 $5" },
      { name: "八曜和茶 (台北城中店)", desc: "新起日式和風茶飲，主打極上和風奶茶與穀物茶", promo: "捷運點數兩倍回饋" },
      { name: "叮哥茶飲 (許昌店)", desc: "來自台東的特色茶飲，主打初鹿牧場鮮奶茶", promo: "第二杯半價優惠" }
    ],
    "文創選物🎨": [
      { name: "三民書局 (重慶南路店)", desc: "老字號巨型書局，精選圖書、進口文具與禮品", promo: "圖書與文具享 9 折優惠" },
      { name: "藝風堂藝術選物", desc: "在地青年藝術家手工精緻器皿、明信片與工藝品", promo: "單筆滿 $1000 享 9 折" },
      { name: "臺灣博物館文創商店", desc: "融合台灣特有種與歷史文物的特製文創設計產品", promo: "出示乘車票證享門票優惠" }
    ]
  },
  "行天宮": {
    "咖啡廳☕": [
      { name: "疍宅 Egghouse", desc: "老宅抹茶戚風蛋糕代表，必點小山園濃抹茶拿鐵", promo: "甜點拿鐵套餐折 $20" },
      { name: "時常在這裡", desc: "預約制手作限定水果戚風、精品單品黑咖啡", promo: "捷運集點合作特約商店" },
      { name: "Coppii Lumii living coffee 冉冉生活", desc: "熱門招牌肉桂捲、奶油鬆餅與大盤全日早午餐", promo: "消費滿 $300 贈美式咖啡券" }
    ],
    "飲料店🥤": [
      { name: "約翰紅茶公司 (民生店)", desc: "紅茶專門店，推薦雨果那堤與煮濃紅茶那堤", promo: "出示捷運 App 免費加椰果/珍珠" },
      { name: "一沐日 (吉林店)", desc: "原創招牌粉粿黑糖奶茶，古早味台式經典手搖", promo: "支援捷運點數全額折抵" },
      { name: "麻古茶坊 (行天宮店)", desc: "鮮果特調代表，推薦芝芝芒果與招牌楊枝甘露", promo: "自備環保杯享雙倍點數" }
    ],
    "文創選物🎨": [
      { name: "小日子商號 (行天宮店)", desc: "台灣本土設計生活雜誌、文青布包與手寫文具", promo: "消費享 9 折加贈 15 pt" },
      { name: "問路選物店", desc: "精選台灣小農香氛、天然蠟燭、心靈牌卡與擺飾", promo: "消費滿 $800 送香氛體驗片" },
      { name: "行天宮文創坊", desc: "現代設計風格防蚊御守、平安香包與傳統文創", promo: "憑乘車票證享 88 折" }
    ]
  },
  "忠孝復興": {
    "咖啡廳☕": [
      { name: "St.1 Cafe' 一街咖啡", desc: "台南精品烘豆名名店北上，必點精品拿鐵與可麗露", promo: "憑乘車紀錄現折 $15" },
      { name: "L'Appart 閃電泡芙", desc: "精緻法式甜點專賣，閃電泡芙與經典義式", promo: "購甜點送美式咖啡一杯" },
      { name: "Homey's Cafe", desc: "隱身二樓老屋，文青與學生深夜最愛的工作拿鐵", promo: "單點飲品即享 9 折" }
    ],
    "飲料店🥤": [
      { name: "迷客夏 Milksha (大安店)", desc: "天然綠光牧場鮮奶系列，推薦芋頭鮮奶", promo: "可用捷運點數折抵消費" },
      { name: "再睡5分鐘 (大安店)", desc: "滴妹人氣奶蓋茶，推薦招牌棉被午茉綠", promo: "點特調茶飲贈點數 10 pt" },
      { name: "珍煮丹 (大安復興店)", desc: "濃厚黑糖珍珠鮮奶，純手工翻炒黑糖黑蜜", promo: "憑大眾運輸票證大杯折 $5" }
    ],
    "文創選物🎨": [
      { name: "誠品生活 (東區地下街店)", desc: "地下街文創長廊，精選文具雜貨、設計好書與好禮", promo: "誠品會員綁定加碼發點" },
      { name: "Fukurou Living 選品", desc: "代理歐美日系小眾設計服飾、生活實用設計配件", promo: "出示捷運卡享 95 折" },
      { name: "米飛兔 miffy 文創專賣", desc: "正版米飛兔聯名生活家居小物、帆布袋與公仔", promo: "精選療癒文創 9 折" }
    ]
  },
  "西門": {
    "咖啡廳☕": [
      { name: "蜂大咖啡 Fong Da", desc: "一甲子老字號，合桃酥、雞仔餅配經典老派虹吸", promo: "買伴手禮送濾掛包" },
      { name: "Cho Cafe' 町咖啡", desc: "西門老宅精品烘豆咖啡，主打手沖單品原豆", promo: "單品現磨咖啡現折 $20" },
      { name: "Cafe' Dalida", desc: "紅樓露天庭園植栽風格，咖啡、調酒與精品輕食", promo: "下午茶時段享 9 折優惠" }
    ],
    "飲料店🥤": [
      { name: "幸福堂 (西門町總店)", desc: "招牌古法黑糖珍珠鮮奶，現炒珍珠", promo: "捷運金庫集點加碼 +15 pt" },
      { name: "老派金魚 Goldfish", desc: "古早味綠豆沙牛奶，濃厚泰式奶茶與冬瓜檸檬", promo: "出示捷運 App 免費加粉條" },
      { name: "萬波島嶼紅茶 (西門店)", desc: "眷村風水果茶、紅豆粉粿鮮奶與蘭葉那堤", promo: "捷運點數一鍵全額折抵" }
    ],
    "文創選物🎨": [
      { name: "西門紅樓 創意市集區", desc: "台灣在地百家手作原創、皮革、手繪明信片", promo: "單筆滿 $500 折抵 $50" },
      { name: "萬年商業大樓 模玩選物", desc: "日系動漫公仔、ACG 文創手作與限定一番賞周邊", promo: "打卡贈送限定設計杯墊" },
      { name: "吉卜力共和國 (西門店)", desc: "宮崎駿吉卜力工作室正版日系授權精品選物商店", promo: "單筆滿 $1000 贈限量環保袋" }
    ]
  }
};

/**
 * 根據任務目標站動態渲染步驟 2 的特約店家清單
 */
function renderCooperativeShops(station) {
  const accordion = document.getElementById("cooperative-shops-accordion");
  if (!accordion) return;
  
  // 清理站名（如 "台大醫院站" 統一轉成 "台大醫院"）
  const cleanStation = station ? station.replace("站", "").trim() : "中山";
  const shopsData = COOPERATIVE_SHOPS[cleanStation];
  
  if (!shopsData) {
    accordion.innerHTML = `<p style="font-size: 0.68rem; color: var(--text-muted); text-align: center; padding: 10px 0;">本站暫無合作店家資訊。</p>`;
    return;
  }
  
  let html = "";
  for (const [category, list] of Object.entries(shopsData)) {
    html += `
      <div class="shop-category-group" style="margin-bottom: 0.8rem;">
        <div style="font-size: 0.72rem; font-weight: 800; color: var(--primary-purple); display: flex; align-items: center; gap: 4px; margin-bottom: 0.3rem;">
          ${category}
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; padding-left: 6px;">
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
    
    html += `
        </div>
      </div>
    `;
  }
  
  accordion.innerHTML = html;
}
