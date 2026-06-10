// ════════════════════════════════════════════════
// セーブ / ロード（ブラウザ localStorage・プレイヤー名ごと）
// ════════════════════════════════════════════════
const SAVE_VERSION = 1;
const SAVE_PREFIX = "cardcraft_save_";
const META_KEY = "cardcraft_meta";

const INITIAL_QUEST_SNAPSHOT = QUESTS.map(q => ({
  id: q.id, done: q.done, visible: q.visible, locked: !!q.locked,
}));
const INITIAL_SUB_QUEST_SNAPSHOT = SUB_QUESTS.map(q => ({
  id: q.id, done: q.done, visible: q.visible,
}));

function sanitizePlayerName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, 16);
}

function playerSaveKey(name) {
  return SAVE_PREFIX + sanitizePlayerName(name).toLowerCase().replace(/[^\w\u3040-\u30ff\u4e00-\u9faf-]/g, "_");
}

function getSaveMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : { lastPlayer: "", players: [] };
  } catch {
    return { lastPlayer: "", players: [] };
  }
}

function setSaveMeta(meta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

function updateSaveMeta(playerName, summary) {
  const meta = getSaveMeta();
  meta.lastPlayer = playerName;
  const key = playerSaveKey(playerName);
  const players = meta.players.filter(p => p.key !== key);
  players.unshift({
    key,
    name: playerName,
    savedAt: summary.savedAt,
    dayCount: summary.dayCount,
  });
  meta.players = players.slice(0, 20);
  setSaveMeta(meta);
}

function hasSaveData(playerName) {
  const key = playerSaveKey(playerName);
  if (!key || key === SAVE_PREFIX) return false;
  return localStorage.getItem(key) !== null;
}

function serializeCard(c) {
  const out = {};
  for (const k of Object.keys(c)) {
    if (k === "w" || k === "h") continue;
    const v = c[k];
    if (typeof v === "function") continue;
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function deserializeCard(data) {
  const d = def(data.type);
  const c = {
    ...data,
    w: CW,
    h: CH,
    stack: data.stack ?? 1,
    uses: data.uses ?? 0,
    maxUses: data.maxUses ?? d.maxUses,
  };
  return c;
}

function serializeCards(arr) {
  return (arr || []).map(serializeCard);
}

function deserializeCards(arr) {
  return (arr || []).map(deserializeCard);
}

function serializeProgressMap() {
  const out = {};
  for (const [key, val] of Object.entries(progressMap)) {
    const recipeIdx = RECIPES.indexOf(val.recipe);
    if (recipeIdx >= 0) {
      out[key] = { progress: val.progress, recipeIdx };
    }
  }
  return out;
}

function deserializeProgressMap(data) {
  const out = {};
  for (const [key, val] of Object.entries(data || {})) {
    const recipe = RECIPES[val.recipeIdx];
    if (recipe) out[key] = { progress: val.progress, recipe };
  }
  return out;
}

function collectGameState() {
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    playerName: currentPlayerName,
    nextId,
    cards: serializeCards(cards),
    baseCards: serializeCards(baseCards),
    darkForestCards: serializeCards(darkForestCards),
    underworldCards: serializeCards(underworldCards),
    underworldBaseCards: serializeCards(underworldBaseCards),
    inDarkForest,
    inUnderworld,
    dayCount,
    dayTimer,
    dayStarted,
    gameOver,
    gameSpeed,
    totalPacksOpened,
    openedPacks: [...openedPacks],
    progressMap: serializeProgressMap(),
    discoveredCards: [...discoveredCards],
    ownedRecipes: [...ownedRecipes],
    discoveredRecipeIdx: [...discoveredRecipes].map(r => RECIPES.indexOf(r)).filter(i => i >= 0),
    unlockedPacks: [...unlockedPacks],
    totalFoodGained,
    totalEmeraldGained,
    totalHouseBuilt,
    witchKills,
    ancientCitySearchCount,
    gateIgnoreCount,
    lastUnstableGateSpawnDay,
    uwDayTimer,
    uwDayLimit,
    uwDayCount,
    lastUwHostileSpawnDay,
    uwDayStarted,
    uwEnterCount,
    uwBossEventActive,
    uwBossMinibossIds: [...uwBossMinibossIds],
    uwHostileKills,
    uwQuestsUnlocked,
    ch2Unlocked: !!(QUEST_CHAPTERS.find(ch => ch.id === "ch1")?._ch2Unlocked),
    darkForestState,
    camX,
    camY,
    camScale,
    initPackOpened,
    quests: QUESTS.map(q => ({ id: q.id, done: q.done, visible: q.visible, locked: !!q.locked })),
    subQuests: SUB_QUESTS.map(q => ({ id: q.id, done: q.done, visible: q.visible })),
  };
}

function applyPackLocksFromSave(savedUnlocked) {
  initPackLocks();
  for (const packId of (savedUnlocked || [])) {
    unlockPackById(packId);
  }
}

function applyQuestStates(questData, subData, ch2Unlocked, uwUnlocked) {
  for (const snap of questData || []) {
    const q = QUESTS.find(x => x.id === snap.id);
    if (q) {
      q.done = snap.done;
      q.visible = snap.visible;
      q.locked = snap.locked;
    }
  }
  for (const snap of subData || []) {
    const q = SUB_QUESTS.find(x => x.id === snap.id);
    if (q) {
      q.done = snap.done;
      q.visible = snap.visible;
    }
  }
  const ch1 = QUEST_CHAPTERS.find(ch => ch.id === "ch1");
  if (ch1) ch1._ch2Unlocked = !!ch2Unlocked;
  uwQuestsUnlocked = !!uwUnlocked;
}

function applyGameState(data) {
  resetGameState();

  nextId = data.nextId || 1;
  baseCards = deserializeCards(data.baseCards);
  darkForestCards = deserializeCards(data.darkForestCards);
  underworldCards = deserializeCards(data.underworldCards);
  underworldBaseCards = deserializeCards(data.underworldBaseCards);
  inDarkForest = !!data.inDarkForest;
  inUnderworld = !!data.inUnderworld;

  const savedCards = deserializeCards(data.cards);
  if (inUnderworld) {
    cards = underworldCards.length > 0 ? underworldCards : savedCards;
  } else if (inDarkForest) {
    cards = darkForestCards.length > 0 ? darkForestCards : savedCards;
  } else {
    cards = savedCards;
  }

  dayCount = data.dayCount ?? 1;
  dayTimer = data.dayTimer ?? 0;
  dayStarted = !!data.dayStarted;
  gameOver = !!data.gameOver;
  gameSpeed = data.gameSpeed ?? 1;
  setSpeed(gameSpeed);

  totalPacksOpened = data.totalPacksOpened ?? 0;
  openedPacks = new Set(data.openedPacks || []);
  progressMap = deserializeProgressMap(data.progressMap);
  discoveredCards = new Set(data.discoveredCards || ["human"]);
  ownedRecipes = new Set(data.ownedRecipes || []);
  discoveredRecipes = new Set(
    (data.discoveredRecipeIdx || []).map(i => RECIPES[i]).filter(Boolean)
  );

  totalFoodGained = data.totalFoodGained ?? 0;
  totalEmeraldGained = data.totalEmeraldGained ?? 0;
  totalHouseBuilt = data.totalHouseBuilt ?? 0;
  witchKills = data.witchKills ?? 0;
  ancientCitySearchCount = data.ancientCitySearchCount ?? 0;
  gateIgnoreCount = data.gateIgnoreCount ?? 0;
  lastUnstableGateSpawnDay = data.lastUnstableGateSpawnDay ?? null;

  uwDayTimer = data.uwDayTimer ?? 0;
  uwDayLimit = data.uwDayLimit ?? 7;
  uwDayCount = data.uwDayCount ?? 0;
  lastUwHostileSpawnDay = data.lastUwHostileSpawnDay ?? 0;
  uwDayStarted = !!data.uwDayStarted;
  uwEnterCount = data.uwEnterCount ?? 0;
  uwBossEventActive = !!data.uwBossEventActive;
  uwBossMinibossIds = new Set(data.uwBossMinibossIds || []);
  uwHostileKills = data.uwHostileKills ?? 0;

  darkForestState = data.darkForestState ?? null;
  camX = data.camX ?? camX;
  camY = data.camY ?? camY;
  camScale = data.camScale ?? camScale;
  initPackOpened = !!data.initPackOpened;

  applyQuestStates(data.quests, data.subQuests, data.ch2Unlocked, data.uwQuestsUnlocked);
  applyPackLocksFromSave(data.unlockedPacks);

  activeBattles = [];
  animations = [];
  mealPhase = false;
  sellPhase = false;
  packOpen = false;
  boardCorruption = null;

  if (inUnderworld) {
    document.getElementById("basePackShopArea").style.display = "none";
    document.getElementById("uwPackShopArea").style.display = "";
  } else {
    document.getElementById("basePackShopArea").style.display = "";
    document.getElementById("uwPackShopArea").style.display = "none";
  }

  const dl = document.getElementById("dayLabel");
  if (dl) {
    if (inUnderworld) dl.textContent = `死の呪いまで${uwDayLimit}日`;
    else if (dayStarted) dl.textContent = `${dayCount}日目`;
    else dl.textContent = "0日目";
  }

  updateCardCount();
  updatePackBadges();
  renderQuestList();
  renderRecipeList();
  clampCam();
}

function saveGame(silent = false) {
  if (!gameActive || !currentPlayerName) return false;
  try {
    const state = collectGameState();
    const key = playerSaveKey(currentPlayerName);
    localStorage.setItem(key, JSON.stringify(state));
    updateSaveMeta(currentPlayerName, { savedAt: state.savedAt, dayCount: state.dayCount });
    refreshTitleSaveInfo();
    if (!silent) toast("💾 セーブしました");
    return true;
  } catch (e) {
    console.error(e);
    if (!silent) toast("セーブに失敗しました");
    return false;
  }
}

function loadGame(playerName) {
  const key = playerSaveKey(playerName);
  const raw = localStorage.getItem(key);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) {
      toast("セーブデータのバージョンが異なります");
      return false;
    }
    currentPlayerName = sanitizePlayerName(playerName);
    applyGameState(data);
    beginGameplay(currentPlayerName);
    if (gameOver) {
      document.getElementById("gameoverOverlay").classList.add("show");
    }
    toast(`💾 ${currentPlayerName} のデータを読み込みました`);
    return true;
  } catch (e) {
    console.error(e);
    toast("ロードに失敗しました");
    return false;
  }
}

function autoSaveDayStart() {
  if (!gameActive || !currentPlayerName || gameOver) return;
  saveGame(true);
  toast("💾 オートセーブ");
}

function resetGameState() {
  cards = [];
  baseCards = [];
  darkForestCards = [];
  underworldCards = [];
  underworldBaseCards = [];
  nextId = 1;
  inDarkForest = false;
  inUnderworld = false;
  gameOver = false;
  dayStarted = false;
  dayTimer = 0;
  dayCount = 1;
  mealPhase = false;
  sellPhase = false;
  packOpen = false;
  progressMap = {};
  activeBattles = [];
  animations = [];
  floatingTexts = [];
  attackEffects = [];
  boardCorruption = null;
  darkForestState = null;
  savedCam = null;
  uwBossEventActive = false;
  uwBossMinibossIds = new Set();
  uwQuestsUnlocked = false;
  uwHostileKills = 0;
  uwDayLimit = 7;
  uwDayCount = 0;
  uwDayTimer = 0;
  uwEnterCount = 0;
  lastUwHostileSpawnDay = 0;
  totalPacksOpened = 0;
  openedPacks = new Set();
  discoveredCards = new Set(["human"]);
  discoveredRecipes = new Set();
  ownedRecipes = new Set();
  unlockedPacks = new Set();
  totalFoodGained = 0;
  totalEmeraldGained = 0;
  totalHouseBuilt = 0;
  witchKills = 0;
  ancientCitySearchCount = 0;
  gateIgnoreCount = 0;
  lastUnstableGateSpawnDay = null;
  initPackOpened = false;

  applyQuestStates(INITIAL_QUEST_SNAPSHOT, INITIAL_SUB_QUEST_SNAPSHOT, false, false);
  SUB_QUESTS.forEach(q => { if (q.chapter === 1) q.visible = true; });
  initPackLocks();

  document.getElementById("gameoverOverlay").classList.remove("show");
  document.getElementById("mealOverlay").classList.remove("show");
  document.getElementById("sellBanner").classList.remove("show");
  document.getElementById("basePackShopArea").style.display = "";
  document.getElementById("uwPackShopArea").style.display = "none";
}

function spawnInitialPack() {
  mkCard("pack_card", INIT_WX, INIT_WY, {
    pool: ["human", "apple_tree", "rock", "wood", "emerald"],
    totalCount: 5,
    currentIndex: 0,
    customLabel: "冒険の始まりパック",
  });
}

function startNewGame(playerName) {
  resetGameState();
  spawnInitialPack();
  initCamera();
  currentPlayerName = sanitizePlayerName(playerName);
  beginGameplay(currentPlayerName);
  renderQuestList();
  renderRecipeList();
  toast(`新しい冒険を始めます（${currentPlayerName}）`);
}

// ── 画面制御 ──────────────────────────────────
function setGameUIVisible(visible) {
  const ids = ["ui", "dayBarWrap", "dayLabel", "sidebar", "sidebarToggle", "speedBtns", "menuBtn"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? "" : "none";
  }
  const recipeToolbar = document.getElementById("sbRecipeToolbar");
  if (recipeToolbar) recipeToolbar.style.display = visible && sbActiveTab === "recipe" ? "" : "none";
}

function showTitleScreen() {
  gameActive = false;
  gamePaused = false;
  setGameUIVisible(false);
  document.getElementById("titleScreen").classList.add("show");
  document.getElementById("gameMenu").classList.remove("show");
  refreshTitleSaveInfo();
}

function hideTitleScreen() {
  document.getElementById("titleScreen").classList.remove("show");
}

function beginGameplay(playerName) {
  currentPlayerName = sanitizePlayerName(playerName);
  gameActive = true;
  gamePaused = false;
  hideTitleScreen();
  setGameUIVisible(true);
  const meta = getSaveMeta();
  meta.lastPlayer = currentPlayerName;
  setSaveMeta(meta);
}

function openGameMenu() {
  if (!gameActive || gameOver) return;
  gamePaused = true;
  document.getElementById("gameMenu").classList.add("show");
  document.getElementById("menuPlayerName").textContent = currentPlayerName;
  document.getElementById("menuDayInfo").textContent = dayStarted
    ? (inUnderworld ? `冥界探索中（残り${uwDayLimit}日）` : `${dayCount}日目`)
    : "冒険準備中";
}

function closeGameMenu() {
  gamePaused = false;
  document.getElementById("gameMenu").classList.remove("show");
}

function refreshTitleSaveInfo() {
  const input = document.getElementById("titlePlayerName");
  const meta = getSaveMeta();
  if (input && !input.value.trim() && meta.lastPlayer) {
    input.value = meta.lastPlayer;
  }
  const name = sanitizePlayerName(input?.value || meta.lastPlayer);
  const continueBtn = document.getElementById("titleContinueBtn");
  const info = document.getElementById("titleSaveInfo");
  if (!continueBtn || !info) return;

  if (name && hasSaveData(name)) {
    continueBtn.disabled = false;
    const key = playerSaveKey(name);
    const slot = meta.players.find(p => p.key === key);
    const when = slot?.savedAt ? new Date(slot.savedAt).toLocaleString("ja-JP") : "";
    const day = slot?.dayCount ?? "?";
    info.textContent = `セーブあり：${day}日目${when ? "（" + when + "）" : ""}`;
    info.style.color = "#a8d4a8";
  } else {
    continueBtn.disabled = true;
    info.textContent = name ? "この名前のセーブデータはありません" : "プレイヤー名を入力してください";
    info.style.color = "#888";
  }

  const list = document.getElementById("titleSaveList");
  if (!list) return;
  list.innerHTML = "";
  for (const slot of meta.players.slice(0, 5)) {
    const btn = document.createElement("button");
    btn.className = "title-slot-btn";
    btn.textContent = `${slot.name}（${slot.dayCount}日目）`;
    btn.addEventListener("click", () => {
      input.value = slot.name;
      refreshTitleSaveInfo();
    });
    list.appendChild(btn);
  }
}

function initTitleAndMenu() {
  const meta = getSaveMeta();
  const nameInput = document.getElementById("titlePlayerName");
  if (nameInput && meta.lastPlayer) nameInput.value = meta.lastPlayer;

  document.getElementById("titleNewBtn").addEventListener("click", () => {
    const name = sanitizePlayerName(nameInput.value);
    if (!name) { toast("プレイヤー名を入力してください"); return; }
    if (hasSaveData(name) && !confirm(`「${name}」のセーブデータがあります。上書きして新しく始めますか？`)) return;
    startNewGame(name);
  });

  document.getElementById("titleContinueBtn").addEventListener("click", () => {
    const name = sanitizePlayerName(nameInput.value);
    if (!name) { toast("プレイヤー名を入力してください"); return; }
    if (!loadGame(name)) toast("セーブデータが見つかりません");
  });

  nameInput.addEventListener("input", refreshTitleSaveInfo);

  document.getElementById("menuBtn").addEventListener("click", openGameMenu);
  document.getElementById("menuResumeBtn").addEventListener("click", closeGameMenu);
  document.getElementById("menuSaveBtn").addEventListener("click", () => saveGame(false));
  document.getElementById("menuTitleBtn").addEventListener("click", () => {
    if (confirm("タイトルに戻りますか？\n（未セーブの進行は失われます）")) {
      saveGame(true);
      closeGameMenu();
      showTitleScreen();
    }
  });

  document.getElementById("restartBtn").addEventListener("click", () => {
    document.getElementById("gameoverOverlay").classList.remove("show");
    showTitleScreen();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.getElementById("gameMenu").classList.contains("show")) {
        closeGameMenu();
      } else if (gameActive && !gameOver && !mealPhase && !packOpen) {
        openGameMenu();
      }
    }
  });

  refreshTitleSaveInfo();
  showTitleScreen();
}

initTitleAndMenu();
