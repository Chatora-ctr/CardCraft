// ════════════════════════════════════════════════
// game.js
// ゲームのロジック・描画・入力処理
// ════════════════════════════════════════════════

// ── 定数 ────────────────────────────────────────
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const UI_H = 72;        // UIバー52px + 日数バー20px
const CW = 80, CH = 100;  // カードのサイズ
// ワールドサイズは動的に計算
const WORLD_BASE_W = 1800, WORLD_BASE_H = 800;
function getWorldW() { return WORLD_BASE_W + Math.max(0, cardLimit() - BASE_CARD_LIMIT) * WORLD_EXPAND_PER_SLOT; }
function getWorldH() { return WORLD_BASE_H + Math.max(0, cardLimit() - BASE_CARD_LIMIT) * WORLD_EXPAND_PER_SLOT; }
const JOB_NAMES = { farmer: "農民", guard: "衛兵", logger: "木こり", miner: "鉱夫", builder: "大工", explorer: "探索者", priest: "神父", ninja: "忍者", hunter: "狩人", mage: "メイジ", soldier: "剣士", grave_keeper: "墓守", hades: "死神" };

// ── ヘルパー ─────────────────────────────────────
function attrSt(attr) { return ATTR_STYLE[attr] || { hd: "#888", bg: "#bbb", label: attr, light: false }; }
function def(type) {
  if (JOB_NAMES[type]) {
    return { label: JOB_NAMES[type], attr: "job", sell: null, maxUses: null };
  }
  return DEFS[type] || { label: type, attr: "material", sell: 1, maxUses: null };
}
function pickOut(r) {
  if (!r || !r.variants) return "wood";
  const tot = r.variants.reduce((s, v) => s + v.w, 0); let x = Math.random() * tot; for (const v of r.variants) { x -= v.w; if (x <= 0) return v.out; } return r.variants[0].out;
}
function getMostProbableOutput(r) {
  if (!r || !r.variants || r.variants.length === 0) return "wood";
  let best = r.variants[0];
  for (const v of r.variants) { if (v.w > best.w) best = v; }
  return best.out;
}
// カードの表示ラベル（職業持ちの村人は職業名を返す、カスタムラベル優先）
function cardLabel(c) {
  if (c.type === "pack_card") {
    if (c.customLabel === "冒険の始まりパック") {
      return "冒険の始まり";
    }
    if (c.packId) {
      const pElem = document.getElementById(c.packId);
      if (pElem) {
        const psNameEl = pElem.querySelector(".ps-name");
        if (psNameEl) return psNameEl.textContent;
      }
    }
    return c.customLabel || def(c.type).label;
  }
  if (c.customLabel) return c.customLabel;
  if (c.type === "human" && c.job) {
    return JOB_NAMES[c.job] || def(c.type).label;
  }
  return def(c.type).label;
}

// 村人の食事コスト（職業による拡張に対応）
function mealCostOf(c) {
  if (c.job && JOB_EFFECTS[c.job] !== undefined) return JOB_EFFECTS[c.job].mealCost;
  return 2;
}

// グループ内に特定jobの村人がいるか確認し、クラフト時間倍率を返す
function craftSpeedMultForGroup(grp, recipe) {
  if (!recipe) return 1.0;

  // participantチェック用：レシピグループ内の村人
  const participants = grp.filter(c => c.type === "human");

  // presentチェック用：盤面全体の村人（グループ外も含む）
  const allHumans = cards.filter(c => c.type === "human");

  let mult = 1.0;
  const checkedJobs = new Set();

  // participantとpresentの両方を合わせてチェック対象にする
  const toCheck = [...new Map([...allHumans].map(c => [c.id, c])).values()];

  for (const c of toCheck) {
    if (!c.job) continue;
    if (checkedJobs.has(c.job)) continue;

    const jobBase = JOB_EFFECTS[c.job];
    if (!jobBase) continue;

    const override = recipe.speedJobBonus?.[c.job];
    const jobMult = override ? override.mult : jobBase.defaultMult;
    const jobMode = override ? override.mode : jobBase.applyMode;

    if (jobMult === 1.0) { checkedJobs.add(c.job); continue; }

    if (jobMode === "present") {
      // 盤面のどこかに存在するだけで効果
      mult *= jobMult;
      checkedJobs.add(c.job);
    } else if (jobMode === "participant") {
      // レシピグループ内のhuman枠として参加している場合のみ
      const isParticipant = participants.some(p => p.id === c.id);
      if (isParticipant) {
        mult *= jobMult;
        checkedJobs.add(c.job);
      }
    }
  }

  // 墓守が冥界でクラフトする場合、時間を2割短縮（速度1/0.8 = 1.25倍）
  if (inUnderworld) {
    const hasGraveKeeper = participants.some(c => c.job === "grave_keeper");
    if (hasGraveKeeper) {
      mult *= 0.8;
    }
  }

  return mult;
}

// 戦闘時のステータス（装備品ボーナス込み）
function combatStats(c) {
  const d = def(c.type);
  const isHuman = (d.attr === "human" || c.type === "baby");
  const base = {
    atk: d.atk || 0,
    def: d.def || 0,
    maxHp: d.maxHp || 10,
    hitRate: d.hitRate !== undefined ? d.hitRate : (isHuman ? 0.8 : 1.0),
    crit: d.crit || 0,
    atkSpeed: d.atkSpeed || 1.5,
    skills: d.skills ? [...d.skills] : []
  };

  // 1. 装備品（職業カード）によるボーナス
  if (c.jobCardType && DEFS[c.jobCardType]) {
    const equip = DEFS[c.jobCardType];
    base.atk += equip.bonusAtk || 0;
    base.def += equip.bonusDef || 0;
    base.maxHp += equip.bonusMaxHp || 0;
    base.hitRate += equip.bonusHitRate || 0;
    base.crit += equip.bonusCrit || 0;
    base.atkSpeed += equip.bonusAtkSpeed || 0;
    if (equip.skills) base.skills.push(...equip.skills);
  }

  // 2. 防具によるボーナス
  if (c.armorCardType && DEFS[c.armorCardType]) {
    const equip = DEFS[c.armorCardType];
    base.atk += equip.bonusAtk || 0;
    base.def += equip.bonusDef || 0;
    base.maxHp += equip.bonusMaxHp || 0;
    base.hitRate += equip.bonusHitRate || 0;
    base.crit += equip.bonusCrit || 0;
    base.atkSpeed += equip.bonusAtkSpeed || 0;
    if (equip.skills) base.skills.push(...equip.skills);
  }

  // 3. 装飾品によるボーナス
  if (c.accessoryCardType && DEFS[c.accessoryCardType]) {
    const equip = DEFS[c.accessoryCardType];
    base.atk += equip.bonusAtk || 0;
    base.def += equip.bonusDef || 0;
    base.maxHp += equip.bonusMaxHp || 0;
    base.hitRate += equip.bonusHitRate || 0;
    base.crit += equip.bonusCrit || 0;
    base.atkSpeed += equip.bonusAtkSpeed || 0;
    if (equip.skills) base.skills.push(...equip.skills);
  }

  // 職業（Job）自体のボーナス（もしあれば。現在は主に作業速度を担当）
  if (c.job && JOB_EFFECTS[c.job]) {
    const eff = JOB_EFFECTS[c.job];
    base.atk += eff.bonusAtk || 0;
    base.def += eff.bonusDef || 0;
    base.hitRate += eff.bonusHitRate || 0;
    base.crit += eff.bonusCrit || 0;
    base.atkSpeed += eff.bonusAtkSpeed || 0;
    if (eff.skills) base.skills.push(...eff.skills);
  }
  return base;
}

// 装備変更時などに最大HPを再計算し、現在のHPを調整する（比率を維持して回復グリッチを防止）
function refreshUnitHp(c) {
  const stats = combatStats(c);
  const newMax = stats.maxHp;
  if (c.hp === undefined) {
    c.hp = newMax;
  } else {
    const oldMax = c._lastMaxHp !== undefined ? c._lastMaxHp : (def(c.type).maxHp || 10);
    if (oldMax > 0 && c.hp > 0) {
      const ratio = c.hp / oldMax;
      c.hp = Math.max(0.1, Math.min(newMax, ratio * newMax));
    } else if (c.hp <= 0) {
      c.hp = 0;
    } else {
      c.hp = newMax;
    }
  }
  c._lastMaxHp = newMax;
}

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();

// ════════════════════════════════════════════════
// 状態変数
// ════════════════════════════════════════════════
let cards = [], nextId = 1;
let debugMode = false;
let debugGodMode = false;
let debugTimeFrozen = false;
let debugMobsFrozen = false;
let debugNoMealCost = false;
let debugNoGameOver = false;
let debugBuffer = "";
let debugBufferTimer = null;
let totalPacksOpened = 0;
let openedPacks = new Set();
let progressMap = {};
let discoveredCards = new Set(["human"]); // 初期カードは発見済み
let discoveredRecipes = new Set();
let dragging = null, dragOffX = 0, dragOffY = 0;
let dragStartX = 0, dragStartY = 0;
let hoveredCard = null;
let hoveredUI = null;
let isDragGroup = false, groupCards = [], groupOffsets = [];
let lastTime = 0;
let lastMousePos = null; // スクリーン座標
let tooltipScrollY = 0;
let tooltipWaitTimer = 0;
let lastTooltipContent = "";
let initPackOpened = false, pendingPackTypes = [], pendingPackRecipeFilter = null;
let packOpen = false;
let activeBattles = [];
let floatingTexts = [];
let attackEffects = [];
let battleIdCounter = 0;
let gameOver = false;
let gameActive = false;
let gamePaused = false;
let currentPlayerName = "";
let dayStarted = false;
let dayTimer = 0, dayCount = 1;
let mealPhase = false;
let mealSelectedIds = new Set();
let mealCardChanges = [];
let mealDeadCount = 0;
let sellPhase = false, sellMustSell = 0;
let gameSpeed = 1;
let ownedRecipes = new Set();
let animations = [];
let unlockedPacks = new Set(); // 全パック初期ロック
const mobMoveTimers = new Map();

// ── クエスト用累計カウンター ────────────────────
let totalFoodGained = 0;
let totalEmeraldGained = 0;
let totalHouseBuilt = 0;
let witchKills = 0; // 森の魔女討伐数
let ancientCitySearchCount = 0; // 古代都市探索回数

// ── ゲートシステム ─────────────────────────────
let gateIgnoreCount = 0;      // ゲートを放置した回数（敵出現レベルに影響）
let lastUnstableGateSpawnDay = null; // 同じ日付での多重出現防止
let darkForestState = null;   // 暗黒の森の状態
let inDarkForest = false;     // 暗黒の森モードフラグ
let darkForestCards = [];     // 暗黒の森のカード配列
let baseCards = [];           // 拠点カードの退避先

// ── アンダーワールド ───────────────────────────
let inUnderworld = false;
let underworldCards = [];
let underworldBaseCards = [];
let savedCam = null; // 拠点のカメラ位置を保存
let uwDayTimer = 0;
let uwDayLimit = 7;
let uwDayCount = 0;
let lastUwHostileSpawnDay = 0;
let uwDayStarted = false;
let uwEnterCount = 0;
// ボスイベント
let uwBossEventActive = false;    // ボスイベント進行中フラグ
let uwBossMinibossIds = new Set(); // 出現中の中ボスのIDセット
let uwHostileKills = 0;

// ── カメラ ──────────────────────────────────────
let WORLD_W = WORLD_BASE_W;
let WORLD_H = WORLD_BASE_H;

function updateWorldSize() {
  const newW = getWorldW(), newH = getWorldH();
  WORLD_W = newW; WORLD_H = newH;
}

let camX = 0, camY = 0, camScale = 1;
const MAX_SC = 3;
// MIN_SCは動的に計算（ワールドが画面からはみ出さない最小スケール）
function getMinScale() {
  const gameH = canvas.height - UI_H;
  // 盤面の下限に20pxの余白を確保
  return Math.min(canvas.width / WORLD_W, (gameH - 20) / WORLD_H);
}
let pinchActive = false, pinchStartDist = 0, pinchStartScale = 1;
let pinchMidW = { x: 0, y: 0 }, pinchMidS = { x: 0, y: 0 };
let panActive = false, panStartX = 0, panStartY = 0, panCamX = 0, panCamY = 0;

// ── 終焉の盃：盤面侵食演出 ──────────────────────
// phase: spreading（円状侵食）→ complete（全面黒）→ shattering（破片落下）
let boardCorruption = null;
const BOARD_CORRUPTION_SPEED = 620; // 実時間 px/秒

function boardCenter() {
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
}

function corruptionMaxRadius(cx, cy) {
  const corners = [
    [0, 0], [WORLD_W, 0], [0, WORLD_H], [WORLD_W, WORLD_H],
  ];
  let max = 0;
  for (const [x, y] of corners) {
    max = Math.max(max, Math.hypot(x - cx, y - cy));
  }
  return max + 120;
}

function startBoardCorruption(cx, cy, waitCameraReturn = false) {
  boardCorruption = {
    centerX: cx, centerY: cy,
    radius: 0,
    maxRadius: corruptionMaxRadius(cx, cy),
    phase: "spreading",
    fragments: null,
    waitingCameraReturn: waitCameraReturn,
  };
}

function makeShatterFragment(x, y, w, h) {
  const shade = 8 + Math.floor(Math.random() * 10);
  return {
    x, y, w, h,
    vx: (Math.random() - 0.5) * 90,
    vy: 18 + Math.random() * 45,
    rot: (Math.random() - 0.5) * 0.35,
    rotSpeed: (Math.random() - 0.5) * 1.8,
    alpha: 1,
    delay: Math.random() * 0.2,
    color: `rgb(${shade}, ${shade}, ${shade + 2})`,
  };
}

function generateScreenShatterFragments() {
  const fragments = [];
  const pad = 24;
  const startX = -pad;
  const startY = UI_H - pad;
  const areaW = canvas.width + pad * 2;
  const areaH = (canvas.height - UI_H) + pad * 2;
  const cols = Math.max(8, Math.ceil(areaW / 160));
  const rows = Math.max(5, Math.ceil(areaH / 130));
  const cellW = areaW / cols;
  const cellH = areaH / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const w = cellW * (1.06 + Math.random() * 0.1);
      const h = cellH * (1.06 + Math.random() * 0.1);
      fragments.push(makeShatterFragment(
        startX + col * cellW + (Math.random() - 0.5) * 16,
        startY + row * cellH + (Math.random() - 0.5) * 16,
        w, h
      ));
    }
  }
  return fragments;
}

function shatterBoardCorruption() {
  if (!boardCorruption) return;
  boardCorruption.phase = "shattering";
  boardCorruption.screenFragments = generateScreenShatterFragments();
}

function isBoardCorrupted() {
  return boardCorruption && !inDarkForest && !inUnderworld;
}

function isBoardFullyBlack() {
  return isBoardCorrupted() && boardCorruption.phase === "complete";
}

function updateBoardCorruption(dt) {
  if (!boardCorruption || dt <= 0) return;
  const sec = dt / 1000;
  if (boardCorruption.phase === "spreading") {
    boardCorruption.radius += BOARD_CORRUPTION_SPEED * sec;
    if (boardCorruption.radius >= boardCorruption.maxRadius) {
      boardCorruption.radius = boardCorruption.maxRadius;
      boardCorruption.phase = "complete";
      if (boardCorruption.waitingCameraReturn) {
        boardCorruption.waitingCameraReturn = false;
        returnCamera();
      }
    }
  } else if (boardCorruption.phase === "shattering" && boardCorruption.screenFragments) {
    let alive = 0;
    for (const f of boardCorruption.screenFragments) {
      if (f.delay > 0) { f.delay -= sec; alive++; continue; }
      f.vy += 520 * sec;
      f.x += f.vx * sec;
      f.y += f.vy * sec;
      f.rot += f.rotSpeed * sec;
      f.alpha -= 0.7 * sec;
      if (f.alpha > 0.02 && f.y < canvas.height + f.h + 80) alive++;
    }
    if (alive === 0) boardCorruption = null;
  }
}

function drawScreenShatterFragments() {
  if (!boardCorruption || boardCorruption.phase !== "shattering" || !boardCorruption.screenFragments) return;
  for (const f of boardCorruption.screenFragments) {
    if (f.alpha <= 0.02) continue;
    ctx.save();
    ctx.globalAlpha = f.delay > 0 ? 1 : f.alpha;
    ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
    ctx.rotate(f.rot);
    ctx.fillStyle = f.color;
    ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
    ctx.restore();
  }
}

function drawBoardCorruption() {
  if (!isBoardCorrupted()) return;

  if (boardCorruption.phase === "spreading") {
    const { centerX, centerY, radius } = boardCorruption;
    if (radius <= 0) return;
    const spreadRatio = radius / boardCorruption.maxRadius;
    const inner = Math.max(0, radius - 48);
    const grad = ctx.createRadialGradient(centerX, centerY, inner, centerX, centerY, radius);
    grad.addColorStop(0, "#080808");
    grad.addColorStop(0.8, "#101010");
    grad.addColorStop(0.95, spreadRatio > 0.82 ? "#101010" : "rgba(16,16,16,0.8)");
    grad.addColorStop(1, spreadRatio > 0.82 ? "#101010" : "rgba(16,16,16,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 40, 110, 0.4)";
    ctx.lineWidth = 4 / camScale;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.95, 0, Math.PI * 2);
    ctx.stroke();
  } else if (boardCorruption.phase === "complete") {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
}

function drawWorldBoundary() {
  ctx.save();
  ctx.strokeStyle = inUnderworld ? "#980f0f" : "rgba(0,100,0,0.35)";
  ctx.lineWidth = 3 / camScale;
  ctx.setLineDash([12 / camScale, 8 / camScale]);
  ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
  ctx.setLineDash([]);
  ctx.restore();
}

// ════════════════════════════════════════════════
// 戦闘属性システム（近接 / 遠距離 / 魔法）
// ════════════════════════════════════════════════
const JOB_COMBAT_ATTR = { hunter: "ranged", ninja: "ranged", mage: "magic", priest: "magic" };
const COMBAT_ATTR_COLOR = { melee: "#e53935", ranged: "#1e88e5", magic: "#43a047" };
const ATTR_ADVANTAGE = { melee: "magic", magic: "ranged", ranged: "melee" };
const ATTR_CRIT_BONUS = 0.07;

function getCardCombatAttr(card) {
  const d = def(card.type);
  if (d && d.attr === "hostile") return d.combatAttr || "melee";
  if (card.job && JOB_COMBAT_ATTR[card.job]) return JOB_COMBAT_ATTR[card.job];
  return "melee";
}
function hasAttributeAdvantage(attacker, target) {
  return ATTR_ADVANTAGE[getCardCombatAttr(attacker)] === getCardCombatAttr(target);
}

// ════════════════════════════════════════════════
// ゲートシステム
// ════════════════════════════════════════════════

const DANGER_POOL = {
  1: ["rabbit", "cow", "chicken"],
  2: ["spider", "bat", "goblin", "dark_goblin", "curse_goblin"],
  3: ["skeleton", "zombie", "creeper"],
  4: ["elf", "dark_elf", "curse_elf", "mimic"],
  5: ["guardian"],
};
const WAVE_LEVELS = {
  1: [{ danger: 1, count: 1 }, { danger: 2, count: 1 }],
  2: [{ danger: 2, count: 3 }],
  3: [{ danger: 2, count: 2 }, { danger: 3, count: 2 }],
  4: [{ danger: 2, count: 2 }, { danger: 3, count: 2 }, { danger: 4, count: 1 }],
  5: [{ danger: 2, count: 1 }, { danger: 3, count: 3 }, { danger: 4, count: 2 }],
  6: [{ danger: 2, count: 1 }, { danger: 3, count: 3 }, { danger: 4, count: 3 }],
};

function pickMobByDanger(danger) {
  const pool = DANGER_POOL[Math.min(5, Math.max(1, danger))] || DANGER_POOL[2];
  return pool[Math.floor(Math.random() * pool.length)];
}
function buildEnemyList(level) {
  if (level === 7) {
    const out = ["witch"];
    for (let i = 0; i < 3; i++) out.push(pickMobByDanger(3));
    for (let i = 0; i < 3; i++) out.push(pickMobByDanger(4));
    return out;
  }
  const lv = Math.min(6, Math.max(1, level));
  const out = [];
  for (const s of WAVE_LEVELS[lv]) for (let i = 0; i < s.count; i++) out.push(pickMobByDanger(s.danger));
  return out;
}

function spawnUnstableGate() {
  const pos = findFreePos(
    WORLD_W / 2 + (Math.random() - 0.5) * WORLD_W * 0.6,
    WORLD_H / 2 + (Math.random() - 0.5) * WORLD_H * 0.6
  );
  const gate = mkCard("unstable_gate", pos.x, pos.y);
  gate.fixed = true;
  gate.gateTimer = 30000;
  gate.gateSendTimer = null;
  gate.gateIgnored = false;
  toast("⚠️ 不安定なゲートが出現した！");
  // ゲート出現時のズームイン演出（少し遅らせて食事フェーズ終了後に）
  setTimeout(() => {
    zoomToWorld(gate.x + CW / 2, gate.y + CH / 2, { targetScale: 1.6, zoomDur: 1000, returnDur: 1200, stopTime: false });
  }, 300);
}

// ── 冥界ボスイベント ───────────────────────────
function spawnUwBossEvent() {
  if (uwBossEventActive) { toast("既にボスイベントが進行中です！"); return; }
  uwBossEventActive = true;
  uwBossMinibossIds = new Set();
  const margin = 80;
  const bossTypes = [
    { type: "gozu",       x: margin,                      y: margin },
    { type: "mezu",       x: WORLD_W - margin - CW,       y: margin },
    { type: "uw_bird",    x: margin,                      y: WORLD_H - margin - CH },
    { type: "soul_eater", x: WORLD_W - margin - CW,       y: WORLD_H - margin - CH },
  ];
  for (const b of bossTypes) {
    const pos = findFreePos(b.x, b.y);
    const mob = mkCard(b.type, pos.x, pos.y);
    uwBossMinibossIds.add(mob.id);
  }
  toast("☠️ 冥界の四鬼が現れた！全てを倒せ！");
}

function spawnPluto() {
  uwBossEventActive = false;
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const pos = findFreePos(cx, cy);
  const pluto = mkCard("pluto", pos.x, pos.y);
  toast("👑 冥王プルートが現れた！");
  setTimeout(() => {
    zoomToWorld(pos.x + CW / 2, pos.y + CH / 2, { targetScale: 1.6, zoomDur: 1000, returnDur: 1500, stopTime: false });
  }, 300);
}

function hasAnyItem(type) {
  return cards.some(c => c.type === type) ||
    baseCards.some(c => c.type === type) ||
    darkForestCards.some(c => c.type === type) ||
    underworldCards.some(c => c.type === type);
}

function checkGateSpawn() {
  if (dayCount < 12) return;
  if (cards.some(c => c.type === "stable_gate")) return; // 安定したゲートがあればスキップ
  if (cards.some(c => c.type === "unstable_gate")) return; // 既に存在する場合はスキップ
  if (lastUnstableGateSpawnDay === dayCount) return; // 同一日での多重出現防止
  if ((dayCount - 12) % 4 === 0) spawnUnstableGate();
  if ((dayCount - 12) % 4 === 0) lastUnstableGateSpawnDay = dayCount;
}
function uwHostileSpawn() {
  if (!inUnderworld) return;
  if (lastUwHostileSpawnDay === uwDayCount) return;
  if (uwDayLimit <= 0) { returnFromUnderWorld(); return; }
  const hasWarding = cards.some(c => def(c.type).attr === "human" && c.accessoryCardType === "warding_charm");
  let spawnCount = Math.floor(Math.random() * 3) + 1;
  if (hasWarding) {
    spawnCount = Math.max(1, spawnCount - 1);
  }
  const uwHostiles = ["hungry_ghost", "wandering_soul", "shadow_stitching"];
  for (let i = 0; i < spawnCount; i++) {
    const randomEnemy = uwHostiles[Math.floor(Math.random() * uwHostiles.length)];
    const rx = WORLD_W / 2 + (Math.random() - 0.5) * WORLD_W * 0.8;
    const ry = WORLD_H / 2 + (Math.random() - 0.5) * WORLD_H * 0.8;
    const pos = findFreePos(rx, ry);
    mkCard(randomEnemy, pos.x, pos.y);
  }
  lastUwHostileSpawnDay = uwDayCount;
}

function updateGates(dtMs) {
  const gates = cards.filter(c => c.type === "unstable_gate" || c.type === "stable_gate");
  for (const gate of gates) {
    const isStable = gate.type === "stable_gate";
    const humans = cards.filter(c =>
      (c.type === "human") && c.gateId === gate.id
    );

    // 安定したゲートの場合、重なっている村人の位置を常に整列する
    if (isStable) {
      humans.sort((a, b) => a.y - b.y);
      humans.forEach((h, idx) => {
        h.x = gate.x;
        h.y = gate.y + 24 * (idx + 1);
      });

      // 描画順（cards配列順）も y 昇順に揃えて、重なり順が崩れないようにする
      // ※ draw() は cards を先頭→末尾の順で描画するため、下（yが大きい）ほど前面に来る
      const group = [gate, ...humans].filter(c => cards.includes(c));
      if (group.length >= 2) {
        const groupIds = new Set(group.map(c => c.id));
        const groupSorted = [...group].sort((a, b) => (a.y - b.y) || (a.id - b.id));
        const firstIndex = Math.min(...group.map(c => cards.findIndex(x => x.id === c.id)));
        const out = [];
        let inserted = false;
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i];
          if (i === firstIndex && !inserted) { out.push(...groupSorted); inserted = true; }
          if (groupIds.has(c.id)) continue;
          out.push(c);
        }
        if (!inserted) out.push(...groupSorted);
        cards = out;
      }
    }

    if (!isStable && humans.length === 0 && !gate.gateIgnored) {
      gate.gateTimer -= dtMs;
      if (gate.gateTimer <= 0) {
        gate.gateIgnored = true;
        gateIgnoreCount++;
        const level = Math.min(6, gateIgnoreCount);
        const enemyTypes = buildEnemyList(level);
        for (const eType of enemyTypes) {
          const p = findFreePos(gate.x, gate.y);
          mkCard(eType, p.x, p.y);
        }
        cards = cards.filter(c => c !== gate);
      }
    }

    if (humans.length > 0) {
      if (gate.gateSendTimer === null) gate.gateSendTimer = 30000; // 最初のドロップ時に正確に30秒から開始
      gate.gateSendTimer -= dtMs;
      if (gate.gateSendTimer <= 0) launchDarkForest(gate, humans);
    } else {
      // 人間がいなくなったらタイマーをリセット
      gate.gateSendTimer = null;
    }
  }
}

function updateUnderworldDoor(dtMs) {
  if (inUnderworld) return;
  const doors = cards.filter(c => c.type === "underworld_door");
  for (const door of doors) {
    const human = cards.find(c => c.doorId === door.id); // maxStack=1 なので find で十分

    // 整列（ゲートと同じパターン）
    if (human) {
      human.x = door.x;
      human.y = door.y + 24;
    }

    if (human) {
      if (door.doorSendTimer === null || door.doorSendTimer === undefined) {
        door.doorSendTimer = 15000; // 15秒後に転移
      }
      door.doorSendTimer -= dtMs;
      if (door.doorSendTimer <= 0) {
        door.doorSendTimer = null;
        launchUnderworld(human);
      }
    } else {
      door.doorSendTimer = null;
    }
  }
}

// ════════════════════════════════════════════════
// 暗黒の森
// ════════════════════════════════════════════════
// 暗黒の森は拠点とは完全に別の盤面（inDarkForest=trueの間はこちらを使う）

// 拠点カードを退避し、暗黒の森に切り替える
function enterDarkForest() {
  baseCards = cards;
  cards = darkForestCards;
  inDarkForest = true;
  completeQuest("qH1");
}

function exitDarkForest() {
  if (!inDarkForest) return;
  darkForestCards = cards;
  cards = baseCards;
  baseCards = [];
  inDarkForest = false;
  completeQuest("qH2");
}

function fadeScreen(color, duration, onMid, onEnd) {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;inset:0;background:${color};opacity:0;z-index:9500;pointer-events:none;transition:opacity ${duration / 2}ms ease;`;
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; });
  setTimeout(() => {
    onMid && onMid();
    el.style.opacity = "0";
    setTimeout(() => { el.remove(); onEnd && onEnd(); }, duration / 2);
  }, duration / 2);
}

function launchDarkForest(gate, humans) {
  if (inDarkForest) return;
  const heroCards = [...humans];
  const isStable = gate.type === "stable_gate";
  cards = cards.filter(c => (isStable ? true : c !== gate) && !heroCards.includes(c));
  if (isStable) {
    gate.gateSendTimer = null;
  }
  const startWave = (darkForestState && darkForestState.nextWave) ? darkForestState.nextWave : 1;
  darkForestState = { wave: startWave, heroCards, enemyCards: [], phase: "spawning", nextWave: startWave };

  darkForestCards = [];
  const hCount = heroCards.length;
  heroCards.forEach((h, i) => {
    delete h.gateId; delete h.fixed;
    h.x = WORLD_BASE_W / 2 + (i - (hCount - 1) / 2) * (CW + 12);
    h.y = WORLD_BASE_H * 0.65;
    darkForestCards.push(h);
  });

  fadeScreen("rgba(8,2,20,1)", 2000, () => {
    enterDarkForest();
    const gameH = canvas.height - UI_H;
    camScale = Math.min(canvas.width / WORLD_BASE_W, (gameH - 20) / WORLD_BASE_H);
    camX = canvas.width / 2 - WORLD_BASE_W / 2 * camScale;
    camY = gameH / 2 - WORLD_BASE_H / 2 * camScale;
    spawnDarkForestWaveEnemies();
    toast("🌑 暗黒の森へ転移した！");
  }, null);
}

function spawnDarkForestWaveEnemies() {
  if (!darkForestState) return;

  // 既存の戦闘を終了
  activeBattles = activeBattles.filter(b => {
    const hasDF = [...b.participants].some(c =>
      darkForestState.heroCards.includes(c) || darkForestState.enemyCards.includes(c)
    );
    if (hasDF) { for (const p of b.participants) { if (p.status) { p.status.stun = 0; } delete p.attackTimer; } return false; }
    return true;
  });

  // 前のウェーブの敵カードのみ除去（ドロップ品・英雄は残す）
  // 参照の同期切れを防ぐため、最新の cards から敵を除去する
  const oldEnemySet = new Set(darkForestState.enemyCards.map(c => c.id));
  darkForestCards = cards.filter(c => !oldEnemySet.has(c.id));
  darkForestState.enemyCards = [];

  // mkCardはcardsにpushするので、先にdarkForestCardsをcardsに設定
  cards = darkForestCards;

  let level;
  const wave = darkForestState.wave;
  if (wave >= 7 && (wave - 7) % 4 === 0) {
    level = 7;
  } else {
    level = Math.min(6, wave);
  }
  const enemyTypes = buildEnemyList(level);
  const eCount = enemyTypes.length;
  const hCount = darkForestState.heroCards.length;

  // 固定盤面中央：敵は上部(25%)、英雄は下部(65%)
  enemyTypes.forEach((type, i) => {
    const mob = mkCard(type,   // mkCardがcards(=darkForestCards)に追加される
      WORLD_BASE_W / 2 + (i - (eCount - 1) / 2) * (CW + 12),
      WORLD_BASE_H * 0.25
    );
    darkForestState.enemyCards.push(mob);
  });

  // darkForestCardsをcardsと同期（mkCardで追加されたものを反映）
  darkForestCards = [...cards];

  // 英雄を再配置（装備品の物理カードを除去して複製を防ぐ）
  darkForestState.heroCards.forEach((h, i) => {
    h.x = WORLD_BASE_W / 2 + (i - (hCount - 1) / 2) * (CW + 12);
    h.y = WORLD_BASE_H * 0.65;
    // 装備品の物理カードがdarkForestCardsに残留していたら除去（複製防止）
    ["armorCardType", "jobCardType", "accessoryCardType"].forEach(slot => {
      if (h[slot]) {
        darkForestCards = darkForestCards.filter(c =>
          c.type !== h[slot] || c === h // 英雄自身は除外しない
        );
      }
    });
  });
  cards = darkForestCards;

  // 全員vs全員の戦闘開始
  setTimeout(() => {
    if (!darkForestState || !inDarkForest) return;
    const heroes = darkForestState.heroCards.filter(h => cards.includes(h));
    const enemies = darkForestState.enemyCards.filter(e => cards.includes(e));
    if (heroes.length > 0 && enemies.length > 0) {
      battleIdCounter++;
      const b = {
        id: battleIdCounter,
        participants: new Set([...heroes, ...enemies]),
        bounds: { x: 0, y: 0, w: 0, h: 0 },
        originX: WORLD_BASE_W / 2,
        originY: WORLD_BASE_H / 2,
      };
      for (const p of b.participants) initCombatant(p);
      activeBattles.push(b);
      formBattleLine(b);
      updateBattleBounds(b);
    }
    darkForestState.phase = "battle";
  }, 400);
}

function updateDarkForest() {
  if (!darkForestState || !inDarkForest || darkForestState.phase !== "battle") return;

  const livingHeroes = darkForestState.heroCards.filter(c => cards.includes(c) && (c.hp === undefined || c.hp > 0));
  const livingEnemies = darkForestState.enemyCards.filter(c => cards.includes(c) && (c.hp === undefined || c.hp > 0));

  if (livingHeroes.length === 0) {
    darkForestState.nextWave = darkForestState.wave; // 敗走：同ウェーブからやり直し
    darkForestState.phase = "returning";
    returnFromDarkForest(false);
    return;
  }
  if (livingEnemies.length === 0) {
    darkForestState.nextWave = darkForestState.wave + 1; // 上限なし
    darkForestState.phase = "choice";
    showDarkForestChoiceDialog();
  }
}

function returnFromDarkForest(survived) {
  if (!inDarkForest) return;
  hideDarkForestChoiceDialog();

  // 戦闘を終了
  activeBattles = activeBattles.filter(b => {
    const hasDF = [...b.participants].some(c =>
      darkForestState.heroCards.includes(c) || darkForestState.enemyCards.includes(c)
    );
    if (hasDF) { for (const p of b.participants) { delete p.attackTimer; } return false; }
    return true;
  });

  const survivors = darkForestState.heroCards.filter(c => cards.includes(c) && (c.hp === undefined || c.hp > 0));
  const heroSet = new Set(darkForestState.heroCards.map(c => c.id));
  const enemySet = new Set(darkForestState.enemyCards.map(c => c.id));
  const drops = survived ? cards.filter(c => !heroSet.has(c.id) && !enemySet.has(c.id)) : [];

  toast(survivors.length === 0 ? "全員倒れた…" : `帰還！`);
  const savedNextWave = darkForestState.nextWave;

  fadeScreen("rgba(180,224,178,1)", 2000, () => {
    exitDarkForest();
    survivors.forEach((h, i) => {
      const p = findFreePos(WORLD_W / 2 + i * (CW + 8), WORLD_H / 2);
      h.x = p.x; h.y = p.y;
      cards.push(h);
    });
    if (drops.length > 0) {
      placeReturnedCardStacks(drops);
    }
    darkForestState = { nextWave: savedNextWave };
    darkForestCards = [];
    initCamera();

    // 拠点盤面に戻った時点で、もし生存している村人が一人もいなければゲームオーバーをトリガーする
    if (cards.filter(c => c.type === "human" || c.type === "baby").length === 0) {
      triggerGameOver();
    }
  }, null);
}

// ── ウェーブクリア選択ダイアログ ──

function showDarkForestChoiceDialog() {
  hideDarkForestChoiceDialog();
  const dlg = document.createElement("div");
  dlg.id = "dfChoiceDlg";
  dlg.style.cssText = [
    "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);",
    "background:rgba(8,2,20,0.96);border:2px solid #4a2080;border-radius:12px;",
    "z-index:9001;padding:24px 32px;text-align:center;min-width:240px;",
    "font-family:'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif;",
    "box-shadow:0 0 40px rgba(100,40,200,0.5);"
  ].join("");
  const wave = darkForestState ? darkForestState.wave : "?";
  const nextWave = darkForestState ? darkForestState.wave + 1 : "?";
  dlg.innerHTML = `
    <div style="color:#b088ff;font-size:16px;font-weight:bold;margin-bottom:6px;">🌑 ウェーブ ${wave} クリア！</div>
    <div style="color:#888;font-size:12px;margin-bottom:18px;">次はウェーブ ${nextWave}</div>
    <button onclick="darkForestNextWave()" style="
      display:block;width:100%;margin-bottom:10px;
      background:#3a1a6a;border:1px solid #b088ff;color:#e0d0ff;
      padding:10px;border-radius:7px;font-size:13px;cursor:pointer;font-family:inherit;">
      ▶ 次のウェーブへ (${nextWave})
    </button>
    <button onclick="darkForestReturn()" style="
      display:block;width:100%;
      background:#1a2a1a;border:1px solid #4caf50;color:#c0e8c0;
      padding:10px;border-radius:7px;font-size:13px;cursor:pointer;font-family:inherit;">
      🏕 帰還する
    </button>
  `;
  document.body.appendChild(dlg);
}

function hideDarkForestChoiceDialog() {
  const el = document.getElementById("dfChoiceDlg");
  if (el) el.remove();
}

function showDarkForestUI() { /* 廃止 */ }
function hideDarkForestUI() { hideDarkForestChoiceDialog(); }
function renderDarkForestUI() { /* 廃止 */ }

function darkForestNextWave() {
  if (!darkForestState || darkForestState.phase !== "choice") return;
  hideDarkForestChoiceDialog();
  darkForestState.wave = darkForestState.nextWave;
  darkForestState.phase = "spawning";
  spawnDarkForestWaveEnemies();
}

function darkForestReturn() { returnFromDarkForest(true); }

// ════════════════════════════════════════════════
// 冥界
// ════════════════════════════════════════════════
// 冥界は拠点とは完全に別の盤面（inUnderWorld=trueの間はこちらを使う）

let uwQuestsUnlocked = false;

function unlockUnderworldQuests() {
  if (uwQuestsUnlocked) return;
  uwQuestsUnlocked = true;
  QUESTS_CH2_I.forEach(q => {
    q.locked = false;
    q.visible = true;
  });
  toast("🌟 冥界のクエストが解放されました！");
  renderQuestList();
}

function enterUnderworld() {
  underworldBaseCards = cards;
  cards = underworldCards;
  inUnderworld = true;
  uwDayStarted = true;
  uwDayLimit = 7;

  unlockUnderworldQuests();
  completeQuest("qI1");

  // パックショップ切り替え
  document.getElementById("basePackShopArea").style.display = "none";
  document.getElementById("uwPackShopArea").style.display = "";
}

function exitUnderworld(preserveFull = false) {
  if (!inUnderworld) return;

  if (preserveFull) {
    underworldCards = [...cards];
  } else {
    underworldCards = cards.filter(c =>
      def(c.type).attr !== "human" &&
      def(c.type).attr !== "doll" &&
      def(c.type).attr !== "currency" &&
      def(c.type).attr !== "precious"
    );
  }
  cards = underworldBaseCards;
  underworldBaseCards = [];
  inUnderworld = false;

  // ボスイベント状態をリセット
  uwBossEventActive = false;
  uwBossMinibossIds = new Set();

  // パックショップ復元
  document.getElementById("basePackShopArea").style.display = "";
  document.getElementById("uwPackShopArea").style.display = "none";

  // カメラを拠点位置に戻す
  if (savedCam) { camX = savedCam.x; camY = savedCam.y; camScale = savedCam.s; savedCam = null; }
}

function launchUnderworld(human) {
  if (inUnderworld) return;

  // カメラ位置を保存
  savedCam = { x: camX, y: camY, s: camScale };

  // human を拠点盤面から除去
  cards = cards.filter(c => c !== human);
  delete human.doorId;

  // 新しいアンダーワールド盤面を生成
  const saved = cards;
  cards = underworldCards;

  uwEnterCount++;

  // ── アンダーワールド専用パックをここで配置 ──
  if (uwEnterCount === 1) {
    mkCard("pack_card", WORLD_BASE_W / 2 - 100, WORLD_BASE_H / 2, {
      pool: ["altar", "stone_doll", "dead_tree", "bone", "funeral_money"],
      totalCount: 5,
      currentIndex: 0,
      customLabel: "冥界パック"
    });
  } else {
    mkCard("pack_card", WORLD_BASE_W / 2 - 100, WORLD_BASE_H / 2, {
      pool: ["stone_doll", "dead_tree", "bone", "funeral_money"],
      totalCount: 4,
      currentIndex: 0,
      customLabel: "冥界パック"
    });
  }

  // 村人を盤面中央に配置
  human.x = WORLD_BASE_W / 2 + 60;
  human.y = WORLD_BASE_H / 2;
  cards.push(human);

  underworldCards = [...cards];
  cards = saved; // 一時差し替えを解除

  fadeScreen("rgba(5,0,15,1)", 2000, () => {
    enterUnderworld();
    const gameH = canvas.height - UI_H;
    camScale = Math.min(canvas.width / WORLD_BASE_W, (gameH - 20) / WORLD_BASE_H);
    camX = canvas.width / 2 - WORLD_BASE_W / 2 * camScale;
    camY = gameH / 2 - WORLD_BASE_H / 2 * camScale;
    toast("💀 冥界へ踏み込んだ！");
  }, null);
}

const FERRY_CARGO_MAX = 6;
const FERRY_RETURN_MS = 20000;

function isSoulDollType(type) {
  const d = def(type);
  return d.attr === "human" && type !== "human" && type !== "baby";
}

function canFerryCarry(card) {
  if (!card || card.type === "ferry") return false;
  const d = def(card.type);
  if (d.attr === "building") return false;
  if (d.attr === "hostile") return false;
  if (d.attr === "gate") return false;
  if (card.type === "funeral_money") return false;
  if (isSoulDollType(card.type)) return false;
  return true;
}

function getFerryStack(ferry) {
  return cards.filter(c => c.ferryId === ferry.id);
}

function findFerryDropTarget(allDragged) {
  const draggedIds = new Set(allDragged.map(c => c.id));
  return cards.find(c => {
    if (c.type !== "ferry") return false;
    if (allDragged.some(d => overlap(d, c))) return true;
    const onFerry = getFerryStack(c).filter(g => !draggedIds.has(g.id));
    return onFerry.some(g => allDragged.some(d => overlap(d, g)));
  });
}

function reorderCardGroup(group) {
  if (group.length < 2) return;
  const groupIds = new Set(group.map(c => c.id));
  const groupSorted = [...group].sort((a, b) => (a.y - b.y) || (a.id - b.id));
  const firstIndex = Math.min(...group.map(c => cards.findIndex(x => x.id === c.id)));
  const out = [];
  let inserted = false;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (i === firstIndex && !inserted) { out.push(...groupSorted); inserted = true; }
    if (groupIds.has(c.id)) continue;
    out.push(c);
  }
  if (!inserted) out.push(...groupSorted);
  cards = out;
}

function alignFerryStack(ferry) {
  const stacked = getFerryStack(ferry);
  const human = stacked.find(c => c.type === "human");
  const cargo = stacked.filter(c => c !== human).sort((a, b) => a.y - b.y);
  const ordered = human ? [human, ...cargo] : cargo;
  ordered.forEach((c, idx) => {
    c.x = ferry.x;
    c.y = ferry.y + 24 * (idx + 1);
  });
  const group = [ferry, ...ordered].filter(c => cards.includes(c));
  if (group.length >= 2) reorderCardGroup(group);
}

function placeReturnedCardStacks(items) {
  if (!items || items.length === 0) return;
  const maxStackSize = 10;
  const stacks = [];
  for (let i = 0; i < items.length; i += maxStackSize) {
    stacks.push(items.slice(i, i + maxStackSize));
  }
  stacks.forEach((stack, si) => {
    const spacingX = CW + 20;
    let baseX = WORLD_W / 2 + (si - (stacks.length - 1) / 2) * spacingX;
    let baseY = WORLD_H / 2 + CH;
    const stackHeight = CH + 24 * (stack.length - 1);
    baseX = Math.max(20, Math.min(WORLD_W - CW - 20, baseX));
    baseY = Math.max(20, Math.min(WORLD_H - stackHeight - 20, baseY));
    stack.forEach((d, idx) => {
      d.x = baseX;
      d.y = baseY + idx * 24;
      cards.push(d);
    });
  });
}

function clearUnderworldBattles() {
  activeBattles = activeBattles.filter(b => {
    const hasUW = [...b.participants].some(c => cards.includes(c));
    if (hasUW) { for (const p of b.participants) delete p.attackTimer; return false; }
    return true;
  });
}

function finishUnderworldReturnToBase() {
  initCamera();
  if (cards.filter(c => c.type === "human" || c.type === "baby").length === 0) {
    triggerGameOver();
  }
}

function returnFromUnderworldViaFerry(ferry) {
  if (!inUnderworld) return;
  const stacked = getFerryStack(ferry);
  const human = stacked.find(c => c.type === "human");
  if (!human) return;
  const cargo = stacked.filter(c => c !== human);
  const toBring = [human, ...cargo];
  toBring.forEach(c => {
    delete c.ferryId;
    delete c.fixed;
  });
  ferry.ferrySendTimer = null;
  clearUnderworldBattles();
  toast("渡し舟で拠点へ帰還！");
  const bringIds = new Set(toBring.map(c => c.id));
  fadeScreen("rgba(180,224,178,1)", 2000, () => {
    cards = cards.filter(c => !bringIds.has(c.id));
    exitUnderworld(true);
    placeReturnedCardStacks(toBring);
    finishUnderworldReturnToBase();
  }, null);
}

function returnFromUnderWorld() {
  if (!inUnderworld) return;
  clearUnderworldBattles();
  fadeScreen("rgba(180,224,178,1)", 2000, () => {
    exitUnderworld(false);
    finishUnderworldReturnToBase();
  }, null);
}

function updateFerry(dtMs) {
  if (!inUnderworld) return;
  const draggedIds = dragging
    ? new Set((isDragGroup ? groupCards : [dragging]).map(c => c.id))
    : null;
  for (const ferry of cards.filter(c => c.type === "ferry")) {
    let stacked = getFerryStack(ferry);
    const draggingFromFerry = draggedIds && stacked.some(c => draggedIds.has(c.id));
    if (stacked.length > 0 && !draggingFromFerry) {
      alignFerryStack(ferry);
      stacked = getFerryStack(ferry);
    }
    const human = stacked.find(c => c.type === "human");
    if (human) {
      if (ferry.ferrySendTimer === null || ferry.ferrySendTimer === undefined) {
        ferry.ferrySendTimer = FERRY_RETURN_MS;
      }
      ferry.ferrySendTimer -= dtMs;
      if (ferry.ferrySendTimer <= 0) {
        ferry.ferrySendTimer = null;
        returnFromUnderworldViaFerry(ferry);
      }
    } else {
      ferry.ferrySendTimer = null;
    }
  }
}

function applyUnderworldDecay() {
  for (const rule of CURSE_DEFS) {
    const targets = cards.filter(c => c.type === rule.from);
    for (const c of targets) {
      c.cursedLimit -= 1;
      if (c.cursedLimit <= 0) {
        c.type = rule.to;
        const nextDef = def(rule.to);
        if (nextDef.cursedLimit !== undefined) {
          c.cursedLimit = nextDef.cursedLimit + 1; // ← リセット
        } else {
          delete c.cursedLimit; // 終端なら削除（これ以上変化しない）
        }
      }
    }
  }
}


// ════════════════════════════════════════════════
let cameraAnim = null;
let cameraAnimSavedSpeed = null; // 演出中に停止した gameSpeed の復元用

/**
 * 指定ワールド座標にカメラをズームインする（片道）
 * stopTimeOnComplete=trueの場合、ズーム完了時にgameSpeedを0にする
 * returnAfterMs が指定された場合、その後自動で元に戻る（時間再開はreturn完了後）
 */
function zoomToWorld(wx, wy, {
  targetScale = 1.6,
  zoomDur = 500,
  returnDur = 500,
  stopTime = false,
  onZoomDone = null, // ズームイン完了・wait開始時のコールバック
  onComplete = null, // return完了時のコールバック
} = {}) {
  const gameH = canvas.height - UI_H;
  const toScale = Math.min(MAX_SC, Math.max(getMinScale(), targetScale));
  const toX = canvas.width / 2 - wx * toScale;
  const toY = gameH / 2 - wy * toScale;
  // ズーム開始時点でsavedSpeedを確保（zoom中にsetSpeedされても復元値を保持）
  if (stopTime && cameraAnimSavedSpeed === null) {
    cameraAnimSavedSpeed = gameSpeed;
  }
  cameraAnim = {
    phase: "zoom",
    t: 0,
    zoomDur,
    returnDur,
    stopTime,
    fromX: camX, fromY: camY, fromScale: camScale,
    toX, toY, toScale,
    originX: camX, originY: camY, originScale: camScale,
    onZoomDone,
    onComplete,
  };
}

/**
 * カメラを元の位置に戻す演出を開始（クラフト完了後に呼ぶ）
 */
function returnCamera() {
  // cameraAnimがない場合でも時間停止していれば解除
  if (!cameraAnim) {
    if (cameraAnimSavedSpeed !== null) {
      gameSpeed = cameraAnimSavedSpeed;
      cameraAnimSavedSpeed = null;
    }
    return;
  }
  cameraAnim.phase = "return";
  cameraAnim.t = 0;
  cameraAnim.fromX = camX;
  cameraAnim.fromY = camY;
  cameraAnim.fromScale = camScale;
}

function updateCameraAnim(dt) {
  if (!cameraAnim) return;
  const a = cameraAnim;

  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  if (a.phase === "zoom") {
    a.t += dt;
    const p = Math.min(a.t / a.zoomDur, 1);
    const ep = ease(p);
    camScale = a.fromScale + (a.toScale - a.fromScale) * ep;
    camX = a.fromX + (a.toX - a.fromX) * ep;
    camY = a.fromY + (a.toY - a.fromY) * ep;
    if (p >= 1 && a.stopTime && cameraAnim && cameraAnim.phase === "zoom") {
      // ズーム完了 → 時間停止して returnCamera() を待つ
      // cameraAnimSavedSpeedはzoomToWorld開始時に既にセット済み
      gameSpeed = 0;
      a.phase = "wait";
      // ズームイン完了コールバック（例: ヨルムンガンド生成 → returnCamera）
      if (a.onZoomDone) a.onZoomDone();
    } else if (p >= 1 && !a.stopTime) {
      a.phase = "return"; a.t = 0;
      a.fromX = camX; a.fromY = camY; a.fromScale = camScale;
    }
  } else if (a.phase === "wait") {
    // returnCamera() が呼ばれるまで何もしない
  } else if (a.phase === "return") {
    a.t += dt;
    const p = Math.min(a.t / a.returnDur, 1);
    const ep = ease(p);
    camScale = a.fromScale + (a.originScale - a.fromScale) * ep;
    camX = a.fromX + (a.originX - a.fromX) * ep;
    camY = a.fromY + (a.originY - a.fromY) * ep;
    if (p >= 1) {
      clampCam();
      const completeCb = a.onComplete || null;
      cameraAnim = null;
      if (cameraAnimSavedSpeed !== null) {
        gameSpeed = cameraAnimSavedSpeed;
        cameraAnimSavedSpeed = null;
      }
      if (completeCb) completeCb();
    }
  }
}

function s2w(sx, sy) { return { x: (sx - camX) / camScale, y: (sy - camY) / camScale }; }

function initCamera() {
  const gameH = canvas.height - UI_H;
  camX = canvas.width / 2 - INIT_WX * camScale;
  camY = gameH / 2 - INIT_WY * camScale;
  clampCam(); // 初期位置もクランプ内に収める
}

function clampCam() {
  const gameH = canvas.height - UI_H;
  const MARGIN = 40 * camScale;

  // ワールドがスクリーンより小さい場合は中央に固定、大きい場合はクランプ
  const worldW = WORLD_W * camScale;
  const worldH = WORLD_H * camScale;

  if (worldW <= canvas.width) {
    // ワールド幅がスクリーン幅以下 → 水平中央固定
    camX = (canvas.width - worldW) / 2;
  } else {
    const maxCamX = MARGIN;
    const minCamX = canvas.width - worldW - MARGIN;
    camX = Math.max(minCamX, Math.min(maxCamX, camX));
  }

  if (worldH <= gameH - 20) {
    camY = (gameH - 20 - worldH) / 2;
  } else {
    const maxCamY = MARGIN;
    const minCamY = (gameH - 20) - worldH;
    camY = Math.max(minCamY, Math.min(maxCamY, camY));
  }
}

// ════════════════════════════════════════════════
// カード生成・配置
// ════════════════════════════════════════════════
const INIT_WX = WORLD_W / 2, INIT_WY = WORLD_H / 2;

function mkCard(type, x, y, extra = {}) {
  const d = def(type);
  const base = { id: nextId++, type, x, y, w: CW, h: CH, stack: 1, uses: 0, maxUses: d.maxUses };
  if (d.maxHp !== undefined) base.hp = d.maxHp;
  if (d.cursedLimit !== undefined) base.cursedLimit = d.cursedLimit;
  return cards[cards.push({ ...base, ...extra }) - 1];
}

function worldClamp(x, y) { return { x: Math.max(0, Math.min(WORLD_W - CW, x)), y: Math.max(0, Math.min(WORLD_H - CH, y)) }; }

function viewClamp(x, y) { return { x: Math.max(0, Math.min(WORLD_W - CW, x)), y: Math.max(Math.max(0, -camY / camScale), Math.min(WORLD_H - CH, y)) }; }

function overlap(a, b) {
  const aw = a.w !== undefined ? a.w : CW;
  const ah = a.h !== undefined ? a.h : CH;
  const bw = b.w !== undefined ? b.w : CW;
  const bh = b.h !== undefined ? b.h : CH;

  let ax = a.x, ay = a.y;
  let bx = b.x, by = b.y;

  // アニメーション中のカードは最終到達地点を元に重複判定を行う
  if (a.id !== undefined && typeof animations !== 'undefined') {
    const anim = animations.find(anim => anim.id === a.id);
    if (anim) { ax = anim.toX; ay = anim.toY; }
  }
  if (b.id !== undefined && typeof animations !== 'undefined') {
    const anim = animations.find(anim => anim.id === b.id);
    if (anim) { bx = anim.toX; by = anim.toY; }
  }

  return !(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay);
}

function findFreePos(bx, by) {
  const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
  for (const d of [90, 130, 180, 240]) {
    for (const a of angles) {
      const p = worldClamp(bx + Math.cos(a) * d, by + Math.sin(a) * d);
      const cand = { x: p.x, y: p.y, w: CW, h: CH };
      if (cards.every(c => !overlap(c, cand))) return p;
    }
  }
  const randAngle = Math.random() * Math.PI * 2;
  return worldClamp(bx + Math.cos(randAngle) * 140, by + Math.sin(randAngle) * 140);
}

function addEmeralds(n, sx, sy) {
  const existing = cards.find(c => c.type === "emerald");
  if (existing) {
    existing.stack = (existing.stack || 1) + n;
  } else {
    const baseX = sx !== undefined ? sx : INIT_WX;
    const baseY = sy !== undefined ? sy : INIT_WY;
    const e = mkCard("emerald", baseX, baseY);
    e.stack = n;
  }
  totalEmeraldGained += n;
  if (totalEmeraldGained >= 25) completeQuest("qE9");
  if (totalEmeraldGained >= 50) completeQuest("qE10");
  if (totalEmeraldGained >= 100) completeQuest("qE11");
}
function addFuneralMoney(n, sx, sy) {
  const existing = cards.find(c => c.type === "funeral_money");
  if (existing) {
    existing.stack = (existing.stack || 1) + n;
  } else {
    const baseX = sx !== undefined ? sx : INIT_WX;
    const baseY = sy !== undefined ? sy : INIT_WY;
    const e = mkCard("funeral_money", baseX, baseY);
    e.stack = n;
  }
}
function addCurrency(n, sx, sy) {
  if (inUnderworld) {
    addFuneralMoney(n, sx, sy);
  } else {
    addEmeralds(n, sx, sy);
  }
}

initCamera();
window.addEventListener("resize", () => { resize(); if (gameActive) initCamera(); });

// ════════════════════════════════════════════════
// トースト通知
// ════════════════════════════════════════════════
let toastTmr = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toastTmr);
  toastTmr = setTimeout(() => el.classList.remove("show"), 2500);
}

// ════════════════════════════════════════════════
// カードアニメーション
// ════════════════════════════════════════════════
function easeOutCubic(t) { return 1 - (1 - t) ** 3; }

function spawnCardAnimated(type, fromX, fromY, toX, toY, extra = {}, onComplete = null) {
  const c = mkCard(type, fromX, fromY, extra);
  discoveredCards.add(type);
  animations.push({ type: "spawn", id: c.id, fromX, fromY, toX, toY, t: 0, dur: 500, onComplete });
  // 2人目の村人入手チェック
  if (type === "human") {
    const humanCount = cards.filter(c => c.type === "human").length;
    if (humanCount >= 2) completeQuest("q11");
    if (humanCount >= 5) completeQuest("qA2");
  }
  // 砂・宝箱入手チェック
  if (type === "sand") completeQuest("qD3");
  if (type === "treasure_chest") completeQuest("qD4");
  // 厚板・レンガはパック入手でも達成
  if (type === "plank") completeQuest("qE3");
  if (type === "brick") completeQuest("qE4");
  // 食べ物累計（枚数カウント）
  if (DEFS[type] && DEFS[type].attr === "food") {
    totalFoodGained += 1; // 枚数（stackでなく1枚単位）
    if (totalFoodGained >= 10) completeQuest("qE6");
    if (totalFoodGained >= 30) completeQuest("qE7");
    if (totalFoodGained >= 50) completeQuest("qE8");
  }
  return c;
}

function clickPackCard(c) {
  if (c.currentIndex >= c.pool.length) return;

  // 冒険の始まりパックを開封したときにクエストq1を進行
  if (c.customLabel === "冒険の始まりパック") {
    completeQuest("q1");
  }

  const type = c.pool[c.currentIndex];
  c.currentIndex++;

  const fromX = c.x;
  const fromY = c.y;
  const p = findFreePos(c.x, c.y);

  if (type === "__recipe__") {
    const idx = resolveRecipeFromPool(c.recipeFilter);
    if (idx !== null) {
      gainRecipeCard(idx, p.x, p.y);
      const newC = cards[cards.length - 1];
      if (newC && newC.type === "recipe_card") {
        animations.push({ id: newC.id, fromX: fromX, fromY: fromY, toX: p.x, toY: p.y, t: 0, dur: 500, onComplete: null });
        newC.x = fromX; newC.y = fromY;
      }
    } else {
      spawnCardAnimated("wood", fromX, fromY, p.x, p.y);
    }
  } else {
    spawnCardAnimated(type, fromX, fromY, p.x, p.y);
  }

  if (!dayStarted) {
    dayStarted = true;
    const dl = document.getElementById("dayLabel");
    if (dl) dl.textContent = "1日目";
    if (typeof autoSaveDayStart === "function") autoSaveDayStart();
  }

  if (c.currentIndex >= c.totalCount) {
    cards = cards.filter(x => x.id !== c.id);
  }
}

function updateAnimations(dt) {
  const done = [];
  for (const a of animations) {
    a.t = Math.min(a.t + dt, a.dur);
    const prog = easeOutCubic(a.t / a.dur);
    const c = cards.find(x => x.id === a.id);
    if (c) { c.x = a.fromX + (a.toX - a.fromX) * prog; c.y = a.fromY + (a.toY - a.fromY) * prog; }
    if (a.t >= a.dur) { if (c) { c.x = a.toX; c.y = a.toY; } done.push(a); }
  }
  animations = animations.filter(a => !done.includes(a));
  for (const a of done) { if (a.onComplete) a.onComplete(); }

  // フローティングテキストの更新
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.t += dt;
    ft.y -= (dt / 1000) * 20; // 少しずつ上に移動する
    if (ft.t >= ft.dur) {
      floatingTexts.splice(i, 1);
    }
  }

  // 攻撃エフェクトの更新
  for (let i = attackEffects.length - 1; i >= 0; i--) {
    const ae = attackEffects[i];
    ae.t += dt;
    if (ae.t >= ae.dur) attackEffects.splice(i, 1);
  }
}

function isAnimating(cardId) { return animations.some(a => a.id === cardId); }

// ════════════════════════════════════════════════
// 敵の移動システム
// ════════════════════════════════════════════════
function updateMobMovement(effDt) {
  if (debugMobsFrozen) return;
  if (mealPhase || sellPhase || gameOver || packOpen) return;

  // 戦闘中の敵は移動しない
  const battleParticipantIds = new Set();
  for (const b of activeBattles) {
    for (const c of b.participants) battleParticipantIds.add(c.id);
  }

  const hostiles = cards.filter(c => def(c.type).attr === "hostile" && !isAnimating(c.id));
  const friendlies = cards.filter(c => def(c.type).attr === "friendly" && !isAnimating(c.id));
  const humans = cards.filter(c => def(c.type).attr === "human" && c !== dragging);

  const draggingIds = new Set();
  if (dragging) draggingIds.add(dragging.id);
  if (isDragGroup) groupCards.forEach(c => draggingIds.add(c.id));

  // 友好モブと敵対モブをまとめて処理
  const mobs = [...hostiles, ...friendlies];

  for (const mob of mobs) {
    if (draggingIds.has(mob.id)) continue;
    if (battleParticipantIds.has(mob.id)) continue;

    const d = def(mob.type);
    const isFriendly = d.attr === "friendly";
    const interval = (d.moveInterval || (isFriendly ? 4 : 5)) * 1000;
    const speed = d.moveSpeed || (isFriendly ? 30 : 50);

    if (!mobMoveTimers.has(mob.id)) {
      mobMoveTimers.set(mob.id, { remaining: interval * Math.random(), moving: false, vx: 0, vy: 0, moveTime: 0, moveDuration: 0 });
    }

    const timer = mobMoveTimers.get(mob.id);

    if (timer.moving) {
      timer.moveTime += effDt;
      const prog = Math.min(timer.moveTime / timer.moveDuration, 1);
      const ease = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;

      const nextX = timer.startX + timer.vx * speed * ease;
      const nextY = timer.startY + timer.vy * speed * ease;
      const clampedX = Math.max(0, Math.min(WORLD_W - CW, nextX));
      const clampedY = Math.max(0, Math.min(WORLD_H - CH, nextY));

      if (!isFriendly && joinBattleIfInZone(mob)) {
        timer.moving = false; continue;
      }

      const newRect = { x: clampedX, y: clampedY, w: CW, h: CH };
      if (!isFriendly) {
        const potentials = spatialGrid.getPotentialColliders(newRect);
        const hitHuman = potentials.find(h => def(h.type).attr === "human" && h !== dragging && !draggingIds.has(h.id) && overlap(newRect, h));
        if (hitHuman) {
          mob.x = clampedX; mob.y = clampedY;
          timer.moving = false;
          triggerCombat(hitHuman, mob);
          continue;
        }
      }

      mob.x = clampedX; mob.y = clampedY;
      if (prog >= 1) { timer.moving = false; timer.remaining = interval; }
      continue;
    }

    timer.remaining -= effDt;
    if (timer.remaining > 0) continue;

    // 檻に入っているモブは移動しない（物理スタック判定）
    if (!isFriendly) {
      const inCageStack = getStack(mob, true).some(c => c.type === 'monster_cage');
      if (inCageStack) { timer.remaining = interval; continue; }
    }

    // 柵・処理場・繁殖小屋のスタックに含まれている家畜は移動しない（物理スタック判定）
    if (isFriendly) {
      const inFenceStack = getStack(mob, true).some(c => c.type === 'livestock_fence' || c.type === 'slaughterhouse' || c.type === 'breeding_shed');
      if (inFenceStack) { timer.remaining = interval; continue; }
    }

    if (isFriendly) {
      // 友好モブはランダムウォーク
      const angle = Math.random() * Math.PI * 2;
      timer.moving = true;
      timer.moveTime = 0;
      timer.moveDuration = 800;
      timer.vx = Math.cos(angle);
      timer.vy = Math.sin(angle);
      timer.startX = mob.x;
      timer.startY = mob.y;
    } else {
      // 敵対モブは村人を追跡
      if (humans.length === 0) { timer.remaining = interval; continue; }
      let nearest = null, nearestDist = Infinity;
      for (const h of humans) {
        if (draggingIds.has(h.id)) continue;
        const dx = (h.x + CW / 2) - (mob.x + CW / 2);
        const dy = (h.y + CH / 2) - (mob.y + CH / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) { nearestDist = dist; nearest = h; }
      }
      if (!nearest) { timer.remaining = interval; continue; }

      const dx = (nearest.x + CW / 2) - (mob.x + CW / 2);
      const dy = (nearest.y + CH / 2) - (mob.y + CH / 2);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      timer.moving = true;
      timer.moveTime = 0;
      timer.moveDuration = 600;
      timer.vx = (dx / dist);
      timer.vy = (dy / dist);
      timer.startX = mob.x;
      timer.startY = mob.y;
    }
  }

  // 削除されたカードのタイマーをクリーンアップ
  const cardIds = new Set(cards.map(c => c.id));
  for (const id of mobMoveTimers.keys()) {
    if (!cardIds.has(id)) mobMoveTimers.delete(id);
  }
}

// ── 空間分割（パフォーマンス最適化用） ────────────────────────
class SpatialGrid {
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }
  clear() {
    this.grid.clear();
  }
  register(card) {
    const xStart = Math.floor(card.x / this.cellSize);
    const xEnd = Math.floor((card.x + CW) / this.cellSize);
    const yStart = Math.floor(card.y / this.cellSize);
    const yEnd = Math.floor((card.y + CH) / this.cellSize);

    for (let x = xStart; x <= xEnd; x++) {
      for (let y = yStart; y <= yEnd; y++) {
        const key = `${x},${y}`;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key).push(card);
      }
    }
  }
  getPotentialColliders(card) {
    const w = card.w !== undefined ? card.w : CW;
    const h = card.h !== undefined ? card.h : CH;
    const xStart = Math.floor(card.x / this.cellSize);
    const xEnd = Math.floor((card.x + w) / this.cellSize);
    const yStart = Math.floor(card.y / this.cellSize);
    const yEnd = Math.floor((card.y + h) / this.cellSize);

    const result = new Set();
    for (let x = xStart; x <= xEnd; x++) {
      for (let y = yStart; y <= yEnd; y++) {
        const key = `${x},${y}`;
        const cell = this.grid.get(key);
        if (cell) {
          for (const c of cell) {
            if (c.id !== card.id) result.add(c);
          }
        }
      }
    }
    return [...result];
  }
}
const spatialGrid = new SpatialGrid(100);

// ════════════════════════════════════════════════
// 斥力システム
// ════════════════════════════════════════════════
function applyRepulsion() {
  const draggingIds = new Set();
  if (dragging) draggingIds.add(dragging.id);
  if (isDragGroup) groupCards.forEach(c => draggingIds.add(c.id));


  const animTargetIds = new Set();
  for (const a of animations) {
    for (const c of cards) {
      if (Math.abs(c.x - a.toX) < CW && Math.abs(c.y - a.toY) < CH) {
        connected(c).forEach(x => animTargetIds.add(x.id));
      }
    }
  }

  const battleIds = new Set();
  activeBattles.forEach(b => { for (const p of b.participants) battleIds.add(p.id); });

  const vis = new Set(), groups = [];
  for (const c of cards) {
    if (vis.has(c.id)) continue;
    const grp = getRepulsionGroup(c); grp.forEach(x => vis.add(x.id));
    const hasDrag = grp.some(c => draggingIds.has(c.id));
    const hasAnim = grp.some(c => isAnimating(c.id));
    const isTarget = grp.some(c => animTargetIds.has(c.id));
    const inBattle = grp.some(c => battleIds.has(c.id));
    const isFixed = grp.some(c => c.fixed); // 固定カード（ゲートなど）

    // バウンディングボックスの事前計算 (キャッシュ化、クイック判定用)
    const minX = Math.min(...grp.map(c => c.x)), minY = Math.min(...grp.map(c => c.y));
    const maxX = Math.max(...grp.map(c => c.x + CW)), maxY = Math.max(...grp.map(c => c.y + CH));
    const bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };

    groups.push({ grp, bbox, hasDrag, hasAnim, isTarget, inBattle, isFixed });
  }

  const MARGIN = 2;
  const moves = new Map();
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const gi = groups[i], gj = groups[j];
      if (gi.hasDrag || gj.hasDrag || gi.inBattle || gj.inBattle) continue;
      if (gi.hasAnim || gj.hasAnim) continue;
      // fixedカード同士または片方がfixedの場合、fixedでない方だけ動かす
      if (gi.isFixed && gj.isFixed) continue;

      const bA = gi.bbox, bB = gj.bbox;
      // 2pxの余白を含めて境界ボックス同士が重なっていないならペア判定自体をスキップ
      const needBBoxX = (bA.w + bB.w) / 2 + MARGIN - Math.abs(bA.cx - bB.cx);
      const needBBoxY = (bA.h + bB.h) / 2 + MARGIN - Math.abs(bA.cy - bB.cy);
      if (needBBoxX <= 0 || needBBoxY <= 0) continue;

      // 実際のカード同士で衝突しているペアを探し、最も重なりが大きいものを基準にする
      let maxOverlap = 0;
      let pushX = 0, pushY = 0;

      for (const cA of gi.grp) {
        for (const cB of gj.grp) {
          const dx = cB.x - cA.x;
          const dy = cB.y - cA.y;
          const overlapX = (CW + MARGIN) - Math.abs(dx);
          const overlapY = (CH + MARGIN) - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            // 他方のカードの中心から自身の中心のベクトルの方向へ押し出す
            const cAx = cA.x + CW / 2;
            const cAy = cA.y + CH / 2;
            const cBx = cB.x + CW / 2;
            const cBy = cB.y + CH / 2;

            const vx = cBx - cAx;
            const vy = cBy - cAy;
            const dist = Math.sqrt(vx * vx + vy * vy);

            const overlapDepth = Math.min(overlapX, overlapY);
            if (overlapDepth > maxOverlap) {
              maxOverlap = overlapDepth;
              if (dist > 0) {
                pushX = vx / dist;
                pushY = vy / dist;
              } else {
                // 中心が完全に重なっている場合はランダムな方向
                const angle = Math.random() * Math.PI * 2;
                pushX = Math.cos(angle);
                pushY = Math.sin(angle);
              }
            }
          }
        }
      }

      if (maxOverlap <= 0) continue; // 実際のカード同士は衝突していない

      // 重なりの解消スピードを速くし、かつ滑らかに押し合って離れるように調整
      const force = Math.min(6.0, maxOverlap * 0.35);
      const iCanMove = !gi.hasAnim && !gi.isTarget && !gi.isFixed;
      const jCanMove = !gj.hasAnim && !gj.isTarget && !gj.isFixed;
      const share = (iCanMove && jCanMove) ? 0.5 : 1.0;
      if (iCanMove) { const m = moves.get(i) || { dx: 0, dy: 0 }; m.dx -= pushX * force * share; m.dy -= pushY * force * share; moves.set(i, m); }
      if (jCanMove) { const m = moves.get(j) || { dx: 0, dy: 0 }; m.dx += pushX * force * share; m.dy += pushY * force * share; moves.set(j, m); }
    }
  }
  for (const [gi, mv] of moves) {
    if (groups[gi].isFixed) continue; // fixedカードは絶対に動かさない
    for (const c of groups[gi].grp) {
      c.x = Math.max(0, Math.min(WORLD_W - CW, c.x + mv.dx));
      c.y = Math.max(0, Math.min(WORLD_H - CH, c.y + mv.dy));
    }
  }
}

// ════════════════════════════════════════════════
// グループ・レシピ判定
// ════════════════════════════════════════════════
function isLibraryCrafting(c) {
  return c && c.type === "library" && progressMap[c.id];
}

function getStack(card, bidirectional = false, sameTypeOnly = false) {
  if (!card) return [];
  if (isLibraryCrafting(card) || card.type === "pack_card") return [card];
  const vis = new Set(), stack = [card], grp = [];
  const startType = card.type;
  while (stack.length) {
    const cur = stack.pop();
    if (vis.has(cur.id)) continue;
    vis.add(cur.id); grp.push(cur);
    const potentials = spatialGrid.getPotentialColliders(cur);
    // 下方向（Y+24）の重なりをチェック
    const onTop = potentials.find(o => !vis.has(o.id) && !isAnimating(o.id) && !isLibraryCrafting(o) && (!sameTypeOnly || o.type === startType) && Math.abs(o.x - cur.x) < 8 && Math.abs(o.y - (cur.y + 24)) < 8);
    if (onTop) stack.push(onTop);
    if (bidirectional) {
      // 上方向（Y-24）の重なりをチェック
      const below = potentials.find(o => !vis.has(o.id) && !isAnimating(o.id) && !isLibraryCrafting(o) && (!sameTypeOnly || o.type === startType) && Math.abs(o.x - cur.x) < 8 && Math.abs(o.y - (cur.y - 24)) < 8);
      if (below) stack.push(below);
    }
  }
  return grp;
}

function getRepulsionGroup(card) {
  const vis = new Set(), stack = [card], grp = [];
  while (stack.length) {
    const cur = stack.pop();
    if (vis.has(cur.id)) continue;
    vis.add(cur.id); grp.push(cur);

    // 1. スタック接続
    const s = getStack(cur, true);
    for (const o of s) if (!vis.has(o.id)) stack.push(o);

    // 2. クラフト中
    for (const key in progressMap) {
      if (key.includes(cur.id.toString())) {
        const ids = key.split(",").map(Number);
        if (ids.includes(cur.id)) {
          ids.forEach(id => {
            const o = cards.find(c => c.id === id);
            if (o && !vis.has(o.id)) stack.push(o);
          });
        }
      }
    }
  }
  return grp;
}

function connectedExcluding(start, excludeIds) {
  if (isLibraryCrafting(start)) return [start];
  const vis = new Set(), stack = [start], grp = [];
  while (stack.length) {
    const cur = stack.pop();
    if (vis.has(cur.id)) continue;
    vis.add(cur.id); grp.push(cur);
    const potentials = spatialGrid.getPotentialColliders(cur);
    for (const o of potentials) {
      if (!vis.has(o.id) && !excludeIds.has(o.id) && !isLibraryCrafting(o) && overlap(cur, o)) {
        stack.push(o);
      }
    }
  }
  return grp;
}
function connected(start) { return connectedExcluding(start, new Set()); }

function getCraftExcludeIds() {
  const ids = new Set();
  if (dragging && !isDragGroup) ids.add(dragging.id);
  else if (dragging && isDragGroup) groupCards.forEach(c => ids.add(c.id));
  animations.forEach(a => ids.add(a.id));
  activeBattles.forEach(b => { for (const p of b.participants) ids.add(p.id); });
  return ids;
}

function allGroupsForCraft() {
  const excludeIds = getCraftExcludeIds();
  const vis = new Set(), groups = [];
  for (const c of cards) {
    if (vis.has(c.id) || excludeIds.has(c.id)) continue;
    const g = connectedExcluding(c, excludeIds);
    g.forEach(x => vis.add(x.id)); groups.push(g);
  }
  return groups;
}

function gKey(grp) { return grp.map(c => c.id).sort((a, b) => a - b).join(","); }

// 職業名キャッシュ
const ALL_JOB_NAMES = new Set(Object.values(DEFS).filter(d => d.job).map(d => d.job));

// 各レシピの要求カード数を事前計算（エメラルドはスタックされるため1枚としてカウント）
for (const r of RECIPES) {
  if (r.inputs) {
    r._requiredCardCount = Object.entries(r.inputs).reduce((sum, [k, v]) => sum + (k === "emerald" ? 1 : v), 0);
    r._requiredCardCount = Object.entries(r.inputs).reduce((sum, [k, v]) => sum + (k === "funeral_money" ? 1 : v), 0);
  }
}

function matchRecipe(grp) {
  for (const r of RECIPES) {
    // 図書館の研究レシピ（libraryとemeraldを要求するもの）は通常の自動判定から除外
    if (r.inputs.library && r.inputs.emerald) continue;

    // 軽量化：要求されるカードオブジェクトの枚数と一致しないグループは即早期リターン
    if (grp.length !== r._requiredCardCount) continue;

    const inputs = { ...r.inputs };

    function cardMatchesInput(card, key) {
      const d = def(card.type);
      if (key === "food") {
        return d.attr === "food";
      }
      if (key === "human") {
        if (r.cantDoll) { return (card.type === "human"); } else { return (d.attr === "human" && card.type !== "baby"); }
      }
      if (key === "cursed") {
        return d.attr === "cursed";
      }
      if (key === "__sellable__") {
        return d.sell !== null && d.sell !== undefined && d.sell > 0;
      }
      if (ALL_JOB_NAMES.has(key)) {
        return card.type === "human" && card.job === key;
      }
      return card.type === key;
    }

    function search(cardIdx, currentInputs) {
      if (cardIdx === grp.length) {
        for (const [k, v] of Object.entries(currentInputs)) {
          if (k === "emerald" || k === "funeral_money") continue;
          if (v > 0) return false;
        }
        return true;
      }

      const card = grp[cardIdx];

      if (card.type === "emerald" || card.type === "funeral_money") {
        if (currentInputs.emerald !== undefined) {
          const required = currentInputs.emerald;
          if ((card.stack || 1) >= required) {
            const nextInputs = { ...currentInputs };
            nextInputs.emerald = 0;
            if (search(cardIdx + 1, nextInputs)) return true;
          }
        }
        if (currentInputs.funeral_money !== undefined) {
          const required = currentInputs.funeral_money;
          if ((card.stack || 1) >= required) {
            const nextInputs = { ...currentInputs };
            nextInputs.funeral_money = 0;
            if (search(cardIdx + 1, nextInputs)) return true;
          }
        }
        return false;
      }

      for (const [k, v] of Object.entries(currentInputs)) {
        if (k === "emerald" || k === "funeral_money") continue;
        if (v > 0 && cardMatchesInput(card, k)) {
          const nextInputs = { ...currentInputs };
          nextInputs[k] = v - 1;
          if (search(cardIdx + 1, nextInputs)) return true;
        }
      }
      return false;
    }

    if (search(0, inputs)) {
      if (r.requireJob) {
        const hasJob = grp.some(c => c.type === "human" && c.job === r.requireJob);
        if (!hasJob) continue;
      }
      return r;
    }
  }
  return null;
}

// ════════════════════════════════════════════════
// カードリミット
// ════════════════════════════════════════════════
function cardLimit() {
  return BASE_CARD_LIMIT + cards.filter(c => def(c.type).cardSlots).reduce((s, c) => s + (def(c.type).cardSlots || 0), 0);
}
function updateCardCount() {
  const lim = cardLimit();
  const cnt = cards.length;

  // カード枚数
  const valEl = document.getElementById("cardCountVal");
  if (valEl) { valEl.textContent = `${cnt}/${lim}`; valEl.style.color = cnt >= lim ? "#ff8080" : "#ccc"; }

  // 食糧満腹度（盤面の合計満腹度 / 村人の必要満腹度）
  const foodEl = document.getElementById("foodStatusVal");
  if (foodEl) {
    const totalSat = cards.filter(c => def(c.type).attr === "food").reduce((s, c) => s + cardActualSat(c), 0);
    const humans = cards.filter(c => c.type === "human" || c.type === "baby");
    const needed = inUnderworld ? 0 : humans.reduce((s, c) => s + mealCostOf(c), 0);
    foodEl.textContent = `${totalSat}/${needed}`;
    const badge = document.getElementById("foodStatus");
    if (badge) badge.style.background = needed > 0 && totalSat >= needed ? "#5a9830" : "#c07820";
  }

  // エメラルド数（盤面の全エメラルドの合計）
  const emEl = document.getElementById("emeraldStatusVal");
  if (emEl) {
    const emeraldTotal = cards.filter(c => c.type === "emerald" || c.type === "funeral_money").reduce((s, c) => s + (c.stack || 1), 0);
    emEl.textContent = emeraldTotal;
  }
}


// ════════════════════════════════════════════════
// パック開封
// ════════════════════════════════════════════════
function drawPool(pool, n, recipeFilter = null, recipeWeight = 10) {
  const results = [];
  let humanDrawnThisPack = false;
  let recipeDrawnThisPack = false;

  // パックB以降で未発見レシピが残っている場合のみ確定枠を有効化
  const isPackBOrLater = recipeFilter && recipeFilter !== "packA";
  const hasUnownedForGuaranteed = isPackBOrLater && RECIPES.some((r, idx) => {
    if (!r.recipeTag || ownedRecipes.has(idx)) return false;
    if (typeof recipeFilter === "string") return r.recipeTag === recipeFilter;
    if (Array.isArray(recipeFilter)) return recipeFilter.includes(r.recipeTag);
    return true;
  });

  for (let i = 0; i < n; i++) {
    // 未発見レシピがある場合のみ確定枠を有効化
    if (hasUnownedForGuaranteed && i === 0) {
      results.push("__recipe__");
      recipeDrawnThisPack = true;
      continue;
    }

    const humanCount = cards.filter(c => c.type === "human" || c.type === "baby").length;

    // 村人出現条件チェック
    const nextTotal = totalPacksOpened;
    const shouldForceHuman =
      (nextTotal === 7 && humanCount < 2 && !humanDrawnThisPack) ||
      (nextTotal >= 10 && humanCount < 2 && (nextTotal - 10) % 5 === 0 && !humanDrawnThisPack);

    if (shouldForceHuman && !inUnderworld) {
      results.push("human");
      humanDrawnThisPack = true;
      continue;
    }

    let filtered = (humanCount >= 2 || humanDrawnThisPack)
      ? pool.filter(p => p.type !== "human")
      : pool;

    const hasUnownedRecipe = RECIPES.some((r, idx) => {
      if (!r.recipeTag || ownedRecipes.has(idx)) return false;
      if (recipeFilter === null) return true;
      if (typeof recipeFilter === "string") return r.recipeTag === recipeFilter;
      if (Array.isArray(recipeFilter)) return recipeFilter.includes(r.recipeTag);
      return true;
    });
    if (hasUnownedRecipe) {
      filtered = filtered.filter(p => p.type !== "__recipe__");
      filtered = [...filtered, { type: "__recipe__", w: recipeWeight }];
    }

    const ftot = filtered.reduce((s, p) => s + p.w, 0);
    let r = Math.random() * ftot, result = filtered[0].type;
    for (const p of filtered) { r -= p.w; if (r <= 0) { result = p.type; break; } }
    if (result === "human") humanDrawnThisPack = true;
    if (result === "__recipe__") recipeDrawnThisPack = true;
    results.push(result);
  }
  return results;
}

function resolveRecipeFromPool(recipeFilter = null) {
  const available = RECIPES.map((r, i) => ({ r, i })).filter(({ r, i }) => {
    if (!r.recipeTag || ownedRecipes.has(i)) return false;
    if (recipeFilter === null) return true;
    // 文字列：単一タグ一致
    if (typeof recipeFilter === "string") return r.recipeTag === recipeFilter;
    // 配列：いずれかのタグに一致
    if (Array.isArray(recipeFilter)) return recipeFilter.includes(r.recipeTag);
    return true;
  });
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)].i;
}

function openPackOverlay(types, recipeFilter = null) {
  pendingPackTypes = types;
  pendingPackRecipeFilter = recipeFilter;
  packOpen = true;
  const cont = document.getElementById("packCards");
  cont.innerHTML = "";
  types.forEach((type, i) => {
    const el = document.createElement("div");
    el.className = "pack-card-preview";
    if (type === "__recipe__") {
      const as = attrSt("recipe");
      el.innerHTML = `<div class="pch" style="background:${as.hd};color:#ddd">レシピ</div>
                    <div class="pcb" style="background:${as.bg};color:#ddd;font-size:10px;">📖 ${as.label}</div>`;
    } else {
      const d = def(type), as = attrSt(d.attr);
      el.innerHTML = `<div class="pch" style="background:${as.hd};color:${as.light ? "#ddd" : "#fff"}">${d.label}</div>
                    <div class="pcb" style="background:${as.bg};color:${as.light ? "#ddd" : "#333"}">${as.label}</div>`;
    }
    cont.appendChild(el);
    setTimeout(() => el.classList.add("pop"), 80 + i * 120);
  });
  document.getElementById("packOverlay").classList.add("show");
}

document.getElementById("packCloseBtn").addEventListener("click", () => {
  document.getElementById("packOverlay").classList.remove("show");
  packOpen = false;
  const wc = s2w(canvas.width / 2, canvas.height / 2);
  const packCenterX = wc.x, packCenterY = wc.y;
  const placed = [];

  function findFreePosAvoid(bx, by) {
    const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
    for (const d of [120, 160, 200, 260, 320, 400]) {
      for (const a of angles) {
        const p = worldClamp(bx + Math.cos(a) * d, by + Math.sin(a) * d);
        const cand = { x: p.x, y: p.y, w: CW, h: CH };
        if (cards.every(c => !overlap(c, cand)) && placed.every(pp => !overlap(pp, cand))) return p;
      }
    }
    const randAngle = Math.random() * Math.PI * 2;
    return worldClamp(bx + Math.cos(randAngle) * 140, by + Math.sin(randAngle) * 140);
  }

  pendingPackTypes.forEach(type => {
    const p = findFreePosAvoid(packCenterX, packCenterY);
    placed.push({ x: p.x, y: p.y, w: CW, h: CH });
    if (type === "__recipe__") {
      const idx = resolveRecipeFromPool(pendingPackRecipeFilter);
      if (idx !== null) {
        gainRecipeCard(idx, p.x, p.y);
        const newC = cards[cards.length - 1];
        if (newC && newC.type === "recipe_card") {
          animations.push({ id: newC.id, fromX: packCenterX, fromY: packCenterY, toX: p.x, toY: p.y, t: 0, dur: 500, onComplete: null });
          newC.x = packCenterX; newC.y = packCenterY;
        }
      }
    } else {
      spawnCardAnimated(type, packCenterX, packCenterY, p.x, p.y);
    }
  });
  pendingPackTypes = [];
  if (!dayStarted) { dayStarted = true; document.getElementById("dayLabel").textContent = "1日目"; }
});

// 初期パックボタンはHTMLから削除されたため、ここでのイベント登録は不要です。

// ════════════════════════════════════════════════
// レシピカードシステム
// ════════════════════════════════════════════════
function gainRecipeCard(recipeIdx, x, y, fromLibrary = false) {
  if (ownedRecipes.has(recipeIdx)) return;
  ownedRecipes.add(recipeIdx);
  const c = mkCard("recipe_card", x, y);
  c.recipeIdx = recipeIdx;
  if (fromLibrary) completeQuest("qF6"); // 図書館経由のみ達成
  if (ownedRecipes.size >= 10) completeQuest("qE1");
  if (ownedRecipes.size >= 30) completeQuest("qE2");
  renderRecipeList();
}

let recipeSearchQuery = "";

function getRecipeGroupAttrs(r) {
  if (r.recipeAttr && r.recipeAttr.length > 0) {
    const seen = new Set();
    const attrs = [];
    for (const raw of r.recipeAttr) {
      const key = raw;
      if (!seen.has(key)) {
        seen.add(key);
        attrs.push(key);
      }
    }
    return attrs.length > 0 ? attrs : ["other"];
  }
  return ["other"];
}

function recipeSearchInfo(r, query) {
  if (!query) return { match: true, categoryOnly: false, categoryHits: new Set() };
  const q = query.toLowerCase();
  const categoryHits = new Set();
  let otherMatch = false;

  if ((r.desc || "").toLowerCase().includes(q)) otherMatch = true;
  for (const attr of getRecipeGroupAttrs(r)) {
    if (attr.toLowerCase().includes(q) || recipeAttrSt(attr).label.toLowerCase().includes(q)) {
      categoryHits.add(attr);
    }
  }
  for (const v of (r.variants || [])) {
    if (!v.out) continue;
    if (v.out.toLowerCase().includes(q)) { otherMatch = true; continue; }
    const d = def(v.out);
    if ((d.label || "").toLowerCase().includes(q)) otherMatch = true;
  }

  const match = categoryHits.size > 0 || otherMatch;
  return {
    match,
    categoryOnly: categoryHits.size > 0 && !otherMatch,
    categoryHits,
  };
}

function recipeMatchesSearch(r, query) {
  return recipeSearchInfo(r, query).match;
}

function formatRecipeInputs(r) {
  const jobNames = new Set(Object.values(DEFS).filter(d => d.job).map(d => d.job));
  return Object.entries(r.inputs).map(([k, v]) => {
    if (jobNames.has(k)) {
      const jobName = JOB_NAMES[k];
      if (jobName) return `${jobName} ×${v}`;
      const jobCard = Object.values(DEFS).find(d => d.job === k);
      return `${jobCard ? jobCard.label : k} ×${v}`;
    }
    return `${def(k).label} ×${v}`;
  }).join(" + ");
}

function appendRecipeListItem(list, r) {
  const inputs = formatRecipeInputs(r);
  const outs = r.variants.map(v => def(v.out).label).join("/");
  const el = document.createElement("div");
  el.className = "recipe-item";
  el.style.cursor = "pointer";
  el.innerHTML = `<div class="ri-title">${outs}</div><div class="ri-arrow">${inputs}</div>`;

  el.addEventListener("mouseenter", () => {
    const descDiv = document.getElementById("cardDescription");
    if (descDiv) {
      let descHtml = "";
      r.variants.forEach((v, vi) => {
        const d = def(v.out);
        const label = d.label || v.out;
        const desc = d.desc || "説明はありません";
        if (vi > 0) descHtml += "<hr style='border:none; border-top:1px solid #333; margin:8px 0;'>";
        descHtml += `<div style="color:#e8b84b;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${label}</div>`;
        descHtml += `<div style="font-size:11px;color:#bbb;line-height:1.4;margin-bottom:8px;">${desc.replace(/\n/g, '<br>')}</div>`;
        if (d.maxHp !== undefined) {
          descHtml += `<div style="font-size:10px;color:#f88;margin-bottom:4px;">HP:${d.maxHp} ATK:${d.atk} DEF:${d.def} SPD:${d.atkSpeed.toFixed(1)}s</div>`;
        }
      });
      descDiv.innerHTML = descHtml;
    }
  });
  el.addEventListener("mouseleave", () => {
    const descDiv = document.getElementById("cardDescription");
    if (descDiv) {
      descDiv.innerHTML = "カードを選択すると説明が表示されます";
    }
  });

  list.appendChild(el);
}

function renderRecipeList() {
  const list = document.getElementById("sbRecipeContent");
  list.innerHTML = "";
  if (ownedRecipes.size === 0) {
    list.innerHTML = `<div style="color:#666;font-size:12px;">まだレシピを入手していません。<br>パックなどから入手できます。</div>`;
    return;
  }

  const query = recipeSearchQuery.trim().toLowerCase();
  const groups = {};
  for (const idx of [...ownedRecipes].sort((a, b) => a - b)) {
    const r = RECIPES[idx]; if (!r) continue;
    if (!r.variants || r.variants.length === 0 || !r.variants[0].out) continue;
    const searchInfo = recipeSearchInfo(r, query);
    if (!searchInfo.match) continue;
    for (const groupAttr of getRecipeGroupAttrs(r)) {
      if (searchInfo.categoryOnly && !searchInfo.categoryHits.has(groupAttr)) continue;
      if (!groups[groupAttr]) groups[groupAttr] = [];
      groups[groupAttr].push({ idx, r });
    }
  }

  const sortedAttrs = [...new Set([...RECIPE_ATTR_ORDER.filter(a => groups[a]), ...Object.keys(groups)])];
  let shown = 0;
  for (const attr of sortedAttrs) {
    if (!groups[attr]) continue;
    const as = recipeAttrSt(attr);
    const hdr = document.createElement("div");
    hdr.style.cssText = `margin:8px 0 4px;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:bold;color:#fff;background:${as.hd};`;
    hdr.textContent = as.label;
    list.appendChild(hdr);
    for (const { r } of groups[attr]) {
      appendRecipeListItem(list, r);
      shown++;
    }
  }

  if (shown === 0) {
    list.innerHTML = `<div style="color:#666;font-size:12px;">「${recipeSearchQuery}」に一致するレシピはありません。</div>`;
  }
}

// ════════════════════════════════════════════════
// クエストシステム
// ════════════════════════════════════════════════
// ── メインクエスト ────────────────────────────
// ── 第2章：壮大な旅路 ──
const QUESTS_CH2_A = [
  { id: "qA1", name: "鉄は熱いうちに", text: "鉱石を精錬する", done: false, visible: false, locked: true, deps: [] },
  { id: "qA2", name: "人口増加中", text: "村人を5人に増やす", done: false, visible: false, locked: true, deps: [] },
  { id: "qA3", name: "収集家", text: "すべてのパックをアンロックする", done: false, visible: false, locked: true, deps: [] },
  { id: "qA4", name: "失われた都", text: "古代都市を入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qA5", name: "祈りの形", text: "神殿を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qA6", name: "おしまい..？", text: "ラスボスを討伐する", done: false, visible: false, locked: true, deps: [] },
  { id: "qA7", name: "虚の王", text: "真のラスボスを討伐する", done: false, visible: false, locked: true, deps: ["qA6"] },
];
// ── 第2章：戦いに備えよ ──
const QUESTS_CH2_B = [
  { id: "qB0", name: "反撃開始", text: "敵を討伐する", done: false, visible: false, locked: true, deps: [] },
  { id: "qB1", name: "武装解除", text: "ダブルクリックで村人の装備を解除する", done: false, visible: false, locked: true, deps: [] },
  { id: "qB2", name: "備えあれば", text: "村人に何らかの防具を装備させる", done: false, visible: false, locked: true, deps: [] },
  { id: "qB3", name: "力をその身に", text: "何らかの装飾品をクラフトする", done: false, visible: false, locked: true, deps: [] },
  { id: "qB4", name: "鉄を鎚つ音", text: "鍛冶台を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qB5", name: "遠くから失礼", text: "村人に手裏剣を装備させる", done: false, visible: false, locked: true, deps: [] },
  { id: "qB6", name: "捕獲完了", text: "モンスターの檻を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qB7", name: "試練の番人", text: "守護者を討伐する", done: false, visible: false, locked: true, deps: [] },
];
// ── 第2章：おいしい食事 ──
const QUESTS_CH2_C = [
  { id: "qC1", name: "初めての火", text: "焚き火を起こす", done: false, visible: false, locked: true, deps: [] },
  { id: "qC2", name: "農耕民族", text: "土を耕す", done: false, visible: false, locked: true, deps: [] },
  { id: "qC3", name: "芽吹きの季節", text: "農園を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qC4", name: "豊かな実り", text: "農場を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qC5", name: "じっくりことこと", text: "シチューを作成する", done: false, visible: false, locked: true, deps: [] },
  { id: "qC6", name: "いただきます", text: "食卓を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qC7", name: "もう敵じゃない", text: "動物を手なずける", done: false, visible: false, locked: true, deps: [] },
  { id: "qC8", name: "囲われた暮らし", text: "家畜の柵を建設する", done: false, visible: false, locked: true, deps: [] },
];
// ── 第2章：未踏の世界 ──
const QUESTS_CH2_D = [
  { id: "qD1", name: "深緑の中へ", text: "森林を探索する", done: false, visible: false, locked: true, deps: [] },
  { id: "qD2", name: "頂を目指して", text: "山を探索する", done: false, visible: false, locked: true, deps: [] },
  { id: "qD3", name: "砂集め", text: "砂を入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qD4", name: "お宝発見", text: "宝箱を入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qD5", name: "肝試し", text: "墓地を作成する", done: false, visible: false, locked: true, deps: [] },
];
// ── 第2章：手段と方法 ──
const QUESTS_CH2_E = [
  { id: "qE1", name: "知識の断片I", text: "レシピを10個入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE2", name: "知識の断片II", text: "レシピを30個入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE3", name: "製材", text: "厚板を入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE4", name: "焼成", text: "レンガを入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE5", name: "融解", text: "ガラスを入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE6", name: "腹ごしらえI", text: "食べ物を累計10枚入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE7", name: "腹ごしらえII", text: "食べ物を累計30枚入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE8", name: "腹ごしらえIII", text: "食べ物を累計50枚入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE9", name: "塵も積もればI", text: "エメラルドを累計25個入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE10", name: "塵も積もればII", text: "エメラルドを累計50個入手する", done: false, visible: false, locked: true, deps: [] },
  { id: "qE11", name: "塵も積もればIII", text: "エメラルドを累計100個入手する", done: false, visible: false, locked: true, deps: [] },
];
// ── 第2章：建築 ──
const QUESTS_CH2_F = [
  { id: "qF1", name: "住宅街", text: "家を3軒建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qF2", name: "整理整頓", text: "倉庫を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qF3", name: "底なしの収納", text: "大倉庫を建設する", done: false, visible: false, locked: true, deps: [] },
  { id: "qF4", name: "商売上手", text: "市場でカードを売却する", done: false, visible: false, locked: true, deps: [] },
  { id: "qF5", name: "聖なる癒し", text: "教会で村人の体力を回復する", done: false, visible: false, locked: true, deps: [] },
  { id: "qF6", name: "知識の探求", text: "図書館でレシピを得る", done: false, visible: false, locked: true, deps: [] },
];
// ── 第2章：長生き ──
const QUESTS_CH2_G = [
  { id: "qG1", name: "一週間", text: "7日目に達する", done: false, visible: false, locked: true, deps: [] },
  { id: "qG2", name: "二週間", text: "14日目に達する", done: false, visible: false, locked: true, deps: [] },
  { id: "qG3", name: "一か月", text: "30日目に達する", done: false, visible: false, locked: true, deps: [] },
];
// ── 第2章：闇の中へ ──
const QUESTS_CH2_H = [
  { id: "qH1", name: "どっちが侵略者？", text: "暗黒の森に入る", done: false, visible: false, locked: true, deps: [] },
  { id: "qH2", name: "今日はやめておきます", text: "暗黒の森から帰還する", done: false, visible: false, locked: true, deps: [] },
  { id: "qH3", name: "災厄の魔女", text: "森の魔女を初めて討伐する", done: false, visible: false, locked: true, deps: [] },
  { id: "qH4", name: "再来の魔女", text: "森の魔女を2回討伐する", done: false, visible: false, locked: true, deps: [] },
];
// ── 冥界 ──
const QUESTS_CH2_I = [
  { id: "qI1", name: "生者立入禁止", text: "冥界へ入る", done: false, visible: false, locked: true, deps: [] },
  { id: "qI2", name: "魂の欠片", text: "霊魂を抽出する", done: false, visible: false, locked: true, deps: [] },
  { id: "qI3", name: "生への執着", text: "死の呪いを中和する", done: false, visible: false, locked: true, deps: [] },
  { id: "qI4", name: "空席アリ", text: "依り代を作成する", done: false, visible: false, locked: true, deps: [] },
  { id: "qI5", name: "成仏してください", text: "冥界の敵を10体討伐する", done: false, visible: false, locked: true, deps: [] },
  { id: "qI6", name: "禁断の近道", text: "穢れの泉か怨嗟の沼で呪いを加速させる", done: false, visible: false, locked: true, deps: [] },
  { id: "qI7", name: "その時が来た", text: "霊廟に魂を奉納する", done: false, visible: false, locked: true, deps: [] },
  { id: "qI8", name: "冥府の夜明け", text: "冥王を討伐する", done: false, visible: false, locked: true, deps: [] },
];

// QUESTS全体（序章 + 第2章以降）
const QUESTS = [
  { id: "q1", name: "冒険の始まり", text: "冒険の始まりパックを開封する", done: false, visible: true, deps: [] },
  { id: "q2", name: "赤い恵み", text: "村人をリンゴの木にドラッグして食料を確保する", done: false, visible: false, deps: ["q1"] },
  { id: "q3", name: "石器時代", text: "村人を使って岩を採掘する", done: false, visible: false, deps: ["q2"] },
  { id: "q4", name: "取引成立", text: "カードを画面上部にドラッグして売却する", done: false, visible: false, deps: ["q3"] },
  { id: "q5", name: "始まりの書", text: "始まりの書を購入する", done: false, visible: false, deps: ["q4"] },
  { id: "q6", name: "木こり入門", text: "村人で木を伐採する", done: false, visible: false, deps: ["q5"] },
  { id: "q7", name: "棒づくり", text: "木材から棒を生産する", done: false, visible: false, deps: ["q6"] },
  { id: "q8", name: "時の流れを変えて", text: "左下のボタンか1〜3キーで時間の経過速度を変更", done: false, visible: false, deps: ["q7"] },
  { id: "q9", name: "芽吹く命", text: "土とリンゴを合わせてリンゴの木を育てる", done: false, visible: false, deps: ["q8"] },
  { id: "q10", name: "夢のマイホーム", text: "家を建築する", done: false, visible: false, deps: ["q9"] },
  { id: "q11", name: "隣人", text: "2人目の村人を入手する", done: false, visible: false, deps: ["q10"] },
  { id: "q12", name: "コウノトリの贈り物", text: "子孫を残す", done: false, visible: false, deps: ["q11"] },
  ...QUESTS_CH2_A, ...QUESTS_CH2_B, ...QUESTS_CH2_C, ...QUESTS_CH2_D,
  ...QUESTS_CH2_E, ...QUESTS_CH2_F, ...QUESTS_CH2_G, ...QUESTS_CH2_H,
  ...QUESTS_CH2_I,
];

// ── サブクエスト ──────────────────────────────
// reward: { type:"card", cardType:"wood", count:1 } または { type:"emerald", count:3 }
const SUB_QUESTS = [
  { id: "sq1", name: "なつかせ名人", text: "ウサギを手なずけよう", done: false, visible: false, chapter: 1, reward: { type: "emerald", count: 2 } },
  { id: "sq2", name: "パン職人", text: "パンを焼こう", done: false, visible: false, chapter: 1, reward: { type: "emerald", count: 3 } },
  { id: "sq3", name: "倉庫番", text: "倉庫を建てよう", done: false, visible: false, chapter: 1, reward: { type: "card", cardType: "wood", count: 3 } },
  { id: "sq4", name: "開拓者", text: "植林場か採石場を建てよう", done: false, visible: false, chapter: 1, reward: { type: "emerald", count: 5 } },
  // chapter:2 以降はここに追加
];

const QUEST_CHAPTERS = [
  {
    id: "ch1", chapterNum: 1, quests: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12"], unlocksPackIds: ["packShopB"],
    unlocksChapter: "ch2"
  },
  { id: "ch2", chapterNum: 2, label: "壮大な旅路", questPool: QUESTS_CH2_A, quests: QUESTS_CH2_A.map(q => q.id), unlocksPackIds: [] },
  { id: "ch3", chapterNum: 3, label: "戦いに備えよ", questPool: QUESTS_CH2_B, quests: QUESTS_CH2_B.map(q => q.id), unlocksPackIds: [] },
  { id: "ch4", chapterNum: 4, label: "おいしい食事", questPool: QUESTS_CH2_C, quests: QUESTS_CH2_C.map(q => q.id), unlocksPackIds: [] },
  { id: "ch5", chapterNum: 5, label: "未踏の世界", questPool: QUESTS_CH2_D, quests: QUESTS_CH2_D.map(q => q.id), unlocksPackIds: [] },
  { id: "ch6", chapterNum: 6, label: "手段と方法", questPool: QUESTS_CH2_E, quests: QUESTS_CH2_E.map(q => q.id), unlocksPackIds: [] },
  { id: "ch7", chapterNum: 7, label: "建築", questPool: QUESTS_CH2_F, quests: QUESTS_CH2_F.map(q => q.id), unlocksPackIds: [] },
  { id: "ch8", chapterNum: 8, label: "長生き", questPool: QUESTS_CH2_G, quests: QUESTS_CH2_G.map(q => q.id), unlocksPackIds: [] },
  { id: "ch9", chapterNum: 9, label: "闇の中へ", questPool: QUESTS_CH2_H, quests: QUESTS_CH2_H.map(q => q.id), unlocksPackIds: [] },
  { id: "ch10", chapterNum: 10, label: "冥界", questPool: QUESTS_CH2_I, quests: QUESTS_CH2_I.map(q => q.id), unlocksPackIds: [] },
];

const INITIALLY_LOCKED_PACKS = new Set(["packShopA", "packShopB", "packShopC", "packShopD", "packShopE", "packShopF", "packShopG", "packShopH", "uwPackShopA", "uwPackShopB", "uwPackShopC", "uwPackShopD"]);

function initPackLocks() {
  for (const id of INITIALLY_LOCKED_PACKS) {
    const el = document.getElementById(id); if (!el) continue;
    el.classList.add("locked");
    const nameEl = document.getElementById(id + "-name");
    const costEl = document.getElementById(id + "-cost");
    if (nameEl) { nameEl.dataset.realName = nameEl.textContent; nameEl.textContent = "???"; }
    if (costEl) { costEl.dataset.realCost = costEl.innerHTML; costEl.innerHTML = "???"; }
  }
}
initPackLocks();
// パックのコスト表示をPACK_COSTSから反映
(() => {
  for (const [packId, cost] of Object.entries(PACK_COSTS)) {
    const el = document.getElementById(packId);
    if (!el) continue;
    const numEl = el.querySelector(".ps-num");
    if (numEl) numEl.textContent = `×${cost}`;
  }
})();

// ゲーム開始時はチャプター1のサブクエストを表示
SUB_QUESTS.forEach(q => { if (q.chapter === 1) q.visible = true; });

function checkChapterComplete() {
  for (const ch of QUEST_CHAPTERS) {
    const allDone = ch.quests.every(qid => { const q = QUESTS.find(x => x.id === qid); return q && q.done; });
    if (!allDone) continue;

    // パック解放
    for (const packId of (ch.unlocksPackIds || [])) {
      if (unlockPackById(packId)) {
        toast("🎉 新しいパックが解放されました！");
        const _allPacks = ["packShopA", "packShopB", "packShopC", "packShopD", "packShopE", "packShopF", "packShopG", "packShopH"];
        if (_allPacks.every(id => unlockedPacks.has(id))) completeQuest("qA3");
      }
    }

    // 序章（ch1）全完了時のみ第2章以降を一斉解放
    if (ch.id === "ch1" && !ch._ch2Unlocked) {
      ch._ch2Unlocked = true;
      let anyNew = false;
      for (const next of QUEST_CHAPTERS) {
        if (next.id === "ch1") continue;
        if (next.questPool) {
          next.questPool.forEach(q => {
            q.locked = false;
            q.visible = true;
          });
          anyNew = true;
        }
      }
      if (anyNew) toast("🌟 新しいクエストが解放されました！");
    }

    // チャプター番号に対応するサブクエストを開放
    unlockSubQuestsForChapter(ch.chapterNum || 1);
  }
}

function unlockSubQuestsForChapter(chapterNum) {
  SUB_QUESTS.forEach(q => {
    if (q.chapter === chapterNum && !q.done) q.visible = true;
  });
  renderQuestList();
}

function completeQuest(id) {
  const q = QUESTS.find(x => x.id === id);
  if (!q || q.done) return;
  q.done = true;
  q.visible = true;
  toast(`📋 クエスト達成：${q.name}`);
  // depsを再帰的に辿り、チェーン上の全祖先がdoneの場合のみvisibleにする
  // ただし locked:true のクエストはcheckChapterCompleteで解放するため除外
  function allAncestorsDone(quest) {
    return quest.deps.every(dep => {
      const dq = QUESTS.find(d => d.id === dep);
      return dq && dq.done && allAncestorsDone(dq);
    });
  }
  QUESTS.forEach(x => {
    if (!x.visible && !x.locked && allAncestorsDone(x)) x.visible = true;
  });
  checkChapterComplete();
  checkQuestCountPackUnlocks();
  if (id.startsWith("qI")) checkUwQuestPackUnlocks();
  renderQuestList();
}
function completeSubQuest(id) {
  const q = SUB_QUESTS.find(x => x.id === id);
  if (!q || q.done) return;
  q.done = true;

  // 報酬を付与（1枚ずつ位置をずらして生成）
  const r = q.reward;
  const baseX = INIT_WX, baseY = INIT_WY;

  if (r.type === "emerald") {
    addCurrency(r.count, baseX, baseY);
    toast(`⭐ ${q.name} 達成！ 💎×${r.count} を獲得！`);
  } else if (r.type === "card") {
    const placed = [];
    for (let i = 0; i < r.count; i++) {
      // 既に配置した位置も避けながら空き位置を探す
      const p = findFreePosAvoiding(baseX, baseY, placed);
      placed.push({ x: p.x, y: p.y, w: CW, h: CH });
      spawnCardAnimated(r.cardType, baseX, baseY, p.x, p.y);
    }
    const d = def(r.cardType);
    toast(`⭐ ${q.name} 達成！ ${d.label}×${r.count} を獲得！`);
  }

  q.visible = true;
  SUB_QUESTS.forEach(x => {
    if (x.chapter === q.chapter || x.done) x.visible = true;
  });
  renderQuestList();
}

// 既に配置予定の位置も避けて空き位置を探す
function findFreePosAvoiding(bx, by, alreadyPlaced) {
  const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4];
  for (const d of [120, 160, 200, 260, 320, 400]) {
    for (const a of angles) {
      const p = worldClamp(bx + Math.cos(a) * d, by + Math.sin(a) * d);
      const cand = { x: p.x, y: p.y, w: CW, h: CH };
      const noOverlapCards = cards.every(c => !overlap(c, cand));
      const noOverlapPlaced = alreadyPlaced.every(pp => !overlap(pp, cand));
      if (noOverlapCards && noOverlapPlaced) return p;
    }
  }
  // 見つからない場合は少しずらして返す（無限ループ防止）
  return worldClamp(bx + alreadyPlaced.length * 90, by + 120);
}

// 宝箱の中身テーブル
const TREASURE_TABLE = [
  { type: "emerald", w: 15, count: 5 },
  { type: "iron_ingot", w: 20, count: 1 },
  { type: "gold_ingot", w: 5, count: 1 },
  { type: "iron_ore", w: 15, count: 1 },
  { type: "gold_ore", w: 5, count: 1 },
  { type: "key", w: 5, count: 1 },
  { type: "magic_stone", w: 15, count: 1 },
  { type: "stew", w: 10, count: 1 },
  { type: "bone", w: 10, count: 1 },
];

function openTreasureChest(bx, by) {
  // 中身を1～3種類抽選
  const itemCount = Math.floor(Math.random() * 2) + 1; // 1~2種類
  const placed = [];
  const got = [];

  for (let i = 0; i < itemCount; i++) {
    const tot = TREASURE_TABLE.reduce((s, t) => s + t.w, 0);
    let r = Math.random() * tot;
    let chosen = TREASURE_TABLE[0];
    for (const t of TREASURE_TABLE) { r -= t.w; if (r <= 0) { chosen = t; break; } }

    if (chosen.type === "emerald") {
      addCurrency(chosen.count, bx, by);
    } else {
      const p = findFreePosAvoiding(bx, by, placed);
      placed.push({ x: p.x, y: p.y, w: CW, h: CH });
      for (let j = 0; j < chosen.count; j++) {
        spawnCardAnimated(chosen.type, bx, by, p.x, p.y);
      }
    }
    got.push(`${def(chosen.type).label}×${chosen.count}`);
  }
  toast(`宝箱を開けた！ ${got.join("、")} を入手！`);
}

function renderQuestList() {
  const container = document.getElementById("sbQuestContent");
  container.innerHTML = "";

  // ── パック解放予告バナー（拠点） ──
  const _basePacks = ["packShopA", "packShopB", "packShopC", "packShopD", "packShopE", "packShopF", "packShopG", "packShopH"];
  const allBasePacksUnlocked = _basePacks.every(id => unlockedPacks.has(id));
  if (!allBasePacksUnlocked) {
    const done = getTotalQuestsDone();
    const next = QUEST_PACK_UNLOCKS.find(e => !unlockedPacks.has(e.packId));
    if (next) {
      const remaining = next.count - done;
      const banner = document.createElement("div");
      banner.dataset.packBanner = "1";
      banner.style.cssText = [
        "margin-bottom:8px;padding:6px 8px;border-radius:6px;",
        "background:rgba(232,184,75,.15);border:1px solid rgba(232,184,75,.35);",
        "font-size:11px;color:#e8b84b;text-align:center;line-height:1.5;"
      ].join("");
      banner.innerHTML = remaining <= 0
        ? `🎁 新パック解放済み！`
        : `🔓 あと <b>${remaining}</b> 個達成で新パック解放！<br><span style="color:#aaa;font-size:10px;">（累計 ${done} / ${next.count} 個）</span>`;
      container.appendChild(banner);
    }
  }

  // ── パック解放予告バナー（冥界） ──
  const _uwPacks = ["uwPackShopA", "uwPackShopB", "uwPackShopC", "uwPackShopD"];
  const allUwPacksUnlocked = _uwPacks.every(id => unlockedPacks.has(id));
  if (uwQuestsUnlocked && !allUwPacksUnlocked) {
    const uwDone = getUwQuestsDone();
    const nextUw = UW_QUEST_PACK_UNLOCKS.find(e => !unlockedPacks.has(e.packId));
    if (nextUw) {
      const remaining = nextUw.count - uwDone;
      const uwBanner = document.createElement("div");
      uwBanner.dataset.uwPackBanner = "1";
      uwBanner.style.cssText = [
        "margin-bottom:8px;padding:6px 8px;border-radius:6px;",
        "background:rgba(176,136,255,.15);border:1px solid rgba(176,136,255,.35);",
        "font-size:11px;color:#b088ff;text-align:center;line-height:1.5;"
      ].join("");
      uwBanner.innerHTML = remaining <= 0
        ? `💀 冥界パック解放済み！`
        : `💀 冥界クエストあと <b>${remaining}</b> 個で新パック解放！<br><span style="color:#aaa;font-size:10px;">（冥界 ${uwDone} / ${nextUw.count} 個）</span>`;
      container.appendChild(uwBanner);
    }
  }

  const tabWrap = document.createElement("div");
  tabWrap.style.cssText = "display:flex;gap:4px;margin-bottom:10px;";

  const tabMain = document.createElement("div");
  tabMain.style.cssText = "flex:1;text-align:center;padding:5px 0;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold;";

  const tabSub = document.createElement("div");
  tabSub.style.cssText = "flex:1;text-align:center;padding:5px 0;border-radius:5px;cursor:pointer;font-size:12px;font-weight:bold;";

  tabWrap.appendChild(tabMain);
  tabWrap.appendChild(tabSub);
  container.appendChild(tabWrap);

  const content = document.createElement("div");
  container.appendChild(content);

  function showTab(tab) {
    if (tab === "main") {
      tabMain.style.background = "rgba(232,184,75,.3)"; tabMain.style.color = "#e8b84b";
      tabSub.style.background = "rgba(255,255,255,.05)"; tabSub.style.color = "#888";
      tabMain.textContent = "📋 メイン";
      tabSub.textContent = "⭐ サブ";
      renderMainQuests(content);
    } else {
      tabSub.style.background = "rgba(255,220,80,.3)"; tabSub.style.color = "#ffd850";
      tabMain.style.background = "rgba(255,255,255,.05)"; tabMain.style.color = "#888";
      tabMain.textContent = "📋 メイン";
      tabSub.textContent = "⭐ サブ";
      renderSubQuests(content);
    }
  }

  tabMain.addEventListener("click", () => { questActiveTab = "main"; showTab("main"); });
  tabSub.addEventListener("click", () => { questActiveTab = "sub"; showTab("sub"); });
  showTab(questActiveTab);
}

// 現在表示中のタブを記憶
let questActiveTab = "main";

// ── クエスト累計達成数によるパック解放 ──────────
const QUEST_PACK_UNLOCKS = [
  { count: 3, packId: "packShopA" },
  { count: 8, packId: "packShopB" },
  { count: 12, packId: "packShopC" },
  { count: 15, packId: "packShopD" },
  { count: 18, packId: "packShopE" },
  { count: 21, packId: "packShopF" },
  { count: 25, packId: "packShopG" },
  { count: 30, packId: "packShopH" },
];

const UW_QUEST_PACK_UNLOCKS = [
  { count: 1, packId: "uwPackShopA" },
  { count: 3, packId: "uwPackShopB" },
  { count: 4, packId: "uwPackShopC" },
  { count: 6, packId: "uwPackShopD" },
];

function getTotalQuestsDone() {
  return QUESTS.filter(q => q.done).length;
}

function getUwQuestsDone() {
  return QUESTS_CH2_I.filter(q => q.done).length;
}

function unlockPackById(packId) {
  if (unlockedPacks.has(packId)) return false;
  unlockedPacks.add(packId);
  const el = document.getElementById(packId); if (!el) return true;
  el.classList.remove("locked"); el.classList.add("unlocked-new");
  setTimeout(() => el.classList.remove("unlocked-new"), 800);
  const nameEl = document.getElementById(packId + "-name");
  const costEl = document.getElementById(packId + "-cost");
  if (nameEl && nameEl.dataset.realName) nameEl.textContent = nameEl.dataset.realName;
  if (costEl && costEl.dataset.realCost) costEl.innerHTML = costEl.dataset.realCost;
  return true;
}

function checkQuestCountPackUnlocks() {
  const done = getTotalQuestsDone();
  const _allPacks = ["packShopA", "packShopB", "packShopC", "packShopD", "packShopE", "packShopF", "packShopG", "packShopH"];
  for (const entry of QUEST_PACK_UNLOCKS) {
    if (done >= entry.count && !unlockedPacks.has(entry.packId)) {
      if (unlockPackById(entry.packId)) {
        toast(`🎉 クエスト${entry.count}個達成！ 新しいパックが解放されました！`);
        if (_allPacks.every(id => unlockedPacks.has(id))) completeQuest("qA3");
      }
    }
  }
}

function checkUwQuestPackUnlocks() {
  const done = getUwQuestsDone();
  for (const entry of UW_QUEST_PACK_UNLOCKS) {
    if (done >= entry.count && !unlockedPacks.has(entry.packId)) {
      if (unlockPackById(entry.packId)) {
        toast(`💀 冥界クエスト${entry.count}個達成！ 冥界パックが解放されました！`);
      }
    }
  }
}

// アコーディオンの開閉状態を記憶（初期値なし = デフォルト開）
const accordionState = {};

// 進捗が必要なクエストの現在値を返す
function getQuestProgress(qid) {
  switch (qid) {
    case "qA2": return { cur: cards.filter(c => c.type === "human").length, max: 5 };
    case "qA3": { const all = ["packShopA", "packShopB", "packShopC", "packShopD", "packShopE", "packShopF", "packShopG", "packShopH"]; return { cur: all.filter(id => unlockedPacks.has(id)).length, max: all.length }; }
    case "qE1": return { cur: Math.min(ownedRecipes.size, 10), max: 10 };
    case "qE2": return { cur: Math.min(ownedRecipes.size, 30), max: 30 };
    case "qE6": return { cur: Math.min(totalFoodGained, 10), max: 10 };
    case "qE7": return { cur: Math.min(totalFoodGained, 30), max: 30 };
    case "qE8": return { cur: Math.min(totalFoodGained, 50), max: 50 };
    case "qE9": return { cur: Math.min(totalEmeraldGained, 25), max: 25 };
    case "qE10": return { cur: Math.min(totalEmeraldGained, 50), max: 50 };
    case "qE11": return { cur: Math.min(totalEmeraldGained, 100), max: 100 };
    case "qF1": return { cur: Math.min(totalHouseBuilt, 3), max: 3 };
    case "qG1": return { cur: Math.min(dayCount, 7), max: 7 };
    case "qG2": return { cur: Math.min(dayCount, 14), max: 14 };
    case "qG3": return { cur: Math.min(dayCount, 30), max: 30 };
    case "qH4": return { cur: Math.min(witchKills, 2), max: 2 };
    case "qI5": return { cur: Math.min(uwHostileKills, 10), max: 10 };
    default: return null;
  }
}

// 進捗バッジ＋パック解放予告バナーをDOMで直接更新（再構築不要）
function updateQuestProgressBadges() {
  const container = document.getElementById("sbQuestContent");
  if (!container) return;
  // 進捗バッジ更新
  container.querySelectorAll("[data-qprog]").forEach(el => {
    const qid = el.dataset.qprog;
    const q = QUESTS.find(x => x.id === qid);
    if (!q || q.done) { el.textContent = ""; return; }
    const prog = getQuestProgress(qid);
    if (prog) el.textContent = `${prog.cur}/${prog.max}`;
  });
  // パック解放予告バナー更新（拠点）
  const banner = container.querySelector("[data-pack-banner]");
  if (banner) {
    const _basePacks = ["packShopA", "packShopB", "packShopC", "packShopD", "packShopE", "packShopF", "packShopG", "packShopH"];
    const allBasePacksUnlocked = _basePacks.every(id => unlockedPacks.has(id));
    if (allBasePacksUnlocked) {
      banner.style.display = "none";
    } else {
      const done = getTotalQuestsDone();
      const next = QUEST_PACK_UNLOCKS.find(e => !unlockedPacks.has(e.packId));
      if (next) {
        const remaining = next.count - done;
        banner.style.display = "";
        banner.innerHTML = `🔓 あと <b>${remaining}</b> 個達成で新パック解放！<br><span style="color:#aaa;font-size:10px;">（累計 ${done} / ${next.count} 個）</span>`;
      }
    }
  }
  // パック解放予告バナー更新（冥界）
  const uwBanner = container.querySelector("[data-uw-pack-banner]");
  if (uwBanner) {
    const _uwPacks = ["uwPackShopA", "uwPackShopB", "uwPackShopC", "uwPackShopD"];
    const allUwPacksUnlocked = _uwPacks.every(id => unlockedPacks.has(id));
    if (!uwQuestsUnlocked || allUwPacksUnlocked) {
      uwBanner.style.display = "none";
    } else {
      const uwDone = getUwQuestsDone();
      const nextUw = UW_QUEST_PACK_UNLOCKS.find(e => !unlockedPacks.has(e.packId));
      if (nextUw) {
        const remaining = nextUw.count - uwDone;
        uwBanner.style.display = "";
        uwBanner.innerHTML = `💀 冥界クエストあと <b>${remaining}</b> 個で新パック解放！<br><span style="color:#aaa;font-size:10px;">（冥界 ${uwDone} / ${nextUw.count} 個）</span>`;
      }
    }
  }
}

function renderMainQuests(content) {
  questActiveTab = "main";
  content.innerHTML = "";

  QUEST_CHAPTERS.forEach((ch, ci) => {
    const chQuests = ch.quests.map(qid => QUESTS.find(x => x.id === qid)).filter(Boolean);
    const showQuests = chQuests.filter(q => (q.visible || q.done) && !q.locked);
    if (showQuests.length === 0) return;

    const done = chQuests.filter(q => q.done).length;
    const total = chQuests.length;
    const chapterLabel = ch.label ? ch.label : (ci === 0 ? "序章" : `第${ci}章`);
    const isOpen = accordionState[ch.id] !== false;

    const hdr = document.createElement("div");
    hdr.style.cssText = [
      "display:flex;align-items:center;justify-content:space-between;",
      "margin:4px 0 2px;padding:5px 6px;border-radius:5px;cursor:pointer;",
      "font-size:11px;font-weight:bold;color:#e8b84b;",
      "background:rgba(232,184,75,.12);border:1px solid rgba(232,184,75,.2);",
      "user-select:none;transition:background .15s;"
    ].join("");
    const allUnlocked = ch.unlocksPackIds.every(id => unlockedPacks.has(id));
    hdr.innerHTML = `<span>${isOpen ? "▼" : "▶"} ${chapterLabel}</span><span style="color:#aaa;font-size:10px;">${done}/${total}${allUnlocked ? " ✅" : ""}</span>`;

    const body = document.createElement("div");
    body.style.cssText = `overflow:hidden;transition:max-height .25s ease;max-height:${isOpen ? "2000px" : "0"};`;

    hdr.addEventListener("click", () => {
      // 未定義はデフォルト「開」なので、トグルは「現在の開閉状態の反転」
      accordionState[ch.id] = !(accordionState[ch.id] !== false);
      renderMainQuests(content);
    });

    content.appendChild(hdr);
    content.appendChild(body);

    showQuests.forEach(q => {
      const prog = getQuestProgress(q.id);
      const progHtml = (prog && !q.done)
        ? `<span data-qprog="${q.id}" style="color:#e8b84b;font-size:10px;margin-left:4px;">${prog.cur}/${prog.max}</span>`
        : `<span data-qprog="${q.id}"></span>`;

      const el = document.createElement("div");
      el.className = "quest-item" + (q.done ? " done" : "");
      el.style.marginLeft = "8px";
      el.innerHTML = `<span class="quest-check q-check">${q.done ? "✅" : "◻"}</span>
        <span style="line-height:1.6;flex:1;">
          <span style="font-weight:bold;color:${q.done ? "#888" : "#ddd"};">${q.name}</span>${progHtml}
          <br><span style="font-size:10px;color:#999;">${q.text}</span>
        </span>`;
      body.appendChild(el);
    });
  });
}

function renderSubQuests(content) {
  questActiveTab = "sub";
  content.innerHTML = "";

  const chapters = [...new Set(SUB_QUESTS.map(q => q.chapter))].sort((a, b) => a - b);
  for (const ch of chapters) {
    const chQuests = SUB_QUESTS.filter(q => q.chapter === ch);
    const showQuests = chQuests.filter(q => q.visible || q.done);
    if (showQuests.length === 0) continue;

    const doneCount = chQuests.filter(q => q.done).length;
    const subKey = "sub_" + ch;
    const isOpen = accordionState[subKey] !== false;

    const hdr = document.createElement("div");
    hdr.style.cssText = [
      "display:flex;align-items:center;justify-content:space-between;",
      "margin:4px 0 2px;padding:5px 6px;border-radius:5px;cursor:pointer;",
      "font-size:11px;font-weight:bold;color:#ffd850;",
      "background:rgba(255,216,80,.08);border:1px solid rgba(255,216,80,.2);",
      "user-select:none;"
    ].join("");
    hdr.innerHTML = `<span>${isOpen ? "▼" : "▶"} ${ch === 1 ? "序章" : `第${ch}章`}</span><span style="color:#aaa;font-size:10px;">${doneCount}/${chQuests.length}</span>`;

    const body = document.createElement("div");
    body.style.cssText = `overflow:hidden;transition:max-height .25s ease;max-height:${isOpen ? "2000px" : "0"};`;

    hdr.addEventListener("click", () => {
      accordionState[subKey] = !(accordionState[subKey] !== false);
      renderSubQuests(content);
    });

    content.appendChild(hdr);
    content.appendChild(body);

    showQuests.forEach(q => {
      const r = q.reward;
      const rewardText = r.type === "emerald" ? `💎×${r.count}` : `${def(r.cardType).label}×${r.count}`;
      const el = document.createElement("div");
      el.className = "quest-item" + (q.done ? " done" : "");
      el.style.marginLeft = "8px";
      el.innerHTML = `<span class="quest-check q-check">${q.done ? "✅" : "◻"}</span>
        <span style="line-height:1.6;flex:1;">
          <span style="font-weight:bold;color:${q.done ? "#888" : "#ddd"};">${q.name}</span>
          <br><span style="font-size:10px;color:#999;">${q.text}</span>
          <br><span style="font-size:10px;color:${q.done ? "#666" : "#ffd850"};">報酬: ${rewardText}</span>
        </span>`;
      body.appendChild(el);
    });
  }

  if (content.innerHTML === "") {
    content.innerHTML = `<div style="color:#666;font-size:12px;">まだサブクエストがありません。</div>`;
  }
}

// ════════════════════════════════════════════════
// 食事フェーズ
// ════════════════════════════════════════════════
function isCrafting(card) { return Object.keys(progressMap).some(key => key.split(",").map(Number).includes(card.id)); }

function cardActualSat(c) {
  const d = def(c.type);
  return c.partialSatiety !== undefined
    ? (c.stack - 1) * (d.satiety || 0) + c.partialSatiety
    : (d.satiety || 0) * c.stack;
}

// ── サイドバー制御 ──────────────────────────
let sidebarOpen = true;
let sbActiveTab = "quest";

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const sb = document.getElementById("sidebar");
  const btn = document.getElementById("sidebarToggle");
  sb.classList.toggle("open", sidebarOpen);
  btn.classList.toggle("open", sidebarOpen);
  btn.textContent = sidebarOpen ? "＜" : "＞";
  if (sidebarOpen) refreshSidebarContent();
}

function refreshSidebarContent() {
  if (sbActiveTab === "quest") renderQuestList();
  else renderRecipeList();
}

document.getElementById("sidebarToggle").addEventListener("click", toggleSidebar);

document.getElementById("sbTabQuest").addEventListener("click", () => {
  sbActiveTab = "quest";
  document.getElementById("sbTabQuest").classList.add("active");
  document.getElementById("sbTabRecipe").classList.remove("active");
  document.getElementById("sbQuestContent").style.display = "";
  document.getElementById("sbRecipeToolbar").style.display = "none";
  document.getElementById("sbRecipeContent").style.display = "none";
  renderQuestList();
});

document.getElementById("sbTabRecipe").addEventListener("click", () => {
  sbActiveTab = "recipe";
  document.getElementById("sbTabRecipe").classList.add("active");
  document.getElementById("sbTabQuest").classList.remove("active");
  document.getElementById("sbRecipeToolbar").style.display = "";
  document.getElementById("sbRecipeContent").style.display = "";
  document.getElementById("sbQuestContent").style.display = "none";
  renderRecipeList();
});

document.getElementById("sbRecipeSearch").addEventListener("input", (e) => {
  recipeSearchQuery = e.target.value;
  renderRecipeList();
});
// 初期状態でサイドバーを開く
(() => {
  const sb = document.getElementById("sidebar");
  const btn = document.getElementById("sidebarToggle");
  sb.classList.add("open");
  btn.classList.add("open");
  btn.textContent = "＜";
  renderQuestList();
})();

function startMealPhase() {
  mealPhase = true;
  const humans = cards.filter(c => c.type === "human" || c.type === "baby");
  const needed = humans.length;
  const foodCards = cards.filter(c => def(c.type).attr === "food");

  let totalMealCost = humans.reduce((s, c) => s + mealCostOf(c), 0);
  if (debugNoMealCost || inUnderworld) {
    totalMealCost = 0;
  }

  // 食卓（dining_table）と同一グループにある食料を優先消費するための判定
  const diningTables = cards.filter(c => c.type === "dining_table");
  const tableFoodIds = new Set();
  for (const dt of diningTables) {
    const grp = getRepulsionGroup(dt);
    for (const c of grp) {
      if (def(c.type).attr === "food") {
        tableFoodIds.add(c.id);
      }
    }
  }

  const tableFoods = foodCards.filter(c => tableFoodIds.has(c.id));
  const otherFoods = foodCards.filter(c => !tableFoodIds.has(c.id));

  // それぞれクラフト中でないものを優先、満腹度が低い順にソート
  const sortFn = (a, b) => {
    const aCraft = isCrafting(a), bCraft = isCrafting(b);
    if (aCraft !== bCraft) return aCraft ? 1 : -1;
    return cardActualSat(a) - cardActualSat(b);
  };

  const tableFoodsSorted = tableFoods.sort(sortFn);
  const otherFoodsSorted = otherFoods.sort(sortFn);

  // 優先順位順に結合した食料リスト
  const sortedFoodsToConsume = [...tableFoodsSorted, ...otherFoodsSorted];

  // 消費シミュレーションの実行
  let satNeeded = totalMealCost;
  const consumedResult = []; // { type, count }
  mealCardChanges = []; // { card, nextStack, nextPartialSatiety, isDeleted }

  for (const c of sortedFoodsToConsume) {
    if (satNeeded <= 0) break;
    const d = def(c.type);
    const satietyPerItem = d.satiety || 0;
    if (satietyPerItem <= 0) continue; // 満腹度0のものは消費対象外

    const cardSat = cardActualSat(c);
    if (cardSat <= 0) continue;

    if (cardSat <= satNeeded) {
      // このカード（またはスタック）を丸ごと消費
      satNeeded -= cardSat;
      consumedResult.push({ type: c.type, count: c.stack });
      mealCardChanges.push({ card: c, isDeleted: true });
    } else {
      // このカード（またはスタック）の一部を消費
      const surplus = cardSat - satNeeded;
      const consumedSat = satNeeded;
      satNeeded = 0;

      const newStack = Math.floor(surplus / satietyPerItem);
      const remSat = surplus % satietyPerItem;

      let nextStack = 0;
      let nextPartialSatiety = undefined;
      if (newStack > 0) {
        nextStack = newStack;
        if (remSat > 0) nextPartialSatiety = remSat;
      } else if (remSat > 0) {
        nextStack = 1;
        nextPartialSatiety = remSat;
      }

      const consumedCount = c.stack - nextStack;
      let displayCount = consumedCount;
      if (displayCount === 0 && consumedSat > 0) {
        displayCount = 1; // 1枚の一部を消費
      }

      if (displayCount > 0) {
        consumedResult.push({ type: c.type, count: displayCount });
      }

      mealCardChanges.push({
        card: c,
        isDeleted: false,
        nextStack,
        nextPartialSatiety
      });
    }
  }

  // 生存人数と死亡者数の計算（職業ごとの mealCost に対応）
  let fed;
  if (debugNoMealCost || inUnderworld) {
    fed = needed;
  } else {
    let remainingSat = totalMealCost - satNeeded;
    fed = 0;
    for (const h of humans) {
      const cost = mealCostOf(h);
      if (cost <= 0) { fed++; continue; }
      if (remainingSat >= cost) {
        remainingSat -= cost;
        fed++;
      }
    }
  }
  mealDeadCount = Math.max(0, needed - fed);

  // UI描画
  let infoHtml = `村人: <b>${needed}</b>人　必要な満腹度: <b>${totalMealCost}</b>`;
  if (inUnderworld) {
    infoHtml += `<br><span style="color:#6aff6a; font-size:13px; display:inline-block; margin-top:5px;">冥界では食事は必要ありません。</span>`;
  } else if (mealDeadCount > 0) {
    infoHtml += `<br><span style="color:#ff6060; font-weight:bold; font-size:13px; display:inline-block; margin-top:5px;">⚠️ 食料が不足しています！村人が ${mealDeadCount} 人飢えで死亡します...</span>`;
  } else {
    infoHtml += `<br><span style="color:#6aff6a; font-size:13px; display:inline-block; margin-top:5px;">全員が食事をとることができます。</span>`;
  }
  document.getElementById("mealInfo").innerHTML = infoHtml;

  const list = document.getElementById("mealFoodList");
  list.innerHTML = "";

  if (consumedResult.length === 0) {
    const noFoodDiv = document.createElement("div");
    noFoodDiv.style.cssText = "color:#faa;font-size:13px;margin:10px 0;";
    noFoodDiv.textContent = foodCards.length === 0 ? "食べ物がありません！" : "消費される食べ物はありません！";
    list.appendChild(noFoodDiv);
  } else {
    // 消費される食料をカード風に表示（集計して表示）
    const summary = new Map();
    for (const item of consumedResult) {
      if (!summary.has(item.type)) {
        summary.set(item.type, 0);
      }
      summary.set(item.type, summary.get(item.type) + item.count);
    }

    for (const [type, count] of summary.entries()) {
      const d = def(type);
      const as = attrSt(d.attr);
      const el = document.createElement("div");
      el.className = "meal-food-item";
      el.style.cursor = "default";
      el.innerHTML = `<div class="mfh" style="background:${as.hd}">${d.label}</div>
                      <div class="mfb" style="background:${as.bg}">消費 × ${count}</div>`;
      list.appendChild(el);
    }
  }

  // 「夜を眠り明かす」ボタンの設定
  const confirmBtn = document.getElementById("mealConfirmBtn");
  confirmBtn.textContent = "夜を眠り明かす";
  confirmBtn.disabled = false;

  document.getElementById("mealOverlay").classList.add("show");
}

document.getElementById("mealConfirmBtn").addEventListener("click", () => {
  // 食料の消費を実際に適用
  for (const change of mealCardChanges) {
    if (change.isDeleted) {
      cards = cards.filter(x => x.id !== change.card.id);
    } else {
      const c = cards.find(x => x.id === change.card.id);
      if (c) {
        c.stack = change.nextStack;
        if (change.nextPartialSatiety !== undefined) {
          c.partialSatiety = change.nextPartialSatiety;
        } else {
          delete c.partialSatiety;
        }
      }
    }
  }

  // 村人の死亡処理
  let killed = mealDeadCount;
  for (let i = cards.length - 1; i >= 0 && killed > 0; i--) {
    const card = cards[i];
    if (card.type === "human" || card.type === "baby") {
      if (card.jobCardType) {
        const p = findFreePos(card.x, card.y);
        spawnCardAnimated(card.jobCardType, card.x, card.y, p.x, p.y);
      }
      if (card.armorCardType) {
        const p = findFreePos(card.x, card.y);
        spawnCardAnimated(card.armorCardType, card.x, card.y, p.x, p.y);
      }
      if (card.accessoryCardType) {
        const p = findFreePos(card.x, card.y);
        spawnCardAnimated(card.accessoryCardType, card.x, card.y, p.x, p.y);
      }
      dropBone(card.x, card.y);
      cards.splice(i, 1);
      killed--;
    }
  }

  // 終了処理
  document.getElementById("mealOverlay").classList.remove("show");
  mealPhase = false;
  cards.filter(c => c.type === "human" || c.type === "baby").forEach(c => {
    const stats = combatStats(c);
    c.hp = Math.min(stats.maxHp, (c.hp ?? stats.maxHp) + 2);
  });
  const left = cards.filter(c => c.type === "human" || c.type === "baby").length;
  if (mealDeadCount > 0) toast(`${mealDeadCount}人の村人が飢えで死亡...`); else toast("全員が食事を終えました！");
  if (left === 0) triggerGameOver(); else checkCardLimit();
  if (typeof autoSaveDayStart === "function") autoSaveDayStart();
});

// ════════════════════════════════════════════════
// 売却フェーズ
// ════════════════════════════════════════════════
function checkCardLimit() {
  const lim = cardLimit();
  const cnt = cards.filter(c => c.type !== "emerald" || c.type !== "funeral_money").length;
  if (cnt <= lim) {
    hideSellBanner();
    checkGateSpawn();
    uwHostileSpawn();
    return;
  }
  startSellPhase(cnt - lim);
}
function startSellPhase(mustSell) { sellPhase = true; sellMustSell = mustSell; updateSellBanner(); document.getElementById("sellBanner").classList.add("show"); }
function updateSellBanner() { const lim = cardLimit(), over = cards.length - lim; if (over <= 0) { endSellPhase(); return; } document.getElementById("sellBannerText").textContent = `あと${over}枚売却が必要`; }
function endSellPhase() { sellPhase = false; hideSellBanner(); updateCardCount(); checkGateSpawn(); uwHostileSpawn(); }
function hideSellBanner() { sellPhase = false; document.getElementById("sellBanner").classList.remove("show"); }

// ════════════════════════════════════════════════
// ゲームオーバー・その他
// ════════════════════════════════════════════════
function dropBone(x, y) { const p = findFreePos(x, y); mkCard("bone", p.x, p.y); }
function triggerGameOver() {
  if (debugNoGameOver) return;
  gameOver = true;
  if (typeof saveGame === "function") saveGame(true);
  document.getElementById("gameoverMsg").textContent = `${dayCount}日目に村人が全滅しました`;
  document.getElementById("gameoverOverlay").classList.add("show");
}

// ── 速度制御 ─────────────────────────────────────
function setSpeed(s) {
  if (cameraAnimSavedSpeed !== null) {
    // カメラ演出中：復元用の速度だけ更新（実際のgameSpeedは演出が制御）
    cameraAnimSavedSpeed = s;
    // ボタン表示は更新しておく
    document.getElementById("btnPause").classList.toggle("active", s === 0);
    document.getElementById("btn1x").classList.toggle("active", s === 1);
    document.getElementById("btn3x").classList.toggle("active", s === 3);
    const dbgInd = document.getElementById("dbgSpeed10xInd");
    if (dbgInd) dbgInd.className = "dbg-indicator " + (s === 10 ? "on" : "off");
    completeQuest("q8");
    return;
  }
  gameSpeed = s;
  document.getElementById("btnPause").classList.toggle("active", s === 0);
  document.getElementById("btn1x").classList.toggle("active", s === 1);
  document.getElementById("btn3x").classList.toggle("active", s === 3);
  const dbgInd = document.getElementById("dbgSpeed10xInd");
  if (dbgInd) dbgInd.className = "dbg-indicator " + (s === 10 ? "on" : "off");
  completeQuest("q8");
}
document.getElementById("btnPause").addEventListener("click", () => setSpeed(0));
document.getElementById("btn1x").addEventListener("click", () => setSpeed(1));
document.getElementById("btn3x").addEventListener("click", () => setSpeed(3));
// キーボードショートカット
document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === "1") setSpeed(0);
  if (e.key === "2") setSpeed(1);
  if (e.key === "3") setSpeed(3);
  if (e.key === "4") setSpeed(10);

  // Q：ドラッグ中のカードを売却
  if (e.key === "q" || e.key === "Q") {
    if (!dragging) return;
    const sellCards = isDragGroup ? groupCards : [dragging];
    let total = 0;
    const sx = dragging.x, sy = dragging.y;
    for (const sc of sellCards) {
      const sd = def(sc.type);
      if (sd.sell !== null && sd.sell >= 0 && sc.type !== "human") {
        total += sd.sell * sc.stack;
        cards = cards.filter(c => c !== sc);
      }
    }
    dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
    document.getElementById("trashZone").classList.remove("active");
    document.getElementById("packShopA").classList.remove("active");
    document.getElementById("packShopB").classList.remove("active");
    if (total > 0) {
      addCurrency(total, sx, sy);
      completeQuest("q4");
      updateSellBanner();
    }
  }

  // E：サイドバーの開閉
  if (e.key === "e" || e.key === "E") {
    toggleSidebar();
  }

  // デバッグコマンド検出
  if (e.key.length === 1) {
    debugBuffer += e.key.toLowerCase();
    if (debugBufferTimer) clearTimeout(debugBufferTimer);
    debugBufferTimer = setTimeout(() => {
      debugBuffer = "";
    }, 2000);

    if (debugBuffer.endsWith("debug")) {
      debugMode = !debugMode;
      const dbgMenu = document.getElementById("debugMenu");
      if (dbgMenu) {
        dbgMenu.classList.toggle("show", debugMode);
        if (debugMode) {
          initDebugCardSelect();
        }
      }
      debugBuffer = "";
    }
  }
});

// ════════════════════════════════════════════════
// 戦闘システム
// ════════════════════════════════════════════════
function softPushOutOfBox(c, box, padding = 12, preferAxis = null) {
  if (isAnimating(c.id)) return;
  const distL = Math.abs((c.x + CW) - box.x);
  const distR = Math.abs(c.x - (box.x + box.w));
  const distT = Math.abs((c.y + CH) - box.y);
  const distB = Math.abs(c.y - (box.y + box.h));

  let minDist = Math.min(distL, distR, distT, distB);
  let tx = c.x, ty = c.y;

  if (preferAxis === "y") {
    // 縦軸（Y軸）のみで近い方に押し出す
    if (distT < distB) ty = box.y - CH - padding;
    else ty = box.y + box.h + padding;
  } else if (preferAxis === "x") {
    // 横軸（X軸）のみで近い方に押し出す
    if (distL < distR) tx = box.x - CW - padding;
    else tx = box.x + box.w + padding;
  } else {
    // 通常の最短距離
    if (minDist === distL) tx = box.x - CW - padding;
    else if (minDist === distR) tx = box.x + box.w + padding;
    else if (minDist === distT) ty = box.y - CH - padding;
    else ty = box.y + box.h + padding;
  }

  const p = worldClamp(tx, ty);
  animations.push({ id: c.id, fromX: c.x, fromY: c.y, toX: p.x, toY: p.y, t: 0, dur: 400, onComplete: null });
}


function softPushGroupOutOfBox(grp, box, padding = 12, preferAxis = null) {
  const minX = Math.min(...grp.map(c => c.x));
  const maxX = Math.max(...grp.map(c => c.x)) + CW;
  const minY = Math.min(...grp.map(c => c.y));
  const maxY = Math.max(...grp.map(c => c.y)) + CH;

  const distL = Math.abs(maxX - box.x);
  const distR = Math.abs(minX - (box.x + box.w));
  const distT = Math.abs(maxY - box.y);
  const distB = Math.abs(minY - (box.y + box.h));
  const minDist = Math.min(distL, distR, distT, distB);

  let dx = 0, dy = 0;
  if (preferAxis === "y") {
    // 縦軸（Y軸）のみで近い方に押し出す
    if (distT < distB) dy = -(maxY - box.y) - padding;
    else dy = (box.y + box.h) - minY + padding;
  } else if (preferAxis === "x") {
    // 横軸（X軸）のみで近い方に押し出す
    if (distL < distR) dx = -(maxX - box.x) - padding;
    else dx = (box.x + box.w) - minX + padding;
  } else {
    if (minDist === distL) dx = -(maxX - box.x) - padding;
    else if (minDist === distR) dx = (box.x + box.w) - minX + padding;
    else if (minDist === distT) dy = -(maxY - box.y) - padding;
    else dy = (box.y + box.h) - minY + padding;
  }

  for (const c of grp) {
    if (isAnimating(c.id)) continue;
    const p = worldClamp(c.x + dx, c.y + dy);
    animations.push({ id: c.id, fromX: c.x, fromY: c.y, toX: p.x, toY: p.y, t: 0, dur: 400, onComplete: null });
  }
}
function triggerCombat(card1, card2) {
  // すでに同じ戦闘に参加している場合は無視
  const b1 = activeBattles.find(b => b.participants.has(card1));
  const b2 = activeBattles.find(b => b.participants.has(card2));

  if (b1 && b1 === b2) return;
  if (b1 && !b2) { b1.participants.add(card2); initCombatant(card2); formBattleLine(b1); updateBattleBounds(b1); }
  else if (!b1 && b2) { b2.participants.add(card1); initCombatant(card1); formBattleLine(b2); updateBattleBounds(b2); }
  else if (!b1 && !b2) {
    battleIdCounter++;
    const b = { id: battleIdCounter, participants: new Set([card1, card2]), bounds: { x: 0, y: 0, w: 0, h: 0 } };

    // 戦闘の中心点を固定（参加者が増減しても列が崩れないように）
    b.originX = (card1.x + card2.x) / 2;
    b.originY = (card1.y + card2.y) / 2;

    // 付近にいる人間と敵を自動的に巻き込む（範囲150px）
    const midX = b.originX + CW / 2;
    const midY = b.originY + CH / 2;
    const checkRadius = 150;
    for (const c of cards) {
      if (b.participants.has(c)) continue;
      const attr = def(c.type).attr;
      if (attr === "human" || attr === "hostile") {
        const dx = (c.x + CW / 2) - midX;
        const dy = (c.y + CH / 2) - midY;
        if (Math.sqrt(dx * dx + dy * dy) < checkRadius) {
          b.participants.add(c);
        }
      }
    }

    for (const p of b.participants) initCombatant(p);
    activeBattles.push(b);
    formBattleLine(b);
    updateBattleBounds(b);
  }
}

function joinBattleIfInZone(card) {
  const cx = card.x + CW / 2, cy = card.y + CH / 2;
  for (const b of activeBattles) {
    if (cx >= b.bounds.x && cx <= b.bounds.x + b.bounds.w && cy >= b.bounds.y && cy <= b.bounds.y + b.bounds.h) {
      const attr = def(card.type).attr;
      if ((attr === "human" || attr === "hostile") && !b.participants.has(card)) {
        b.participants.add(card);
        initCombatant(card);
        formBattleLine(b);
        updateBattleBounds(b);
        return true;
      }
    }
  }
  return false;
}

function formBattleLine(b) {
  const humans = [...b.participants].filter(c => def(c.type).attr === "human");
  const hostiles = [...b.participants].filter(c => def(c.type).attr === "hostile");
  if (humans.length === 0 || hostiles.length === 0) return;

  // 固定された基準点を使用
  let cx = b.originX;
  let cy = b.originY;

  const spacing = CW + 10;
  const maxN = Math.max(humans.length, hostiles.length);
  const maxRowTotalWidth = (maxN - 1) * spacing;

  // 陣形全体（全カードの端から端まで）が盤面内に収まるように中心座標を調整
  if (cx - maxRowTotalWidth / 2 < 0) cx = maxRowTotalWidth / 2;
  if (cx + maxRowTotalWidth / 2 + CW > WORLD_W) cx = WORLD_W - CW - maxRowTotalWidth / 2;
  if (cy - 75 < 0) cy = 75;
  if (cy + 75 + CH > WORLD_H) cy = WORLD_H - CH - 75;

  const arrangeRow = (cardsToArrange, startY) => {
    const totalWidth = (cardsToArrange.length - 1) * spacing;
    const startX = cx - totalWidth / 2;
    cardsToArrange.forEach((c, i) => {
      const pos = worldClamp(startX + i * spacing, startY);
      const targetX = pos.x;
      const targetY = pos.y;

      // 移動アニメーションを追加（なめらかに移動）
      if (!isAnimating(c.id)) {
        animations.push({
          id: c.id,
          fromX: c.x, fromY: c.y,
          toX: targetX, toY: targetY,
          t: 0, dur: 300, onComplete: null
        });
      } else {
        const anim = animations.find(a => a.id === c.id);
        if (anim) { anim.toX = targetX; anim.toY = targetY; }
      }
    });
  };

  arrangeRow(humans, cy + 75);
  arrangeRow(hostiles, cy - 75);

  // 非戦闘員を枠外に弾き出す（ドラッグ中のカードや人間、敵は除外）
  const movingIds = dragging ? (isDragGroup ? new Set(groupCards.map(gc => gc.id)) : new Set([dragging.id])) : new Set();
  const maxRowWidth = (Math.max(humans.length, hostiles.length) - 1) * spacing + CW;
  const bB = { x: cx - maxRowWidth / 2 - 20, y: cy - 140, w: maxRowWidth + 40, h: 280 };
  const nonCombatants = cards.filter(c => {
    if (b.participants.has(c) || movingIds.has(c.id)) return false;
    const d = def(c.type);
    if (d.attr === "human" || c.type === "baby" || d.attr === "hostile") return false;
    return overlap(c, bB);
  });
  for (const nc of nonCombatants) softPushOutOfBox(nc, bB);
}

function initCombatant(c) {
  cancelCraftForCard(c);
  const stats = combatStats(c);
  if (c.hp === undefined) c.hp = stats.maxHp;
  c._lastMaxHp = stats.maxHp;
  if (c.attackTimer === undefined) {
    const stats = combatStats(c);
    const variance = (Math.random() * 400 - 200); // ±0.2秒のばらつき
    c.attackTimer = Math.max(100, (stats.atkSpeed || 3.0) * 1000 + variance);
  }
  if (!c.status) c.status = { poison: false, stun: 0, bleed: 0, invincible: 0, frenzy: 0 };
}

function isInvincible(c) {
  return !!(c && c.status && c.status.invincible > 0);
}

function ensureStatus(c) {
  if (!c.status) c.status = { poison: false, stun: 0, bleed: 0, invincible: 0, frenzy: 0 };
  if (c.status.invincible === undefined) c.status.invincible = 0;
  if (c.status.frenzy === undefined) c.status.frenzy = 0;
  return c.status;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function applyInvincible(target, durSec = 10) {
  const st = ensureStatus(target);
  st.invincible = Math.max(st.invincible || 0, durSec);
}

function applyFrenzy(target, durSec = 10) {
  const st = ensureStatus(target);
  st.frenzy = Math.max(st.frenzy || 0, durSec);
}

function updateBattleBounds(b) {
  if (b.participants.size === 0) return;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of b.participants) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x + CW > maxX) maxX = c.x + CW;
    if (c.y + CH > maxY) maxY = c.y + CH;
  }
  const paddingX = 15;  // 左右の余白
  const paddingY = 15;  // 手前と奥の余白

  const bx = Math.max(0, minX - paddingX);
  const by = Math.max(0, minY - paddingY);
  const bw = Math.min(WORLD_W, maxX + paddingX) - bx;
  const bh = Math.min(WORLD_H, maxY + paddingY) - by;

  b.bounds = { x: bx, y: by, w: bw, h: bh };
}

function addFloatingText(text, x, y, color = "#fff", size = 12) {
  floatingTexts.push({ text, x, y, color, size, t: 0, dur: 1000 });
}

function updateBattles(dt) {
  for (let i = activeBattles.length - 1; i >= 0; i--) {
    const b = activeBattles[i];

    // 生きている参加者だけに更新
    const prevCount = b.participants.size;
    const alive = new Set([...b.participants].filter(c => cards.includes(c)));
    b.participants = alive;

    const humans = [...b.participants].filter(c => def(c.type).attr === "human");
    const hostiles = [...b.participants].filter(c => def(c.type).attr === "hostile");

    if (humans.length === 0 || hostiles.length === 0) {
      for (const p of b.participants) {
        p.status = { poison: false, stun: 0, bleed: 0 };
        delete p.attackTimer;
      }
      activeBattles.splice(i, 1);
      continue;
    }

    // 参加者が減った場合に陣形を再構成
    if (alive.size !== prevCount) {
      formBattleLine(b);
      updateBattleBounds(b);
    }

    // 非戦闘員を枠外に弾き出す（継続的。ドラッグ中のカードや人間、敵は除外）
    const movingIds = dragging ? (isDragGroup ? new Set(groupCards.map(gc => gc.id)) : new Set([dragging.id])) : new Set();
    const bB = b.bounds;
    const nonCombatants = cards.filter(c => {
      if (b.participants.has(c) || movingIds.has(c.id)) return false;
      const d = def(c.type);
      if (d.attr === "human" || c.type === "baby" || d.attr === "hostile") return false;
      return overlap(c, bB);
    });
    for (const nc of nonCombatants) softPushOutOfBox(nc, bB);

    for (const c of alive) {
      const stats = combatStats(c);
      const isHuman = def(c.type).attr === "human";
      const enemies = isHuman ? hostiles : humans;
      const allies = isHuman ? humans : hostiles;

      ensureStatus(c);

      // 状態異常更新
      // 0. バフ（無敵/狂乱）
      if (c.status.invincible > 0) {
        c.status.invincible -= dt / 1000;
        if (c.status.invincible < 0) c.status.invincible = 0;
      }
      if (c.status.frenzy > 0) {
        c.status.frenzy -= dt / 1000;
        if (c.status.frenzy < 0) c.status.frenzy = 0;
      }

      // 1. 毒 (Poison): 10秒ごとに-1、永続
      if (c.status.poison) {
        c.status.poisonTimer = (c.status.poisonTimer || 0) + dt / 1000;
        if (c.status.poisonTimer >= 10) {
          c.status.poisonTimer -= 10;
          if (!(debugGodMode && (def(c.type).attr === "human" || c.type === "baby"))) {
            if (!isInvincible(c)) {
              c.hp -= 1;
              addFloatingText("-1", c.x + CW / 2, c.y - 10, "#a0f", 12);
              if (c.hp <= 0) { handleCombatDeath(c); continue; }
            }
          }
        }
      }

      // 2. 出血 (Bleed): 2秒ごとに-1、6秒持続
      if (c.status.bleed > 0) {
        c.status.bleed -= dt / 1000;
        c.status.bleedTimer = (c.status.bleedTimer || 0) + dt / 1000;
        if (c.status.bleedTimer >= 2) {
          c.status.bleedTimer -= 2;
          if (!(debugGodMode && (def(c.type).attr === "human" || c.type === "baby"))) {
            if (!isInvincible(c)) {
              c.hp -= 1;
              addFloatingText("-1", c.x + CW / 2, c.y - 10, "#f44", 12);
              if (c.hp <= 0) { handleCombatDeath(c); continue; }
            }
          }
        }
      } else {
        delete c.status.bleedTimer;
      }

      // 3. 気絶 (Stun): 4.0秒行動不能
      if (c.status.stun > 0) {
        c.status.stun -= dt / 1000;
        continue; // スタン中は攻撃タイマーを進めない
      }

      c.attackTimer -= dt; // 呼び出し元でgameSpeed調整済み
      if (c.attackTimer <= 0) {
        const variance = (Math.random() * 400 - 200); // ±0.2秒のばらつき
        c.attackTimer = Math.max(100, (stats.atkSpeed || 3.0) * 1000 + variance);
        // 攻撃対象を更新 (途中で死んでいる可能性を考慮)
        const currentEnemies = enemies.filter(e => cards.includes(e));
        if (currentEnemies.length > 0) {
          // 確率に基づいて発動するスキルをすべて抽選
          const triggeredSkills = (stats.skills || []).filter(s => Math.random() < (s.chance || 0.1));
          const healSkills = triggeredSkills.filter(s => s.type === "heal");
          const attackSkills = triggeredSkills.filter(s => s.type !== "heal");

          // 回復スキルの実行
          for (const hs of healSkills) {
            const currentAllies = allies.filter(a => cards.includes(a));
            if (currentAllies.length > 0) {
              const healTarget = currentAllies.sort((a, b) => a.hp - b.hp)[0];
              const power = hs.power || 2;
              const htStats = combatStats(healTarget);
              const maxHp = htStats.maxHp;
              healTarget.hp = Math.min(maxHp, healTarget.hp + power);
              addFloatingText("+" + power, healTarget.x + CW / 2, healTarget.y - 10, "#4caf50", 14);

              // 毒・出血を治療！
              if (healTarget.status) {
                if (healTarget.status.poison || healTarget.status.bleed > 0) {
                  healTarget.status.poison = false;
                  healTarget.status.bleed = 0;
                  delete healTarget.status.poisonTimer;
                  delete healTarget.status.bleedTimer;
                  addFloatingText("Cured!", healTarget.x + CW / 2, healTarget.y - 25, "#4caf50", 12);
                }
              }

              attackEffects.push({
                x1: c.x + CW / 2, y1: c.y + CH / 2,
                x2: healTarget.x + CW / 2, y2: healTarget.y + CH / 2,
                t: 0, dur: 300, color: "#4caf50"
              });
            }
          }

          // バフスキル（無敵/狂乱）：味方ランダム1人へ10秒付与
          const buffSkills = attackSkills.filter(s => s.type === "invincible" || s.type === "frenzy");
          if (buffSkills.length > 0) {
            const currentAllies = allies.filter(a => cards.includes(a));
            if (currentAllies.length > 0) {
              for (const bs of buffSkills) {
                const tgt = pickRandom(currentAllies);
                if (bs.type === "invincible") {
                  applyInvincible(tgt, 10);
                  addFloatingText("Invincible!", tgt.x + CW / 2, tgt.y - 28, "#b088ff", 12);
                } else if (bs.type === "frenzy") {
                  applyFrenzy(tgt, 10);
                  addFloatingText("Frenzy!", tgt.x + CW / 2, tgt.y - 28, "#ff9800", 12);
                }
              }
            }
          }

          // 複合攻撃の実行
          const pureAttackSkills = attackSkills.filter(s => s.type !== "invincible" && s.type !== "frenzy");
          executeCompositeAttack(c, currentEnemies, stats, pureAttackSkills);
        }
      }
    }
    updateBattleBounds(b);
  }
}

function executeCompositeAttack(attacker, enemies, aStats, attackSkills) {
  // クリーパー自爆の特別処理
  if (def(attacker.type).creeper) {
    attacker.hp = 0; // 自身は死ぬ
    // 敵全体に大ダメージ（命中率とクリティカルは対象ごとに判定）
    const baseDmg = aStats.atk;
    for (const target of enemies) {
      const tStats = combatStats(target);

      // 自爆の命中判定
      let hitRate = aStats.hitRate !== undefined ? aStats.hitRate : 1.0;
      if (attacker.status && attacker.status.frenzy > 0) hitRate -= 0.10;
      hitRate = Math.max(0, Math.min(1, hitRate));
      if (Math.random() > hitRate) {
        addFloatingText("Miss", target.x + CW / 2, target.y - 10, "#aaa");
        continue;
      }

      // 自爆のクリティカル判定（相性ボーナス込み）
      const critBonus2 = hasAttributeAdvantage(attacker, target) ? ATTR_CRIT_BONUS : 0;
      let critRate2 = (aStats.crit || 0.05) + critBonus2;
      if (attacker.status && attacker.status.frenzy > 0) critRate2 += 0.10;
      const isCrit = Math.random() < Math.max(0, Math.min(1, critRate2));
      const dmg = isCrit ? Math.ceil(baseDmg * 1.5) : baseDmg;

      const actualDmg = Math.max(1, dmg - tStats.def);
      if (!(debugGodMode && (def(target.type).attr === "human" || target.type === "baby"))) {
        if (!isInvincible(target)) target.hp -= actualDmg;
      }
      const text = isCrit ? "Crit! " + actualDmg : actualDmg.toString();
      addFloatingText(text, target.x + CW / 2 + (Math.random() * 10 - 5), target.y - 10 + (Math.random() * 10 - 5), isCrit ? "#ffeb3b" : "#fff", isCrit ? 20 : 12);

      attackEffects.push({
        x1: attacker.x + CW / 2, y1: attacker.y + CH / 2,
        x2: target.x + CW / 2, y2: target.y + CH / 2,
        t: 0, dur: isCrit ? 400 : 200, color: "#f00",
        width: 4
      });
      if (target.hp <= 0) handleCombatDeath(target);
    }
    handleCombatDeath(attacker);
    return;
  }

  // 通常のターゲット決定
  const isAoE = attackSkills.some(s => s.type === "aoe");
  const defaultTarget = enemies[Math.floor(Math.random() * enemies.length)];
  const targets = isAoE ? enemies : [defaultTarget];

  // 突進アニメーション（攻撃者全体として1回だけ行う）
  if (!isAnimating(attacker.id) && targets.length > 0) {
    const origX = attacker.x, origY = attacker.y;
    // 代表ターゲットへの突進
    const repTarget = targets[0];
    const dx = repTarget.x - attacker.x, dy = repTarget.y - attacker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveX = dist > 0 ? (dx / dist) * 15 : 0;
    const moveY = dist > 0 ? (dy / dist) * 15 : 0;

    animations.push({
      id: attacker.id,
      fromX: origX, fromY: origY,
      toX: origX + moveX, toY: origY + moveY,
      t: 0, dur: 100,
      onComplete: () => {
        animations.push({
          id: attacker.id,
          fromX: attacker.x, fromY: attacker.y,
          toX: origX, toY: origY,
          t: 0, dur: 150, onComplete: null
        });
      }
    });
  }

  let totalDmgDealt = 0;

  // フローティングテキスト表示用
  if (isAoE) {
    addFloatingText("AoE!", attacker.x + CW / 2, attacker.y - 20, "#ff9800", 14);
  }

  // 複合スキルのバッジ表示
  const skillTypes = attackSkills.map(s => s.type);
  if (skillTypes.includes("poison")) addFloatingText("Poison!", attacker.x + CW / 2, attacker.y - 30, "#a0f", 12);
  if (skillTypes.includes("stun")) addFloatingText("Stun!", attacker.x + CW / 2, attacker.y - 40, "#ffeb3b", 12);
  if (skillTypes.includes("bleed")) addFloatingText("Bleed!", attacker.x + CW / 2, attacker.y - 50, "#f44", 12);

  for (const target of targets) {
    if (!cards.includes(target)) continue;
    const tStats = combatStats(target);

    // 命中判定（対象ごとに個別抽選）
    let hitRate = aStats.hitRate !== undefined ? aStats.hitRate : 1.0;
    if (attacker.status && attacker.status.frenzy > 0) hitRate -= 0.10;
    hitRate = Math.max(0, Math.min(1, hitRate));
    if (Math.random() > hitRate) {
      addFloatingText("Miss", target.x + CW / 2, target.y - 10, "#aaa");
      continue;
    }

    // クリティカル判定（相性ボーナス込み）
    const critBonus = hasAttributeAdvantage(attacker, target) ? ATTR_CRIT_BONUS : 0;
    let critRate = (aStats.crit || 0.05) + critBonus;
    if (attacker.status && attacker.status.frenzy > 0) critRate += 0.10;
    const isCrit = Math.random() < Math.max(0, Math.min(1, critRate));

    // ダメージ計算
    const baseDmg = Math.max(1, aStats.atk - tStats.def);
    const dmg = isCrit ? Math.ceil(baseDmg * 1.5) : baseDmg;

    if (!(debugGodMode && (def(target.type).attr === "human" || target.type === "baby"))) {
      if (!isInvincible(target)) {
        target.hp -= dmg;
        totalDmgDealt += dmg;
      } else {
        addFloatingText("Immune", target.x + CW / 2, target.y - 10, "#b088ff", 12);
      }
    }

    const text = isCrit ? "Crit! " + dmg : dmg.toString();
    addFloatingText(text, target.x + CW / 2 + (Math.random() * 10 - 5), target.y - 10 + (Math.random() * 10 - 5), isCrit ? "#ffeb3b" : "#fff", isCrit ? 20 : 12);

    // 斬撃エフェクトの追加
    attackEffects.push({
      x1: attacker.x + CW / 2, y1: attacker.y + CH / 2,
      x2: target.x + CW / 2, y2: target.y + CH / 2,
      t: 0, dur: isCrit ? 400 : 200, color: isCrit ? "#ff5722" : "#ffeb3b",
      width: isCrit ? 6 : 3
    });

    // 状態異常の付与
    ensureStatus(target);

    if (skillTypes.includes("poison")) {
      target.status.poison = true;
    }
    if (skillTypes.includes("stun")) {
      target.status.stun = 4.0; // スタンは4.0秒固定
    }
    if (skillTypes.includes("bleed")) {
      target.status.bleed = 6.0; // 出血は6秒間持続
      target.status.bleedTimer = 0.0;
    }

    if (target.hp <= 0) handleCombatDeath(target);
  }

  // 吸収回復スキルの実行
  if (skillTypes.includes("drain") && totalDmgDealt > 0) {
    const drainSkill = attackSkills.find(s => s.type === "drain");
    const fraction = drainSkill ? (drainSkill.fraction || 1.0) : 1.0;
    const heal = Math.ceil(totalDmgDealt * fraction);
    attacker.hp = Math.min(aStats.maxHp, attacker.hp + heal);
    addFloatingText("+" + heal, attacker.x + CW / 2, attacker.y - 10, "#4caf50", 14);
  }
}

function handleCombatDeath(card) {
  if (!cards.includes(card)) return; // 既に処理済み
  const d = def(card.type);
  const isHuman = d.attr === "human";
  const isDoll = (isHuman && card.type !== "human" && card.type !== "baby");

  // 吸魂の指輪の回復処理
  if (!isHuman) {
    const battle = activeBattles.find(b => b.participants.has(card));
    if (battle) {
      const combatants = [...battle.participants].filter(c => c !== card && cards.includes(c));
      const ringEquippedHumans = combatants.filter(c => def(c.type).attr === "human" && c.accessoryCardType === "soul_drain_ring");
      for (const h of ringEquippedHumans) {
        const stats = combatStats(h);
        h.hp = Math.min(stats.maxHp, h.hp + 2);
        addFloatingText("+2", h.x + CW / 2, h.y - 10, "#4caf50", 14);
      }
    }
  }

  if (!isHuman && d.drop && d.drop.length > 0 && !d.creeper) {
    // ── 固有ドロップアイテムの処理（ヨルムンガンド・森の魔女・冥王）──
    const uniqueDropType = card.type === "jormungand" ? "serpent_scale"
      : card.type === "witch" ? "witch_blood"
      : card.type === "pluto" ? "pluto_heart"
      : card.type === "abyss" ? "monument"
        : null;
    if (uniqueDropType && !hasAnyItem(uniqueDropType)) {
      // 固有アイテムを未所持 → 固有アイテム + dropから1つ
      const pos0 = findFreePos(card.x, card.y);
      mkCard(uniqueDropType, pos0.x, pos0.y);
      const tot0 = d.drop.reduce((s, dp) => s + dp.w, 0);
      let r0 = Math.random() * tot0, dropType0 = d.drop[0].type;
      for (const dp of d.drop) { r0 -= dp.w; if (r0 <= 0) { dropType0 = dp.type; break; } }
      const pos1 = findFreePos(card.x, card.y);
      mkCard(dropType0, pos1.x, pos1.y);
      if (DEFS[dropType0] && DEFS[dropType0].attr === "food") {
        totalFoodGained += 1;
        if (totalFoodGained >= 10) completeQuest("qE6");
        if (totalFoodGained >= 30) completeQuest("qE7");
        if (totalFoodGained >= 50) completeQuest("qE8");
      }
    } else {
      // 固有アイテム所持済み or 固有ドロップなしの敵 → dropから通常ドロップ
      const randCount = Math.random();
      let count = 1;
      if (randCount < 0.80) {
        count = 1;
      } else if (randCount < 0.95) {
        count = 2;
      } else {
        count = 3;
      }

      for (let i = 0; i < count; i++) {
        const tot = d.drop.reduce((s, dp) => s + dp.w, 0);
        let r = Math.random() * tot, dropType = d.drop[0].type;
        for (const dp of d.drop) {
          r -= dp.w;
          if (r <= 0) { dropType = dp.type; break; }
        }
        if (dropType === null) continue;
        const pos = findFreePos(card.x, card.y);
        mkCard(dropType, pos.x, pos.y);
        // 食べ物ドロップのカウント
        if (DEFS[dropType] && DEFS[dropType].attr === "food") {
          totalFoodGained += 1;
          if (totalFoodGained >= 10) completeQuest("qE6");
          if (totalFoodGained >= 30) completeQuest("qE7");
          if (totalFoodGained >= 50) completeQuest("qE8");
        }
      }
    }
  } else if (isDoll) {
    const dropDoll = card.type === "wood_soul_doll" ? "wood_doll"
      : card.type === "stone_soul_doll" ? "stone_doll"
        : card.type === "iron_soul_doll" ? "iron_doll"
          : card.type === "gold_soul_doll" ? "gold_doll"
            : card.type === "cursed_wood_soul_doll" ? "cursed_wood_doll"
              : card.type === "dead_stone_soul_doll" ? "dead_stone_doll"
                : card.type === "uw_iron_soul_doll" ? "uw_iron_doll"
                  : card.type === "uw_gold_soul_doll" ? "uw_gold_doll"
                    : null;
    const p = findFreePos(card.x, card.y); mkCard(dropDoll, p.x, p.y);

    // ソウルドールの装備ドロップ
    if (card.jobCardType) {
      const ep = findFreePos(card.x, card.y);
      spawnCardAnimated(card.jobCardType, card.x, card.y, ep.x, ep.y);
    }
    if (card.armorCardType) {
      const ep = findFreePos(card.x, card.y);
      spawnCardAnimated(card.armorCardType, card.x, card.y, ep.x, ep.y);
    }
    if (card.accessoryCardType) {
      const ep = findFreePos(card.x, card.y);
      spawnCardAnimated(card.accessoryCardType, card.x, card.y, ep.x, ep.y);
    }
  } else if (isHuman) {
    // 職業（武器）のドロップ
    if (card.jobCardType) {
      const p = findFreePos(card.x, card.y);
      spawnCardAnimated(card.jobCardType, card.x, card.y, p.x, p.y);
    }
    // 防具のドロップ
    if (card.armorCardType) {
      const p = findFreePos(card.x, card.y);
      spawnCardAnimated(card.armorCardType, card.x, card.y, p.x, p.y);
    }
    // 装飾品のドロップ
    if (card.accessoryCardType) {
      const p = findFreePos(card.x, card.y);
      spawnCardAnimated(card.accessoryCardType, card.x, card.y, p.x, p.y);
    }
    dropBone(card.x, card.y);
  }

  if (d.creeper) {
    // クリーパー自爆エフェクト
    addFloatingText("BOOM!", card.x + CW / 2, card.y, "#f00", 18);
  } else if (!isHuman) {
    completeQuest("qB0"); // モンスターハンター（敵を討伐）
    if (card.type === "jormungand") completeQuest("qA6"); // ヨルムンガンド討伐
    if (card.type === "abyss") completeQuest("qA7")
    if (card.type === "guardian") completeQuest("qB7"); // 守護者討伐
    if (card.type === "witch") {
      witchKills++;
      completeQuest("qH3"); // 災厄の魔女
      if (witchKills >= 2) {
        completeQuest("qH4"); // 再来の魔女
      }
    }
    if (card.type === "abyss") {
      shatterBoardCorruption();
      toast("深淵が沈黙し、世界の色が戻った");
    }
    // 冥界ボスイベント：中ボス討伐チェック
    if (uwBossEventActive && uwBossMinibossIds.has(card.id)) {
      uwBossMinibossIds.delete(card.id);
      if (uwBossMinibossIds.size === 0) {
        // 四鬼全滅 → 冥王プルートを召喚
        setTimeout(() => { spawnPluto(); }, 800);
      } else {
        toast(`残り${uwBossMinibossIds.size}体...`);
      }
    }
    if (inUnderworld && d.attr === "hostile") {
      uwHostileKills++;
      if (uwHostileKills >= 10) completeQuest("qI5");
    }
    if (card.type === "pluto") {
      completeQuest("qI8");
      if (!hasAnyItem("ferry")) {
        const ferryPos = findFreePos(card.x, card.y);
        mkCard("ferry", ferryPos.x, ferryPos.y);
      }
    }
  }
  // 死んだカードを消去
  cards = cards.filter(c => c !== card);
  cards.forEach(c => { if (c.caged === card.id) { delete c.caged; } });

  const totalLivingHumans = inDarkForest
    ? cards.filter(c => c.type === "human" || c.type === "baby").length + baseCards.filter(c => c.type === "human" || c.type === "baby").length
    : cards.filter(c => c.type === "human" || c.type === "baby").length;
  if (totalLivingHumans === 0) {
    if (inUnderworld) returnFromUnderWorld();
    else triggerGameOver();
  }
}

// ════════════════════════════════════════════════
// 入力処理（タッチ・マウス共通 / Pointer Events）
// ════════════════════════════════════════════════
function cancelCraftForCard(card) { for (const key of Object.keys(progressMap)) { if (key.split(",").map(Number).includes(card.id)) delete progressMap[key]; } }
function cancelCraftIfInterrupted(movingCards) {
  const movingIds = new Set(movingCards.map(c => c.id));
  for (const key of Object.keys(progressMap)) {
    const craftIds = key.split(",").map(Number);
    const hasMoving = craftIds.some(id => movingIds.has(id));
    if (hasMoving) {
      const allMoving = craftIds.every(id => movingIds.has(id));
      if (!allMoving) {
        delete progressMap[key];
      }
    }
  }
}
// ダブルタップ・ダブルクリック検出用
let lastTapTime = 0, lastTapCard = null;

function handleDoubleTap(card) {
  if (card.type !== "human" && (def(card.type).attr !== "human" || card.type === "baby")) return;
  let removed = false;

  // 職業持ち村人：職業解除
  if (card.jobCardType) {
    const p = findFreePos(card.x, card.y);
    spawnCardAnimated(card.jobCardType, card.x, card.y, p.x, p.y);
    delete card.job;
    delete card.jobCardType;
    removed = true;
  }

  // 防具解除
  if (card.armorCardType) {
    const p = findFreePos(card.x, card.y);
    spawnCardAnimated(card.armorCardType, card.x, card.y, p.x, p.y);
    delete card.armorCardType;
    removed = true;
  }

  // 装飾品解除
  if (card.accessoryCardType) {
    const p = findFreePos(card.x, card.y);
    spawnCardAnimated(card.accessoryCardType, card.x, card.y, p.x, p.y);
    delete card.accessoryCardType;
    removed = true;
  }

  if (removed) {
    refreshUnitHp(card);
    completeQuest("qB1"); // 装備解除クエスト
  }
}

function hitCard(wx, wy) {
  for (let i = cards.length - 1; i >= 0; i--) {
    const c = cards[i];
    if (isAnimating(c.id)) continue;
    if (wx >= c.x && wx <= c.x + c.w && wy >= c.y && wy <= c.y + c.h) return { card: c, idx: i };
  }
  return null;
}

// アクティブなポインターを管理（ID→座標）
// タッチのみカウント（マウスはピンチ判定に含めない）
const activePointers = new Map();
function isTouchPointer(e) { return e.pointerType === "touch"; }

// ピンチ中かどうかを判定（ポインターが2つ以上ある場合）
function isPinching() { return activePointers.size >= 2; }

// ポインター2点間の距離
function pointerDist() {
  const pts = [...activePointers.values()];
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

// ポインター2点の中点（スクリーン座標）
function pointerMid() {
  const pts = [...activePointers.values()];
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

function getPointerWorld(e) { return s2w(e.clientX, e.clientY - UI_H); }

canvas.addEventListener("pointerdown", e => {
  if (!gameActive || gamePaused || mealPhase || gameOver) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  if (isTouchPointer(e)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // 2本指になったらピンチ開始
  if (isPinching()) {
    dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
    panActive = false;
    pinchActive = true;
    pinchStartDist = pointerDist();
    pinchStartScale = Math.max(getMinScale(), camScale);
    const mid = pointerMid();
    pinchMidS = { x: mid.x, y: mid.y - UI_H };
    pinchMidW = s2w(pinchMidS.x, pinchMidS.y);
    return;
  }

  // 1本指の処理
  const wpos = getPointerWorld(e);
  const hit = hitCard(wpos.x, wpos.y);

  if (hit) {
    const { card, idx } = hit;

    // ── ダブルタップ・ダブルクリック検出 ──
    const now = performance.now();
    if (lastTapCard === card && now - lastTapTime < 400) {
      handleDoubleTap(card);
      lastTapTime = 0; lastTapCard = null;
      return;
    }
    lastTapTime = now; lastTapCard = card;

    // 檻から敵を取り出す場合、cagedInをクリア（ドラッグ終了時に完全に外れたらクリアするように変更）
    /*
    if (def(card.type).attr === "hostile" && card.cagedIn) {
      delete card.cagedIn;
    }
    */

    // fixedカード（ゲート・ゲートに送り込んだ人間）はドラッグ不可
    if (card.fixed) return;

    // 戦闘中のカードはドラッグ開始しない
    if (activeBattles.some(b => b.participants.has(card))) return;

    dragStartX = card.x; dragStartY = card.y;
    // ── ドラッグ開始 ──
    const grp = getStack(card); // 垂直方向のスタックのみ取得
    const tapY = card.y;
    const moveCards = grp.filter(c => c.y >= tapY);
    const isBottomCard = grp.length > 1 && grp.every(c => c.y >= tapY);

    // 柵内の家畜を持ち上げたら fencedIn をクリア（ドラッグ終了時に完全に外れたらクリアするように変更）
    /*
    if (def(card.type).attr === 'friendly' && card.fencedIn) {
      delete card.fencedIn;
    }
    */

    // 特殊: tamed_chicken + 卵は一緒に持ち上げる
    let chickenEggExtra = [];
    if (card.type === 'tamed_chicken') {
      const connGrp = connected(card);
      chickenEggExtra = connGrp.filter(c => c.type === 'egg' && c.id !== card.id);
    }

    if (grp.length > 1 && (moveCards.length > 1 || isBottomCard)) {
      // 卵も合わせた移動セット
      const baseMove = isBottomCard ? [...grp] : moveCards;
      const actualMoveMap = new Map([...baseMove, ...chickenEggExtra].map(c => [c.id, c]));
      const actualMove = [...actualMoveMap.values()];
      const notMoved = cards.filter(c => !actualMoveMap.has(c.id));
      const sortedMove = [...actualMove].sort((a, b) => a.y - b.y);
      cards.splice(0, cards.length, ...notMoved, ...sortedMove);
      isDragGroup = true; dragging = card;
      groupCards = [...sortedMove];
      groupOffsets = sortedMove.map(c => ({ dx: wpos.x - c.x, dy: wpos.y - c.y }));
      cancelCraftIfInterrupted(sortedMove);
    } else if (chickenEggExtra.length > 0) {
      // chicken + egg グループドラッグ
      const moveSet = [card, ...chickenEggExtra];
      const sortedMove = [...moveSet].sort((a, b) => a.y - b.y);
      const notMoved = cards.filter(c => !moveSet.includes(c));
      cards.splice(0, cards.length, ...notMoved, ...sortedMove);
      isDragGroup = true; dragging = card;
      groupCards = [...sortedMove];
      groupOffsets = sortedMove.map(c => ({ dx: wpos.x - c.x, dy: wpos.y - c.y }));
      cancelCraftIfInterrupted(moveSet);
    } else {
      const grpBefore = connected(card);
      const restGrp = grpBefore.filter(c => c.id !== card.id);
      isDragGroup = false; dragging = card;
      dragOffX = wpos.x - card.x; dragOffY = wpos.y - card.y;
      cards.splice(idx, 1); cards.push(card);
      // 家畜（単体生産）はドラッグしても進捗をリセットしない
      const isFriendlyLone = def(card.type).attr === 'friendly';
      if (!isFriendlyLone) cancelCraftIfInterrupted([card]);
      if (restGrp.length > 0) {
        const restRecipe = matchRecipe(restGrp);
        if (restRecipe) { const rk = gKey(restGrp); if (!progressMap[rk]) progressMap[rk] = { progress: 0, recipe: restRecipe }; }
      }
    }
    // ドラッグ対象（および一緒にドラッグされるグループ）の gateId をクリア
    // ただし「安定したゲート本体を動かす」場合は、村人をゲートから外した扱いにしない（転送タイマー維持）
    // 既存コード（l.3575〜3587）に doorId のクリアを追加
    const dragTargets = isDragGroup ? groupCards : [dragging];
    const draggingStableGate = dragTargets.some(c => c && (c.type === "stable_gate" || c.type === "underworld_door"));
    if (!draggingStableGate) {
      dragTargets.forEach(c => {
        if (c && c.gateId) {
          const gate = cards.find(g => g.id === c.gateId);
          if (gate && gate.type === "stable_gate") {
            delete c.gateId;
            delete c.fixed;
          }
        }
        // ↓ 追加
        if (c && c.doorId) {
          const door = cards.find(g => g.id === c.doorId);
          if (door) {
            delete c.doorId;
            delete c.fixed;
          }
        }
        if (c && c.ferryId) {
          delete c.ferryId;
        }
      });
    }
  } else {
    if (!cameraAnim) { // カメラ演出中はパン無効
      panActive = true;
      panStartX = e.clientX; panStartY = e.clientY;
      panCamX = camX; panCamY = camY;
    }
  }
}, { passive: false });

canvas.addEventListener("pointermove", e => {
  if (!gameActive || gamePaused || mealPhase || gameOver) return;
  e.preventDefault();
  if (isTouchPointer(e)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // ── ピンチズーム ──
  if (pinchActive && isPinching()) {
    const dist = pointerDist();
    const newSc = Math.max(getMinScale(), Math.min(MAX_SC, pinchStartScale * (dist / pinchStartDist)));
    camScale = newSc;
    camX = pinchMidS.x - pinchMidW.x * camScale;
    camY = pinchMidS.y - pinchMidW.y * camScale;
    clampCam();
    return;
  }

  // ── パン ──
  if (!dragging && panActive && !isPinching()) {
    camX = panCamX + (e.clientX - panStartX);
    camY = panCamY + (e.clientY - panStartY);
    clampCam();
    return;
  }

  const wpos = getPointerWorld(e);
  lastMousePos = { x: e.clientX, y: e.clientY };

  if (!dragging) {
    // ドラッグ中でない時のホバー検知
    const hit = hitCard(wpos.x, wpos.y);
    hoveredCard = hit ? hit.card : null;
    return;
  }

  if (isDragGroup && groupCards.length > 0) {
    const maxDX = Math.max(...groupOffsets.map(o => o.dx));
    const minLimitX = Math.min(...groupOffsets.map(o => WORLD_W - CW + o.dx));
    const maxDY = Math.max(...groupOffsets.map(o => o.dy));
    const minLimitY = Math.min(...groupOffsets.map(o => WORLD_H - CH + o.dy));

    let tx = wpos.x;
    let ty = wpos.y;

    // カメラの表示エリア上端（UI境界）に相当するワールドY座標を計算
    const viewTopW = -camY / camScale;

    // ワールド境界での制限
    tx = Math.max(maxDX, Math.min(minLimitX, tx));
    ty = Math.max(maxDY, Math.min(minLimitY, ty));

    // カメラの上方向（画面外）への移動を制限 (UIの下に完全に隠れないように)
    if (ty < viewTopW + maxDY + 2) ty = viewTopW + maxDY + 2;

    groupCards.forEach((c, i) => {
      c.x = tx - groupOffsets[i].dx;
      c.y = ty - groupOffsets[i].dy;
    });
  } else if (dragging) {
    // 単体ドラッグ
    const viewTopW = -camY / camScale;
    const np = worldClamp(wpos.x - dragOffX, wpos.y - dragOffY);
    dragging.x = np.x;
    dragging.y = Math.max(viewTopW + 2, np.y);
  }

  const d = def(dragging ? dragging.type : (hoveredCard ? hoveredCard.type : ""));
  const overUI = e.clientY < UI_H;
  const isEmerald = (dragging && (dragging.type === "emerald" || dragging.type === "funeral_money"));
  document.getElementById("trashZone").classList.toggle("active", overUI && !!d.sell && !!dragging);

  hoveredCard = dragging;

  ALL_PACK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });

  if (overUI && isEmerald) {
    // カーソルがパックUIの範囲内に重なっている場合のみハイライト
    ALL_PACK_IDS.forEach(packId => {
      const el = document.getElementById(packId);
      if (!el || el.classList.contains("locked")) return;
      if (!unlockedPacks.has(packId)) return;
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
        el.classList.add("active");
      }
    });
  }
}, { passive: false });

// 画面外やUI上でのホバーリセット
// UIのホバー監視（委譲ではなく個別登録で安定させる）
function setupUIHover(idOrClass) {
  const elements = idOrClass.startsWith(".") ? document.querySelectorAll(idOrClass) : [document.getElementById(idOrClass)];
  elements.forEach(el => {
    if (!el) return;
    el.addEventListener("mouseenter", () => {
      hoveredUI = el.id || el;
    });
    el.addEventListener("mouseleave", () => {
      hoveredUI = null;
    });
  });
}
["dayLabel", "dayBarWrap", "cardCount", "foodStatus", "emeraldStatus", ".pack-shop-zone", "initPackCard"].forEach(setupUIHover);

// ポインター移動時の座標更新を強化
window.addEventListener("pointermove", e => {
  lastMousePos = { x: e.clientX, y: e.clientY };
  if (e.target !== canvas) {
    // Canvas以外のUI要素に乗っている場合はカードホバーを解除
    hoveredCard = null;
  }
});

canvas.addEventListener("pointerup", e => {
  e.preventDefault();
  if (isTouchPointer(e)) activePointers.delete(e.pointerId);

  // 2本指→1本指になったらピンチ終了、パン再開準備
  if (!isPinching()) {
    pinchActive = false;
    // 残った1本指でパンを再開しない（意図しない移動を防ぐ）
    panActive = false;
  }

  if (!gameActive || gamePaused || mealPhase || gameOver || !dragging) return;

  const isTap = Math.abs(dragging.x - dragStartX) < 3 && Math.abs(dragging.y - dragStartY) < 3;
  if (isTap && dragging.type === "pack_card") {
    clickPackCard(dragging);
    dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
    return;
  }

  document.getElementById("trashZone").classList.remove("active");
  ALL_PACK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });

  if (e.clientY < UI_H) {
    handleUIZoneDrop(e);
  } else {
    // ── 不安定なゲートおよび安定したゲート：人間のドロップ処理 ──
    {
      // ドラッグ中のカードまたはグループ内のいずれかがゲートグループに重なるか確認
      const allDragged = isDragGroup ? groupCards : [dragging];
      const gate = cards.find(c => {
        if (c.type !== "unstable_gate" && c.type !== "stable_gate") return false;
        if (allDragged.some(d => overlap(d, c))) return true;
        const gateGroup = cards.filter(x => x.gateId === c.id);
        return gateGroup.some(g => allDragged.some(d => overlap(d, g)));
      });

      if (gate) {
        const isStable = gate.type === "stable_gate";
        const humans = allDragged.filter(c => c.type === "human");
        const nonHumans = allDragged.filter(c => c.type !== "human");

        if (humans.length > 0) {
          const stacked = cards.filter(c => c.gateId === gate.id);
          const maxStack = def(gate.type).maxStack || 7;
          const canAdd = Math.min(humans.length, maxStack - stacked.length);

          if (canAdd <= 0) {
            toast(`これ以上村人を送り込めない（最大${maxStack}人）`);
            humans.forEach(h => {
              const p = findFreePos(gate.x, gate.y);
              h.x = p.x; h.y = p.y;
            });
          } else {
            humans.slice(0, canAdd).forEach((h, i) => {
              h.gateId = gate.id;
              if (isStable) {
                delete h.fixed; // 安定したゲートの場合は固定しない
              } else {
                h.fixed = true; // 不安定なゲートの場合は固定する
              }
              h.x = gate.x;
              h.y = gate.y + 24 * (stacked.length + 1 + i);
            });
            // 転送タイマー：乗せた瞬間に開始できるよう初期化（sellPhase等で updateGates が止まっても表示/進行準備ができる）
            if (gate.gateSendTimer === null || gate.gateSendTimer === undefined) {
              gate.gateSendTimer = 30000;
            }
            if (canAdd < humans.length) {
              humans.slice(canAdd).forEach(h => {
                const p = findFreePos(gate.x, gate.y);
                h.x = p.x; h.y = p.y;
              });
            }
          }
        }

        // 非村人カードはグループから外してそのまま落とす（斥力が自然にはじく）
        // 特に何もしなくてよい（斥力システムが処理する）

        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }
    // ── 人間以外の単体をゲートにドロップしようとした場合ははじく ──
    if (!isDragGroup && dragging.type !== "human" && dragging.type !== "baby") {
      const gate = cards.find(c => {
        if (c.type !== "unstable_gate" && c.type !== "stable_gate") return false;
        if (overlap(dragging, c)) return true;
        const gateGroup = cards.filter(x => x.gateId === c.id);
        return gateGroup.some(x => overlap(dragging, x));
      });
      if (gate) {
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }
    // ── underworld_door：村人のドロップ処理（maxStack=1）──
    {
      const allDragged = isDragGroup ? groupCards : [dragging];
      const door = cards.find(c => {
        if (c.type !== "underworld_door") return false;
        if (allDragged.some(d => overlap(d, c))) return true;
        const doorGroup = cards.filter(x => x.doorId === c.id);
        return doorGroup.some(g => allDragged.some(d => overlap(d, g)));
      });

      if (door) {
        const humans = allDragged.filter(c => c.type === "human");
        const maxStack = 1;
        const stacked = cards.filter(c => c.doorId === door.id);

        if (humans.length > 0) {
          if (stacked.length >= maxStack) {
            toast("これ以上送り込めない（最大1人）");
            humans.forEach(h => { const p = findFreePos(door.x, door.y); h.x = p.x; h.y = p.y; });
          } else {
            // 先頭の1人だけ乗せる
            const h = humans[0];
            h.doorId = door.id;
            h.x = door.x;
            h.y = door.y + 24;
            if (door.doorSendTimer === null || door.doorSendTimer === undefined) {
              door.doorSendTimer = 15000;
            }
            // 2人以上ドラッグしていた場合は残りを近くに落とす
            humans.slice(1).forEach(h2 => { const p = findFreePos(door.x, door.y); h2.x = p.x; h2.y = p.y; });
          }
        }

        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }
    // ── ferry（冥界）：村人1人+荷物6枚で拠点帰還 ──
    if (inUnderworld) {
      const allDragged = isDragGroup ? groupCards : [dragging];
      const ferry = findFerryDropTarget(allDragged);

      if (ferry) {
        const stacked = getFerryStack(ferry);
        const hasHuman = stacked.some(c => c.type === "human");
        const humans = allDragged.filter(c => c.type === "human");
        const cargoCandidates = allDragged.filter(c => c.type !== "human" && canFerryCarry(c));
        const blocked = allDragged.filter(c =>
          c !== ferry && !humans.includes(c) && !cargoCandidates.includes(c)
        );

        if (blocked.length > 0) {
          toast("このカードは渡し舟に載せられない");
          blocked.forEach(c => {
            const p = findFreePos(ferry.x, ferry.y);
            c.x = p.x; c.y = p.y;
          });
        }

        if (humans.length > 0) {
          if (hasHuman) {
            toast("渡し舟には村人1人まで");
            humans.forEach(h => {
              const p = findFreePos(ferry.x, ferry.y);
              h.x = p.x; h.y = p.y;
            });
          } else {
            const h = humans[0];
            h.ferryId = ferry.id;
            humans.slice(1).forEach(h2 => {
              const p = findFreePos(ferry.x, ferry.y);
              h2.x = p.x; h2.y = p.y;
            });
          }
        }

        const slotsLeft = FERRY_CARGO_MAX - stacked.filter(c => c.type !== "human").length;
        const newCargo = cargoCandidates.filter(c => c.ferryId !== ferry.id);
        if (newCargo.length > slotsLeft) {
          toast(`荷物は最大${FERRY_CARGO_MAX}枚まで`);
        }
        newCargo.slice(0, slotsLeft).forEach(c => { c.ferryId = ferry.id; });
        newCargo.slice(slotsLeft).forEach(c => {
          const p = findFreePos(ferry.x, ferry.y);
          c.x = p.x; c.y = p.y;
        });

        alignFerryStack(ferry);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }

      if (!isDragGroup && dragging.type !== "human" && !canFerryCarry(dragging)) {
        const draggedIds = new Set([dragging.id]);
        const ferryBlock = cards.find(c => {
          if (c.type !== "ferry") return false;
          if (overlap(dragging, c)) return true;
          return getFerryStack(c).filter(x => !draggedIds.has(x.id)).some(x => overlap(dragging, x));
        });
        if (ferryBlock) {
          toast("このカードは渡し舟に載せられない");
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        }
      }
    }
    if (!isDragGroup && dragging.type === "key") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "treasure_chest");
      if (target) {
        cards = cards.filter(c => c !== dragging && c !== target);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];

        // ミミック判定（20%）
        if (Math.random() < 0.2) {
          toast("ミミックだ！");
          const p = findFreePos(target.x, target.y);
          const mimic = mkCard("mimic", p.x, p.y);
          // 少し待ってから戦闘開始（演出）
          setTimeout(() => {
            const human = cards.find(c => c.type === "human" || c.type === "baby");
            if (human) triggerCombat(human, mimic);
          }, 1000);
        } else {
          // 宝箱の中身を抽選
          openTreasureChest(target.x, target.y);
        }
        return;
      }
    }

    // ── 燃料カード(またはグループ) → かまど：燃料追加 ──
    let isFuelDrop = false;
    let fuelCards = [];
    if (!isDragGroup) {
      if (dragging.type === "wood") {
        fuelCards = [dragging];
        isFuelDrop = true;
      }
    } else {
      if (groupCards.length > 0 && groupCards.every(c => c.type === "wood")) {
        fuelCards = [...groupCards];
        isFuelDrop = true;
      }
    }

    if (isFuelDrop && fuelCards.length > 0) {
      const leadCard = dragging;
      const target = cards.find(c => !fuelCards.includes(c) && overlap(leadCard, c) && c.type === "furnace");
      if (target) {
        let totalFuelAdd = 0;
        for (const fc of fuelCards) {
          const fuelAdd = 0.5;
          totalFuelAdd += fuelAdd * (fc.stack || 1);
        }
        target.fuel = (target.fuel || 0) + totalFuelAdd;
        cards = cards.filter(c => !fuelCards.includes(c));
        toast(`燃料を追加！ 残り燃料: ${Math.floor(target.fuel * 10) / 10}`);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    let isSoulFuelDrop = false;
    let soulFuelCards = [];
    if (!isDragGroup) {
      if (dragging.type === "soul") {
        soulFuelCards = [dragging];
        isSoulFuelDrop = true;
      }
    } else {
      if (groupCards.length > 0 && groupCards.every(c => c.type === "soul")) {
        soulFuelCards = [...groupCards];
        isSoulFuelDrop = true;
      }
    }

    if (isSoulFuelDrop && soulFuelCards.length > 0) {
      const leadCard = dragging;
      const target = cards.find(c => !soulFuelCards.includes(c) && overlap(leadCard, c) && c.type === "soul_furnace");
      if (target) {
        let totalSoulFuelAdd = 0;
        for (const fc of soulFuelCards) {
          const fuelAdd = 1.0;
          totalSoulFuelAdd += fuelAdd * (fc.stack || 1);
        }
        target.fuel = (target.fuel || 0) + totalSoulFuelAdd;
        cards = cards.filter(c => !soulFuelCards.includes(c));
        toast(`燃料を追加！ 残り燃料: ${Math.floor(target.fuel * 10) / 10}`);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    // ── 敵 → モンスターの檻：収容 ──
    if (!isDragGroup && def(dragging.type).attr === "hostile") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "monster_cage");
      if (target) {
        const stacked = getStack(target, true).filter(c => def(c.type).attr === "hostile");
        if (stacked.length < 5) {
          // 収容成功
          dragging.x = target.x;
          dragging.y = target.y + 24 + stacked.length * 24;
          dragging.cagedIn = target.id;
          snapStack(dragging);
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        } else {
          toast("檻がいっぱいです！（最大5体）");
          const p = findFreePos(dragging.x, dragging.y); dragging.x = p.x; dragging.y = p.y;
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        }
      }
    }

    // モンスターの檻に敵以外を重ねようとしたら弾く
    if (!isDragGroup && def(dragging.type).attr !== "hostile") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "monster_cage");
      if (target) {
        const p = findFreePos(dragging.x, dragging.y); dragging.x = p.x; dragging.y = p.y;
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    // ── 家畜 → 家畜の柵：収容 ──
    if (!isDragGroup && def(dragging.type).attr === "friendly") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "livestock_fence");
      if (target) {
        const stacked = getStack(target, true).filter(c => def(c.type).attr === "friendly");
        if (stacked.length < 5) {
          // 収容成功
          dragging.x = target.x;
          dragging.y = target.y + 24 + stacked.length * 24;
          dragging.fencedIn = target.id;
          snapStack(dragging);
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        } else {
          toast("柵がいっぱいです！（最大5体）");
          const p = findFreePos(dragging.x, dragging.y); dragging.x = p.x; dragging.y = p.y;
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        }
      }
    }

    // 家畜の柵に家畜以外を重ねようとしたら弾く
    if (!isDragGroup && def(dragging.type).attr !== "friendly") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "livestock_fence");
      if (target) {
        const p = findFreePos(dragging.x, dragging.y); dragging.x = p.x; dragging.y = p.y;
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    // ── 職業カード → 村人・ソウルドール：職業付与 ──
    if (!isDragGroup && def(dragging.type).attr === "job") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && (c.type === "human" || (def(c.type).attr === "human" && c.type !== "baby")));
      if (target) {
        const jobDef = def(dragging.type);
        // 既に職業を持っている場合は古い職業カードを排出
        if (target.job && target.jobCardType) {
          const p = findFreePos(target.x, target.y);
          spawnCardAnimated(target.jobCardType, target.x, target.y, p.x, p.y);
        }
        // 職業を付与
        target.job = jobDef.job;
        target.jobCardType = dragging.type;
        // 職業カードを消費
        cards = cards.filter(c => c !== dragging);
        refreshUnitHp(target);
        if (dragging.type === "shuriken") completeQuest("qB5"); // 手裏剣装備クエスト
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    // ── 防具カード → 村人・ソウルドール：防具装備 ──
    if (!isDragGroup && def(dragging.type).attr === "armor") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && (c.type === "human" || (def(c.type).attr === "human" && c.type !== "baby")));
      if (target) {
        // 既に防具を装備している場合は古い防具カードを排出
        if (target.armorCardType) {
          const p = findFreePos(target.x, target.y);
          spawnCardAnimated(target.armorCardType, target.x, target.y, p.x, p.y);
        }
        // 防具を付与
        target.armorCardType = dragging.type;
        // 防具カードを消費
        cards = cards.filter(c => c !== dragging);
        refreshUnitHp(target);
        completeQuest("qB2"); // 防具装備クエスト
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    // ── 装飾品カード → 村人・ソウルドール：装飾品装備 ──
    if (!isDragGroup && def(dragging.type).attr === "accessory") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && (c.type === "human" || (def(c.type).attr === "human" && c.type !== "baby")));
      if (target) {
        // 既に装飾品を装備している場合は古い装飾品カードを排出
        if (target.accessoryCardType) {
          const p = findFreePos(target.x, target.y);
          spawnCardAnimated(target.accessoryCardType, target.x, target.y, p.x, p.y);
        }
        // 装飾品を付与
        target.accessoryCardType = dragging.type;
        // 装飾品カードを消費
        cards = cards.filter(c => c !== dragging);
        refreshUnitHp(target);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }


    // ── エメラルド (50以上) → 図書館：研究開始 ──
    if (!isDragGroup) {
      let emCard = null, libCard = null;
      if (dragging.type === "emerald" && (dragging.stack || 1) >= 50) {
        libCard = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "library");
        emCard = dragging;
      } else if (dragging.type === "library") {
        emCard = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "emerald" && (c.stack || 1) >= 50);
        libCard = dragging;
      }
      if (emCard && libCard) {
        // 図書館レシピのプール（exploreRecipes）に残レシピがあるか確認
        const libRecipeDef = RECIPES.find(r => r.inputs.library && r.inputs.emerald);
        const libFilter = libRecipeDef ? (libRecipeDef.exploreRecipes || libRecipeDef.recipeTag || null) : null;
        const hasLibRecipe = RECIPES.some((r, idx) => {
          if (!r.recipeTag || ownedRecipes.has(idx)) return false;
          if (libFilter === null) return true;
          if (typeof libFilter === "string") return r.recipeTag === libFilter;
          if (Array.isArray(libFilter)) return libFilter.includes(r.recipeTag);
          return true;
        });
        if (!hasLibRecipe) {
          const p = findFreePos(dragging.x, dragging.y); dragging.x = p.x; dragging.y = p.y;
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        }
        if (!progressMap[libCard.id]) {
          emCard.stack -= 50;
          if (emCard.stack <= 0) cards = cards.filter(c => c !== emCard);

          const recipe = libRecipeDef;
          if (recipe) {
            const key = libCard.id.toString();
            progressMap[key] = { progress: 0, recipe };
            toast("図書館で研究を開始しました！(50💎消費)");

            // 物理的なはじき判定（即時斥力）
            for (const c of cards) {
              if (c !== libCard && overlap(libCard, c)) {
                const p = findFreePos(c.x, c.y);
                c.x = p.x; c.y = p.y;
              }
            }
          }
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        } else {
          const p = findFreePos(dragging.x, dragging.y); dragging.x = p.x; dragging.y = p.y;
          dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
          return;
        }
      }
    }

    // エメラルド同士のスタック化
    if (!isDragGroup && dragging.type === "emerald") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "emerald");
      if (target) {
        target.stack = (target.stack || 1) + (dragging.stack || 1);
        cards = cards.filter(c => c !== dragging);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }
    if (!isDragGroup && dragging.type === "funeral_money") {
      const target = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === "funeral_money");
      if (target) {
        target.stack = (target.stack || 1) + (dragging.stack || 1);
        cards = cards.filter(c => c !== dragging);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    // 手なずけ処理（TAME_DEFSから汎用的に判定）
    if (!isDragGroup) {
      let tameResult = null;
      for (const td of TAME_DEFS) {
        let itemCard = null, mobCard = null;
        if (dragging.type === td.item) {
          mobCard = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === td.mob);
          itemCard = dragging;
        } else if (dragging.type === td.mob) {
          itemCard = cards.find(c => c !== dragging && overlap(dragging, c) && c.type === td.item);
          mobCard = dragging;
        }
        if (itemCard && mobCard) { tameResult = { td, itemCard, mobCard }; break; }
      }
      if (tameResult) {
        const { td, itemCard, mobCard } = tameResult;
        if (Math.random() < td.chance) {
          mobCard.type = td.result;
          delete mobCard.hp;
          const resultLabel = def(td.result).label;
          toast(`${resultLabel}を手なずけた！`);
          if (td.mob === "rabbit") completeSubQuest("sq1");
          completeQuest("qC7"); // 動物手なずけクエスト
        } else {
          const mobLabel = def(td.mob).label;
          toast(`失敗…${mobLabel}に逃げられた！`);
        }
        if (!td.keepItem) cards = cards.filter(c => c !== itemCard);
        dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
        return;
      }
    }

    // 戦闘判定
    const joinCheck = isDragGroup ? groupCards : [dragging];
    let joinedAny = false;
    for (const c of joinCheck) { if (joinBattleIfInZone(c)) joinedAny = true; }
    if (joinedAny) { dragging = null; isDragGroup = false; groupCards = []; groupOffsets = []; return; }

    snapStack(dragging);

    // ドラッグしたカードが最終的に柵や檻のスタックに含まれていない場合、fencedIn/cagedInをクリア
    const droppedCards = isDragGroup ? [...groupCards] : [dragging];
    for (const c of droppedCards) {
      if (!c) continue; // nullガード
      if (c.ferryId) {
        const ferry = cards.find(f => f.id === c.ferryId);
        const stillOnFerry = ferry && (
          overlap(c, ferry) ||
          getFerryStack(ferry).some(x => x !== c && overlap(c, x))
        );
        if (!stillOnFerry) delete c.ferryId;
      }
      const fullStack = getStack(c, true);
      const hasFence = fullStack.some(x => x.type === "livestock_fence");
      const hasCage = fullStack.some(x => x.type === "monster_cage");
      if (!hasFence && c.fencedIn) delete c.fencedIn;
      if (!hasCage && c.cagedIn) delete c.cagedIn;
    }

    tryStartCraft(dragging);
  }
  dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
}, { passive: false });

canvas.addEventListener("pointercancel", e => {
  if (isTouchPointer(e)) activePointers.delete(e.pointerId);
  if (!isPinching()) pinchActive = false;
  if (activePointers.size === 0) {
    panActive = false;
    dragging = null; isDragGroup = false; groupCards = []; groupOffsets = [];
  }
});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const mx = e.clientX, my = e.clientY - UI_H;
  const wBefore = s2w(mx, my);
  camScale = Math.max(getMinScale(), Math.min(MAX_SC, camScale * factor));
  camX = mx - wBefore.x * camScale;
  camY = my - wBefore.y * camScale;
  clampCam();
}, { passive: false });

const ALL_PACK_IDS = ["packShopA", "packShopB", "packShopC", "packShopD", "packShopE", "packShopF", "packShopG", "packShopH", "uwPackShopA", "uwPackShopB", "uwPackShopC", "uwPackShopD"];

function handleUIZoneDrop(e) {
  // 暗黒の森中はパック購入禁止（売却は後段で個別に許可）
  const sellCards = isDragGroup ? groupCards : [dragging];
  if (dragging.type === "funeral_money" || dragging.type === "emerald") {
    let packId = null;
    for (const id of ALL_PACK_IDS) {
      const el = document.getElementById(id);
      if (!el || !unlockedPacks.has(id) || el.classList.contains("locked")) continue;
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) { packId = id; break; }
    }
    if (!packId) return;
    if (inDarkForest) { toast("暗黒の森ではパックを購入できない"); dragging = null; isDragGroup = false; groupCards = []; groupOffsets = []; return; }
    const poolMap = { packShopA: PACK_A, packShopB: PACK_B, packShopC: PACK_C, packShopD: PACK_D, packShopE: PACK_E, packShopF: PACK_F, packShopG: PACK_G, packShopH: PACK_H, uwPackShopA: UW_PACK_A, uwPackShopB: UW_PACK_B, uwPackShopC: UW_PACK_C, uwPackShopD: UW_PACK_D };
    const recipeMap = { packShopA: PACK_A_RECIPES, packShopB: PACK_B_RECIPES, packShopC: PACK_C_RECIPES, packShopD: PACK_D_RECIPES, packShopE: PACK_E_RECIPES, packShopF: PACK_F_RECIPES, packShopG: PACK_G_RECIPES, packShopH: PACK_H_RECIPES, uwPackShopA: UW_PACK_A_RECIPES, uwPackShopB: UW_PACK_B_RECIPES, uwPackShopC: UW_PACK_C_RECIPES, uwPackShopD: UW_PACK_D_RECIPES };
    const costMap = PACK_COSTS;
    const cost = costMap[packId];
    if (dragging.stack >= cost) {
      dragging.stack -= cost;
      if (dragging.stack <= 0) cards = cards.filter(c => c !== dragging);
      else { const p = findFreePos(dragging.x, dragging.y); dragging.x = p.x; dragging.y = p.y; }

      const recipeWeightMap = { packShopA: PACK_A_RECIPE_WEIGHT, packShopB: PACK_B_RECIPE_WEIGHT, packShopC: PACK_C_RECIPE_WEIGHT, packShopD: PACK_D_RECIPE_WEIGHT, packShopE: PACK_E_RECIPE_WEIGHT, packShopF: PACK_F_RECIPE_WEIGHT, packShopG: PACK_G_RECIPE_WEIGHT, packShopH: PACK_H_RECIPE_WEIGHT, uwPackShopA: UW_PACK_A_RECIPE_WEIGHT, uwPackShopB: UW_PACK_B_RECIPE_WEIGHT, uwPackShopC: UW_PACK_C_RECIPE_WEIGHT, uwPackShopD: UW_PACK_D_RECIPE_WEIGHT };
      const recipeWeight = recipeWeightMap[packId] || 10;
      const packCountMap = { packShopA: PACK_A_COUNT, packShopB: PACK_B_COUNT, packShopC: PACK_C_COUNT, packShopD: PACK_D_COUNT, packShopE: PACK_E_COUNT, packShopF: PACK_F_COUNT, packShopG: PACK_G_COUNT, packShopH: PACK_H_COUNT, uwPackShopA: UW_PACK_A_COUNT, uwPackShopB: UW_PACK_B_COUNT, uwPackShopC: UW_PACK_C_COUNT, uwPackShopD: PACK_D_COUNT };
      const packCount = packCountMap[packId] || 4;
      totalPacksOpened++;
      openedPacks.add(packId);
      const packPos = findFreePos(dragging ? dragging.x : INIT_WX, dragging ? dragging.y : INIT_WY);
      mkCard("pack_card", packPos.x, packPos.y, {
        packId: packId,
        pool: drawPool(poolMap[packId], packCount, recipeMap[packId], recipeWeight),
        recipeFilter: recipeMap[packId],
        totalCount: packCount,
        currentIndex: 0
      });
      toast("パックを購入しました！");
      if (packId === "packShopA") completeQuest("q5");
    } else {
      toast(`💎が${cost}個必要です`);
    }
    return;
  }
  let total = 0, sx = dragging.x, sy = dragging.y;
  for (const sc of sellCards) {
    const sd = def(sc.type);
    if (sd.sell !== null && sd.sell >= 0 && sc.type !== "human") {
      total += sd.sell * sc.stack;
      cards = cards.filter(c => c !== sc);
    }
  }
  if (isDragGroup) dragging = null;
  if (total > 0) {
    if (inDarkForest) { toast("暗黒の森では売却できない"); dragging = null; isDragGroup = false; groupCards = []; groupOffsets = []; return; }
    addCurrency(total, sx, sy); completeQuest("q4"); updateSellBanner();
  }
}

function snapStack(dropped, sameTypeOnly = false) {
  const isCurrentlyDragging = (dragging === dropped);
  const movingIds = (isCurrentlyDragging && isDragGroup) ? new Set(groupCards.map(c => c.id)) : new Set([dropped.id]);
  const dragCards = (isCurrentlyDragging && isDragGroup) ? groupCards : [dropped];
  // 接触しているカードを探す
  const potentials = new Set();
  for (const dc of dragCards) {
    const pc = spatialGrid.getPotentialColliders(dc);
    for (const p of pc) {
      if (!movingIds.has(p.id)) potentials.add(p);
    }
  }
  let externalOverlap = [...potentials].filter(c => dragCards.some(dc => overlap(dc, c)));

  // 戦闘エリア内へのドロップ制限（非戦闘員のみ）
  const isCombatant = dragCards.every(c => def(c.type).attr === "human" || c.type === "baby" || def(c.type).attr === "hostile");
  if (!isCombatant) {
    const targetBattle = activeBattles.find(b => dragCards.some(dc => overlap(dc, b.bounds)));
    if (targetBattle) {
      dragCards.forEach(dc => softPushOutOfBox(dc, targetBattle.bounds));
      dragging = null; return;
    }
  }

  if (sameTypeOnly) {
    externalOverlap = externalOverlap.filter(c => c.type === dropped.type);
  }

  if (externalOverlap.length === 0) return;

  // 敵対カードとの接触による戦闘開始
  const hostilesInOverlap = externalOverlap.filter(c => def(c.type).attr === "hostile");
  const hostilesInDrag = dragCards.filter(c => def(c.type).attr === "hostile");
  const friendsInOverlap = externalOverlap.filter(c => def(c.type).attr === "human" || c.type === "baby");
  const friendsInDrag = dragCards.filter(c => def(c.type).attr === "human" || c.type === "baby");

  if (hostilesInOverlap.length > 0 && friendsInDrag.length > 0) {
    triggerCombat(friendsInDrag[0], hostilesInOverlap[0]);
    dragging = null; return;
  }
  if (hostilesInDrag.length > 0 && friendsInOverlap.length > 0) {
    triggerCombat(friendsInOverlap[0], hostilesInDrag[0]);
    dragging = null; return;
  }

  // 敵対カードには重なれない（戦闘にならない組み合わせの場合の斥力）
  // ただし、接触したスタックに monster_cage が含まれる場合ははじかない
  const targetStackForHostile = externalOverlap.length > 0 ? getStack(externalOverlap[0], true, sameTypeOnly) : [];
  const hasCageInTarget = targetStackForHostile.some(c => c.type === "monster_cage");
  if (!hasCageInTarget) {
    if (externalOverlap.some(c => def(c.type).attr === "hostile") || dragCards.some(c => def(c.type).attr === "hostile")) {
      const p = findFreePos(dropped.x, dropped.y); dropped.x = p.x; dropped.y = p.y; return;
    }
  }

  // 接触したカードの中から、既存の「意図的なスタック」を取得
  // sameTypeOnly が真（自動生成時など）なら、同じ種類だけのスタックを対象とする
  const stackBase = getStack(externalOverlap[0], true, sameTypeOnly).filter(c => !movingIds.has(c.id));
  if (stackBase.length === 0) return;
  stackBase.sort((a, b) => a.y - b.y);

  // ドラッグ中のカードも並び替えておく（念のため）
  dragCards.sort((a, b) => a.y - b.y);

  // 常に既存スタック(stackBase)の後ろにドラッグ中のカード(dragCards)を連結
  const finalGrp = [...stackBase, ...dragCards];

  // 家畜の柵グループへのドロップ検証（スタック結合後の状態で判定）
  if (finalGrp.some(c => c.type === 'livestock_fence')) {
    const allFriendlyOrFence = finalGrp.every(c => def(c.type).attr === 'friendly' || c.type === 'livestock_fence');
    if (!allFriendlyOrFence) {
      dragCards.forEach(dc => { const p = findFreePos(dc.x, dc.y); dc.x = p.x; dc.y = p.y; });
      return;
    }
    const friendlyCount = finalGrp.filter(c => def(c.type).attr === 'friendly').length;
    if (friendlyCount > 5) {
      dragCards.forEach(dc => { const p = findFreePos(dc.x, dc.y); dc.x = p.x; dc.y = p.y; });
      toast('柵がいっぱいです！（最大5体）');
      return;
    }
    const fence = finalGrp.find(c => c.type === 'livestock_fence');
    dragCards.filter(c => def(c.type).attr === 'friendly').forEach(c => { c.fencedIn = fence.id; });
  }

  // モンスターの檻グループへのドロップ検証（スタック結合後の状態で判定）
  if (finalGrp.some(c => c.type === 'monster_cage')) {
    const allHostileOrCage = finalGrp.every(c => def(c.type).attr === 'hostile' || c.type === 'monster_cage');
    if (!allHostileOrCage) {
      dragCards.forEach(dc => { const p = findFreePos(dc.x, dc.y); dc.x = p.x; dc.y = p.y; });
      return;
    }
    const hostileCount = finalGrp.filter(c => def(c.type).attr === 'hostile').length;
    if (hostileCount > 5) {
      dragCards.forEach(dc => { const p = findFreePos(dc.x, dc.y); dc.x = p.x; dc.y = p.y; });
      toast('檻がいっぱいです！（最大5体）');
      return;
    }
    const cage = finalGrp.find(c => c.type === 'monster_cage');
    dragCards.filter(c => def(c.type).attr === 'hostile').forEach(c => { c.cagedIn = cage.id; });
  }
  const totalH = (finalGrp.length - 1) * 24 + CH;
  const baseX = stackBase[0].x;
  let startY = stackBase[0].y;

  // 盤面下端からはみ出さないように補正
  if (startY + totalH > WORLD_H) startY = WORLD_H - totalH;
  // カメラ上端（画面外）からはみ出さないように補正
  if (startY < camY) startY = camY;
  if (startY < 0) startY = 0;

  const fullStackSet = new Set(finalGrp.map(c => c.id));
  const finalBox = { x: baseX, y: startY, w: CW, h: totalH };
  const occOverlap = (c1, box) => {
    return c1.x < box.x + box.w && c1.x + CW > box.x &&
      c1.y < box.y + box.h && c1.y + CH > box.y;
  };
  const occupants = cards.filter(occ => !fullStackSet.has(occ.id) && !movingIds.has(occ.id) && occOverlap(occ, finalBox));

  finalGrp.forEach((c, i) => {
    c.x = baseX;
    c.y = startY + i * 24;
  });

  const fullStack = connected(finalGrp[0]);
  fullStack.sort((a, b) => a.y - b.y);
  const stackIds = new Set(fullStack.map(c => c.id));
  const otherCards = cards.filter(c => !stackIds.has(c.id));
  cards.splice(0, cards.length, ...otherCards, ...fullStack);
}

function getActiveReservationGroupAndRecipe(g) {
  const facility = g.find(c => ["plank_factory", "brick_factory", "glass_factory", "composter", "furnace", "market", "slaughterhouse"].includes(c.type));
  if (!facility) return null;

  const materialsInStack = g.filter(c => c.id !== facility.id).sort((a, b) => a.y - b.y);

  if (facility.type === "plank_factory") {
    const woods = materialsInStack.filter(c => c.type === "wood");
    if (woods.length >= 2) {
      const activeGrp = [facility, woods[0], woods[1]];
      const recipe = RECIPES.find(r => r.inputs.plank_factory && r.inputs.wood === 2);
      return { activeGrp, recipe };
    }
  }
  else if (facility.type === "brick_factory") {
    const stones = materialsInStack.filter(c => c.type === "stone");
    if (stones.length >= 2) {
      const activeGrp = [facility, stones[0], stones[1]];
      const recipe = RECIPES.find(r => r.inputs.brick_factory && r.inputs.stone === 2);
      return { activeGrp, recipe };
    }
  }
  else if (facility.type === "glass_factory") {
    const sands = materialsInStack.filter(c => c.type === "sand");
    if (sands.length >= 2) {
      const activeGrp = [facility, sands[0], sands[1]];
      const recipe = RECIPES.find(r => r.inputs.glass_factory && r.inputs.sand === 2);
      return { activeGrp, recipe };
    }
  }
  else if (facility.type === "composter") {
    const foods = materialsInStack.filter(c => def(c.type).attr === "food");
    if (foods.length >= 3) {
      const activeGrp = [facility, ...foods.slice(0, 3)];
      const recipe = RECIPES.find(r => r.inputs.composter && r.inputs.food === 3);
      return { activeGrp, recipe };
    }
  }
  else if (facility.type === "furnace") {
    const validTypes = ["iron_ore", "gold_ore", "sand"];
    const matCard = materialsInStack.find(c => validTypes.includes(c.type));
    if (matCard) {
      const activeGrp = [facility, matCard];
      const recipe = RECIPES.find(r => r.inputs.furnace && r.inputs[matCard.type] === 1);
      return { activeGrp, recipe };
    }
  }
  else if (facility.type === "slaughterhouse") {
    const animalTypes = ["tamed_rabbit", "tamed_cow", "tamed_chicken"];
    const matCard = materialsInStack.find(c => animalTypes.includes(c.type));
    if (matCard) {
      const activeGrp = [facility, matCard];
      const recipe = RECIPES.find(r => r.inputs.slaughterhouse && r.inputs[matCard.type] === 1);
      return { activeGrp, recipe };
    }
  }
  else if (facility.type === "market") {
    const sellCard = materialsInStack.find(c => {
      if (c.type === "market") return false;
      const d = def(c.type);
      return d.sell !== null && d.sell !== undefined && d.sell > 0;
    });
    if (sellCard) {
      const activeGrp = [facility, sellCard];
      const recipe = RECIPES.find(r => r.inputs.market && r.inputs.__sellable__ === 1);
      return { activeGrp, recipe };
    }
  }

  return null;
}

function tryStartCraft(dropped) {
  const grp = connected(dropped);

  // 1. 予約機能対象の施設アクションか判定
  const res = getActiveReservationGroupAndRecipe(grp);
  if (res) {
    discoveredRecipes.add(res.recipe);
    const key = gKey(res.activeGrp);
    if (!progressMap[key]) {
      progressMap[key] = { progress: 0, recipe: res.recipe };
    }
    return;
  }

  // 1.5. 家畜の柵の特別処理（並列クラフト開始）
  const fence = grp.find(c => c.type === "livestock_fence");
  if (fence) {
    const friendlies = grp.filter(c => def(c.type).attr === "friendly");
    for (const animal of friendlies) {
      const pair = [fence, animal];
      const r = matchRecipe(pair);
      if (r) {
        discoveredRecipes.add(r);
        const key = gKey(pair);
        if (!progressMap[key]) {
          progressMap[key] = { progress: 0, recipe: r };
        }
      }
    }
    return;
  }

  // 2. 通常のクラフト開始判定
  const recipe = matchRecipe(grp);
  if (!recipe) return;
  discoveredRecipes.add(recipe);
  const key = gKey(grp);
  if (progressMap[key]) return;
  progressMap[key] = { progress: 0, recipe };
}

// ════════════════════════════════════════════════
// 更新ループ
// ════════════════════════════════════════════════
function updateTooltip() {
  let el = document.getElementById("cardDescription");
  if (!el) return;

  // カードホバー状態を再計算（カード移動・消滅対応）
  if (lastMousePos && !gameOver) {
    const rect = canvas.getBoundingClientRect();
    const wp = s2w(lastMousePos.x - rect.left, lastMousePos.y - rect.top - UI_H);
    const hit = hitCard(wp.x, wp.y);
    hoveredCard = hit ? hit.card : null;
    if (dragging) hoveredCard = dragging;
  }

  let html = "";

  if (hoveredUI) {
    // ── UI要素の説明 ──
    const uId = typeof hoveredUI === "string" ? hoveredUI : hoveredUI.id;
    if (uId === "dayLabel" || uId === "dayBarWrap") {
      if (inUnderworld) {
        const remain = Math.max(0, (DAY_MS - uwDayTimer) / 1000).toFixed(1);
        html = `<div style="color:#e8b84b;font-weight:bold;margin-bottom:4px;">死の呪いまで${uwDayLimit}日</div>`
          + `<div style="font-size:11px;color:#bbb;">日が暮れるまであと <span style="color:#fff;font-family:monospace;">${remain}秒</span></div>`;
      } else {
        const remain = Math.max(0, (DAY_MS - dayTimer) / 1000).toFixed(1);
        html = `<div style="color:#e8b84b;font-weight:bold;margin-bottom:4px;">${dayCount}日目</div>`
          + `<div style="font-size:11px;color:#bbb;">日が暮れるまであと <span style="color:#fff;font-family:monospace;">${remain}秒</span></div>`;
      }
    } else if (uId === "cardCount") {
      html = `<div style="color:#fff;font-weight:bold;margin-bottom:4px;">カード上限</div>`
        + `<div style="font-size:11px;color:#bbb;">現在のカード枚数 / 上限枚数<br>上限を超えると、一日の終わりに上限までカードを売却する必要がある</div>`;
    } else if (uId === "foodStatus") {
      if (inUnderworld) {
        html = `<div style="color:#fff;font-weight:bold;margin-bottom:4px;">食糧状況</div>`
          + `<div style="font-size:11px;color:#bbb;">冥界では食事は必要ない</div>`;
      } else {
        html = `<div style="color:#fff;font-weight:bold;margin-bottom:4px;">食糧状況</div>`
          + `<div style="font-size:11px;color:#bbb;">盤面上の食糧の満腹度合計 / 必要な満腹度</div>`;
      }
    } else if (uId === "emeraldStatus") {
      if (inUnderworld) {
        html = `<div style="color:#fff;font-weight:bold;margin-bottom:4px;">冥銭</div>`
          + `<div style="font-size:11px;color:#bbb;">所持している冥銭の総数<br>ショップでのパック購入などに使用する</div>`;
      } else {
        html = `<div style="color:#fff;font-weight:bold;margin-bottom:4px;">エメラルド</div>`
          + `<div style="font-size:11px;color:#bbb;">所持しているエメラルドの総数<br>ショップでのパック購入などに使用する</div>`;
      }
    } else if (uId.startsWith("packShop") || uId.startsWith("uwPackShop")) {
      const pTableMap = { packShopA: PACK_A, packShopB: PACK_B, packShopC: PACK_C, packShopD: PACK_D, packShopE: PACK_E, packShopF: PACK_F, packShopG: PACK_G, packShopH: PACK_H, uwPackShopA: UW_PACK_A, uwPackShopB: UW_PACK_B, uwPackShopC: UW_PACK_C, uwPackShopD: UW_PACK_D };
      const pRecipeMap = { packShopA: PACK_A_RECIPES, packShopB: PACK_B_RECIPES, packShopC: PACK_C_RECIPES, packShopD: PACK_D_RECIPES, packShopE: PACK_E_RECIPES, packShopF: PACK_F_RECIPES, packShopG: PACK_G_RECIPES, packShopH: PACK_H_RECIPES, uwPackShopA: UW_PACK_A_RECIPES, uwPackShopB: UW_PACK_B_RECIPES, uwPackShopC: UW_PACK_C_RECIPES, uwPackShopD: UW_PACK_D_RECIPES };
      const pTable = pTableMap[uId];
      const pTag = pRecipeMap[uId];

      if (pTable) {
        const pElem = document.getElementById(uId);
        const pName = pElem?.querySelector(".ps-name")?.textContent ?? "";
        const pCostNum = pElem?.querySelector(".ps-num")?.textContent ?? "";

        const allPackCards = pTable.map(i => i.type);
        const discoveredInPack = allPackCards.filter(t => discoveredCards.has(t));
        const undiscoveredCardsCount = new Set(allPackCards.filter(t => !discoveredCards.has(t))).size;

        const allPackRecipes = RECIPES.filter(r => r.recipeTag === pTag);
        const undiscoveredRecipesCount = allPackRecipes.filter(r => {
          const idx = RECIPES.indexOf(r);
          return !discoveredRecipes.has(r) && !ownedRecipes.has(idx);
        }).length;

        html = `<div style="color:#e8b84b;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${pName}</div>`;
        html += `<div style="font-size:11px;color:#c8b860;margin-bottom:8px;">値段: ${pCostNum}</div>`;
        html += `<div style="font-size:11px;color:#bbb;">未発見のカード：${undiscoveredCardsCount}種</div>`;
        html += `<div style="font-size:11px;color:#bbb;margin-bottom:8px;">未発見のレシピ：${undiscoveredRecipesCount}種</div>`;

        if (discoveredInPack.length > 0) {
          html += `<div style="font-size:10px;color:#888;margin-bottom:2px;border-top:1px solid #333;padding-top:4px;">発見済みのカード：</div>`;
          const uniqueD = Array.from(new Set(discoveredInPack));
          uniqueD.forEach(t => { html += `<div style="font-size:10px;color:#aaa;">・${def(t).label}</div>`; });
        }
      }
    } else if (uId === "initPackCard") {
      html = `<div style="color:#e8b84b;font-weight:bold;margin-bottom:4px;">冒険の始まり</div>`
        + `<div style="font-size:11px;color:#bbb;">ここをクリックして冒険を始める</div>`;
    }
  } else if (hoveredCard) {
    const c = hoveredCard;
    const d = def(c.type);

    // ── ステータスアイコンへのホバー検出 ──
    if (c.status && lastMousePos && !dragging) {
      const STATUS_TOOLTIPS = {
        stun:      { label: "気絶",   color: "#ffeb3b", desc: "一定時間、行動不能になる。\nスタン効果中は攻撃ができず、解除まで無防備な状態が続く。" },
        poison:    { label: "毒",     color: "#bb44ff", desc: "毒を受けると、10秒ごとにHPが1減少する。\n毒の効果は戦闘が終わるか、回復を受けるまで持続する。" },
        bleed:     { label: "出血",   color: "#ff4444", desc: "2秒ごとにHPが1減少する。\n効果は6秒間持続する。" },
        invincible:{ label: "無敵",   color: "#b088ff", desc: "一定時間、あらゆるダメージを無効化する。\n効果中は攻撃を受けても被ダメージが0になる。" },
        frenzy:    { label: "狂乱",   color: "#ff9800", desc: "クリティカル率が上がるが、命中率が下がる。\n効果が切れると通常状態に戻る。" },
      };
      const rect = canvas.getBoundingClientRect();
      const wp = s2w(lastMousePos.x - rect.left, lastMousePos.y - rect.top - UI_H);
      const iconSize = 12;
      const hitR = iconSize; // ヒット半径を少し大きくして当てやすく
      let sX = c.x + 4;
      const sY = c.y + 54;
      const statusOrder = [
        { key: "stun",       active: c.status.stun > 0 },
        { key: "poison",     active: !!c.status.poison },
        { key: "bleed",      active: c.status.bleed > 0 },
        { key: "invincible", active: c.status.invincible > 0 },
        { key: "frenzy",     active: c.status.frenzy > 0 },
      ];
      for (const s of statusOrder) {
        if (s.active) {
          const cx = sX + iconSize / 2;
          const cy = sY + iconSize / 2;
          const dx = wp.x - cx, dy = wp.y - cy;
          if (dx * dx + dy * dy <= hitR * hitR) {
            const st = STATUS_TOOLTIPS[s.key];
            if (st) {
              html = `<div style="color:${st.color};font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">【状態異常】${st.label}</div>`;
              html += `<div style="font-size:11px;color:#bbb;line-height:1.6;">${st.desc.replace(/\n/g, '<br>')}</div>`;
            }
            break;
          }
          sX += iconSize + 4;
        }
      }
    }

    let grp = connected(c);
    if (dragging) {
      const dragIds = new Set(isDragGroup ? groupCards.map(gc => gc.id) : [dragging.id]);
      grp = grp.filter(gc => dragIds.has(gc.id));
    }
    const key = gKey(grp);
    const prog = progressMap[key];

    // ── ゲート転送中の説明（不安定/安定ゲート共通） ──
    // gateSendTimer が動いている間は、クラフト進捗より優先して「転送中」を表示する
    const gate = grp.find(x => x.type === "unstable_gate" || x.type === "stable_gate");
    if (gate) {
      const humansOnGate = cards.filter(h =>
        h.type === "human" && h.gateId === gate.id
      );
      if (humansOnGate.length > 0 && gate.gateSendTimer !== null && gate.gateSendTimer !== undefined) {
        const remain = Math.max(0, gate.gateSendTimer / 1000).toFixed(1);
        html = `<div style="color:#b088ff;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${humansOnGate.length}人を暗黒の森に転送中</div>`;
        html += `<div style="font-size:11px;color:#ccc;">残り時間: <span style="color:#fff;font-family:monospace;">${remain}秒</span></div>`;
      }
    }
    const door = grp.find(x => x.type === "underworld_door");
    if (door) {
      const humansOnDoor = cards.filter(h =>
        h.type === "human" && h.doorId === door.id
      );
      if (humansOnDoor.length > 0 && door.doorSendTimer !== null && door.doorSendTimer !== undefined) {
        const remain = Math.max(0, door.doorSendTimer / 1000).toFixed(1);
        html = `<div style="color:#b088ff;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${humansOnDoor.length}人を冥界に転送中</div>`;
        html += `<div style="font-size:11px;color:#ccc;">残り時間: <span style="color:#fff;font-family:monospace;">${remain}秒</span></div>`;
      }
    }
    const ferry = grp.find(x => x.type === "ferry");
    if (ferry) {
      const onFerry = getFerryStack(ferry);
      const humanOnFerry = onFerry.find(h => h.type === "human");
      if (humanOnFerry && ferry.ferrySendTimer !== null && ferry.ferrySendTimer !== undefined) {
        const remain = Math.max(0, ferry.ferrySendTimer / 1000).toFixed(1);
        const cargoCount = onFerry.filter(c => c.type !== "human").length;
        html = `<div style="color:#b088ff;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">渡し舟で拠点へ帰還中</div>`;
        html += `<div style="font-size:11px;color:#ccc;">村人1人 / 荷物${cargoCount}枚</div>`;
        html += `<div style="font-size:11px;color:#ccc;">残り時間: <span style="color:#fff;font-family:monospace;">${remain}秒</span></div>`;
      }
    }

    if (!html && prog) {
      let title = "";
      const searchCard = grp.find(c => def(c.type).attr === "search");
      if (searchCard) {
        title = `${def(searchCard.type).label}を探索中`;
      } else {
        title = prog.recipe.desc ? prog.recipe.desc : `${def(getMostProbableOutput(prog.recipe)).label}を生産中`;
      }
      const speedMult = craftSpeedMultForGroup(grp, prog.recipe);
      const remain = Math.max(0, (prog.recipe.time - (prog.progress / 1000)) * speedMult).toFixed(1);
      html = `<div style="color:#e8b84b;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${title}</div>`;
      html += `<div style="font-size:11px;color:#ccc;">残り時間: <span style="color:#fff;font-family:monospace;">${remain}秒</span></div>`;
    } else if (!html && grp.length > 1) {
      html = `<div style="color:#fff;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">カードの束</div>`;
      const counts = {};
      grp.forEach(gc => { const label = def(gc.type).label; counts[label] = (counts[label] || 0) + 1; });
      for (const [name, count] of Object.entries(counts)) {
        html += `<div style="font-size:11px;color:#bbb;">${name} ×${count}</div>`;
      }
    } else if (!html && c.type === "recipe_card") {
      const rIdx = c.recipeIdx;
      const r = RECIPES[rIdx];
      if (!r) { html = "未知のレシピです"; }
      else {
        const outType = getMostProbableOutput(r);
        const outName = def(outType).label;
        const outDesc = def(outType).desc || "説明はありません";
        html = `<div style="color:#6a6aaa;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">生成: ${outName}</div>`;
        for (const [inType, inCount] of Object.entries(r.inputs)) {
          html += `<div style="font-size:11px;color:#bbb;">${def(inType).label} ×${inCount}</div>`;
        }
        html += `<div style="margin-top:8px;font-size:11px;color:#888;font-style:italic;">${outDesc}</div>`;
      }
    } else if (!html && c.type === "pack_card") {
      let pName = "カードパック";
      if (c.packId) {
        const pElem = document.getElementById(c.packId);
        if (pElem) {
          const psNameEl = pElem.querySelector(".ps-name");
          if (psNameEl) pName = psNameEl.textContent;
        }
      } else {
        pName = "冒険の始まりパック";
      }
      const remain = c.totalCount - c.currentIndex;
      html = `<div style="color:#e8b84b;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${pName}</div>`;
      html += `<div style="font-size:11px;color:#c8b860;margin-bottom:8px;">残り枚数: <span style="color:#fff;font-family:monospace;font-weight:bold;">${remain}</span> / ${c.totalCount}</div>`;
      html += `<div style="font-size:11px;color:#bbb;line-height:1.4;">クリックまたはタップするたびに、カードが1枚ずつ排出されます。すべて排出し終えるとこのパックは消滅します。</div>`;
    } else if (!html && d.attr === "search") {
      const label = cardLabel(c);
      const desc = d.desc || "説明はありません";

      const searchRecipe = RECIPES.find(r => r.inputs[c.type] === 1);
      const allSearchCards = searchRecipe ? searchRecipe.variants.filter(v => v.out !== "__recipe__").map(v => v.out) : [];
      const discoveredInSearch = allSearchCards.filter(t => discoveredCards.has(t));
      const undiscoveredCardsCount = new Set(allSearchCards.filter(t => !discoveredCards.has(t))).size;

      let undiscoveredRecipesCount = 0;
      const hasRecipeOutput = searchRecipe && searchRecipe.variants.some(v => v.out === "__recipe__");
      if (hasRecipeOutput) {
        const pFilter = searchRecipe.exploreRecipes || searchRecipe.recipeTag || null;
        undiscoveredRecipesCount = RECIPES.filter((r, idx) => {
          if (!r.recipeTag || ownedRecipes.has(idx) || discoveredRecipes.has(r)) return false;
          if (pFilter === null) return true;
          if (typeof pFilter === "string") return r.recipeTag === pFilter;
          if (Array.isArray(pFilter)) return pFilter.includes(r.recipeTag);
          return true;
        }).length;
      }

      html = `<div style="color:#fff;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${label}</div>`;
      html += `<div style="font-size:11px;color:#bbb;line-height:1.4;margin-bottom:12px;">${desc.replace(/\n/g, '<br>')}</div>`;

      html += `<div style="font-size:11px;color:#bbb;">未発見のカード：${undiscoveredCardsCount}種</div>`;
      html += `<div style="font-size:11px;color:#bbb;margin-bottom:12px;">未発見のレシピ：${undiscoveredRecipesCount}種</div>`;

      if (discoveredInSearch.length > 0) {
        html += `<div style="font-size:10px;color:#888;margin-bottom:4px;border-top:1px solid #333;padding-top:6px;">発見済みのカード：</div>`;
        const uniqueD = Array.from(new Set(discoveredInSearch));
        uniqueD.forEach(t => { html += `<div style="font-size:10px;color:#aaa;margin-bottom:2px;">・${def(t).label}</div>`; });
      }
    } else if (!html) {
      const label = cardLabel(c);
      let desc = (d.attr === "human" && c.job) ? (JOB_EFFECTS[c.job].desc || d.desc) : (d.desc || "説明はありません");
      // 図書館：残レシピ数で説明文を差し替え
      if (c.type === "library") {
        const libRecipeDef = RECIPES.find(r => r.inputs.library && r.inputs.emerald);
        const libFilter = libRecipeDef ? (libRecipeDef.exploreRecipes || libRecipeDef.recipeTag || null) : null;
        const hasLibRecipe = RECIPES.some((r, idx) => {
          if (!r.recipeTag || ownedRecipes.has(idx)) return false;
          if (libFilter === null) return true;
          if (typeof libFilter === "string") return r.recipeTag === libFilter;
          if (Array.isArray(libFilter)) return libFilter.includes(r.recipeTag);
          return true;
        });
        if (!hasLibRecipe) desc = "もうここには新しいレシピはないようだ";
      }
      html = `<div style="color:#fff;font-weight:bold;border-bottom:1px solid #444;padding-bottom:4px;margin-bottom:6px;">${label}</div>`;
      if (d.maxHp !== undefined) {
        const stats = combatStats(c);
        html += `<div style="font-size:10px;color:#f88;margin-bottom:4px;">HP:${Math.floor(c.hp)}/${stats.maxHp} ATK:${stats.atk} DEF:${stats.def} SPD:${stats.atkSpeed.toFixed(1)}s</div>`;

        let equips = [];
        if (c.jobCardType) equips.push(`武器: ${def(c.jobCardType).label}`);
        if (c.armorCardType) equips.push(`防具: ${def(c.armorCardType).label}`);
        if (c.accessoryCardType) equips.push(`装飾品: ${def(c.accessoryCardType).label}`);
        if (equips.length > 0) {
          html += `<div style="font-size:10px;color:#ffd850;margin-bottom:4px;">装備: ${equips.join(" / ")}</div>`;
          html += `<div style="font-size:9px;color:#888;margin-bottom:6px;">※ダブルクリックで一括解除</div>`;
        }
      } else if (d.sell !== null && d.sell !== undefined) {
        html += `<div style="font-size:10px;color:#c8b860;margin-bottom:4px;">売却値: 💎×${d.sell}</div>`;
      }
      html += `<div style="font-size:11px;color:#bbb;line-height:1.4;">${desc.replace(/\n/g, '<br>')}</div>`;
      if (d.cursedLimit !== undefined && inUnderworld) {
        html += `<div style="font-size:11px;color:#f88;margin-bottom:4px;">瘴気で汚染中..  あと${c.cursedLimit}日</div>`;
      }
    }
  }

  if (lastTooltipContent !== html) {
    el.innerHTML = html;
    lastTooltipContent = html;
    el.parentElement.scrollTop = 0;
    tooltipScrollY = 0;
    tooltipWaitTimer = 0;
  }
}

function updateTooltipScroll(dt) {
  const container = document.getElementById("sidebarBottom");
  if (!container) return;

  if (container.scrollHeight > container.clientHeight) {
    if (tooltipWaitTimer > 0) {
      tooltipWaitTimer -= dt;
      if (tooltipWaitTimer <= 0) {
        container.scrollTop = 0;
        tooltipScrollY = 0;
      }
    } else {
      tooltipScrollY += (dt / 1000) * 30; // 30px/sec
      container.scrollTop = tooltipScrollY;

      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 1) {
        tooltipWaitTimer = 1000; // 1秒待機
      }
    }
  } else {
    container.scrollTop = 0;
    tooltipScrollY = 0;
    tooltipWaitTimer = 0;
  }
}

function updatePackBadges() {
  const pTableMap = { packShopA: PACK_A, packShopB: PACK_B, packShopC: PACK_C, packShopD: PACK_D, packShopE: PACK_E, packShopF: PACK_F, packShopG: PACK_G, packShopH: PACK_H, uwPackShopA: UW_PACK_A, uwPackShopB: UW_PACK_B, uwPackShopC: UW_PACK_C, uwPackShopD: UW_PACK_D };
  const pRecipeMap = { packShopA: PACK_A_RECIPES, packShopB: PACK_B_RECIPES, packShopC: PACK_C_RECIPES, packShopD: PACK_D_RECIPES, packShopE: PACK_E_RECIPES, packShopF: PACK_F_RECIPES, packShopG: PACK_G_RECIPES, packShopH: PACK_H_RECIPES, uwPackShopA: UW_PACK_A_RECIPES, uwPackShopB: UW_PACK_B_RECIPES, uwPackShopC: UW_PACK_C_RECIPES, uwPackShopD: UW_PACK_D_RECIPES };

  ALL_PACK_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || !unlockedPacks.has(id) || el.classList.contains("locked")) return;

    const badge = el.querySelector(".ps-badge");
    if (!badge) return;

    badge.classList.remove("red", "blue");

    if (!openedPacks.has(id)) {
      badge.classList.add("red");
    } else {
      // 未発見のカードまたはレシピがあるかチェック
      const pTable = pTableMap[id];
      const pTag = pRecipeMap[id];

      const hasUndiscoveredCard = pTable.some(i => !discoveredCards.has(i.type));
      const hasUndiscoveredRecipe = RECIPES.some((r, idx) => {
        return r.recipeTag === pTag && !discoveredRecipes.has(r) && !ownedRecipes.has(idx);
      });

      if (hasUndiscoveredCard || hasUndiscoveredRecipe) {
        badge.classList.add("blue");
      }
    }
  });
}

function update(dt) {
  if (!gameActive || gamePaused || mealPhase || gameOver || packOpen) return;

  // 空間グリッドの再構築
  spatialGrid.clear();
  for (const c of cards) {
    spatialGrid.register(c);
  }

  updateWorldSize();
  updateCardCount();
  updatePackBadges();
  updateTooltip();
  updateTooltipScroll(dt);
  updateAnimations(dt);
  updateCameraAnim(dt); // カメラ演出
  const effDt = cameraAnim ? 0 : dt * gameSpeed; // ゲームスピード込みの経過時間。ズーム演出中は時間停止
  updateBoardCorruption(dt); // 侵食・破片は常に実時間で進行
  updateMobMovement(effDt);     // 拠点・暗黒の森どちらも同じ速度で動く
  updateBattles(effDt);         // 戦闘も同じ速度
  applyRepulsion();
  updateQuestProgressBadges(); // 進捗バッジをリアルタイム更新
  updateGates(inDarkForest ? 0 : effDt); // 暗黒の森中はゲートタイマー停止
  updateUnderworldDoor(inUnderworld ? 0 : effDt);
  updateFerry(inUnderworld ? effDt : 0);
  if (inDarkForest && darkForestState) { updateDarkForest(); }
  if (sellPhase) { updateSellBanner(); return; }
  const eff = (inDarkForest || inUnderworld) ? 0 : effDt; // 暗黒の森中は拠点時間停止（dayTimer等）
  const uwEff = inUnderworld ? effDt : 0;
  // if (eff <= 0) return;

  if (dayStarted) {
    if (!debugTimeFrozen) {
      dayTimer += eff;
    }
    const ratio = Math.min(dayTimer / DAY_MS, 1);
    document.getElementById("dayBar").style.width = (ratio * 100) + "%";
    document.getElementById("dayLabel").textContent = `${dayCount}日目`;
    if (dayTimer >= DAY_MS) {
      dayTimer = 0; dayCount++;
      if (dayCount >= 7) completeQuest("qG1");
      if (dayCount >= 14) completeQuest("qG2");
      if (dayCount >= 30) completeQuest("qG3");
      startMealPhase(); return;
    }
  }
  if (dayStarted && inUnderworld) {
    if (!debugTimeFrozen) {
      uwDayTimer += uwEff;
    }
    const ratio = Math.min(uwDayTimer / DAY_MS, 1);
    document.getElementById("dayBar").style.width = (ratio * 100) + "%";
    document.getElementById("dayLabel").textContent = `死の呪いまで${uwDayLimit}日`;
    if (uwDayTimer >= DAY_MS) {
      uwDayTimer = 0; uwDayLimit--; uwDayCount++;
      const dolls = cards.filter(c => def(c.type).attr === "human" && c.type !== "human");
      for (const doll of dolls) {
        const dropDoll = doll.type === "wood_soul_doll" ? "wood_doll"
          : doll.type === "stone_soul_doll" ? "stone_doll"
            : doll.type === "iron_soul_doll" ? "iron_doll"
              : doll.type === "gold_soul_doll" ? "gold_doll"
                : doll.type === "cursed_wood_soul_doll" ? "cursed_wood_doll"
                  : doll.type === "dead_stone_soul_doll" ? "dead_stone_doll"
                    : doll.type === "uw_iron_soul_doll" ? "uw_iron_doll"
                      : doll.type === "uw_gold_soul_doll" ? "uw_gold_doll"
                        : null;
        mkCard(dropDoll, doll.x, doll.y);

        // ソウルドールが人形に戻る際の装備ドロップ
        if (doll.jobCardType) {
          const ep = findFreePos(doll.x, doll.y);
          mkCard(doll.jobCardType, ep.x, ep.y);
        }
        if (doll.armorCardType) {
          const ep = findFreePos(doll.x, doll.y);
          mkCard(doll.armorCardType, ep.x, ep.y);
        }
        if (doll.accessoryCardType) {
          const ep = findFreePos(doll.x, doll.y);
          mkCard(doll.accessoryCardType, ep.x, ep.y);
        }

        cards = cards.filter(c => c !== doll);
      }
      applyUnderworldDecay();
      startMealPhase();
      return;
    }
  }

  const allGroupsCached = allGroupsForCraft();
  for (const g of allGroupsCached) {
    // 1. 予約機能対象の特別な施設アクションかどうかを判定
    const res = getActiveReservationGroupAndRecipe(g);
    if (res) {
      const activeKey = gKey(res.activeGrp);
      if (!progressMap[activeKey]) {
        progressMap[activeKey] = { progress: 0, recipe: res.recipe };
      }
      continue;
    }

    // 1.5. 家畜の柵の特別処理（並列クラフト開始）
    const fence = g.find(c => c.type === "livestock_fence");
    if (fence) {
      const friendlies = g.filter(c => def(c.type).attr === "friendly");
      for (const animal of friendlies) {
        const pair = [fence, animal];
        const r = matchRecipe(pair);
        if (r) {
          const key = gKey(pair);
          if (!progressMap[key]) {
            progressMap[key] = { progress: 0, recipe: r };
          }
        }
      }
      continue;
    }

    // 2. 通常のクラフト処理
    const key = gKey(g);
    if (!progressMap[key] && !isLibraryCrafting(g[0])) {
      const r = matchRecipe(g);
      if (r) {
        progressMap[key] = { progress: 0, recipe: r };
      }
    }
  }

  const newPM = {}, byKey = {};
  for (const g of allGroupsCached) byKey[gKey(g)] = g;
  const dragGroupIdSet = (isDragGroup && groupCards.length > 0) ? new Set(groupCards.map(c => c.id)) : new Set();

  for (const [key, info] of Object.entries(progressMap)) {
    const craftIds = new Set(key.split(",").map(Number));
    if (isDragGroup && dragGroupIdSet.size > 0) {
      const allInDrag = [...craftIds].every(id => dragGroupIdSet.has(id));
      if (allInDrag) {
        let npDrag = 0;
        if (inUnderworld) {
          npDrag = info.progress + uwEff;
        } else {
          npDrag = info.progress + eff;
        }
        newPM[key] = { progress: Math.min(npDrag, info.recipe.time * 1000), recipe: info.recipe };
        continue;
      }
    }
    const isLibraryAction = info.recipe.inputs.library && info.recipe.inputs.emerald;
    let grp = byKey[key];
    if (!grp && !isLibraryAction) {
      // 厳密な一致がない場合（斥力などで他カードが触れた場合）、このIDセットを全て含むグループを探す
      grp = allGroupsCached.find(g => craftIds.size <= g.length && [...craftIds].every(id => g.some(c => c.id === id)));
    }
    if (isLibraryAction && !grp) {
      const libCard = cards.find(c => c.id.toString() === key);
      if (libCard) grp = [libCard];
    }
    if (!grp) {
      // 物理グループが見つからなくても、檻や柵に収容されているカードが含まれる場合は進捗を一時停止（維持）
      const cardsInCraft = [...craftIds].map(id => cards.find(c => c.id === id)).filter(Boolean);
      if (cardsInCraft.length === craftIds.size && cardsInCraft.length > 0) {
        const hasFenceOrCageInfo = cardsInCraft.some(c => c.fencedIn || c.cagedIn);
        if (hasFenceOrCageInfo) {
          newPM[key] = { progress: info.progress, recipe: info.recipe };
          continue;
        }
      }
      continue;
    }

    const ids = [...craftIds];
    const baseGrp = ids.map(id => cards.find(c => c.id === id)).filter(Boolean);
    if (baseGrp.length !== ids.length) continue;

    // もしグループが拡大している場合
    if (grp.length > baseGrp.length) {
      const altRecipe = matchRecipe(grp);
      if (altRecipe && altRecipe !== info.recipe) {
        // 新しいレシピが成立するなら、古いクラフトを中断して削除（newPMにコピーしない）
        continue;
      }
      // 予約システム対象の施設アクションは、追加で無関係なカードが重ねられても一時停止しない
      const isReservationAction = baseGrp.some(c => ["plank_factory", "brick_factory", "glass_factory", "composter", "furnace", "market", "livestock_fence", "monster_cage", "slaughterhouse"].includes(c.type));
      if (!isReservationAction) {
        // 新しいレシピが成立しないなら、無関係なカードが重ねられたとみなして進捗を一時停止
        newPM[key] = { progress: info.progress, recipe: info.recipe };
        continue;
      }
    }

    let recipe = null;
    if (isLibraryAction) {
      recipe = info.recipe;
    } else {
      recipe = matchRecipe(baseGrp);
    }
    if (!recipe || RECIPES.indexOf(recipe) !== RECIPES.indexOf(info.recipe)) continue;
    // 職業ボーナスはbaseGrp（実際の参加者）を渡す
    const speedMult = craftSpeedMultForGroup(baseGrp, recipe);
    const effForCraft = inUnderworld ? uwEff / speedMult : eff / speedMult;
    // かまどレシピは燃料がある場合のみ進行
    if (recipe.furnaceRecipe) {
      const furnaceCard = grp.find(c => c.type === "furnace");
      if (!furnaceCard || (furnaceCard.fuel || 0) <= 0) {
        newPM[key] = { progress: info.progress, recipe }; // 進捗停止
        continue;
      }
    }
    if (recipe.soulFurnaceRecipe) {
      const soulFurnaceCard = grp.find(c => c.type === "soul_furnace");
      if (!soulFurnaceCard || (soulFurnaceCard.fuel || 0) <= 0) {
        newPM[key] = { progress: info.progress, recipe };
        continue;
      }
    }
    const np = info.progress + effForCraft;

    if (np >= recipe.time * 1000) {
      // ── 終焉の盃生成演出（クラフト完了の場合にここで分岐）──
      const isEndGrailRecipeComplete = recipe.variants?.some(v => v.out === "end_grail");
      if (isEndGrailRecipeComplete && !info._endGrailZoomed) {
        info._endGrailZoomed = true;
        delete newPM[key];
        const capturedGrp = [...baseGrp];
        const capturedRecipe = recipe;
        const bc = boardCenter();
        zoomToWorld(bc.x, bc.y, {
          targetScale: getMinScale(),
          zoomDur: 1500,
          returnDur: 1500,
          stopTime: true,
          onZoomDone: () => { finishEndGrailCraft(capturedGrp, capturedRecipe); },
          onComplete: null,
        });
        continue;
      }
      // ── ヨルムンガンド召喚演出（クラフト完了の場合にここで分岐）──
      const isJormungandRecipeComplete = recipe.inputs.temple && recipe.inputs.holy_grail;
      if (isJormungandRecipeComplete && !info._jormungandZoomed) {
        info._jormungandZoomed = true;
        delete newPM[key]; // 通常完了処理をスキップし、onZoomDoneで処理
        const capturedGrp = [...baseGrp];
        const capturedRecipe = recipe;
        const baseCard2 = [...capturedGrp].sort((a, b) => a.y - b.y)[0];
        zoomToWorld(baseCard2.x + CW / 2, baseCard2.y + CH / 2, {
          targetScale: 1.4,
          zoomDur: 1000,   // ズームイン 1.0秒（実時間）
          returnDur: 1000, // カメラ戻り 1.0秒（実時間）
          stopTime: true,
          // ズームイン完了（waitフェーズ開始）時：ヨルムンガンドを生成し　1.0秒後にカメラを戻す
          onZoomDone: () => { finishJormungandCraft(capturedGrp, capturedRecipe); },
          onComplete: null,
        });
        continue; // このキーは onZoomDone で処理するのでループをスキップ
      }
      // ── アビス召喚演出（クラフト完了の場合にここで分岐）──
      const isAbyssRecipeComplete = recipe.inputs.temple && recipe.inputs.end_grail;
      if (isAbyssRecipeComplete && !info._abyssZoomed) {
        info._abyssZoomed = true;
        delete newPM[key]; // 通常完了処理をスキップし、onZoomDoneで処理
        const capturedGrp = [...baseGrp];
        const capturedRecipe = recipe;
        const baseCard2 = [...capturedGrp].sort((a, b) => a.y - b.y)[0];
        zoomToWorld(baseCard2.x + CW / 2, baseCard2.y + CH / 2, {
          targetScale: 1.4,
          zoomDur: 1000,   // ズームイン 1.0秒（実時間）
          returnDur: 1000, // カメラ戻り 1.0秒（実時間）
          stopTime: true,
          // ズームイン完了（waitフェーズ開始）時：アビスを生成し　1.0秒後にカメラを戻す
          onZoomDone: () => { finishAbyssCraft(capturedGrp, capturedRecipe); },
          onComplete: null,
        });
        continue; // このキーは onZoomDone で処理するのでループをスキップ
      }
      // かまどレシピの場合、燃料チェック
      if (recipe.furnaceRecipe) {
        const furnaceCard = grp.find(c => c.type === "furnace");
        const fuelCost = recipe.fuelCost || 1.0;
        if (!furnaceCard || (furnaceCard.fuel || 0) < fuelCost) {
          // 燃料不足：進捗をリセットして待機
          newPM[key] = { progress: 0, recipe };
          toast("熔鉱炉の燃料が足りません！木材を追加してください");
          continue;
        }
        // 燃料を消費
        furnaceCard.fuel = Math.round((furnaceCard.fuel - fuelCost) * 10) / 10;
      }
      if (recipe.soulFurnaceRecipe) {
        const soulFurnaceCard = grp.find(c => c.type === "soul_furnace");
        const soulFuelCost = recipe.fuelCost || 1.0;
        if (!soulFurnaceCard || (soulFurnaceCard.fuel || 0) < soulFuelCost) {
          // 燃料不足：進捗をリセットして待機
          newPM[key] = { progress: 0, recipe };
          toast("霊魂炉の燃料が足りません！霊魂を追加してください");
          continue;
        }
        // 燃料を消費
        soulFurnaceCard.fuel = Math.round((soulFurnaceCard.fuel - soulFuelCost) * 10) / 10;
      }
      const keepAttrs = recipe.keepAttrs || [], toRemove = [], toKeep = [], autoRestart = [];
      const sortedGrp = [...baseGrp].sort((a, b) => a.y - b.y);
      const baseCard = sortedGrp[0], baseX = baseCard.x, baseY = baseCard.y;
      for (const c of sortedGrp) {
        const d = def(c.type);
        if (keepAttrs.includes(d.attr)) { toKeep.push(c); }
        else if (d.attr === "resource") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); autoRestart.push(c); } }
        else if (d.attr === "tool") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); } }
        else { toRemove.push(c); }
      }
      cards = cards.filter(c => !toRemove.includes(c));

      // 予約システム対象施設の素材消費に伴う位置調整（スライド移動）
      const facility = grp.find(c => ["plank_factory", "brick_factory", "glass_factory", "composter", "furnace", "market", "slaughterhouse"].includes(c.type));
      if (facility && toRemove.length > 0) {
        const consumedCards = [...toRemove];
        for (const c of cards) {
          if (grp.some(gc => gc.id === c.id) && c.id !== facility.id && !toRemove.includes(c)) {
            // 自分よりY座標が小さい（＝自分の下にある）消費素材カードの枚数分だけスライドさせる
            const shiftCount = consumedCards.filter(cc => cc.y < c.y).length;
            if (shiftCount > 0) {
              c.y -= shiftCount * 24;
            }
          }
        }
      }
      // toKeepをY順に並べてから配置し直す（重なり順の維持）
      toKeep.sort((a, b) => a.y - b.y);
      const hasFenceOrCage = toKeep.some(c => c.type === "livestock_fence" || c.type === "monster_cage");
      if (!hasFenceOrCage) {
        toKeep.forEach((c, i) => { const p = worldClamp(baseX, baseY + i * 24); c.x = p.x; c.y = p.y; });
      }

      // 特殊アクションの処理
      if (recipe.specialType === "heal") {
        baseGrp.forEach(c => {
          if (def(c, type).attr === "human") {
            const stats = combatStats(c);
            c.hp = Math.min(stats.maxHp, (c.hp || stats.maxHp) + recipe.healAmount);
            floatingTexts.push({ x: c.x + CW / 2, y: c.y, text: `+${recipe.healAmount}`, color: "#4f4", t: 0, dur: 1000 });
            completeQuest("qF5"); // 教会回復クエスト
            // 毒・出血を治療！
            if (c.status) {
              if (c.status.poison || c.status.bleed > 0) {
                c.status.poison = false;
                c.status.bleed = 0;
                delete c.status.poisonTimer;
                delete c.status.bleedTimer;
                floatingTexts.push({ x: c.x + CW / 2, y: c.y - 15, text: "Cured!", color: "#4f4", t: 0, dur: 1000 });
              }
            }
          }
        });
      } else if (recipe.specialType === "sell_multiplier") {
        const sellable = baseGrp.find(c => {
          if (c.type === "market") return false; // 市場自体は売却しない！
          const d = def(c.type);
          return d.sell !== null && d.sell !== undefined && d.sell > 0;
        });
        if (sellable) {
          const val = def(sellable.type).sell * (sellable.stack || 1) * (recipe.multiplier || 1);
          addCurrency(val, baseX, baseY);
          cards = cards.filter(c => c !== sellable);
          completeQuest("qF4"); // 市場売却クエスト
        }
      } else if (recipe.specialType === "soul_return") {
        // クラフト素材の中から cursed カードを探し、その soulAmount の数だけ soul を生成
        const placed = [];
        for (const c of baseGrp) {
          if (def(c.type).attr !== "cursed") continue;
          const count = def(c.type).soulAmount || 0;
          for (let i = 0; i < count; i++) {
            const p = findFreePosAvoiding(baseX, baseY, placed);
            placed.push({ x: p.x, y: p.y, w: CW, h: CH });
            spawnCardAnimated("soul", baseX, baseY, p.x, p.y);
          }
        }
        completeQuest("qI2");
      } else if (recipe.specialType === "offering") {
        uwDayLimit++;
        completeQuest("qI3");
      } else if (recipe.specialType === "uw_boss") {
        // 冥界ボスイベント起動（霊廟 + 霊魂10個）
        spawnUwBossEvent();
        completeQuest("qI7");
      } else if (recipe.inputs.emerald && recipe.inputs.emerald > 0) {
        // エメラルド消費の処理
        const emeraldCard = baseGrp.find(c => c.type === "emerald");
        if (emeraldCard) {
          emeraldCard.stack -= recipe.inputs.emerald;
          if (emeraldCard.stack <= 0) cards = cards.filter(c => c !== emeraldCard);
        }
      }

      // オートリスタート判定（即時開始処理）
      const shouldAutoRestart = autoRestart.length > 0 || toRemove.length === 0;
      if (shouldAutoRestart) {
        const survivors = toKeep.filter(c => cards.includes(c));
        if (survivors.length > 0) {
          const sortedS = [...survivors].sort((a, b) => a.y - b.y);
          const refX = sortedS[0].x, refY = sortedS[0].y;
          const hasFenceOrCageRestart = sortedS.some(c => c.type === "livestock_fence" || c.type === "monster_cage");
          if (!hasFenceOrCageRestart) {
            sortedS.forEach((c, i) => { const p = worldClamp(refX, refY + i * 24); c.x = p.x; c.y = p.y; });
          }
          const nr = matchRecipe(survivors);
          if (nr) {
            const nk = gKey(survivors);
            newPM[nk] = { progress: 0, recipe: nr };
          }
        }
      }

      // 特殊アクションレシピの場合は、カードの生成を行わずにここで終了（continue）
      if (recipe.specialType) {
        continue;
      }

      let outType = pickOut(recipe);
      if (recipe.variants === search_ancient_city) {
        if (!hasAnyItem("holy_grail")) {
          ancientCitySearchCount++;
          if (ancientCitySearchCount >= 5) {
            outType = "holy_grail";
            ancientCitySearchCount = 0;
          }
        }
      }
      if (!outType) { /* エラー防止 */ }

      // __recipe__の場合はレシピカードを排出して終了（continue）
      if (outType === "__recipe__") {
        const pool = recipe.exploreRecipes || recipe.recipeTag || null;
        const idx = resolveRecipeFromPool(pool);
        if (idx !== null) {
          const p = findFreePos(baseX, baseY);
          gainRecipeCard(idx, p.x, p.y, isLibraryAction); // 図書館フラグを渡す
          const newC = cards[cards.length - 1];
          if (newC && newC.type === "recipe_card") {
            animations.push({ type: "spawn", id: newC.id, fromX: baseX, fromY: baseY, toX: p.x, toY: p.y, t: 0, dur: 500, onComplete: null });
            newC.x = baseX; newC.y = baseY;
          }
        } else {
          // 出るべきレシピが尽きた場合、__recipe__ を除いたテーブルで再抽選して通常カードを排出
          const fallbackVariants = recipe.variants.filter(v => v.out !== "__recipe__");
          if (fallbackVariants.length > 0) {
            const tot = fallbackVariants.reduce((s, v) => s + v.w, 0);
            let rx = Math.random() * tot;
            let fallbackType = fallbackVariants[0].out;
            for (const v of fallbackVariants) { rx -= v.w; if (rx <= 0) { fallbackType = v.out; break; } }
            const p = findFreePos(baseX, baseY);
            spawnCardAnimated(fallbackType, baseX, baseY, p.x, p.y);
          }
        }
        continue;
      }

      const SNAP_DIST = 250;
      let snapTarget = null;
      {
        const sameType = cards.filter(c => c.type === outType && c !== dragging && (!isDragGroup || !groupCards.includes(c)) && !isAnimating(c.id));
        let nearestDist = Infinity;
        for (const sc of sameType) {
          const cx = (sc.x + CW / 2) - baseX, cy = (sc.y + CH / 2) - baseY, dist = Math.sqrt(cx * cx + cy * cy);
          if (dist < nearestDist) { const grpCheck = connected(sc); if (grpCheck.every(gc => gc.type === outType)) { nearestDist = dist; snapTarget = sc; } }
        }
        if (nearestDist >= SNAP_DIST) snapTarget = null;
      }
      let toX, toY;
      if (snapTarget) {
        const grpN = getStack(snapTarget, true); grpN.sort((a, b) => a.y - b.y);
        toX = grpN[0].x; toY = Math.max(...grpN.map(c => c.y)) + 24;
        // 他の進行中のアニメーションで既にここを狙っているものがいないか、競合がなくなるまでループ確認
        let conflicted = true;
        while (conflicted) {
          conflicted = false;
          for (const anim of animations) {
            if (anim.type === "spawn" && Math.abs(anim.toX - toX) < 5 && Math.abs(anim.toY - toY) < 5) {
              toY += 24;
              conflicted = true;
              break;
            }
          }
        }
      }
      else { const pos = findFreePos(baseX, baseY); toX = pos.x; toY = pos.y; }

      const spawnId = nextId;
      const _isJormungand = outType === "jormungand";
      const newCard = spawnCardAnimated(outType, baseX, baseY, toX, toY, {}, () => {
        const nc = cards.find(c => c._spawnId === spawnId); if (!nc) return;
        delete nc._spawnId;
        if (snapTarget && cards.includes(snapTarget)) {
          if (!isAnimating(snapTarget.id)) {
            snapStack(nc, true);
          }
        }
        setTimeout(() => {
          const ex = getCraftExcludeIds();
          const sg = connectedExcluding(nc, ex);
          const sr = matchRecipe(sg);
          if (sr) {
            const sk = gKey(sg);
            if (!progressMap[sk]) progressMap[sk] = { progress: 0, recipe: sr };
          }
        }, 50);
      });
      // 注: ヨルムンガンドはズームイン演出で onZoomDone コールバックにより
      // finishJormungandCraft が呼ばれるため、ここには到達しない
      newCard._spawnId = spawnId;
      if (outType === "apple" && recipe.inputs.apple_tree) completeQuest("q2"); // リンゴ収穫
      if (outType === "stone" || outType === "flint") {
        if (recipe.inputs.rock) completeQuest("q3"); // 岩採掘
      }
      if (outType === "wood") completeQuest("q6"); // 木の伐採
      if (outType === "stick" && recipe.inputs.wood) completeQuest("q7"); // 棒づくり
      if (outType === "apple_tree") completeQuest("q9"); // リンゴの木育成
      if (recipe.inputs.forest) completeQuest("qD1"); // 森林探索
      if (recipe.inputs.mountain) completeQuest("qD2"); // 山探索
      if (outType === "house") { // 家の建築
        completeQuest("q10");
        totalHouseBuilt++;
        if (totalHouseBuilt >= 3) completeQuest("qF1");
      }
      if (outType === "human") { // baby→humanで2人目チェック
        const humanCount = cards.filter(c => c.type === "human").length;
        if (humanCount >= 2) completeQuest("q11");
      }
      if (outType === "baby") completeQuest("q12"); // 子孫を残す
      // 第2章クエスト：各種建築・素材
      if (outType === "iron_ingot" || outType === "gold_ingot") completeQuest("qA1"); // 鉱石精錬
      if (outType === "temple") completeQuest("qA5"); // 神殿建設
      if (outType === "ancient_city") completeQuest("qA4"); // 古代都市
      if (outType === "bonfire") completeQuest("qC1"); // 焚き火
      if (outType === "soil") completeQuest("qC2"); // 土を耕す
      if (outType === "garden") completeQuest("qC3"); // 農園建設
      if (outType === "farm") completeQuest("qC4"); // 農場建設
      if (outType === "stew") completeQuest("qC5"); // シチュー
      if (outType === "dining_table") completeQuest("qC6"); // 食卓建設
      if (outType === "livestock_fence") completeQuest("qC8"); // 家畜の柵
      if (outType === "smithing_table") completeQuest("qB4"); // 鍛冶台
      if (outType === "monster_cage") completeQuest("qB6"); // モンスターの檻
      if (outType === "cemetery") completeQuest("qD5"); // 墓地
      if (outType === "plank") completeQuest("qE3"); // 厚板
      if (outType === "brick") completeQuest("qE4"); // レンガ
      if (outType === "glass") completeQuest("qE5"); // ガラス
      if (outType === "warehouse") { completeSubQuest("sq3"); completeQuest("qF2"); } // 倉庫
      if (outType === "storage") completeQuest("qF3"); // 大倉庫
      if (outType === "plantation" || outType === "quarry") completeSubQuest("sq4");
      // 装飾品クラフト
      if (def(outType) && def(outType).attr === "accessory") completeQuest("qB3");
      if (outType === "bread") completeSubQuest("sq2");
      if (def(outType) && def(outType).attr === "doll") completeQuest("qI4");
      if (recipe.inputs.defilement_spring || recipe.inputs.resentment_swamp) completeQuest("qI6");
    } else { newPM[key] = { progress: np, recipe }; }
  }
  progressMap = newPM;

  // ── 家畜の柵内での独立生産 ──
  // 柵に重なっている家畜を探し、それぞれに対してレシピ判定を行う
  const fencedAnimals = cards.filter(c => c.fencedIn && !isAnimating(c.id));
  for (const a of fencedAnimals) {
    // 既にレシピ進行中の場合はスキップ
    const inRecipe = Object.keys(progressMap).some(k => k.split(",").includes(a.id.toString()));
    if (inRecipe) continue;

    const fence = cards.find(c => c.id === a.fencedIn);
    if (!fence || !overlap(a, fence)) { delete a.fencedIn; continue; }

    // [家畜, 柵] のペアでレシピが成立するかチェック
    const grp = [a, fence];
    const r = matchRecipe(grp);
    if (r) {
      const k = gKey(grp);
      if (!progressMap[k]) progressMap[k] = { progress: 0, recipe: r };
    }
  }
}

/**
 * 終焉の盃のクラフト完了処理（ズームアウト終了後に呼ばれる）
 */
function finishEndGrailCraft(grp, recipe) {
  const sortedGrp = [...grp].sort((a, b) => a.y - b.y);
  const baseCard = sortedGrp[0];
  const baseX = baseCard.x, baseY = baseCard.y;

  const keepAttrs = recipe.keepAttrs || [];
  const toRemove = [], toKeep = [];
  for (const c of sortedGrp) {
    if (!cards.includes(c)) continue;
    const d = def(c.type);
    if (keepAttrs.includes(d.attr)) { toKeep.push(c); }
    else if (d.attr === "resource") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); } }
    else if (d.attr === "tool") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); } }
    else { toRemove.push(c); }
  }
  cards = cards.filter(c => !toRemove.includes(c));

  toKeep.sort((a, b) => a.y - b.y);
  toKeep.forEach((c, i) => { const p = worldClamp(baseX, baseY + i * 24); c.x = p.x; c.y = p.y; });

  const outType = pickOut(recipe) || "end_grail";
  const pos = findFreePos(baseX, baseY);
  const centerX = pos.x + CW / 2;
  const centerY = pos.y + CH / 2;
  const spawnId = nextId;
  const newCard = spawnCardAnimated(outType, baseX, baseY, pos.x, pos.y, {}, () => {
    const nc = cards.find(c => c._spawnId === spawnId); if (!nc) return;
    delete nc._spawnId;
    setTimeout(() => {
      const ex = getCraftExcludeIds();
      const sg = connectedExcluding(nc, ex);
      const sr = matchRecipe(sg);
      if (sr) { const sk = gKey(sg); if (!progressMap[sk]) progressMap[sk] = { progress: 0, recipe: sr }; }
    }, 50);
  });
  if (newCard) newCard._spawnId = spawnId;

  startBoardCorruption(centerX, centerY, true);
  toast("終焉の盃が生まれた…世界が闇に飲まれていく");
}

/**
 * ヨルムンガンドのクラフト完了処理（ズームイン終了後に呼ばれる）
 * gameSpeed=0のズーム中でも確実に実行できるよう独立した関数として分離
 */
function finishJormungandCraft(grp, recipe) {
  const sortedGrp = [...grp].sort((a, b) => a.y - b.y);
  const baseCard = sortedGrp[0];
  const baseX = baseCard.x, baseY = baseCard.y;

  // 素材カードの消費
  const keepAttrs = recipe.keepAttrs || [];
  const toRemove = [], toKeep = [];
  for (const c of sortedGrp) {
    if (!cards.includes(c)) continue; // 既に消去済みなら無視
    const d = def(c.type);
    if (keepAttrs.includes(d.attr)) { toKeep.push(c); }
    else if (d.attr === "resource") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); } }
    else if (d.attr === "tool") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); } }
    else { toRemove.push(c); }
  }
  cards = cards.filter(c => !toRemove.includes(c));

  toKeep.sort((a, b) => a.y - b.y);
  toKeep.forEach((c, i) => { const p = worldClamp(baseX, baseY + i * 24); c.x = p.x; c.y = p.y; });

  // ヨルムンガンドを生成
  const outType = pickOut(recipe);
  const pos = findFreePos(baseX, baseY);
  const spawnId = nextId;
  const newCard = spawnCardAnimated(outType || "jormungand", baseX, baseY, pos.x, pos.y, {}, () => {
    const nc = cards.find(c => c._spawnId === spawnId); if (!nc) return;
    delete nc._spawnId;
    setTimeout(() => {
      const ex = getCraftExcludeIds();
      const sg = connectedExcluding(nc, ex);
      const sr = matchRecipe(sg);
      if (sr) { const sk = gKey(sg); if (!progressMap[sk]) progressMap[sk] = { progress: 0, recipe: sr }; }
    }, 50);
  });
  if (newCard) newCard._spawnId = spawnId;

  toast("🐍 大蛇が解き放たれた");

  // ズーム固定 1.0秒（実時間）後にカメラを戻す
  // setTimeout は gameSpeed=0 中でも実時間で動作する
  setTimeout(() => returnCamera(), 1000);
}

function finishAbyssCraft(grp, recipe) {
  const sortedGrp = [...grp].sort((a, b) => a.y - b.y);
  const baseCard = sortedGrp[0];
  const baseX = baseCard.x, baseY = baseCard.y;

  // 素材カードの消費
  const keepAttrs = recipe.keepAttrs || [];
  const toRemove = [], toKeep = [];
  for (const c of sortedGrp) {
    if (!cards.includes(c)) continue; // 既に消去済みなら無視
    const d = def(c.type);
    if (keepAttrs.includes(d.attr)) { toKeep.push(c); }
    else if (d.attr === "resource") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); } }
    else if (d.attr === "tool") { c.uses = (c.uses || 0) + 1; if (c.maxUses && c.uses >= c.maxUses) { toRemove.push(c); } else { toKeep.push(c); } }
    else { toRemove.push(c); }
  }
  cards = cards.filter(c => !toRemove.includes(c));

  toKeep.sort((a, b) => a.y - b.y);
  toKeep.forEach((c, i) => { const p = worldClamp(baseX, baseY + i * 24); c.x = p.x; c.y = p.y; });

  // アビスを生成
  const outType = pickOut(recipe);
  const pos = findFreePos(baseX, baseY);
  const spawnId = nextId;
  const newCard = spawnCardAnimated(outType || "abyss", baseX, baseY, pos.x, pos.y, {}, () => {
    const nc = cards.find(c => c._spawnId === spawnId); if (!nc) return;
    delete nc._spawnId;
    setTimeout(() => {
      const ex = getCraftExcludeIds();
      const sg = connectedExcluding(nc, ex);
      const sr = matchRecipe(sg);
      if (sr) { const sk = gKey(sg); if (!progressMap[sk]) progressMap[sk] = { progress: 0, recipe: sr }; }
    }, 50);
  });
  if (newCard) newCard._spawnId = spawnId;

  toast("隴ｦ蜻岩國豺ｱ豺ｵ繝ｲ隕励け縺ｪ");

  // ズーム固定 1.0秒（実時間）後にカメラを戻す
  // setTimeout は gameSpeed=0 中でも実時間で動作する
  setTimeout(() => returnCamera(), 1000);
}


// ════════════════════════════════════════════════
// 描画
// ════════════════════════════════════════════════
function drawCard(c, craftProg, craftTotal) {
  const d = def(c.type), as = attrSt(d.attr), { x, y } = c, r = 8;
  const isDrag = (c === dragging) || (isDragGroup && groupCards.includes(c));
  ctx.save();
  if (isDrag) { ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; }

  if (d.attr === "recipe") {
    const rec = c.recipeIdx !== undefined ? RECIPES[c.recipeIdx] : null;
    const outLabel = rec ? def(rec.variants[0].out).label : "レシピ";
    const as2 = attrSt("recipe"), r2 = 8;
    ctx.beginPath(); ctx.roundRect(x, y, CW, CH, r2); ctx.fillStyle = as2.bg; ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y, CW, 24, [r2, r2, 0, 0]); ctx.fillStyle = as2.hd; ctx.fill();
    ctx.fillStyle = "#dde"; ctx.font = "bold 10px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    ctx.fillText(outLabel, x + CW / 2, y + 16);
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.roundRect(x + 3, y + 27, 30, 13, 3); ctx.fill();
    ctx.fillStyle = "#ddd"; ctx.font = "8px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("レシピ", x + 18, y + 37);
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.roundRect(x + CW - 34, y + 27, 31, 13, 3); ctx.fill();
    ctx.fillStyle = "#dde"; ctx.font = "9px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("💎1", x + CW - 18, y + 37);
    if (rec) {
      const inputLines = Object.entries(rec.inputs).map(([k, v]) => `${def(k).label} ×${v}`);
      ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.roundRect(x + 3, y + 43, CW - 6, CH - 47, 3); ctx.fill();
      ctx.fillStyle = "#cce"; ctx.font = "8px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
      inputLines.forEach((line, idx) => ctx.fillText(line, x + CW / 2, y + 54 + idx * 11));
    }
    if (isDrag) { ctx.strokeStyle = "#e8b84b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, CW, CH, r2); ctx.stroke(); }
    ctx.restore(); return;
  }

  ctx.beginPath(); ctx.roundRect(x, y, CW, CH, r); ctx.fillStyle = as.bg; ctx.fill();
  ctx.beginPath(); ctx.roundRect(x, y, CW, 24, [r, r, 0, 0]); ctx.fillStyle = as.hd; ctx.fill();
  ctx.fillStyle = as.light ? "#eee" : "#fff"; ctx.font = "bold 11px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
  ctx.fillText(cardLabel(c), x + CW / 2, y + 16);
  ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.roundRect(x + 3, y + 27, 30, 13, 3); ctx.fill();
  ctx.fillStyle = as.light ? "#ddd" : "#fff"; ctx.font = "8px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
  ctx.fillText(as.label, x + 18, y + 37);
  if (d.sell !== null && d.sell >= 0) {
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.roundRect(x + CW - 34, y + 27, 31, 13, 3); ctx.fill();
    ctx.fillStyle = as.light ? "#dde" : "#fff"; ctx.font = "9px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("💎" + d.sell, x + CW - 18, y + 37);
  }
  if (d.soulAmount !== undefined) {
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.roundRect(x + CW - 34, y + 42, 31, 13, 3); ctx.fill();
    ctx.fillStyle = as.light ? "#dde" : "#fff"; ctx.font = "9px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("魂 " + d.soulAmount, x + CW - 18, y + 52);
  }
  // ── ゲート専用タイマーバー（カード上部に表示） ──
  // unstable_gate: 放置タイマー/転移タイマーの両方
  // stable_gate  : 転移タイマーのみ
  if (c.type === "unstable_gate" || c.type === "stable_gate") {
    const humans = cards.filter(h => h.gateId === c.id);
    const isStableGate = c.type === "stable_gate";
    const bx = x + 4, by = y - 8, bw = CW - 8, bh = 7;
    // 外枠
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 4); ctx.fill();
    // 背景
    ctx.fillStyle = "rgba(35,40,45,0.75)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();

    if (!isStableGate && humans.length === 0) {
      // 不安定ゲート：放置タイマー（オレンジ→赤：残り時間が減る）
      const ratio = Math.max(0, (c.gateTimer || 0) / 30000);
      ctx.fillStyle = ratio > 0.5 ? "#ff9800" : "#f44336";
      ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 3); ctx.fill();
    } else {
      // 転移タイマー（紫：経過時間が増える。初期値は30秒=30000ms）
      // stable_gate は人が乗っている時だけゲージを進める想定なので、
      // gateSendTimer が null の場合は 0% 表示にする。
      const sendRemaining = c.gateSendTimer;
      const ratio = (sendRemaining === null || sendRemaining === undefined)
        ? 0
        : (1 - Math.max(0, sendRemaining / 30000));
      ctx.fillStyle = "#b088ff";
      ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 3); ctx.fill();
    }

    // 光沢
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh / 2, 2); ctx.fill();
  }
  if (c.type === "underworld_door") {
    const humans = cards.filter(h => h.doorId === c.id);
    const isStableDoor = c.type === "underworld_door";
    const bx = x + 4, by = y - 8, bw = CW - 8, bh = 7;
    // 外枠
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 4); ctx.fill();
    // 背景
    ctx.fillStyle = "rgba(35,40,45,0.75)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();

    // underworld_door は人が乗っている時だけゲージを進める想定なので、
    // doorSendTimer が null の場合は 0% 表示にする。
    const sendRemaining = c.doorSendTimer;
    const ratio = (sendRemaining === null || sendRemaining === undefined)
      ? 0
      : (1 - Math.max(0, sendRemaining / 15000));
    ctx.fillStyle = "#b088ff";
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 3); ctx.fill();

    // 光沢
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh / 2, 2); ctx.fill();
  }
  if (c.type === "ferry") {
    const stacked = getFerryStack(c);
    const human = stacked.find(h => h.type === "human");
    const bx = x + 4, by = y - 8, bw = CW - 8, bh = 7;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 4); ctx.fill();
    ctx.fillStyle = "rgba(35,40,45,0.75)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
    const sendRemaining = c.ferrySendTimer;
    const ratio = (sendRemaining === null || sendRemaining === undefined || !human)
      ? 0
      : (1 - Math.max(0, sendRemaining / FERRY_RETURN_MS));
    ctx.fillStyle = "#6a9aff";
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh / 2, 2); ctx.fill();
  }
  if ((d.attr === "human" || d.attr === "hostile") && d.maxHp) {
    const stats = combatStats(c);
    const hp = c.hp !== undefined ? c.hp : stats.maxHp, ratio = Math.max(0, hp / stats.maxHp);
    const bx = x + 4, by = y + 44, bw = CW - 8, bh = 6;
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? "#4caf50" : ratio > 0.25 ? "#ff9800" : "#f44336"; ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 3); ctx.fill();
    ctx.fillStyle = as.light ? "#ddd" : "#333"; ctx.font = "8px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`HP ${Math.floor(hp)}/${stats.maxHp}`, x + CW / 2, by + 5);

    // 戦闘中に属性アイコン（色のみ）を右上に表示
    const inBattle = c.hp !== undefined && activeBattles.some(b => b.participants.has(c));
    if (inBattle) {
      const color = COMBAT_ATTR_COLOR[getCardCombatAttr(c)] || "#888";
      const ir = 5, ix = x + CW - 4 - ir * 2, iy = y + 4;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(ix + ir, iy + ir, ir, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  if (c.status) {
    let statusX = x + 4;
    const statusY = y + 54;
    const size = 12;

    // 1. 気絶 (Stun): 黄色
    if (c.status.stun > 0) {
      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath(); ctx.arc(statusX + size / 2, statusY + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#000"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("気", statusX + size / 2, statusY + size / 2 + 0.5);
      statusX += size + 4;
    }

    // 2. 毒 (Poison): 紫
    if (c.status.poison) {
      ctx.fillStyle = "#a0f";
      ctx.beginPath(); ctx.arc(statusX + size / 2, statusY + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("毒", statusX + size / 2, statusY + size / 2 + 0.5);
      statusX += size + 4;
    }

    // 3. 出血 (Bleed): 赤 (敵カードの赤でも認識できるように白フチ+黒フチ仕様)
    if (c.status.bleed > 0) {
      ctx.fillStyle = "#f44";
      ctx.beginPath(); ctx.arc(statusX + size / 2, statusY + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = "#000"; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("血", statusX + size / 2, statusY + size / 2 + 0.5);
      statusX += size + 4;
    }

    // 4. 無敵 (Invincible): 青紫
    if (c.status.invincible > 0) {
      ctx.fillStyle = "#b088ff";
      ctx.beginPath(); ctx.arc(statusX + size / 2, statusY + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("無", statusX + size / 2, statusY + size / 2 + 0.5);
      statusX += size + 4;
    }

    // 5. 狂乱 (Frenzy): オレンジ
    if (c.status.frenzy > 0) {
      ctx.fillStyle = "#ff9800";
      ctx.beginPath(); ctx.arc(statusX + size / 2, statusY + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("狂", statusX + size / 2, statusY + size / 2 + 0.5);
      statusX += size + 4;
    }
  }
  if (d.attr === "food" && d.satiety !== null) {
    ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.roundRect(x + 3, y + 43, CW - 6, 14, 3); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    const dispSat = c.partialSatiety !== undefined ? (c.stack > 1 ? `満腹度 ${(c.stack - 1) * d.satiety}+${c.partialSatiety}` : `満腹度 ${c.partialSatiety}`) : `満腹度 ${d.satiety}`;
    ctx.fillText(dispSat, x + CW / 2, y + 53);
  }
  if (c.type === "furnace" || c.type === "soul_furnace") {
    const fuel = c.fuel || 0;
    const maxDisp = 5; // 表示上の最大値
    const ratio = Math.min(fuel / maxDisp, 1);
    const bx = x + 4, by = y + 44, bw = CW - 8, bh = 7;
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
    ctx.fillStyle = fuel > 0 ? "#ff8c00" : "#555";
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 3); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "8px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`燃料 ${Math.floor(fuel * 10) / 10}`, x + CW / 2, by + 5);
  }
  if (c.stack > 1) {
    const dispStack = c.stack || 0;
    ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.beginPath(); ctx.roundRect(x + CW - 28, y + CH - 22, 25, 18, 4); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif"; ctx.textAlign = "center";
    ctx.fillText("×" + dispStack, x + CW - 15, y + CH - 9);
  }
  if (craftTotal > 0) {
    const ratio = Math.min(craftProg / craftTotal, 1);
    const bx = x + 4, by = y - 8, bw = CW - 8, bh = 7;

    // 外枠（優しく馴染む半透明のボーダー効果）
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 4); ctx.fill();

    // 背景（柔らかいダークグレー）
    ctx.fillStyle = "rgba(35,40,45,0.75)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();

    // プログレス（目に優しいソフトターコイズ・ティールのグラデーション）
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, "#43aba4"); // 落ち着いたマイルドなターコイズ
    g.addColorStop(1, "#2a7e78"); // 深みのあるソフトなティールブルー
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh, 3); ctx.fill();

    // 立体感（優しめのグロス光沢効果）
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.roundRect(bx, by, bw * ratio, bh / 2, 2); ctx.fill();
  }
  if (isDrag) { ctx.strokeStyle = "#e8b84b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, CW, CH, r); ctx.stroke(); }
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 暗黒の森は暗い背景色。盤面が全面黒のときはカメラ可視範囲も黒にする
  const corruptionFullBg = isBoardFullyBlack();
  ctx.fillStyle = inDarkForest ? "#072d01" : (inUnderworld ? "#410705" : (corruptionFullBg ? "#0a0a0a" : "#b8e0b2"));
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate(camX, UI_H + camY); ctx.scale(camScale, camScale);
  const step = 40, tl = s2w(0, 0), br = s2w(canvas.width, canvas.height);
  if (camScale > 0.3) {
    ctx.fillStyle = "rgba(0,80,0,.06)";
    const stepSize = camScale < 0.65 ? step * 2 : step;
    for (let gx = Math.floor(tl.x / stepSize) * stepSize; gx <= br.x; gx += stepSize) {
      for (let gy = Math.floor(tl.y / stepSize) * stepSize; gy <= br.y; gy += stepSize) {
        ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
      }
    }
  }
  drawBoardCorruption();
  drawWorldBoundary();
  const progressToDraw = new Map(); // cardId -> { progress, total }
  for (const [key, info] of Object.entries(progressMap)) {
    const ids = key.split(",").map(Number);
    const grpCards = cards.filter(c => ids.includes(c.id));
    if (grpCards.length > 0) {
      // そのグループの中で最もY座標が小さいカードを代表とする
      const targetCard = grpCards.reduce((min, c) => c.y < min.y ? c : min, grpCards[0]);
      progressToDraw.set(targetCard.id, { progress: info.progress, total: info.recipe.time * 1000 });
    }
  }
  for (const c of cards) {
    const inf = progressToDraw.get(c.id);
    drawCard(c, inf ? inf.progress : 0, inf ? inf.total : 0);
  }

  // 戦闘枠の描画
  for (const b of activeBattles) {
    ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(b.bounds.x, b.bounds.y, b.bounds.w, b.bounds.h);
    ctx.setLineDash([]);
  }

  // 攻撃エフェクトの描画
  for (const ae of attackEffects) {
    const alpha = Math.max(0, 1 - ae.t / ae.dur);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ae.color || "#ffeb3b";
    ctx.lineWidth = ae.width || 3;
    ctx.beginPath();
    ctx.moveTo(ae.x1, ae.y1);
    ctx.lineTo(ae.x2, ae.y2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // フローティングテキストの描画
  for (const ft of floatingTexts) {
    ctx.font = `bold ${ft.size + 4}px 'Hiragino Maru Gothic ProN','BIZ UDPGothic',sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const alpha = Math.max(0, 1 - ft.t / ft.dur);
    ctx.globalAlpha = alpha;

    const textWidth = ctx.measureText(ft.text).width;
    const bgW = textWidth + 12;
    const bgH = ft.size + 8;

    // 背景の黒枠
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect(ft.x - bgW / 2, ft.y - bgH / 2, bgW, bgH, 6);
    ctx.fill();

    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();

  drawScreenShatterFragments();

  // 一時停止（×0）時の薄いオーバーレイ（カメラ演出中は除く）
  if (gameSpeed === 0 && !cameraAnim) {
    ctx.fillStyle = "rgba(210, 220, 235, 0.19)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.setLineDash([]);
  }
}

function loop(t) {
  const dt = Math.min(t - lastTime, 100); lastTime = t;
  update(dt); draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(t => { lastTime = t; requestAnimationFrame(loop); });

// ════════════════════════════════════════════════
// デバッグモード機能の実装
// ════════════════════════════════════════════════
function initDebugCardSelect() {
  const select = document.getElementById("dbgCardSelect");
  if (!select) return;
  if (select.children.length > 0) return; // すでに初期化済みの場合はスキップ

  // DEFSから全てのカードタイプを取得し、pack_cardを除外
  const types = Object.keys(DEFS).filter(type => type !== "pack_card");

  // 属性ごとにグループ分け
  const groups = {};
  for (const type of types) {
    const d = DEFS[type];
    const attr = d.attr || "material";
    if (!groups[attr]) groups[attr] = [];
    groups[attr].push({ type, label: d.label || type });
  }

  // 属性のソート順
  const attrOrder = ["human", "building", "tool", "material", "food", "resource", "currency", "hostile", "friendly", "recipe", "job"];
  const sortedAttrs = [...new Set([...attrOrder.filter(a => groups[a]), ...Object.keys(groups)])];

  for (const attr of sortedAttrs) {
    if (!groups[attr] || groups[attr].length === 0) continue;
    const as = attrSt(attr);
    const optgroup = document.createElement("optgroup");
    optgroup.label = as.label.toUpperCase(); // グループのラベル

    // カードタイプを日本語名順でソートして追加
    groups[attr].sort((a, b) => a.label.localeCompare(b.label, "ja"));
    for (const card of groups[attr]) {
      const option = document.createElement("option");
      option.value = card.type;
      option.textContent = `${card.label} (${card.type})`;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
}

// デバッグパネルのイベントリスナー設定
const addDbgListener = (id, event, callback) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, callback);
};

// 1. 任意カード生成
addDbgListener("dbgSpawnCard", "click", () => {
  const select = document.getElementById("dbgCardSelect");
  if (!select) return;
  const selectedType = select.value;
  if (!selectedType) return;
  const pos = findFreePos(INIT_WX, INIT_WY);
  mkCard(selectedType, pos.x, pos.y);
  toast(`生成: ${def(selectedType).label}`);
});

// 2. 💎増減
addDbgListener("dbgEm100", "click", () => {
  addCurrency(100, INIT_WX, INIT_WY);
  toast("💎×100 を追加しました");
});
addDbgListener("dbgEm1000", "click", () => {
  addCurrency(1000, INIT_WX, INIT_WY);
  toast("💎×1000 を追加しました");
});
addDbgListener("dbgEmReset", "click", () => {
  cards = cards.filter(c => c.type !== "emerald" && c.type !== "funeral_money");
  toast("盤面の💎をすべてリセットしました");
});

// 3. 時間制御
addDbgListener("dbgFreezeTime", "click", () => {
  debugTimeFrozen = !debugTimeFrozen;
  const ind = document.getElementById("dbgFreezeInd");
  if (ind) {
    ind.className = "dbg-indicator " + (debugTimeFrozen ? "on" : "off");
    ind.textContent = debugTimeFrozen ? "ON" : "OFF";
  }
  toast(debugTimeFrozen ? "時間停止 ON" : "時間停止 OFF");
});

addDbgListener("dbgSkipNight", "click", () => {
  if (!dayStarted) {
    toast("ゲームがまだ始まっていません");
    return;
  }
  if (inUnderworld) {
    uwDayTimer = DAY_MS - 1;
  } else {
    dayTimer = DAY_MS - 1;
  }
  toast("夜にスキップします");
});

// 4. プレイヤー (God Mode, 全員回復)
addDbgListener("dbgGodMode", "click", () => {
  debugGodMode = !debugGodMode;
  const ind = document.getElementById("dbgGodInd");
  if (ind) {
    ind.className = "dbg-indicator " + (debugGodMode ? "on" : "off");
    ind.textContent = debugGodMode ? "ON" : "OFF";
  }
  toast(debugGodMode ? "無敵モード ON" : "無敵モード OFF");
});

addDbgListener("dbgHealAll", "click", () => {
  cards.filter(c => def(c.type).attr === "human").forEach(c => {
    const stats = combatStats(c);
    c.hp = stats.maxHp;
    c.status = { poison: false, stun: 0, bleed: 0 };
  });
  toast("全員のHPと状態異常を全回復しました");
});

// 5. クエスト・図鑑
addDbgListener("dbgCompleteQuests", "click", () => {
  // defs.jsにある全クエストとサブクエストを強制クリア
  if (typeof QUESTS !== "undefined") {
    QUESTS.forEach(q => completeQuest(q.id));
  }
  if (typeof SUB_QUESTS !== "undefined") {
    SUB_QUESTS.forEach(sq => completeSubQuest(sq.id));
  }
  // パックの全解放
  if (typeof ALL_PACK_IDS !== "undefined") {
    ALL_PACK_IDS.forEach(id => unlockedPacks.add(id));
  }
  renderQuestList();
  toast("すべてのクエストをクリアし、パックを全解放しました");
});

addDbgListener("dbgUnlockRecipes", "click", () => {
  // 全てのカードを発見済みに
  Object.keys(DEFS).forEach(type => discoveredCards.add(type));
  // 全てのレシピを発見済みに
  if (typeof RECIPES !== "undefined") {
    RECIPES.forEach((r, idx) => {
      discoveredRecipes.add(r);
      ownedRecipes.add(idx);
    });
  }

  // 自動的にレシピタブに切り替えてサイドバーを開く
  sbActiveTab = "recipe";
  const tabRecipe = document.getElementById("sbTabRecipe");
  const tabQuest = document.getElementById("sbTabQuest");
  const recipeToolbar = document.getElementById("sbRecipeToolbar");
  const recipeContent = document.getElementById("sbRecipeContent");
  const questContent = document.getElementById("sbQuestContent");
  if (tabRecipe) tabRecipe.classList.add("active");
  if (tabQuest) tabQuest.classList.remove("active");
  if (recipeToolbar) recipeToolbar.style.display = "";
  if (recipeContent) recipeContent.style.display = "";
  if (questContent) questContent.style.display = "none";

  const sb = document.getElementById("sidebar");
  const btn = document.getElementById("sidebarToggle");
  if (sb && !sb.classList.contains("open")) {
    sb.classList.add("open");
    if (btn) btn.textContent = "＜";
  }

  renderRecipeList();
  updatePackBadges();
  toast("レシピとカード図鑑をすべて解放しました");
});

// 6. 盤面クリア
addDbgListener("dbgClearNonHuman", "click", () => {
  cards = cards.filter(c => def(c.type).attr === "human");
  progressMap = {};
  toast("人間以外のカードをすべて消去しました");
});

addDbgListener("dbgClearAll", "click", () => {
  cards = [];
  progressMap = {};
  toast("すべてのカードを消去しました");
});

// 7. 新規デバッグ機能 (モブ移動制限, 必要満腹度0, ゲームオーバー無効)
addDbgListener("dbgFreezeMobs", "click", () => {
  debugMobsFrozen = !debugMobsFrozen;
  const ind = document.getElementById("dbgFreezeMobsInd");
  if (ind) {
    ind.className = "dbg-indicator " + (debugMobsFrozen ? "on" : "off");
    ind.textContent = debugMobsFrozen ? "ON" : "OFF";
  }
  toast(debugMobsFrozen ? "モブ移動制限 ON" : "モブ移動制限 OFF");
});

addDbgListener("dbgNoMealCost", "click", () => {
  debugNoMealCost = !debugNoMealCost;
  const ind = document.getElementById("dbgNoMealCostInd");
  if (ind) {
    ind.className = "dbg-indicator " + (debugNoMealCost ? "on" : "off");
    ind.textContent = debugNoMealCost ? "ON" : "OFF";
  }
  toast(debugNoMealCost ? "必要満腹度0 ON" : "必要満腹度0 OFF");
});

addDbgListener("dbgNoGameOver", "click", () => {
  debugNoGameOver = !debugNoGameOver;
  const ind = document.getElementById("dbgNoGameOverInd");
  if (ind) {
    ind.className = "dbg-indicator " + (debugNoGameOver ? "on" : "off");
    ind.textContent = debugNoGameOver ? "ON" : "OFF";
  }
  toast(debugNoGameOver ? "ゲームオーバー無効 ON" : "ゲームオーバー無効 OFF");
});

// 8. カード検索機能
addDbgListener("dbgCardSearch", "input", (e) => {
  const query = e.target.value.toLowerCase().trim();
  const select = document.getElementById("dbgCardSelect");
  if (!select) return;

  const optgroups = select.getElementsByTagName("optgroup");
  for (const group of optgroups) {
    let hasVisibleOption = false;
    const options = group.getElementsByTagName("option");
    for (const opt of options) {
      const text = opt.textContent.toLowerCase();
      const val = opt.value.toLowerCase();
      const match = text.includes(query) || val.includes(query);
      opt.style.display = match ? "" : "none";
      if (match) {
        hasVisibleOption = true;
      }
    }
    // グループ内にマッチするオプションが1つもなければ、グループ自体を非表示にする
    group.style.display = hasVisibleOption ? "" : "none";
  }

  // 絞り込んだ結果、選択されているオプションが非表示になっていたら、
  // 最初に見つかった表示されているオプションを自動選択する
  if (select.value) {
    const selectedOpt = select.options[select.selectedIndex];
    if (selectedOpt && selectedOpt.style.display === "none") {
      for (const opt of select.options) {
        if (opt.style.display !== "none") {
          select.value = opt.value;
          break;
        }
      }
    }
  }
});

// 9. 新規デバッグ機能 (ゲーム時間10倍速, 敵モブ消去)
addDbgListener("dbgSpeed10x", "click", () => {
  if (gameSpeed === 10) {
    setSpeed(1);
  } else {
    setSpeed(10);
  }
  toast(gameSpeed === 10 ? "時間速度 10倍速 ON" : "時間速度 1倍速");
});

addDbgListener("dbgClearHostiles", "click", () => {
  cards = cards.filter(c => def(c.type).attr !== "hostile");
  toast("敵モブをすべて消去しました");
});