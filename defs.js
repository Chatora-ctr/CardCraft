// ════════════════════════════════════════════════
// defs.js
// カード定義・レシピ・パック設定
// ここを編集してアイテムやレシピを追加できます
// ════════════════════════════════════════════════

// ── ゲームパラメータ ──────────────────────────
// 1日の長さ（ミリ秒）。増やすと1日が長くなる
const DAY_MS = 2 * 60 * 1000;

// カード枠の基本上限
const BASE_CARD_LIMIT = 20;
// カード1枠あたりの盤面拡張サイズ（ピクセル）
const WORLD_EXPAND_PER_SLOT = 3;

// ── カードの色・見た目の定義 ──────────────────
// label: カードに表示される属性名
// hd: ヘッダーの色, bg: 背景色, light: 文字を暗くするか
const ATTR_STYLE = {
  human: { hd: "#4a6a9a", bg: "#7aaad0", label: "人間", light: false },
  resource: { hd: "#3a6a3a", bg: "#6aaa6a", label: "資源", light: false },
  material: { hd: "#7a5020", bg: "#b88050", label: "素材", light: false },
  cursed: { hd: "#320222", bg: "#471547", label: "呪物", light: true },
  doll: { hd: "#0e7171", bg: "#6b9094", label: "依り代", light: true },
  building: { hd: "#6a5030", bg: "#a08060", label: "施設", light: false },
  currency: { hd: "#2a6050", bg: "#4a9880", label: "通貨", light: true },
  food: { hd: "#a06000", bg: "#e09030", label: "食べ物", light: false },
  hostile: { hd: "#7a1020", bg: "#c02840", label: "敵", light: true },
  friendly: { hd: "#1a6070", bg: "#3aaabb", label: "友好", light: false },
  recipe: { hd: "#3a3a6a", bg: "#6a6aaa", label: "レシピ", light: true },
  job: { hd: "#54524c", bg: "#8b867c", label: "職業", light: false },
  search: { hd: "#5a2070", bg: "#8a50a8", label: "探索", light: true },
  precious: { hd: "#816b00", bg: "#b49d07", label: "貴重品", light: true },
  armor: { hd: "#4a3e3d", bg: "#8e7f7d", label: "防具", light: false },
  accessory: { hd: "#3f354a", bg: "#776c85", label: "装飾品", light: false },
  pack: { hd: "#a83232", bg: "#e07a5f", label: "パック", light: false },
  gate: { hd: "#1a0a3a", bg: "#3a1a6a", label: "ゲート", light: true },
};

// レシピタブの分類（recipeAttr）
const RECIPE_ATTR_STYLE = {
  base: { hd: "#4a6a9a", bg: "#7aaad0", label: "基本" },
  resource: { hd: "#3a6a3a", bg: "#6aaa6a", label: "資源" },
  agriculture: { hd: "#5a8040", bg: "#8ab860", label: "農業" },
  building: { hd: "#6a5030", bg: "#a08060", label: "建築" },
  cooking: { hd: "#a06000", bg: "#e09030", label: "料理" },
  job: { hd: "#54524c", bg: "#8b867c", label: "職業" },
  military: { hd: "#5a3030", bg: "#8a5050", label: "軍事" },
  armor: { hd: "#4a3e3d", bg: "#8e7f7d", label: "防具" },
  accessory: { hd: "#3f354a", bg: "#776c85", label: "装飾品" },
  underworld: { hd: "#320222", bg: "#5a1848", label: "冥界" },
  gate: { hd: "#1a0a3a", bg: "#3a1a6a", label: "ゲート" },
  important: { hd: "#816b00", bg: "#b49d07", label: "重要" },
  other: { hd: "#555555", bg: "#888888", label: "その他" },
};

const RECIPE_ATTR_ORDER = [
  "base", "resource", "agriculture", "building", "cooking",
  "job", "military", "armor", "accessory", "underworld", "gate", "important", "other",
];

function recipeAttrSt(attr) {
  const key = attr;
  return RECIPE_ATTR_STYLE[key] || RECIPE_ATTR_STYLE.other;
}

// ── カード定義 ────────────────────────────────
// label  : カード名
// attr   : 属性（上のATTR_STYLEのキー）
// sell   : 売却価格（nullは売却不可）
// maxUses: 使用回数上限（nullは無制限）
// maxHp  : 最大HP（戦闘キャラのみ）
// atk    : 攻撃力（戦闘キャラのみ）
// def    : 防御力（戦闘キャラのみ）
// satiety: 満腹度（食べ物のみ）
// drop   : 倒したときのドロップ [{type, w(重み)}]
// cardSlots: このカードが増やすカード枠の数
const DEFS = {
  // ゲート
  unstable_gate: {
    label: "不安定なゲート", attr: "gate", sell: null, maxUses: null,
    fixed: true,        // 移動不可・斥力除外フラグ
    maxStack: 7,        // 最大7人の村人を重ねられる
    desc: "異界に繋がる不安定なゲート\n村人を送り込めば探索できるかもしれない(最大7人)\n放置すると危険な敵が出現する"
  },
  stable_gate: {
    label: "安定したゲート", attr: "gate", sell: 5, maxUses: null,
    maxStack: 7,        // 最大7人の村人を重ねられる
    desc: "異界に繋がる安定したゲート\n村人を送り込めば探索できる(最大7人)\n放置しても敵は出現しない"
  },
  underworld_door: {
    label: "冥界の扉", attr: "gate", sell: 5, maxUses: null,
    maxStack: 1,
    desc: "冥界へつながる扉\n村人1人を冥界に送ることができる"
  },
  ferry: {
    label: "渡し舟", attr: "gate", sell: null, maxUses: null,
    maxStack: 7,
    desc: "冥界から拠点へ帰還できる舟\n村人1人と荷物6枚まで乗せられる"
  },

  // 人間
  human: {
    label: "村人", attr: "human", sell: null, maxUses: null,
    maxHp: 15, atk: 3, def: 1, hitRate: 0.8, crit: 0.05, atkSpeed: 4.2,
    desc: "村で暮らし働く住民"
  },
  baby: {
    label: "赤ちゃん", attr: "human", sell: null, maxUses: null,
    maxHp: 5, atk: 1, def: 0, hitRate: 0.8, crit: 0.05, atkSpeed: 5.0,
    desc: "まだ幼く成長途中の子ども\n家でひとりでに成長する"
  },
  wood_soul_doll: {
    label: "木霊", attr: "human", sell: null, maxUses: null, combatAttr: "magic",
    maxHp: 6, atk: 2, def: 1, hitRate: 0.8, crit: 0.05, atkSpeed: 3.5,
    desc: ""
  },
  cursed_wood_soul_doll: {
    label: "呪木霊", attr: "human", sell: null, maxUses: null,
    maxHp: 8, atk: 4, def: 2, hitRate: 0.8, crit: 0.05, atkSpeed: 3.5,
    skills: [{ type: "heal", chance: 0.3, power: 2 }],
    desc: ""
  },
  stone_soul_doll: {
    label: "石霊", attr: "human", sell: null, maxUses: null,
    maxHp: 8, atk: 1, def: 3, hitRate: 0.8, crit: 0.0, atkSpeed: 4.5,
    desc: ""
  },
  dead_stone_soul_doll: {
    label: "死石霊", attr: "human", sell: null, maxUses: null,
    maxHp: 10, atk: 2, def: 4, hitRate: 0.8, crit: 0.05, atkSpeed: 4.5,
    skills: [{ type: "poison", chance: 0.15 }],
    desc: ""
  },
  iron_soul_doll: {
    label: "鉄霊", attr: "human", sell: null, maxUses: null,
    maxHp: 8, atk: 4, def: 2, hitRate: 0.8, crit: 0.1, atkSpeed: 4.2,
    desc: ""
  },
  uw_iron_soul_doll: {
    label: "冥鉄霊", attr: "human", sell: null, maxUses: null,
    maxHp: 12, atk: 5, def: 3, hitRate: 0.8, crit: 0.1, atkSpeed: 4.2,
    skills: [{ type: "bleed", chance: 0.15 }],
    desc: ""
  },
  gold_soul_doll: {
    label: "金霊", attr: "human", sell: null, maxUses: null,
    maxHp: 10, atk: 5, def: 2, hitRate: 0.9, crit: 0.1, atkSpeed: 4.2,
    desc: ""
  },
  uw_gold_soul_doll: {
    label: "冥金霊", attr: "human", sell: null, maxUses: null,
    maxHp: 15, atk: 6, def: 3, hitRate: 0.9, crit: 0.1, atkSpeed: 4.2,
    skills: [{ type: "stun", chance: 0.15 }],
    desc: ""
  },

  // 依代人形
  wood_doll: { label: "木偶", attr: "doll", sell: 2, maxUses: null, desc: "腐木でできた依代人形\n霊魂を込めることができる" },
  stone_doll: { label: "石偶", attr: "doll", sell: 2, maxUses: null, desc: "脆石でできた依代人形\n霊魂を込めることができる" },
  iron_doll: { label: "鉄偶", attr: "doll", sell: 3, maxUses: null, desc: "錆鉄塊でできた依代人形\n霊魂を込めることができる" },
  gold_doll: { label: "金偶", attr: "doll", sell: 4, maxUses: null, desc: "錆金塊でできた依代人形\n霊魂を込めることができる" },
  cursed_wood_doll: { label: "呪木偶", attr: "doll", sell: 3, maxUses: null, desc: "呪木でできた依代人形\n霊魂を込めることができる" },
  dead_stone_doll: { label: "死石偶", attr: "doll", sell: 3, maxUses: null, desc: "死石でできた依代人形\n霊魂を込めることができる" },
  uw_iron_doll: { label: "冥鉄偶", attr: "doll", sell: 4, maxUses: null, desc: "冥鉄塊でできた依代人形\n霊魂を込めることができる" },
  uw_gold_doll: { label: "冥金偶", attr: "doll", sell: 5, maxUses: null, desc: "冥金塊でできた依代人形\n霊魂を込めることができる" },

  // 資源（地上）
  tree: { label: "木", attr: "resource", sell: 1, maxUses: 2, desc: "伐採することで木材などを入手できる" },
  rock: { label: "岩", attr: "resource", sell: 1, maxUses: 2, desc: "採掘することで石材などを入手できる" },
  apple_tree: { label: "リンゴの木", attr: "resource", sell: 1, maxUses: 3, desc: "リンゴを採取することができる" },
  iron_vein: { label: "鉄鉱脈", attr: "resource", sell: 3, maxUses: 2, desc: "地下に広がる鉄鉱石の集まり" },
  gold_vein: { label: "金鉱脈", attr: "resource", sell: 5, maxUses: 1, desc: "貴重な金鉱石を含む鉱脈" },

  // 資源（冥界）
  dead_tree: { label: "枯れ木", attr: "resource", sell: 1, maxUses: 2, desc: "伐採することで木材などを入手できる" },
  tomb_stone: { label: "墓石", attr: "resource", sell: 1, maxUses: 2, desc: "採掘することで石材などを入手できる" },

  // 探索
  forest: { label: "森林", attr: "search", sell: 3, maxUses: null, desc: "静けさ漂う森の中にはモンスターの気配も" },
  mountain: { label: "山", attr: "search", sell: 3, maxUses: null, desc: "あの山岳には何があるのだろう" },
  plain: { label: "平原", attr: "search", sell: 3, maxUses: null, desc: "青々としていて気持ちがいい" },
  beach: { label: "砂浜", attr: "search", sell: 3, maxUses: null, desc: "砂と海が広がっている" },
  cemetery: { label: "墓地", attr: "search", sell: 3, maxUses: null, desc: "墓石が並ぶ静まり返った不気味な場所だ" },
  ancient_city: { label: "古代都市", attr: "search", sell: 3, maxUses: null, desc: "噂では謎のアイテムが眠っているらしい" },

  // 素材（地上）
  wood: { label: "木材", attr: "material", sell: 1, cursedLimit: 1, maxUses: null, desc: "加工や建築の基本になる、切り出したばかりの木" },
  stick: { label: "木の棒", attr: "material", sell: 2, maxUses: null, desc: "様々な素材として使われる細い棒" },
  dirt: { label: "土", attr: "material", sell: 1, maxUses: null, desc: "どこにでもある柔らかい地面の素材" },
  stone: { label: "石材", attr: "material", sell: 1, cursedLimit: 1, maxUses: null, desc: "硬く丈夫で、建築にも道具にも使える石の塊" },
  flint: { label: "火打石", attr: "material", sell: 2, maxUses: null, desc: "火花を散らし、火起こしに使われる石" },
  sand: { label: "砂", attr: "material", sell: 1, maxUses: null, desc: "さらさらと崩れる細かな粒の集まり" },
  glass: { label: "ガラス", attr: "material", sell: 2, maxUses: null, desc: "砂を高温で溶かして作られた透明な素材" },
  rope: { label: "ロープ", attr: "material", sell: 2, maxUses: null, desc: "物を縛ったり引っ張ったりできる丈夫な縄" },
  seed: { label: "種", attr: "material", sell: 1, maxUses: null, desc: "育てれば作物になる小さな命の粒" },
  wheat: { label: "小麦", attr: "material", sell: 1, maxUses: null, desc: "パン作りに欠かせない穀物" },
  bone: { label: "骨", attr: "material", sell: 2, maxUses: null, desc: "動物の体を支える白く硬い部位" },
  feather: { label: "羽", attr: "material", sell: 2, maxUses: null, desc: "軽くて柔らかな鳥の羽根" },
  leather: { label: "革", attr: "material", sell: 2, maxUses: null, desc: "加工しやすく丈夫な動物の皮" },
  paper: { label: "紙", attr: "material", sell: 2, maxUses: null, desc: "本や地図を作るために使われる薄い素材" },
  plank: { label: "厚板", attr: "material", sell: 3, maxUses: null, desc: "強度を高めた分厚い木の板" },
  brick: { label: "レンガ", attr: "material", sell: 3, maxUses: null, desc: "焼き固められた丈夫な素材" },
  poop: { label: "ウンチ", attr: "material", sell: 1, maxUses: null, desc: "強烈な臭いを放っている" },

  // 素材（洞窟）
  iron_ore: { label: "鉄鉱石", attr: "material", sell: 3, cursedLimit: 2, maxUses: null, desc: "精錬によって鉄を取り出せる鉱石" },
  gold_ore: { label: "金鉱石", attr: "material", sell: 5, cursedLimit: 3, maxUses: null, desc: "貴重な金を含んだ鉱石" },
  iron_ingot: { label: "鉄インゴット", attr: "material", sell: 4, maxUses: null, desc: "精錬された鉄の塊" },
  gold_ingot: { label: "金インゴット", attr: "material", sell: 8, maxUses: null, desc: "輝きを放つ高価な金の塊" },
  silk: { label: "糸", attr: "material", sell: 2, maxUses: null, desc: "道具の材料になる細い繊維" },

  // 呪物
  rotten_wood: { label: "腐木", attr: "cursed", sell: 0, cursedLimit: 3, soulAmount: 1, maxUses: null, desc: "瘴気により朽ち果てた木材" },
  rotten_stone: { label: "脆石", attr: "cursed", sell: 0, cursedLimit: 3, soulAmount: 1, maxUses: null, desc: "簡単に崩れてしまいそうな石材" },
  rusted_iron_ore: { label: "錆鉄鉱石", attr: "cursed", sell: 0, cursedLimit: 4, soulAmount: 1, maxUses: null, desc: "赤茶けた錆に覆われた鉄鉱石" },
  rusted_gold_ore: { label: "錆金鉱石", attr: "cursed", sell: 0, cursedLimit: 5, soulAmount: 1, maxUses: null, desc: "不気味な変色を帯びた金鉱石" },
  rusted_iron_ingot: { label: "錆鉄塊", attr: "cursed", sell: 0, soulAmount: 3, maxUses: null, desc: "腐食が進んだ鉄塊" },
  rusted_gold_ingot: { label: "錆金塊", attr: "cursed", sell: 0, soulAmount: 4, maxUses: null, desc: "鈍い輝きを放つ金塊" },
  cursed_wood: { label: "呪木", attr: "cursed", sell: 0, soulAmount: 3, maxUses: null, desc: "呪いを吸い込み黒ずんだ木材" },
  dead_stone: { label: "死石", attr: "cursed", sell: 0, soulAmount: 3, maxUses: null, desc: "冷気を帯びた冥界の石材" },
  uw_iron_ore: { label: "冥鉄鉱石", attr: "cursed", sell: 0, soulAmount: 3, maxUses: null, desc: "魂の力を宿した暗色の鉄鉱石" },
  uw_gold_ore: { label: "冥金鉱石", attr: "cursed", sell: 0, soulAmount: 3, maxUses: null, desc: "青白い光を放つ金鉱石" },
  uw_iron_ingot: { label: "冥鉄塊", attr: "cursed", sell: 0, soulAmount: 6, maxUses: null, desc: "冥界の炉で鍛えられた鉄の塊" },
  uw_gold_ingot: { label: "冥金塊", attr: "cursed", sell: 0, soulAmount: 7, maxUses: null, desc: "霊力を秘めた黄金の塊" },

  // 施設
  soil: { label: "耕地", attr: "building", sell: 1, maxUses: null, desc: "作物を育てるために耕された土地" },
  garden: { label: "農園", attr: "building", sell: 3, maxUses: null, desc: "小規模に作物を育てる畑\n耕地よりも速く作物が成長する" },
  farm: { label: "農場", attr: "building", sell: 5, maxUses: null, desc: "大量の作物を管理する生産施設\n農園よりも速く作物が成長する" },
  bonfire: { label: "焚き火", attr: "building", sell: 2, maxUses: null, desc: "簡単に加熱調理ができる火" },
  house: { label: "家", attr: "building", sell: 3, maxUses: null, desc: "人々が生活するための建物" },
  warehouse: { label: "倉庫", attr: "building", sell: 3, maxUses: null, cardSlots: 4, desc: "資材や食料を保管する建物\nカード所持上限が4増える" },
  storage: { label: "大倉庫", attr: "building", sell: 5, maxUses: null, cardSlots: 14, desc: "大量の物資を保管できる大きな倉庫\nカード所持上限が14増える" },
  plantation: { label: "植林場", attr: "building", sell: 3, maxUses: null, desc: "木材を得るために木を育てる場所\n木材などを無限に入手できる" },
  quarry: { label: "採石場", attr: "building", sell: 3, maxUses: null, desc: "石材を掘り出すための採掘場\n石材などを無限に入手できる" },
  iron_mine: { label: "鉄鉱山", attr: "building", sell: 5, maxUses: null, desc: "鉄鉱石が豊富に存在する鉱山\n鉄鉱石などを無限に入手できる" },
  gold_mine: { label: "金鉱山", attr: "building", sell: 7, maxUses: null, desc: "貴重な金が豊富に存在する鉱山\n金鉱石などを無限に入手できる" },
  sand_pit: { label: "砂採掘場", attr: "building", sell: 3, maxUses: null, desc: "大量の砂を採取するための場所\n砂などを無限に入手できる" },
  plank_factory: { label: "製材所", attr: "building", sell: 4, maxUses: null, desc: "木材を加工して厚板を作る工房\n木材2つから厚板を生産できる" },
  brick_factory: { label: "レンガ工房", attr: "building", sell: 4, maxUses: null, desc: "石材を加工してレンガを作る工房\n石材2つからレンガを生産できる" },
  glass_factory: { label: "ガラス工房", attr: "building", sell: 4, maxUses: null, desc: "砂を加工してガラスを作る工房\n砂2つからガラスを生産できる" },
  monster_cage: { label: "モンスターの檻", attr: "building", sell: 5, maxUses: null, desc: "危険な魔物を閉じ込めるための檻" },
  livestock_fence: { label: "家畜の柵", attr: "building", sell: 4, maxUses: null, desc: "家畜を飼育するための囲い" },
  breeding_shed: { label: "繁殖小屋", attr: "building", sell: 4, maxUses: null, desc: "家畜を繁殖させるためだけの簡素な小屋" },
  slaughterhouse: { label: "処理場", attr: "building", sell: 4, maxUses: null, desc: "家畜を開放してあげる施設" },
  composter: { label: "コンポスター", attr: "building", sell: 4, maxUses: null, desc: "不要な有機物を再利用するための装置\n食料3つから土を生産する" },
  kiln: { label: "竈", attr: "building", sell: 4, maxUses: null, desc: "加熱調理に特化した炉\n焚き火よりも速く調理することができる" },
  furnace: { label: "熔鉱炉", attr: "building", sell: 5, maxUses: null, desc: "鉱石などを高温で溶かして精錬する炉\n燃料に木材が必要" },
  smithing_table: { label: "鍛冶台", attr: "building", sell: 5, maxUses: null, desc: "強力な武器や道具を加工するための作業台" },
  church: { label: "教会", attr: "building", sell: 5, maxUses: null, desc: "祈りと信仰のために建てられた神聖な場所\n村人の体力を回復することができる" },
  library: { label: "図書館", attr: "building", sell: 5, maxUses: null, desc: "知識を記した本が集められた建物\n50エメラルドでレシピを交換してくれる" },
  market: { label: "市場", attr: "building", sell: 5, maxUses: null, desc: "人々が品物を売買する賑やかな場所\n倍の値段でカードを売却できる" },
  dining_table: { label: "食卓", attr: "building", sell: 5, maxUses: null, desc: "料理を並べて食事をするための机\n上に乗った食料を優先的に消費する" },
  temple: { label: "神殿", attr: "building", sell: 10, maxUses: null, desc: "古い力や神々を祀る荘厳な建築物\n遺物を奉納すると...?" },

  soul_return_table: { label: "帰魂台", attr: "building", sell: 5, maxUses: null, desc: "宿った魂を呼び戻すための台座\n呪物から霊魂を抽出できる" },
  defilement_spring: { label: "穢れの泉", attr: "building", sell: 3, maxUses: null, desc: "瘴気が湧き出す泉\n呪物化を促進する" },
  purification_spring: { label: "浄化の泉", attr: "building", sell: 3, maxUses: null, desc: "呪いや穢れを洗い流す神秘の泉" },
  resentment_swamp: { label: "怨嗟の沼", attr: "building", sell: 5, maxUses: null, desc: "無数の怨念が沈む黒い沼\n呪物化をより促進する" },
  soul_furnace: { label: "霊魂炉", attr: "building", sell: 4, maxUses: null, desc: "冥界の素材を精錬する炉\n燃料に霊魂が必要" },
  altar: { label: "祭壇", attr: "building", sell: null, maxUses: null, desc: "霊魂を3つ奉納することで死の呪いを中和することができる" },
  mausoleum: { label: "霊廟", attr: "building", sell: 10, maxUses: null, desc: "先祖の霊を祭る神聖な建物\n霊魂を10個捧げることで冥王を呼び出せるとか..." },

  // 職業カード
  hoe: {
    label: "くわ", attr: "job", sell: 2, maxUses: null, job: "farmer",
    desc: "農作業を効率化する道具"
  },
  sword: {
    label: "剣", attr: "job", sell: 3, maxUses: null, job: "soldier",
    bonusAtk: 1, skills: [{ type: "bleed", chance: 0.1 }],
    desc: "戦闘に特化した武器\nATK +1\n10%の確率でターゲットに出血を付与する"
  },
  spear: {
    label: "槍", attr: "job", sell: 3, maxUses: null, job: "guard",
    bonusAtk: 2, bonusCrit: 0.05,
    desc: "リーチを活かした鋭い槍\nATK +2\n5%の確率でクリティカルが発生する"
  },
  bone_spear: {
    label: "骨の槍", attr: "job", sell: 3, maxUses: null, job: "guard",
    bonusAtk: 2, bonusCrit: 0.1, bonusHitRate: 0.05,
    desc: "骨を削り出した凶悪な槍\nATK +2  命中率 +1\n10%の確率でクリティカルが発生する"
  },
  soul_reaper: {
    label: "ソウルリーパー", attr: "job", sell: 7, maxUses: null, job: "hades",
    bonusMaxHp: 5, bonusAtk: 2, bonusDef: 1, bonusHitRate: 0.1, bonusCrit: 0.2,
    desc: "魂を刈り取る禍々しい鎌\nMaxHP +5  ATK +2  DEF +1  命中率 +2\n20%の確率でクリティカルが発生する"
  },
  slingshot: {
    label: "パチンコ銃", attr: "job", sell: 3, maxUses: null, job: "hunter",
    bonusAtk: 1, bonusHitRate: 0.05, bonusAtkSpeed: -0.5,
    desc: "遠距離から獲物を射抜く弓\nATK +1  命中率 +1  攻撃速度 +1"
  },
  shuriken: {
    label: "手裏剣", attr: "job", sell: 3, maxUses: null, job: "ninja",
    bonusAtk: 1, bonusHitRate: 0.05, bonusAtkSpeed: -1.5,
    desc: "忍びの隠し武器\nATK +1  命中率 +1  攻撃速度  +3"
  },
  bow: {
    label: "弓", attr: "job", sell: 3, maxUses: null, job: "hunter",
    bonusAtk: 2, bonusHitRate: 0.1, bonusAtkSpeed: -0.5, bonusCrit: 0.07,
    desc: "遠距離から獲物を射抜く弓\nATK +2  命中率 +2  攻撃速度 +1\n7%の確率でクリティカルが発生する"
  },
  boomerang: {
    label: "ブーメラン", attr: "job", sell: 3, maxUses: null, job: "hunter",
    bonusAtk: 1, bonusHitRate: 0.15, skills: [{ type: "aoe", chance: 0.15 }],
    desc: "投げると手元に戻ってくる武器\nATK +1  命中率 +3\n15%の確率で全体攻撃になる"
  },
  light_bowgun: {
    label: "ライトボウガン", attr: "job", sell: 3, maxUses: null, job: "hunter",
    bonusAtk: 1, bonusCrit: 0.15, bonusAtkSpeed: -1.0,
    desc: "手軽に扱える軽量の弩\nATK +1  命中率 +3  攻撃速度 +2"
  },
  heavy_bowgun: {
    label: "ヘビィボウガン", attr: "job", sell: 3, maxUses: null, job: "hunter",
    bonusAtk: 4, bonusAtkSpeed: 1.0, skills: [{ type: "aoe", chance: 0.15 }],
    desc: "巨大で重量のある弩\nATK +4  攻撃速度 -2\n15%の確率で全体攻撃になる"
  },
  serpent_bow: {
    label: "邪蛇の弩", attr: "job", sell: 8, maxUses: null, job: "hunter",
    bonusMaxHp: 10, bonusAtk: 2, bonusHitRate: 0.1, bonusAtkSpeed: -1.0, skills: [{ type: "drain", chance: 0.05, fraction: 2 }],
    desc: "大蛇の怨念が宿る弩\nMaxHP +10  ATK +2  命中率 +2  攻撃速度 +2\n5%の確率でターゲットからドレインする"
  },
  dual_blades: {
    label: "双剣", attr: "job", sell: 3, maxUses: null, job: "soldier",
    bonusAtk: 1, bonusAtkSpeed: -0.5, skills: [{ type: "bleed", chance: 0.1 }],
    desc: "両手に携えた二振りの剣\nATK +1  攻撃速度 +1\n10%の確率でターゲットに出血を付与する"
  },
  great_sword: {
    label: "大剣", attr: "job", sell: 3, maxUses: null, job: "soldier",
    bonusAtk: 3, bonusDef: 1, bonusAtkSpeed: 0.5, skills: [{ type: "stun", chance: 0.15, duration: 3.0 }],
    desc: "自身の背丈ほどもある大剣\nATK +3 DEF +1 攻撃速度 -1\n15%の確率でターゲットにスタンを付与する"
  },
  magic_wand: {
    label: "魔法の杖", attr: "job", sell: 3, maxUses: null, job: "mage",
    bonusAtk: 2, bonusCrit: 0.10, bonusAtkSpeed: -0.5, skills: [{ type: "heal", chance: 0.15, power: 2 }],
    desc: "魔力を宿した杖\nATK +2  攻撃速度 +1\n10%の確率でクリティカルが発生する\n15%の確率で味方を回復する"
  },
  bone_wand: {
    label: "骨の杖", attr: "job", sell: 3, maxUses: null, job: "mage",
    bonusAtk: 2, bonusMaxHp: -3.0, bonusAtkSpeed: -0.5, skills: [{ type: "drain", chance: 0.15, fraction: 2 }],
    desc: "禁忌の呪いが込められた骨の杖\nMaxHP -3  ATK +2  攻撃速度 +1\n15%の確率でターゲットからドレインする"
  },
  magic_book: {
    label: "魔導書", attr: "job", sell: 3, maxUses: null, job: "mage",
    bonusAtk: 1, bonusMaxHp: 10, bonusHitRate: 0.10, skills: [{ type: "heal", chance: 0.1, power: 2 }, { type: "frenzy", chance: 0.1 }],
    desc: "魔導の知識が記された書物\nMaxHP +10  ATK +1  命中率 +2\n10%の確率で味方を回復する\n10%の確率で味方に狂乱を付与する"
  },
  bomb_stick: {
    label: "爆裂ステッキ", attr: "job", sell: 3, maxUses: null, job: "mage",
    bonusAtk: 2, bonusAtkSpeed: 1.0, skills: [{ type: "aoe", chance: 0.3 }],
    desc: "爆裂魔法を操る魔法の杖\nATK +2  攻撃速度 -2\n30%の確率で全体攻撃になる"
  },
  witch_broom: {
    label: "魔女の箒", attr: "job", sell: 7, maxUses: null, job: "mage",
    bonusAtk: 2, bonusHitRate: 0.15, bonusAtkSpeed: -1.0, skills: [{ type: "heal", chance: 0.15, power: 2 }, { type: "poison", chance: 0.1 }],
    desc: "魔力を秘めた魔女愛用の箒\nATK +2  命中率 +3  攻撃速度 +2\n15%の確率で味方を回復する\n10%の確率でターゲットに毒を付与する"
  },
  axe: {
    label: "斧", attr: "job", sell: 3, maxUses: null, job: "logger",
    bonusAtk: 2, bonusAtkSpeed: 0.5, skills: [{ type: "bleed", chance: 0.1 }],
    desc: "伐採に使う道具\nATK +2  攻撃速度 -1\n10%の確率でターゲットに出血を付与する"
  },
  pickaxe: {
    label: "つるはし", attr: "job", sell: 3, maxUses: null, job: "miner",
    bonusAtk: 2, bonusAtkSpeed: 0.5, bonusCrit: 0.1,
    desc: "採掘に使う道具\nATK +2  攻撃速度 -1\n10%の確率でクリティカルが発生する"
  },
  hammer: {
    label: "ハンマー", attr: "job", sell: 3, maxUses: null, job: "builder",
    bonusAtk: 2, bonusAtkSpeed: -0.5, skills: [{ type: "stun", chance: 0.1 }],
    desc: "建築に使う道具\nATK +2  攻撃速度 +1\n10%の確率でターゲットにスタンを付与する"
  },
  map: {
    label: "地図と羽ペン", attr: "job", sell: 3, maxUses: null, job: "explorer",
    desc: "探索を助ける道具"
  },
  bible: {
    label: "聖書", attr: "job", sell: 5, maxUses: null, job: "priest",
    bonusMaxHp: -2, skills: [{ type: "heal", chance: 0.3, power: 2 }],
    desc: "神の言葉が記された聖典\nMaxHP -2\n30%の確率で味方を回復する"
  },
  shovel: {
    label: "シャベル", attr: "job", sell: 3, maxUses: null, job: "grave_keeper",
    bonusMaxHp: 3, bonusDef: 2,
    desc: "墓地を整備する道具\nMaxHP +3  DEF +2"
  },
  resentment_spear: {
    label: "霊魂の槍", attr: "job", sell: 3, maxUses: null, job: "guard",
    bonusAtk: 3, bonusCrit: 0.05, bonusAtkSpeed: 0.5, skills: [{ type: "bleed", chance: 0.1 }],
    desc: "怨念が宿った禍々しい槍\nATK +3  クリティカル率 +1  攻撃速度 -1\n10%の確率でターゲットに出血を付与する"
  },
  underworld_wand: {
    label: "冥符の杖", attr: "job", sell: 3, maxUses: null, job: "mage",
    bonusAtk: 2, bonusMaxHp: -2, bonusHitRate: 0.1, skills: [{ type: "drain", chance: 0.15, fraction: 1.0 }, { type: "heal", chance: 0.1, power: 2 }],
    desc: "冥界の符が貼られた呪いの杖\nMaxHP -2  ATK +2  命中率 +2\n15%の確率でターゲットからドレインする\n10%の確率で味方を回復する"
  },
  necro_dart: {
    label: "吹き矢", attr: "job", sell: 3, maxUses: null, job: "ninja",
    bonusAtk: 2, bonusAtkSpeed: -1.0, skills: [{ type: "poison", chance: 0.1 }],
    desc: "矢じりに毒を塗った暗器\nATK +2  攻撃速度 +2\n10%の確率でターゲットに毒を付与する"
  },

  // 通貨
  emerald: { label: "エメラルド", attr: "currency", sell: null, maxUses: null, desc: "鮮やかな緑色に輝く宝石\nこの世界の通貨" },
  funeral_money: { label: "冥銭", attr: "currency", sell: null, maxUses: null, desc: "冥界で流通する死者の貨幣\n冥界の通貨" },

  // 食べ物
  apple: { label: "リンゴ", attr: "food", sell: 1, maxUses: null, satiety: 1, desc: "甘酸っぱくて食べやすい果物" },
  carrot: { label: "ニンジン", attr: "food", sell: 1, maxUses: null, satiety: 1, desc: "鮮やかな橙色をした根菜" },
  potato: { label: "ジャガイモ", attr: "food", sell: 1, maxUses: null, satiety: 1, desc: "加熱するとホクホクになる芋\nこのまま食べてもおいしい" },
  onion: { label: "タマネギ", attr: "food", sell: 2, maxUses: null, satiety: 1, desc: "切ると涙が出る独特な野菜" },
  baked_potato: { label: "ベイクドポテト", attr: "food", sell: 1, maxUses: null, satiety: 2, desc: "こんがり焼き上げた熱々のジャガイモ" },
  raw_meat: { label: "生肉", attr: "food", sell: 3, maxUses: null, satiety: 0, desc: "まだ火を通していない肉\nこのままでは当然食べられない" },
  grilled_meat: { label: "焼いた肉", attr: "food", sell: 3, maxUses: null, satiety: 2, desc: "香ばしく焼き上げられた肉" },
  bread: { label: "パン", attr: "food", sell: 3, maxUses: null, satiety: 5, desc: "小麦から作られる定番の主食" },
  mushroom: { label: "キノコ", attr: "food", sell: 2, maxUses: null, satiety: 1, desc: "湿った場所によく生える不思議な菌類" },
  mushroom_stew: { label: "キノコシチュー", attr: "food", sell: 2, maxUses: null, satiety: 4, desc: "キノコの旨味が溶け込んだ温かい煮込み料理" },
  milk: { label: "ミルク", attr: "food", sell: 2, maxUses: null, satiety: 1, desc: "栄養たっぷりの白い飲み物" },
  egg: { label: "卵", attr: "food", sell: 1, maxUses: null, satiety: 0, desc: "さまざまな料理に使える食材\nこのままでは食べられない" },
  sugar_cane: { label: "サトウキビ", attr: "food", sell: 2, maxUses: null, satiety: 1, desc: "そのままかじっても甘い" },
  candy_apple: { label: "りんご飴", attr: "food", sell: 5, maxUses: null, satiety: 2, desc: "水飴でコーティングされた甘いりんご" },
  frittata: { label: "フリッタータ", attr: "food", sell: 3, maxUses: null, satiety: 4, desc: "具材を混ぜて焼き上げた卵料理" },
  omelet: { label: "オムレツ", attr: "food", sell: 5, maxUses: null, satiety: 3, desc: "ふわふわに焼き上げた卵料理" },
  pancake: { label: "パンケーキ", attr: "food", sell: 8, maxUses: null, satiety: 6, desc: "甘い香りが漂うスイーツ" },
  stew: { label: "シチュー", attr: "food", sell: 10, maxUses: null, satiety: 10, desc: "具材をじっくり煮込んだ温かい料理" },
  fruit_milk: { label: "フルーツ牛乳", attr: "food", sell: 5, maxUses: null, satiety: 3, desc: "果物の甘さが混ざったまろやかな飲み物" },

  // 敵（地上）
  rabbit: {
    label: "ウサギ", attr: "hostile", sell: null, maxUses: null, danger: 1, combatAttr: "melee",
    maxHp: 4, atk: 2, def: 1, hitRate: 0.8, crit: 0.05, atkSpeed: 4.5,
    drop: [{ type: "raw_meat", w: 50 }, { type: "carrot", w: 30 }, { type: "poop", w: 10 }, { type: "rabbit_charm", w: 10 }],
    moveInterval: 5, moveSpeed: 40,
    desc: "素早く飛び跳ねて襲いかかる小動物\nニンジンが好物"
  },
  cow: {
    label: "ウシ", attr: "hostile", sell: null, maxUses: null, danger: 1, combatAttr: "melee",
    maxHp: 7, atk: 2, def: 3, hitRate: 0.85, crit: 0.05, atkSpeed: 6.0,
    drop: [{ type: "raw_meat", w: 50 }, { type: "leather", w: 30 }, { type: "milk", w: 10 }, { type: "leather_armor", w: 10 }],
    moveInterval: 8, moveSpeed: 35,
    desc: "突進して攻撃してくる大型の動物\n小麦が好物"
  },
  chicken: {
    label: "ニワトリ", attr: "hostile", sell: null, danger: 1, combatAttr: "melee",
    maxUses: null, maxHp: 3, atk: 2, def: 0, hitRate: 0.75, crit: 0.2, atkSpeed: 3.5,
    drop: [{ type: "raw_meat", w: 50 }, { type: "feather", w: 30 }, { type: "egg", w: 10 }, { type: "feather_coat", w: 10 }],
    moveInterval: 3, moveSpeed: 20,
    desc: "勢いに任せて襲ってくる気性の荒い鳥\n種が好物"
  },

  // 友好モブ
  tamed_rabbit: { label: "うさぎ", attr: "friendly", sell: 2, maxUses: null, desc: "人に懐きおとなしくなったうさぎ" },
  tamed_cow: { label: "うし", attr: "friendly", sell: 3, maxUses: null, desc: "飼育できるようになった穏やかなうし" },
  tamed_chicken: { label: "にわとり", attr: "friendly", sell: 2, maxUses: null, desc: "卵を産み資源を提供してくれるにわとり" },

  // 敵（洞窟）
  skeleton: {
    label: "スケルトン", attr: "hostile", sell: null, maxUses: null, danger: 3, combatAttr: "ranged",
    maxHp: 6, atk: 3, def: 1, hitRate: 0.9, crit: 0.1, atkSpeed: 5.0,
    skills: [{ type: "bleed", chance: 0.2 }],
    drop: [{ type: "bone", w: 40 }, { type: "skull_helm", w: 10 }, { type: "magic_stone", w: 20 }, { type: "wood_shield", w: 5 }, { type: "bow", w: 5 }, { type: "quiver", w: 10 }, { type: "iron_armor", w: 5 }],
    moveInterval: 5, moveSpeed: 50,
    desc: "弓を構えて襲いかかってくる骸骨の魔物"
  },
  spider: {
    label: "クモ", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "magic",
    maxHp: 5, atk: 3, def: 0, hitRate: 0.8, crit: 0.1, atkSpeed: 4.0,
    skills: [{ type: "poison", chance: 0.3 }],
    drop: [{ type: "silk", w: 40 }, { type: "leather", w: 15 }, { type: "magic_stone", w: 15 }, { type: "rag", w: 10 }, { type: "cocoon", w: 10 }, { type: "curse_chest", w: 10 }],
    moveInterval: 3, moveSpeed: 40,
    desc: "素早く動き回る巨大な蜘蛛"
  },
  bat: {
    label: "コウモリ", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "ranged",
    maxHp: 3, atk: 1, def: 0, hitRate: 0.9, crit: 0.05, atkSpeed: 3.0,
    skills: [{ type: "drain", chance: 0.5, fraction: 1.0 }],
    drop: [{ type: "feather", w: 45 }, { type: "slingshot", w: 15 }, { type: "magic_stone", w: 10 }, { type: "mushroom", w: 20 }, { type: "dark_charm", w: 10 }],
    moveInterval: 1, moveSpeed: 30,
    desc: "暗闇を飛び回る小型の魔物"
  },
  zombie: {
    label: "ゾンビ", attr: "hostile", sell: null, maxUses: null, danger: 3, combatAttr: "melee",
    maxHp: 8, atk: 4, def: 2, hitRate: 0.75, crit: 0.10, atkSpeed: 6.0,
    drop: [{ type: "bone", w: 30 }, { type: "zombie_helm", w: 15 }, { type: "magic_stone", w: 20 }, { type: "wood_shield", w: 5 }, { type: "iron_shield", w: 5 }, { type: "iron_armor", w: 5 }, { type: "rag", w: 10 }, { type: "pickaxe", w: 10 }],
    moveInterval: 8, moveSpeed: 30,
    desc: "ゆっくり迫ってくる不死の怪物"
  },
  creeper: {
    label: "クリーパー", attr: "hostile", sell: null, maxUses: null, danger: 3, combatAttr: "magic",
    maxHp: 10, atk: 8, def: 0, hitRate: 0.85, crit: 0.0, atkSpeed: 18.0,
    skills: [{ type: "aoe", chance: 1.0 }],
    drop: [{ type: "magic_stone", w: 20 }, { type: "bomb_stick", w: 15 }, { type: "magic_book", w: 5 }, { type: "steel_chest", w: 10 }, { type: "sand", w: 20 }, { type: "plank", w: 15 }, { type: "brick", w: 15 }], creeper: true,
    moveInterval: 2, moveSpeed: 10,
    desc: "近づくと爆発する危険な魔物"
  },
  goblin: {
    label: "ゴブリン", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "melee",
    maxHp: 6, atk: 2, def: 1, hitRate: 0.75, crit: 0.1, atkSpeed: 3.5,
    skills: [{ type: "bleed", chance: 0.05 }],
    drop: [{ type: "magic_stone", w: 20 }, { type: "bone", w: 20 }, { type: "axe", w: 10 }, { type: "wood_shield", w: 10 }, { type: "rag", w: 15 }, { type: "leather_armor", w: 15 }, { type: "barbaric_charm", w: 10 }],
    moveInterval: 2, moveSpeed: 40,
    desc: "粗末な武器を振り回して突撃してくる小鬼"
  },
  dark_goblin: {
    label: "ダークゴブリン", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "ranged",
    maxHp: 5, atk: 2, def: 1, hitRate: 0.85, crit: 0.1, atkSpeed: 3.3,
    skills: [{ type: "bleed", chance: 0.05 }],
    drop: [{ type: "magic_stone", w: 20 }, { type: "quiver", w: 15 }, { type: "rag", w: 15 }, { type: "dark_charm", w: 10 }, { type: "slingshot", w: 15 }, { type: "leather_armor", w: 15 }, { type: "barbaric_charm", w: 10 }],
    moveInterval: 2, moveSpeed: 40,
    desc: "離れた場所から矢を放って攻撃してくる小鬼"
  },
  curse_goblin: {
    label: "カースゴブリン", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "magic",
    maxHp: 5, atk: 3, def: 1, hitRate: 0.80, crit: 0.05, atkSpeed: 3.7,
    skills: [{ type: "aoe", chance: 0.05 }, { type: "poison", chance: 0.05, }],
    drop: [{ type: "magic_stone", w: 20 }, { type: "magic_wand", w: 15 }, { type: "rag", w: 15 }, { type: "dark_charm", w: 10 }, { type: "curse_chest", w: 10 }, { type: "leather_armor", w: 15 }, { type: "barbaric_charm", w: 10 }],
    moveInterval: 2, moveSpeed: 40,
    desc: "怪しい魔術で敵を翻弄する小鬼"
  },
  elf: {
    label: "エルフ", attr: "hostile", sell: null, maxUses: null, danger: 4, combatAttr: "melee",
    maxHp: 15, atk: 5, def: 3, hitRate: 0.8, crit: 0.0, atkSpeed: 4.5,
    skills: [{ type: "drain", chance: 0.1, fraction: 1.0 }],
    drop: [{ type: "magic_stone", w: 20 }, { type: "iron_ingot", w: 20 }, { type: "glass", w: 10 }, { type: "bone", w: 15 }, { type: "dual_blades", w: 5 }, { type: "bone_spear", w: 5 }, { type: "iron_armor", w: 10 }, { type: "iron_shield", w: 10 }],
    moveInterval: 5, moveSpeed: 50,
    desc: "素早い動きで刃を振るう森の戦士"
  },
  dark_elf: {
    label: "ダークエルフ", attr: "hostile", sell: null, maxUses: null, danger: 4, combatAttr: "ranged",
    maxHp: 12, atk: 5, def: 2, hitRate: 0.9, crit: 0.0, atkSpeed: 4.0,
    skills: [{ type: "drain", chance: 0.1, fraction: 1.0 }],
    drop: [{ type: "magic_stone", w: 20 }, { type: "bow", w: 15 }, { type: "quiver", w: 15 }, { type: "iron_ingot", w: 20 }, { type: "glass", w: 10 }, { type: "bone", w: 10 }, { type: "iron_armor", w: 10 }],
    moveInterval: 5, moveSpeed: 50,
    desc: "高い命中精度で矢を射抜く弓使い"
  },
  curse_elf: {
    label: "カースエルフ", attr: "hostile", sell: null, maxUses: null, danger: 4, combatAttr: "magic",
    maxHp: 12, atk: 6, def: 2, hitRate: 0.9, crit: 0.0, atkSpeed: 4.8,
    skills: [{ type: "drain", chance: 0.15, fraction: 1.0 }, { type: "stun", chance: 0.1 }],
    drop: [{ type: "magic_stone", w: 20 }, { type: "iron_ingot", w: 20 }, { type: "glass", w: 10 }, { type: "bone", w: 15 }, { type: "magic_book", w: 5 }, { type: "bone_wand", w: 10 }, { type: "iron_armor", w: 10 }, { type: "curse_chest", w: 10 }],
    moveInterval: 5, moveSpeed: 50,
    desc: "自然の力を操る神秘的な術師"
  },
  mimic: {
    label: "ミミック", attr: "hostile", sell: null, maxUses: null, danger: 4, combatAttr: "magic",
    maxHp: 12, atk: 5, def: 2, hitRate: 0.85, crit: 0.2, atkSpeed: 5.0,
    drop: [{ type: "key", w: 50 }, { type: "gold_ore", w: 10 }, { type: "magic_stone", w: 20 }, { type: "map", w: 20 }],
    moveInterval: 15, moveSpeed: 120,
    desc: "宝箱に擬態して獲物を待つ魔物"
  },
  guardian: {
    label: "守護者", attr: "hostile", sell: null, maxUses: null, danger: 5, combatAttr: "melee",
    maxHp: 50, atk: 7, def: 3, hitRate: 0.95, crit: 0.05, atkSpeed: 8.0,
    skills: [{ type: "stun", chance: 0.2 }, { type: "aoe", chance: 0.4 }, { type: "bleed", chance: 0.2 }],
    drop: [{ type: "treasure_chest", w: 30 }, { type: "gold_ore", w: 10 }, { type: "magic_stone", w: 20 }, { type: "gold_armor", w: 10 }, { type: "steel_chest", w: 10 }, { type: "iron_shield", w: 10 }, { type: "hammer", w: 10 }],
    moveInterval: 15, moveSpeed: 0,
    desc: "宝や遺跡を守る強力な存在\n侵入者から一体何を守っているのだろうか"
  },
  witch: {
    label: "森の魔女", attr: "hostile", sell: null, maxUses: null, danger: 7, combatAttr: "magic",
    maxHp: 200, atk: 5, def: 2, hitRate: 0.9, crit: 0.05, atkSpeed: 3.0,
    skills: [{ type: "aoe", chance: 0.1 }, { type: "poison", chance: 0.1 }, { type: "heal", chance: 0.3, power: 2 }, { type: "invincible", chance: 0.1 }, { type: "frenzy", chance: 0.1 }],
    drop: [{ type: "witch_broom", w: 50 }, { type: "witch_hat", w: 50 }],
    moveInterval: 5, moveSpeed: 30,
    desc: ""
  },
  jormungand: {
    label: "ヨルムンガンド", attr: "hostile", sell: null, maxUses: null, danger: 8, combatAttr: "ranged",
    maxHp: 300, atk: 7, def: 3, hitRate: 0.8, crit: 0.05, atkSpeed: 4.0,
    skills: [{ type: "aoe", chance: 0.1 }, { type: "stun", chance: 0.3 }, { type: "drain", chance: 0.1, fraction: 1.0 }],
    drop: [{ type: "serpent_bow", w: 50 }, { type: "serpent_robe", w: 50 }],
    moveInterval: 10, moveSpeed: 50,
    desc: "世界を取り巻くとされる巨大な蛇の怪物"
  },
  abyss: {
    label: "アビス", attr: "hostile", sell: null, maxUses: null, danger: 10, combatAttr: "nothing",
    maxHp: 500, atk: 8, def: 4, hitRate: 0.9, crit: 0.2, atkSpeed: 4.5,
    skills: [{ type: "aoe", chance: 0.1 }, { type: "stun", chance: 0.3 }, { type: "invincible", chance: 0.1 }, { type: "heal", chance: 0.1, power: 4 }, { type: "bleed", chance: 0.1 }, { type: "frenzy", chance: 0.1 }],
    drop: [{ type: null, w: 100 }],
    moveInterval: 60, moveSpeed: 1,
    desc: "?????????????"
  },

  hungry_ghost: {
    label: "餓鬼", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "melee",
    maxHp: 4, atk: 2, def: 0, hitRate: 0.7, crit: 0.05, atkSpeed: 3.5,
    drop: [{ type: "soul", w: 50 }, { type: "rotten_wood", w: 5 }, { type: null, w: 45 }],
    moveInterval: 3, moveSpeed: 35,
    desc: "飢えに苦しみ続ける亡者"
  },
  wandering_soul: {
    label: "彷徨い魂", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "ranged",
    maxHp: 3, atk: 2, def: 1, hitRate: 0.8, crit: 0, atkSpeed: 4.5,
    drop: [{ type: "soul", w: 50 }, { type: "rotten_stone", w: 5 }, { type: null, w: 45 }],
    moveInterval: 5, moveSpeed: 40,
    desc: "行き場を失い漂う魂"
  },
  shadow_stitching: {
    label: "影縫い", attr: "hostile", sell: null, maxUses: null, danger: 2, combatAttr: "magic",
    maxHp: 3, atk: 1, def: 1, hitRate: 1.0, crit: 0.05, atkSpeed: 4.0,
    drop: [{ type: "soul", w: 50 }, { type: "bone", w: 5 }, { type: null, w: 45 }],
    moveInterval: 4.5, moveSpeed: 40,
    desc: "影に潜み獲物を待つ妖怪"
  },
  defeated_warrior: {
    label: "落武者", attr: "hostile", sell: null, maxUses: null, danger: 3, combatAttr: "melee",
    maxHp: 6, atk: 3, def: 2, hitRate: 0.75, crit: 0.10, atkSpeed: 6.0,
    drop: [{ type: "soul", w: 70 }, { type: "rusted_iron_ore", w: 5 }, { type: null, w: 25 }],
    moveInterval: 8, moveSpeed: 30,
    desc: "無念を抱いたまま彷徨う亡霊武者"
  },
  skeleton_soldier: {
    label: "骸兵", attr: "hostile", sell: null, maxUses: null, danger: 3, combatAttr: "ranged",
    maxHp: 5, atk: 3, def: 1, hitRate: 0.9, crit: 0.1, atkSpeed: 5.0,
    drop: [{ type: "soul", w: 70 }, { type: "rustes_gold_ore", w: 5 }, { type: null, w: 25 }],
    moveInterval: 5, moveSpeed: 50,
    desc: "骨だけになっても戦い続ける兵士"
  },
  crying_woman: {
    label: "啼き女", attr: "hostile", sell: null, maxUses: null, danger: 3, combatAttr: "magic",
    maxHp: 8, atk: 5, def: 0, hitRate: 0.85, crit: 0.0, atkSpeed: 12.0,
    drop: [{ type: "soul", w: 70 }, { type: "flint", w: 5 }, { type: null, w: 25 }],
    moveInterval: 3, moveSpeed: 10,
    desc: "悲痛な泣き声で生者を惑わす亡霊"
  },
  rakshasa: {
    label: "羅刹", attr: "hostile", sell: null, maxUses: null, danger: 4, combatAttr: "melee",
    maxHp: 12, atk: 4, def: 2, hitRate: 0.8, crit: 0.0, atkSpeed: 4.5,
    drop: [{ type: "soul", w: 90 }, { type: "cursed_wood", w: 5 }, { type: null, w: 5 }],
    moveInterval: 3.5, moveSpeed: 40,
    desc: "圧倒的な腕力を持つ鬼神"
  },
  crow_tengu: {
    label: "鴉天狗", attr: "hostile", sell: null, maxUses: null, danger: 4, combatAttr: "ranged",
    maxHp: 10, atk: 5, def: 2, hitRate: 0.9, crit: 0.0, atkSpeed: 4.0,
    drop: [{ type: "soul", w: 90 }, { type: "dead_stone", w: 5 }, { type: null, w: 5 }],
    moveInterval: 4.0, moveSpeed: 30,
    desc: "空から奇襲を仕掛けてくる妖怪"
  },
  curse_monk: {
    label: "呪詛僧", attr: "hostile", sell: null, maxUses: null, danger: 4, combatAttr: "magic",
    maxHp: 11, atk: 5, def: 2, hitRate: 0.85, crit: 0.0, atkSpeed: 4.8,
    drop: [{ type: "soul", w: 90 }, { type: "flint", w: 10 }],
    moveInterval: 5.0, moveSpeed: 35,
    desc: "邪悪な経を唱えて呪いを振りまく僧"
  },
  gozu: {
    label: "牛頭鬼", attr: "hostile", sell: null, maxUses: null, danger: 5, combatAttr: "melee",
    maxHp: 80, atk: 3, def: 6, hitRate: 0.9, crit: 0.05, atkSpeed: 5.0,
    skills: [{ type: "stun", chance: 0.1 } ],
    drop: [{ type: "soul", w: 100 }],
    moveInterval: 60, moveSpeed: 1,
    desc: "巨大な牛の頭を持つ冥界の番人"
  },
  mezu: {
    label: "馬頭鬼", attr: "hostile", sell: null, maxUses: null, danger: 5, combatAttr: "melee",
    maxHp: 50, atk: 6, def: 2, hitRate: 0.7, crit: 0.15, atkSpeed: 2.5,
    skills: [{ type: "bleed", chance: 0.1 } ],
    drop: [{ type: "soul", w: 100 }],
    moveInterval: 60, moveSpeed: 1,
    desc: "鋭い蹄で踏みつぶす冥界の処刑人"
  },
  uw_bird: {
    label: "冥鳥", attr: "hostile", sell: null, maxUses: null, danger: 5, combatAttr: "ranged",
    maxHp: 60, atk: 4, def: 4, hitRate: 0.9, crit: 0.1, atkSpeed: 4.0,
    skills: [{ type: "aoe", chance: 0.1 } ],
    drop: [{ type: "soul", w: 100 }],
    moveInterval: 60, moveSpeed: 1,
    desc: "不吉な鳴き声を響かせる黒い怪鳥"
  },
  soul_eater: {
    label: "魂喰い", attr: "hostile", sell: null, maxUses: null, danger: 5, combatAttr: "magic",
    maxHp: 50, atk: 3, def: 3, hitRate: 0.85, crit: 0.1, atkSpeed: 4.0,
    skills: [{ type: "heal", chance: 0.2, power: 3 }, { type: "invincible", chance: 0.1 }, { type: "poison", chance: 0.1 } ],
    drop: [{ type: "soul", w: 100 }],
    moveInterval: 60, moveSpeed: 1,
    desc: "魂そのものを捕食する恐ろしい怪物"
  },
  pluto: {
    label: "冥王", attr: "hostile", sell: null, maxUses: null, danger: 7, combatAttr: "melee",
    maxHp: 200, atk: 5, def: 5, hitRate: 0.8, crit: 0.2, atkSpeed: 4.5,
    skills: [{ type: "aoe", chance: 0.1 }, { type: "frenzy", chance: 0.1 }, { type: "bleed", chance: 0.1 }, { type: "stun", chance: 0.1 }],
    drop: [{ type: "soul_reaper", w: 100 }],
    dropCount: 5,
    moveInterval: 60, moveSpeed: 1,
    desc: "冥界の支配者\n四鬼を倒した者の前に現れる冥界の王"
  },

  // 貴重品
  key: { label: "鍵", attr: "precious", sell: 3, maxUses: null, desc: "金色に輝く鍵\nこの鍵は一体どこに..." },
  treasure_chest: { label: "宝箱", attr: "precious", sell: 2, maxUses: null, desc: "一体何が入っているのだろうか..." },
  pearl: { label: "真珠", attr: "precious", sell: 10, maxUses: null, desc: "美しい輝きを持つ貴重な珠\n高く売れそうだ" },
  holy_grail: { label: "聖杯", attr: "precious", sell: null, maxUses: null, desc: "特別な力を秘めるとされる杯\nどこかに奉納できそうだ" },
  magic_stone: { label: "魔石", attr: "precious", sell: 5, maxUses: null, desc: "不思議な魔力を宿した鉱石" },
  soul: { label: "霊魂", attr: "precious", sell: 3, maxUses: null, desc: "様々な念の残る魂の欠片" },
  old_book: { label: "古書", attr: "precious", sell: 4, maxUses: null, desc: "古代の知識が記された年代物の本" },
  witch_blood: { label: "魔女の生き血", attr: "precious", sell: null, maxUses: null, desc: "強い魔力を帯びた魔女の血液" },
  serpent_scale: { label: "大蛇の鱗", attr: "precious", sell: null, maxUses: null, desc: "世界蛇がか剥がれ落ちた巨大な鱗" },
  pluto_heart: { label: "冥王の心臓", attr: "precious", sell: null, maxUses: null, desc: "死してなお鼓動を続ける冥界の王の心臓" },
  end_grail: { label: "終焉の盃", attr: "precious", sell: null, maxUses: null, desc: "終焉の訪れを招くという盃\nどこかに奉納できそうだ" },
  monument: { label: "記念碑", attr: "precious", sell: null, maxUses: null, desc: "" },

  // 防具
  rag: {
    label: "ぼろ布", attr: "armor", sell: 2, maxUses: null,
    bonusMaxHp: 2, bonusAtkSpeed: -0.5, bonusDef: -1,
    desc: "最低限の防寒に使える擦り切れた布\nMaxHP +2  DEF -1  攻撃速度 +1"
  },
  feather_coat: {
    label: "羽毛のコート", attr: "armor", sell: 2, maxUses: null,
    bonusAtk: 1, bonusAtkSpeed: -0.5,
    desc: "軽く暖かい羽毛入りの外套\nATK +1  攻撃速度 +1"
  },
  leather_armor: {
    label: "革の鎧", attr: "armor", sell: 3, maxUses: null,
    bonusMaxHp: -3, bonusAtkSpeed: -1.0,
    desc: "動物の革を鞣して作った鎧\nMaxHP -3  攻撃速度 +2"
  },
  iron_armor: {
    label: "鉄の鎧", attr: "armor", sell: 4, maxUses: null,
    bonusMaxHp: 5, bonusDef: 2,
    desc: "頑丈な鉄板を繋ぎ合わせた鎧\nMaxHP +5  DEF +2"
  },
  gold_armor: {
    label: "黄金の鎧", attr: "armor", sell: 5, maxUses: null,
    bonusDef: 3, skills: [{ type: "stun", chance: 0.1 }],
    desc: "頑丈な鉄板を繋ぎ合わせた鎧\nDEF +3\n10%の確率でターゲットにスタンを付与する"
  },
  cocoon: {
    label: "繭", attr: "armor", sell: 3, maxUses: null,
    bonusMaxHp: 10, bonusDef: 1,
    desc: "蜘蛛が愛用しているという繭\nMaxHP +10  DEF +1"
  },
  steel_chest: {
    label: "鋼鉄の胸当て", attr: "armor", sell: 4, maxUses: null,
    bonusMaxHp: 2, bonusDef: 2,
    desc: "高い防御力を誇る金属製の鎧\nMaxHP +2  DEF +2"
  },
  curse_chest: {
    label: "呪いの胸当て", attr: "armor", sell: 4, maxUses: null,
    bonusMaxHp: -3, skills: [{ type: "stun", chance: 0.05 }, { type: "poison", chance: 0.05 }],
    desc: "禍々しい力を宿した危険な防具\nMaxHP -3\n5%の確率でターゲットにスタンを付与する\n5%の確率でターゲットに毒を付与する"
  },
  serpent_robe: {
    label: "世界蛇の外套", attr: "armor", sell: 8, maxUses: null,
    bonusMaxHp: 10, bonusAtk: 1, bonusDef: 2, bonusAtkSpeed: -0.5, bonusCrit: 0.07, skills: [{ type: "aoe", chance: 0.07 }],
    desc: "大蛇の素材から織られた伝説級の外套\nMaxHP +10  ATK +1  DEF +2  攻撃速度 +1\n7%の確率でクリティカルが発生する\n7%の確率で全体攻撃になる"
  },

  // 装飾品
  ring_of_life: {
    label: "命の指輪", attr: "accessory", sell: 4, maxUses: null,
    bonusMaxHp: 8, skills: [{ type: "heal", chance: 0.05, power: 1 }],
    desc: "生命の魔力が宿る美しい指輪\nMaxHP +8\n5%の確率で味方を回復する"
  },
  lucky_charm: {
    label: "幸運のお守り", attr: "accessory", sell: 4, maxUses: null,
    bonusHitRate: 0.10, bonusCrit: 0.07,
    desc: "四つ葉のクローバーを模したお守り\n命中率 +2\n7%の確率でクリティカルが発生する"
  },
  rabbit_charm: {
    label: "うさぎの耳飾り", attr: "accessory", sell: 2, maxUses: null,
    bonusMaxHp: -5, bonusAtkSpeed: -0.5, bonusDef: 1,
    desc: "素早さを高める軽やかな耳飾り\nMaxHP -5  DEF +1  攻撃速度 +1"
  },
  wood_shield: {
    label: "木の盾", attr: "accessory", sell: 3, maxUses: null,
    bonusAtk: 1, bonusDef: 1,
    desc: "木材で作られた簡素な盾\nATK 1  DEF +1"
  },
  iron_shield: {
    label: "鉄の盾", attr: "accessory", sell: 4, maxUses: null,
    bonusDef: 2, skills: [{ type: "stun", chance: 0.1 }],
    desc: "頑丈な鉄板で作られた盾\nDEF +2\n10%の確率でターゲットにスタンを付与する"
  },
  barbaric_charm: {
    label: "野蛮なお守り", attr: "accessory", sell: 3, maxUses: null,
    bonusMaxHp: 5, bonusHitRate: 0.05, bonusDef: 1, bonusCrit: 0.05,
    desc: "荒々しい力を感じさせる護符\nMaxHP +5  DEF +1  命中率 +1\n5%の確率でクリティカルが発生する"
  },
  mountain_charm: {
    label: "山のお守り", attr: "accessory", sell: 5, maxUses: null,
    bonusAtk: 2, skills: [{ type: "frenzy", chance: 0.1 }, { type: "invincible", chance: 0.1 }],
    desc: "岩山の加護を宿したお守り\nATK +2\n10%の確率で味方に狂乱を付与する\n10%の確率で味方に無敵を付与する"
  },
  forest_charm: {
    label: "森のお守り", attr: "accessory", sell: 5, maxUses: null,
    bonusMaxHp: 5, bonusAtkSpeed: -1.0, skills: [{ type: "heal", chance: 0.1, power: 2 }, { type: "drain", chance: 0.1, fraction: 2 }],
    desc: "森の精霊の力を宿す護符\nMaxHP +5  攻撃速度 +2\n10%の確率で味方を回復する\n10%の確率でターゲットからドレインする"
  },
  dark_charm: {
    label: "闇のお守り", attr: "accessory", sell: 5, maxUses: null,
    bonusMaxHp: 10, bonusCrit: 0.1,
    desc: "不気味な闇の力を秘めたお守り\nMaxHP +10\n10%の確率でクリティカルが発生する"
  },
  animal_hat: {
    label: "アニマルハット", attr: "accessory", sell: 5, maxUses: null,
    bonusDef: 1, bonusAtkSpeed: -1.0, skills: [{ type: "stun", chance: 0.1 }, { type: "poison", chance: 0.1 },],
    desc: "動物の姿を模した奇妙な帽子\nDEF +1  攻撃速度 +2\n10%の確率でターゲットにスタンを付与する\n10%の確率でターゲットに毒を付与する"
  },
  zombie_helm: {
    label: "ゾンビヘルム", attr: "accessory", sell: 5, maxUses: null,
    bonusMaxHp: 5, bonusAtk: 2, bonusDef: 2, skills: [{ type: "drain", chance: 0.1, fraction: 2 }],
    desc: "死者の気配をまとった不穏な兜\nMaxHP +5  ATK +2  DEF +2\n10%の確率でターゲットからドレインする"
  },
  skull_helm: {
    label: "スカルヘルム", attr: "accessory", sell: 5, maxUses: null,
    bonusMaxHp: 5, bonusAtkSpeed: -1.0, bonusDef: 1,
    desc: "骸骨を模した威圧感のある兜\nMaxHP +5  DEF +1  攻撃速度 +2"
  },
  quiver: {
    label: "矢筒", attr: "accessory", sell: 4, maxUses: null,
    bonusAtkSpeed: -1.0, skills: [{ type: "bleed", chance: 0.1 }],
    desc: "矢をまとめて収納するための筒\n攻撃速度 +2\n10%の確率でターゲットに出血を付与する"
  },
  warding_charm: {
    label: "厄除けの護符", attr: "accessory", sell: 3, maxUses: null,
    bonusMaxHp: 3, bonusDef: 1,
    desc: "冥界の魔物を遠ざけるお守り\nMaxHP +3  DEF +1\n冥界でスポーンする敵モブが1体減少する"
  },
  soul_drain_ring: {
    label: "吸魂の指輪", attr: "accessory", sell: 3, maxUses: null,
    bonusMaxHp: 4,
    desc: "倒した敵の魂を吸い取る指輪\nMaxHP +4\n戦闘で敵を倒した時、自身のHPを2回復する"
  },
  witch_hat: {
    label: "黒尖帽", attr: "accessory", sell: 6, maxUses: null,
    bonusMaxHp: 5, bonusHitRate: 0.1, bonusDef: 1, skills: [{ type: "aoe", chance: 0.15 }],
    desc: "魔女の象徴とされる黒い尖り帽子\nMaxHP +5  DEF +1  命中率 +2\n15%の確率で全体攻撃になる"
  },

  // その他
  recipe_card: { label: "レシピ", attr: "recipe", sell: 1, maxUses: null },
  pack_card: { label: "カードパック", attr: "pack", sell: null, maxUses: null, desc: "クリックするとカードを1枚排出する" },
};

// ── 職業のデフォルト効果 ──────────────────────
const JOB_EFFECTS = {
  farmer: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "土を耕し食料を生産する働き手\nいるだけで作物の成長時間が短縮される" },
  soldier: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "前線で剣を振るう熟練の兵\n魔法に有利" },
  guard: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "村や住民を守るために戦う兵士\n魔法に有利" },
  ninja: { defaultMult: 0.95, applyMode: "participant", mealCost: 2, desc: "影に潜み素早く動く隠密\n近接に有利" },
  hunter: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "遠くから獲物を狙う狩猟の専門家\n近接に有利" },
  mage: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "元素を操り魔法を放つ賢者\n遠距離に有利" },
  logger: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "木を切り出して木材を集める職人\n木の伐採が速い" },
  miner: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "地下を掘り進み鉱石を採掘する作業員\n石系の採掘が速い" },
  builder: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "建物や家具を作る建築の職人\n施設の建築や素材の加工が速い" },
  explorer: { defaultMult: 1.2, applyMode: "participant", mealCost: 2, desc: "未知の土地や遺跡を調査する冒険者\n探索が非常に速いが、他の作業は遅い" },
  priest: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "神に祈りを捧げる聖職者\n戦いには向かないが、献身的な治癒で仲間を支える" },
  grave_keeper: { defaultMult: 1.0, applyMode: "participant", mealCost: 2, desc: "墓の整備を欠かさない者\n冥界での作業時間が短縮される" },
  hades: { defaultMult: 1.0, applyMode: "participant", mealCost: 0, desc: "死を導く魂の管理者\n食事を必要としない" }
};

// ── 手なずけ定義 ──────────────────────────────
// mob      : 手なずけ対象のモブカード種類
// item     : 使用するアイテムカード種類
// result   : 手なずけ成功後のカード種類
// chance   : 成功確率（0.0〜1.0）
// keepItem : アイテムを消費しない場合はtrue（省略時はfalse=消費する）
const TAME_DEFS = [
  { mob: "rabbit", item: "carrot", result: "tamed_rabbit", chance: 0.75 },
  { mob: "cow", item: "wheat", result: "tamed_cow", chance: 0.75 },
  { mob: "chicken", item: "seed", result: "tamed_chicken", chance: 0.75 },
];

const CURSE_DEFS = [
  { from: "wood", to: "rotten_wood" },
  { from: "stone", to: "rotten_stone" },
  { from: "iron_ore", to: "rusted_iron_ore" },
  { from: "gold_ore", to: "rusted_gold_ore" },
  { from: "rotten_wood", to: "cursed_wood" },
  { from: "rotten_stone", to: "dead_stone" },
  { from: "rusted_iron_ore", to: "uw_iron_ore" },
  { from: "rusted_gold_ore", to: "uw_gold_ore" },
];

// ── 探索アイテムプール ──────────────────────────────
const search_forest = [
  { out: "apple_tree", w: 10 },
  { out: "apple", w: 10 },
  { out: "tree", w: 10 },
  { out: "stick", w: 10 },
  { out: "rabbit", w: 10 },
  { out: "mushroom", w: 10 },
  { out: "treasure_chest", w: 5 },
  { out: "__recipe__", w: 30 },
];
const search_mountain = [
  { out: "rock", w: 20 },
  { out: "flint", w: 20 },
  { out: "spider", w: 10 },
  { out: "iron_vein", w: 15 },
  { out: "treasure_chest", w: 5 },
  { out: "__recipe__", w: 30 },
];
const search_plain = [
  { out: "chicken", w: 10 },
  { out: "cow", w: 10 },
  { out: "mushroom", w: 10 },
  { out: "onion", w: 10 },
  { out: "potato", w: 10 },
  { out: "carrot", w: 10 },
  { out: "milk", w: 10 },
  { out: "egg", w: 10 },
  { out: "soil", w: 10 },
  { out: "__recipe__", w: 30 },
];
const search_beach = [
  { out: "sand", w: 25 },
  { out: "glass", w: 10 },
  { out: "rope", w: 10 },
  { out: "wood", w: 10 },
  { out: "pearl", w: 5 },
  { out: "key", w: 5 },
  { out: "__recipe__", w: 30 },
];
const search_cemetery = [
  { out: "zombie", w: 15 },
  { out: "skeleton", w: 15 },
  { out: "bone", w: 10 },
  { out: "dirt", w: 10 },
  { out: "gold_vein", w: 10 },
  { out: "treasure_chest", w: 5 },
  { out: "ancient_city", w: 10 },
  { out: "__recipe__", w: 30 },
];
const search_ancient_city = [
  { out: "old_book", w: 11 },
  { out: "guardian", w: 11 },
  { out: "gold_vein", w: 11 },
  { out: "treasure_chest", w: 11 },
  { out: "key", w: 11 },
  { out: "__recipe__", w: 30 },
];

// ── レシピ定義 ────────────────────────────────
// inputs    : 必要なカードの種類と枚数 { カード種類: 枚数 }
// variants  : 生成されるカード [{out: 種類, w: 重み(確率)}]
// time      : クラフトにかかる時間（秒）
// keepAttrs : クラフト後も残す属性（"human"など）
// speedJobBonus: 職業ごとの倍率上書き
//   { 職業名: { mult: 倍率, mode: "participant" or "present" } }
//   省略した職業はJOB_EFFECTSのdefaultMultとapplyModeが使われる
//   defaultMultが1.0の職業は省略時に効果なし
const RECIPES = [
  // ── 地上系 ──
  {
    inputs: { human: 1, tree: 1 }, variants: [{ out: "wood", w: 85 }, { out: "stick", w: 10 }, { out: "apple", w: 5 }],
    time: 10, keepAttrs: ["human"], speedJobBonus: { logger: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, dead_tree: 1 }, variants: [{ out: "wood", w: 80 }, { out: "stick", w: 15 }, { out: "soul", w: 5 }],
    time: 10, keepAttrs: ["human"], speedJobBonus: { logger: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, rock: 1 }, variants: [{ out: "stone", w: 80 }, { out: "flint", w: 20 }],
    time: 10, keepAttrs: ["human"], speedJobBonus: { miner: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, tomb_stone: 1 }, variants: [{ out: "stone", w: 80 }, { out: "bone", w: 15 }, { out: "soul", w: 5 }],
    time: 10, keepAttrs: ["human"], speedJobBonus: { miner: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, wood: 1 }, variants: [{ out: "stick", w: 100 }],
    time: 10, keepAttrs: ["human"],
  },
  {
    inputs: { human: 1, wood: 3 }, variants: [{ out: "plank", w: 100 }],
    time: 30, keepAttrs: ["human"], recipeTag: "packB", recipeAttr: ["base","resource"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { plank_factory: 1, wood: 2 }, variants: [{ out: "plank", w: 100 }],
    time: 10, keepAttrs: ["building"],
  },
  {
    inputs: { human: 1, stone: 3 }, variants: [{ out: "brick", w: 100 }],
    time: 30, keepAttrs: ["human"], recipeTag: "packB", recipeAttr: ["base","resource"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { brick_factory: 1, stone: 2 }, variants: [{ out: "brick", w: 100 }],
    time: 10, keepAttrs: ["building"],
  },
  {
    inputs: { glass_factory: 1, sand: 2 }, variants: [{ out: "glass", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { human: 2, house: 1 }, variants: [{ out: "baby", w: 100 }],
    time: 30, keepAttrs: ["human", "building"], recipeTag: "packA", recipeAttr: ["base"], cantDoll: true
  },
  {
    inputs: { baby: 1, house: 1 }, variants: [{ out: "human", w: 100 }],
    time: 60, keepAttrs: ["building"],
  },
  {
    inputs: { human: 1, apple_tree: 1 }, variants: [{ out: "apple", w: 100 }],
    time: 10, keepAttrs: ["human"], speedJobBonus: { farmer: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, plantation: 1 }, variants: [{ out: "wood", w: 80 }, { out: "stick", w: 20 }],
    time: 15, keepAttrs: ["human", "building"], speedJobBonus: { logger: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, quarry: 1 }, variants: [{ out: "stone", w: 80 }, { out: "flint", w: 20 }],
    time: 15, keepAttrs: ["human", "building"], speedJobBonus: { miner: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, iron_mine: 1 }, variants: [{ out: "iron_ore", w: 80 }, { out: "stone", w: 15 }, { out: "flint", w: 5 }],
    time: 45, keepAttrs: ["human", "building"], speedJobBonus: { miner: { mult: 0.5, mode: "participant" } }
  },
  {
    inputs: { human: 1, gold_mine: 1 }, variants: [{ out: "gold_ore", w: 80 }, { out: "stone", w: 15 }, { out: "flint", w: 5 }],
    time: 45, keepAttrs: ["human", "building"], speedJobBonus: { miner: { mult: 0.5, mode: "participant" } }
  },
  {
    inputs: { human: 1, sand_pit: 1 }, variants: [{ out: "sand", w: 90 }, { out: "glass", w: 5 }, { out: "gold_ingot", w: 5 }],
    time: 15, keepAttrs: ["human", "building"],
  },
  {
    inputs: { composter: 1, food: 3 }, variants: [{ out: "dirt", w: 100 }],
    time: 30, keepAttrs: ["building"],
  },
  {
    inputs: { silk: 2 }, variants: [{ out: "rope", w: 100 }],
    time: 20, keepAttrs: [], recipeTag: "beach", recipeAttr: ["resource"]
  },
  {
    inputs: { sugar_cane: 2 }, variants: [{ out: "paper", w: 100 }],
    time: 20, keepAttrs: [], recipeTag: "packC", recipeAttr: ["resource"]
  },

  // ── 栽培系 ──
  {
    inputs: { dirt: 1, farmer: 1 }, variants: [{ out: "soil", w: 100 }],
    time: 10, keepAttrs: ["human"], recipeTag: "packC", requireJob: "farmer", recipeAttr: ["base","agriculture","building"]
  },
  {
    inputs: { dirt: 1, apple: 1 }, variants: [{ out: "apple_tree", w: 100 }],
    time: 60, keepAttrs: []
  },
  {
    inputs: { soil: 1, carrot: 1 }, variants: [{ out: "carrot", w: 100 }],
    time: 100, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { garden: 1, carrot: 1 }, variants: [{ out: "carrot", w: 100 }],
    time: 75, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { farm: 1, carrot: 1 }, variants: [{ out: "carrot", w: 100 }],
    time: 50, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { soil: 1, onion: 1 }, variants: [{ out: "onion", w: 100 }],
    time: 140, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { garden: 1, onion: 1 }, variants: [{ out: "onion", w: 100 }],
    time: 105, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { farm: 1, onion: 1 }, variants: [{ out: "onion", w: 100 }],
    time: 70, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { soil: 1, potato: 1 }, variants: [{ out: "potato", w: 100 }],
    time: 120, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { garden: 1, potato: 1 }, variants: [{ out: "potato", w: 100 }],
    time: 90, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { farm: 1, potato: 1 }, variants: [{ out: "potato", w: 100 }],
    time: 60, keepAttrs: ["building", "food"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { soil: 1, seed: 1 }, variants: [{ out: "wheat", w: 100 }],
    time: 40, keepAttrs: ["building"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { garden: 1, seed: 1 }, variants: [{ out: "wheat", w: 100 }],
    time: 30, keepAttrs: ["building"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { farm: 1, seed: 1 }, variants: [{ out: "wheat", w: 100 }],
    time: 20, keepAttrs: ["building"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { dirt: 1, mushroom: 1 }, variants: [{ out: "mushroom", w: 100 }],
    time: 120, keepAttrs: ["material", "food"], recipeTag: "packD", recipeAttr: ["agriculture"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },
  {
    inputs: { dirt: 1, sugar_cane: 1 }, variants: [{ out: "sugar_cane", w: 100 }],
    time: 50, keepAttrs: ["material", "food"], recipeTag: "packC", recipeAttr: ["agriculture"], speedJobBonus: { farmer: { mult: 0.9, mode: "present" } }
  },

  // ── 料理系 ──
  {
    inputs: { wheat: 3 }, variants: [{ out: "bread", w: 100 }],
    time: 20, keepAttrs: [], recipeTag: "packC", recipeAttr: ["cooking"]
  },
  {
    inputs: { bonfire: 1, raw_meat: 1 }, variants: [{ out: "grilled_meat", w: 100 }],
    time: 50, keepAttrs: ["building"], recipeTag: "packA", recipeAttr: ["base","cooking"]
  },
  {
    inputs: { kiln: 1, raw_meat: 1 }, variants: [{ out: "grilled_meat", w: 100 }],
    time: 25, keepAttrs: ["building"],
  },
  {
    inputs: { bonfire: 1, potato: 1 }, variants: [{ out: "baked_potato", w: 100 }],
    time: 60, keepAttrs: ["building"], recipeTag: "packD", recipeAttr: ["cooking"]
  },
  {
    inputs: { kiln: 1, potato: 1 }, variants: [{ out: "baked_potato", w: 100 }],
    time: 30, keepAttrs: ["building"],
  },
  {
    inputs: { bonfire: 1, mushroom: 2 }, variants: [{ out: "mushroom_stew", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "packD", recipeAttr: ["cooking"]
  },
  {
    inputs: { kiln: 1, mushroom: 2 }, variants: [{ out: "mushroom_stew", w: 100 }],
    time: 20, keepAttrs: ["building"],
  },
  {
    inputs: { bonfire: 1, egg: 1, potato: 1 }, variants: [{ out: "frittata", w: 100 }],
    time: 70, keepAttrs: ["building"], recipeTag: "packD", recipeAttr: ["cooking"]
  },
  {
    inputs: { kiln: 1, egg: 1, potato: 1 }, variants: [{ out: "frittata", w: 100 }],
    time: 35, keepAttrs: ["building"],
  },
  {
    inputs: { bonfire: 1, egg: 2 }, variants: [{ out: "omelet", w: 100 }],
    time: 60, keepAttrs: ["building"], recipeTag: "packD", recipeAttr: ["cooking"]
  },
  {
    inputs: { kiln: 1, egg: 2 }, variants: [{ out: "omelet", w: 100 }],
    time: 30, keepAttrs: ["building"],
  },
  {
    inputs: { bonfire: 1, egg: 1, milk: 1, wheat: 1 }, variants: [{ out: "pancake", w: 100 }],
    time: 100, keepAttrs: ["building"], recipeTag: "packD", recipeAttr: ["cooking"]
  },
  {
    inputs: { kiln: 1, egg: 1, milk: 1, wheat: 1 }, variants: [{ out: "pancake", w: 100 }],
    time: 50, keepAttrs: ["building"],
  },
  {
    inputs: { bonfire: 1, raw_meat: 1, onion: 1, carrot: 1, potato: 1 }, variants: [{ out: "stew", w: 100 }],
    time: 120, keepAttrs: ["building"], recipeTag: "packD", recipeAttr: ["cooking"]
  },
  {
    inputs: { kiln: 1, raw_meat: 1, onion: 1, carrot: 1, potato: 1 }, variants: [{ out: "stew", w: 100 }],
    time: 60, keepAttrs: ["building"],
  },
  {
    inputs: { milk: 1, apple: 1 }, variants: [{ out: "fruit_milk", w: 100 }],
    time: 20, keepAttrs: [], recipeTag: "packC", recipeAttr: ["cooking"]
  },
  {
    inputs: { human: 1, apple: 1, stick: 1 }, variants: [{ out: "candy_apple", w: 100 }],
    time: 10, keepAttrs: ["human"], recipeTag: "packB", recipeAttr: ["base","cooking"]
  },

  // ── 家畜系 ──
  {
    inputs: { tamed_rabbit: 1 }, time: 80, keepAttrs: ["friendly", "building"],
    variants: [{ out: "seed", w: 60 }, { out: "carrot", w: 30 }, { out: "poop", w: 10 }],
  },
  {
    inputs: { tamed_cow: 1 }, time: 100, keepAttrs: ["friendly", "building"],
    variants: [{ out: "milk", w: 60 }, { out: "leather", w: 30 }, { out: "poop", w: 10 }],
  },
  {
    inputs: { tamed_chicken: 1 }, time: 90, keepAttrs: ["friendly", "building"],
    variants: [{ out: "egg", w: 60 }, { out: "feather", w: 30 }, { out: "poop", w: 10 }],
  },
  {
    inputs: { tamed_rabbit: 1, livestock_fence: 1 }, variants: [{ out: "seed", w: 60 }, { out: "carrot", w: 30 }, { out: "poop", w: 10 }],
    time: 50, keepAttrs: ["friendly", "building"],
  },
  {
    inputs: { tamed_cow: 1, livestock_fence: 1 }, variants: [{ out: "milk", w: 60 }, { out: "leather", w: 30 }, { out: "poop", w: 10 }],
    time: 70, keepAttrs: ["friendly", "building"],
  },
  {
    inputs: { tamed_chicken: 1, livestock_fence: 1 }, variants: [{ out: "egg", w: 60 }, { out: "feather", w: 30 }, { out: "poop", w: 10 }],
    time: 60, keepAttrs: ["friendly", "building"],
  },
  {
    inputs: { slaughterhouse: 1, tamed_rabbit: 1 }, variants: [{ out: "raw_meat", w: 100 }],
    time: 60, keepAttrs: ["building"],
  },
  {
    inputs: { slaughterhouse: 1, tamed_cow: 1 }, variants: [{ out: "raw_meat", w: 80 }, { out: "leather", w: 20 }],
    time: 60, keepAttrs: ["building"],
  },
  {
    inputs: { slaughterhouse: 1, tamed_chicken: 1 }, variants: [{ out: "raw_meat", w: 80 }, { out: "feather", w: 20 }],
    time: 60, keepAttrs: ["building"],
  },
  {
    inputs: { breeding_shed: 1, tamed_rabbit: 2 }, variants: [{ out: "tamed_rabbit", w: 100 }],
    time: 120, keepAttrs: ["friendly", "building"]
  },
  {
    inputs: { breeding_shed: 1, tamed_cow: 2 }, variants: [{ out: "tamed_cow", w: 100 }],
    time: 120, keepAttrs: ["friendly", "building"]
  },
  {
    inputs: { breeding_shed: 1, tamed_chicken: 1, egg: 1 }, variants: [{ out: "tamed_chicken", w: 100 }],
    time: 120, keepAttrs: ["friendly", "building"], recipeTag: "forest", recipeAttr: ["agriculture"]
  },

  // ── 洞窟・採掘系 ──
  {
    inputs: { human: 1, iron_vein: 1 }, variants: [{ out: "iron_ore", w: 100 }],
    time: 20, keepAttrs: ["human"], speedJobBonus: { miner: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, gold_vein: 1 }, variants: [{ out: "gold_ore", w: 100 }],
    time: 25, keepAttrs: ["human"], speedJobBonus: { miner: { mult: 0.8, mode: "participant" } }
  },

  // ── 特殊施設アクション ──
  {
    inputs: { priest: 1, human: 1 }, time: 30, keepAttrs: ["human"],
    specialType: "heal", healAmount: 1, desc: "祈りによって村人を癒やす"
  },
  {
    inputs: { church: 1, human: 1 }, time: 20, keepAttrs: ["human", "building"],
    specialType: "heal", healAmount: 1, desc: "神聖な場所で休息し体力を回復する"
  },
  {
    inputs: { market: 1, __sellable__: 1 }, time: 60, keepAttrs: ["building"],
    specialType: "sell_multiplier", multiplier: 2, desc: "市場で商品を高く売り込む"
  },
  {
    inputs: { library: 1, emerald: 50 }, time: 60, keepAttrs: ["building"],
    variants: [{ out: "__recipe__", w: 100 }], exploreRecipes: "library", desc: "膨大な蔵書から新たな知識を得る"
  },
  {
    inputs: { soul_return_table: 1, cursed: 1 }, time: 30, keepAttrs: ["building"],
    specialType: "soul_return", desc: "霊魂を抽出する"
  },
  {
    inputs: { altar: 1, soul: 3 }, time: 30, keepAttrs: ["building"],
    specialType: "offering", desc: "死の呪いを中和する"
  },

  // ── 精錬系 ──
  {
    inputs: { furnace: 1, iron_ore: 1 }, variants: [{ out: "iron_ingot", w: 100 }],
    time: 40, keepAttrs: ["building"], furnaceRecipe: true, fuelCost: 1.0
  },
  {
    inputs: { furnace: 1, gold_ore: 1 }, variants: [{ out: "gold_ingot", w: 100 }],
    time: 50, keepAttrs: ["building"], furnaceRecipe: true, fuelCost: 1.0
  },
  {
    inputs: { furnace: 1, sand: 1 }, variants: [{ out: "glass", w: 100 }],
    time: 20, keepAttrs: ["building"], recipeTag: "beach", recipeAttr: ["resource"], furnaceRecipe: true, fuelCost: 1.0
  },
  {
    inputs: { soul_furnace: 1, rusted_iron_ore: 1 }, variants: [{ out: "rusted_iron_ingot", w: 100 }],
    time: 30, keepAttrs: ["building"], soulFurnaceRecipe: true, fuelCost: 1.0
  },
  {
    inputs: { soul_furnace: 1, rusted_gold_ore: 1 }, variants: [{ out: "rusted_gold_ingot", w: 100 }],
    time: 40, keepAttrs: ["building"], soulFurnaceRecipe: true, fuelCost: 1.0
  },
  {
    inputs: { soul_furnace: 1, uw_iron_ore: 1 }, variants: [{ out: "uw_iron_ingot", w: 100 }],
    time: 40, keepAttrs: ["building"], soulFurnaceRecipe: true, fuelCost: 1.0
  },
  {
    inputs: { soul_furnace: 1, uw_gold_ore: 1 }, variants: [{ out: "uw_gold_ingot", w: 100 }],
    time: 50, keepAttrs: ["building"], soulFurnaceRecipe: true, fuelCost: 1.0
  },

  // ── 施設建築系 ──
  {
    inputs: { human: 1, wood: 1, stone: 2 }, variants: [{ out: "house", w: 100 }],
    time: 30, keepAttrs: ["human"], recipeTag: "packA", recipeAttr: ["base","building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { flint: 1, stick: 1 }, variants: [{ out: "bonfire", w: 100 }],
    time: 20, keepAttrs: [], recipeTag: "packA", recipeAttr: ["base","building","cooking"]
  },
  {
    inputs: { human: 1, flint: 1, iron_ingot: 1, brick: 1 }, variants: [{ out: "kiln", w: 100 }],
    time: 50, keepAttrs: ["human"], recipeTag: "library", recipeAttr: ["base","building","cooking"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, wood: 1, stone: 1, stick: 1 }, variants: [{ out: "warehouse", w: 100 }],
    time: 30, keepAttrs: ["human"], recipeTag: "packB", recipeAttr: ["base","building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, iron_ingot: 1, stone: 1 }, variants: [{ out: "storage", w: 100 }],
    time: 45, keepAttrs: ["human"], recipeTag: "packE", recipeAttr: ["building","important"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { soil: 1, wood: 1, stone: 2, human: 1 }, variants: [{ out: "garden", w: 100 }],
    time: 30, keepAttrs: ["human"], recipeTag: "packD", recipeAttr: ["agriculture","building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { soil: 1, plank: 1, brick: 2, human: 1 }, variants: [{ out: "farm", w: 100 }],
    time: 50, keepAttrs: ["human"], recipeTag: "plain", recipeAttr: ["agriculture","building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, wood: 3, stone: 1 }, variants: [{ out: "plantation", w: 100 }],
    time: 40, keepAttrs: ["human"], recipeTag: "packB", recipeAttr: ["base","building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, wood: 1, stone: 3 }, variants: [{ out: "quarry", w: 100 }],
    time: 40, keepAttrs: ["human"], recipeTag: "packB", recipeAttr: ["base","building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, flint: 2, wood: 1, stone: 1 }, variants: [{ out: "iron_mine", w: 100 }],
    time: 70, keepAttrs: ["human"], recipeTag: "packF", recipeAttr: ["building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, gold_ore: 1, flint: 1, wood: 1, stone: 1 }, variants: [{ out: "gold_mine", w: 100 }],
    time: 80, keepAttrs: ["human"], recipeTag: "library", recipeAttr: ["building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, plank: 1, brick: 1, sand: 1 }, variants: [{ out: "sand_pit", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "packH", recipeAttr: ["building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, plank: 1, stone: 1, iron_ingot: 1 }, variants: [{ out: "plank_factory", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "packE", recipeAttr: ["building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, brick: 1, wood: 1, iron_ingot: 1 }, variants: [{ out: "brick_factory", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "packE", recipeAttr: ["building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, glass: 1, iron_ingot: 1 }, variants: [{ out: "glass_factory", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "beach", recipeAttr: ["building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, flint: 2, plank: 1, brick: 2 }, variants: [{ out: "furnace", w: 100 }],
    time: 80, keepAttrs: ["human"], recipeTag: "packE", recipeAttr: ["base","building","important"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, iron_ingot: 2, brick: 2 }, variants: [{ out: "smithing_table", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "packE", recipeAttr: ["building","military","important"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, plank: 1, brick: 1, stick: 2 }, variants: [{ out: "monster_cage", w: 100 }],
    time: 20, keepAttrs: ["human"], recipeTag: "packF", recipeAttr: ["building","military"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, plank: 1, wood: 1, iron_ingot: 1 }, variants: [{ out: "livestock_fence", w: 100 }],
    time: 40, keepAttrs: ["human"], recipeTag: "mountain", recipeAttr: ["building","agriculture"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { livestock_fence: 1, magic_stone: 2 }, variants: [{ out: "breeding_shed", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "forest", recipeAttr: ["building","agriculture"],
  },
  {
    inputs: { human: 1, plank: 2, raw_meat: 1, iron_ingot: 1 }, variants: [{ out: "slaughterhouse", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "mountain", recipeAttr: ["building","agriculture"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, plank: 1, brick: 1, poop: 2 }, variants: [{ out: "composter", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "packC", recipeAttr: ["building","agriculture"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { plank: 1, brick: 2, priest: 1 }, variants: [{ out: "church", w: 100 }],
    time: 75, keepAttrs: ["human"], recipeTag: "packG", recipeAttr: ["building","military"], requireJob: "priest"
  },
  {
    inputs: { human: 1, old_book: 1, brick: 3 }, variants: [{ out: "library", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "ancient_city", recipeAttr: ["building","important"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 1, iron_ingot: 1, brick: 3 }, variants: [{ out: "market", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "packE", recipeAttr: ["building"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { brick: 1, iron_ingot: 1, bonfire: 1 }, variants: [{ out: "dining_table", w: 100 }],
    time: 60, keepAttrs: [], recipeTag: "plain", recipeAttr: ["building","cooking"],
  },
  {
    inputs: { human: 3, plank: 3, brick: 3, glass: 3, iron_ingot: 3 }, variants: [{ out: "temple", w: 100 }],
    time: 180, keepAttrs: ["human"], recipeTag: "packH", recipeAttr: ["building","important"], speedJobBonus: { builder: { mult: 0.9, mode: "participant" } }
  },
  {
    inputs: { brick: 2, magic_stone: 2, human: 1 }, variants: [{ out: "stable_gate", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "library", recipeAttr: ["gate","important"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { bone: 2, magic_stone: 2, human: 1 }, variants: [{ out: "underworld_door", w: 100 }],
    time: 20, keepAttrs: ["human"], recipeTag: "ancient_city", recipeAttr: ["gate", "important","underworld"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { bone: 2, rotten_wood: 1, rotten_stone: 1, human: 1 }, variants: [{ out: "soul_return_table", w: 100 }],
    time: 20, keepAttrs: ["human"], recipeTag: "uwPackA", recipeAttr: ["underworld"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { flint: 2, rotten_stone: 2, soul: 1, human: 1 }, variants: [{ out: "soul_furnace", w: 100 }],
    time: 30, keepAttrs: ["human"], recipeTag: "uwPackB", recipeAttr: ["underworld"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { rusted_iron_ingot: 1, rotten_wood: 1, rotten_stone: 1, human: 1 }, variants: [{ out: "defilement_spring", w: 100 }],
    time: 20, keepAttrs: ["human"], recipeTag: "uwPackB", recipeAttr: ["underworld"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { rusted_iron_ingot: 1, wood: 1, stone: 1, human: 1 }, variants: [{ out: "purification_spring", w: 100 }],
    time: 20, keepAttrs: ["human"], recipeTag: "uwPackB", recipeAttr: ["underworld"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { uw_iron_ingot: 1, cursed_wood: 1, dead_stone: 1, human: 1 }, variants: [{ out: "resentment_swamp", w: 100 }],
    time: 40, keepAttrs: ["human"], recipeTag: "uwPackD", recipeAttr: ["underworld"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { rusted_gold_ingot: 1, plank: 1, brick: 1, human: 1, }, variants: [{ out: "church", w: 100 }],
    time: 45, keepAttrs: ["human"], recipeTag: "uwPackC", recipeAttr: ["underworld"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { human: 3, cursed_wood: 2, dead_stone: 2, uw_iron_ingot: 1, uw_gold_ingot: 1 }, variants: [{ out: "mausoleum", w: 100 }],
    time: 60, keepAttrs: ["human"], recipeTag: "uwPackD", recipeAttr: ["underworld","important"], speedJobBonus: { builder: { mult: 0.8, mode: "participant" } }
  },
  {
    inputs: { mausoleum: 1, soul: 10 }, variants: [{ out: "soul", w: 100 }],
    time: 10, keepAttrs: ["building"], specialType: "uw_boss", desc: "冥王召喚の儀"
  },

  // ── 職業系 ──
  {
    inputs: { wood: 2, stick: 1 }, variants: [{ out: "hoe", w: 100 }],
    time: 5, keepAttrs: [], recipeTag: "packB", recipeAttr: ["job","agriculture"]
  },
  {
    inputs: { stone: 2, stick: 1 }, variants: [{ out: "sword", w: 100 }],
    time: 8, keepAttrs: [], recipeTag: "packA", recipeAttr: ["job","military"]
  },
  {
    inputs: { wood: 1, stick: 2 }, variants: [{ out: "spear", w: 100 }],
    time: 8, keepAttrs: [], recipeTag: "packA", recipeAttr: ["job","military"]
  },
  {
    inputs: { spear: 1, bone: 2 }, variants: [{ out: "bone_spear", w: 100 }],
    time: 8, keepAttrs: [], recipeTag: "cemetery", recipeAttr: ["job","military"]
  },
  {
    inputs: { stone: 1, stick: 2 }, variants: [{ out: "slingshot", w: 100 }],
    time: 8, keepAttrs: [], recipeTag: "packB", recipeAttr: ["job","military"]
  },
  {
    inputs: { iron_ingot: 3, smithing_table: 1 }, variants: [{ out: "shuriken", w: 100 }],
    time: 20, keepAttrs: ["building"], recipeTag: "packG", recipeAttr: ["job","military"]
  },
  {
    inputs: { rope: 1, plank: 1, stick: 1 }, variants: [{ out: "bow", w: 100 }],
    time: 15, keepAttrs: [], recipeTag: "packF", recipeAttr: ["job","military"]
  },
  {
    inputs: { plank: 3, smithing_table: 1 }, variants: [{ out: "boomerang", w: 100 }],
    time: 20, keepAttrs: ["building"], recipeTag: "packG", recipeAttr: ["job","military"]
  },
  {
    inputs: { gold_ingot: 1, iron_ingot: 1, plank: 1, flint: 1, smithing_table: 1 }, variants: [{ out: "heavy_bowgun", w: 100 }],
    time: 30, keepAttrs: ["building"], recipeTag: "packH", recipeAttr: ["job","military"]
  },
  {
    inputs: { iron_ingot: 1, plank: 1, wood: 1, rope: 1, smithing_table: 1 }, variants: [{ out: "light_bowgun", w: 100 }],
    time: 30, keepAttrs: ["building"], recipeTag: "cemetery", recipeAttr: ["job","military"]
  },
  {
    inputs: { sword: 2, smithing_table: 1 }, variants: [{ out: "dual_blades", w: 100 }],
    time: 20, keepAttrs: ["building"], recipeTag: "packG", recipeAttr: ["job","military"]
  },
  {
    inputs: { sword: 1, iron_ingot: 3, smithing_table: 1 }, variants: [{ out: "great_sword", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "packH", recipeAttr: ["job","military"]
  },
  {
    inputs: { magic_stone: 1, wood: 1, smithing_table: 1 }, variants: [{ out: "magic_wand", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "packF", recipeAttr: ["job","military"]
  },
  {
    inputs: { magic_wand: 1, bone: 1, gold_ingot: 1, smithing_table: 1 }, variants: [{ out: "bone_wand", w: 100 }],
    time: 50, keepAttrs: ["building"], recipeTag: "cemetery", recipeAttr: ["job","military"]
  },
  {
    inputs: { magic_stone: 2, paper: 1, leather: 1, smithing_table: 1 }, variants: [{ out: "magic_book", w: 100 }],
    time: 60, keepAttrs: ["building"], recipeTag: "packH", recipeAttr: ["job","military"]
  },
  {
    inputs: { iron_ingot: 1, stick: 1, wood: 1 }, variants: [{ out: "axe", w: 100 }],
    time: 30, keepAttrs: [], recipeTag: "packE", recipeAttr: ["job","military"]
  },
  {
    inputs: { iron_ingot: 1, stick: 1, flint: 1 }, variants: [{ out: "pickaxe", w: 100 }],
    time: 30, keepAttrs: [], recipeTag: "packE", recipeAttr: ["job","military"]
  },
  {
    inputs: { iron_ingot: 1, stick: 1, stone: 1 }, variants: [{ out: "hammer", w: 100 }],
    time: 30, keepAttrs: [], recipeTag: "packF", recipeAttr: ["job","military"]
  },
  {
    inputs: { paper: 1, leather: 1, feather: 1 }, variants: [{ out: "map", w: 100 }],
    time: 30, keepAttrs: [], recipeTag: "packG", recipeAttr: ["job"]
  },
  {
    inputs: { paper: 2, leather: 1, gold_ingot: 1 }, variants: [{ out: "bible", w: 100 }],
    time: 30, keepAttrs: [], recipeTag: "packF", recipeAttr: ["job","military"]
  },
  {
    inputs: { uw_gold_ingot: 1, stick: 2 }, variants: [{ out: "shovel", w: 100 }],
    time: 10, keepAttrs: [], recipeTag: "uwPackB", recipeAttr: ["job","underworld"]
  },
  {
    inputs: { stick: 2, bone: 2, soul: 2 }, variants: [{ out: "resentment_spear", w: 100 }],
    time: 15, keepAttrs: [], recipeTag: "uwPackC", recipeAttr: ["job","military","underworld"]
  },
  {
    inputs: { rotten_wood: 2, stick: 1, soul: 2 }, variants: [{ out: "underworld_wand", w: 100 }],
    time: 15, keepAttrs: [], recipeTag: "uwPackC", recipeAttr: ["job","military","underworld"]
  },
  {
    inputs: { flint: 2, bone: 3 }, variants: [{ out: "necro_dart", w: 100 }],
    time: 15, keepAttrs: [], recipeTag: "uwPackC", recipeAttr: ["job","military"]
  },

  // ── 防具 ──
  {
    inputs: { leather: 2, human: 1 }, variants: [{ out: "leather_armor", w: 100 }],
    time: 20, keepAttrs: ["human"], recipeTag: "packC", recipeAttr: ["armor","military"]
  },
  {
    inputs: { iron_ingot: 2, smithing_table: 1 }, variants: [{ out: "iron_armor", w: 100 }],
    time: 30, keepAttrs: ["building"], recipeTag: "packF", recipeAttr: ["armor","military"]
  },
  {
    inputs: { gold_ingot: 2, smithing_table: 1 }, variants: [{ out: "gold_armor", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "ancient_city", recipeAttr: ["armor","military"]
  },

  // ── 装飾品 ──
  {
    inputs: { plank: 1, stick: 1 }, variants: [{ out: "wood_shield", w: 100 }],
    time: 10, keepAttrs: [], recipeTag: "packE", recipeAttr: ["accessory","military"]
  },
  {
    inputs: { iron_ingot: 1, plank: 1, smithing_table: 1 }, variants: [{ out: "iron_shield", w: 100 }],
    time: 20, keepAttrs: ["building"], recipeTag: "packF", recipeAttr: ["accessory","military"]
  },
  {
    inputs: { gold_ingot: 2, magic_stone: 1, stone: 1, smithing_table: 1 }, variants: [{ out: "mountain_charm", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "mountain", recipeAttr: ["accessory","military"]
  },
  {
    inputs: { gold_ingot: 2, magic_stone: 1, wood: 1, smithing_table: 1 }, variants: [{ out: "forest_charm", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "forest", recipeAttr: ["accessory","military"]
  },
  {
    inputs: { leather: 1, feather: 1, gold_ingot: 1 }, variants: [{ out: "animal_hat", w: 100 }],
    time: 30, keepAttrs: [], recipeTag: "plain", recipeAttr: ["accessory","military"]
  },
  {
    inputs: { gold_ingot: 2, magic_stone: 1, smithing_table: 1 }, variants: [{ out: "ring_of_life", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "packH", recipeAttr: ["accessory","military"]
  },
  {
    inputs: { gold_ingot: 1, magic_stone: 2, smithing_table: 1 }, variants: [{ out: "lucky_charm", w: 100 }],
    time: 40, keepAttrs: ["building"], recipeTag: "packH", recipeAttr: ["accessory","military"]
  },
  {
    inputs: { bone: 2, soul: 1 }, variants: [{ out: "warding_charm", w: 100 }],
    time: 15, keepAttrs: [], recipeTag: "uwPackA", recipeAttr: ["accessory","military","underworld"]
  },
  {
    inputs: { gold_ingot: 1, soul: 2 }, variants: [{ out: "soul_drain_ring", w: 100 }],
    time: 20, keepAttrs: [], recipeTag: "uwPackD", recipeAttr: ["accessory","military","underworld"]
  },

  // ── 探索 ──
  {
    inputs: { human: 1, forest: 1 }, variants: search_forest, exploreRecipes: "forest",
    time: 40, keepAttrs: ["human", "search"], speedJobBonus: { explorer: { mult: 0.5, mode: "participant" } }
  },
  {
    inputs: { human: 1, mountain: 1 }, variants: search_mountain, exploreRecipes: "mountain",
    time: 40, keepAttrs: ["human", "search"], speedJobBonus: { explorer: { mult: 0.5, mode: "participant" } }
  },
  {
    inputs: { human: 1, plain: 1 }, variants: search_plain, exploreRecipes: "plain",
    time: 40, keepAttrs: ["human", "search"], speedJobBonus: { explorer: { mult: 0.5, mode: "participant" } }
  },
  {
    inputs: { human: 1, beach: 1 }, variants: search_beach, exploreRecipes: "beach",
    time: 40, keepAttrs: ["human", "search"], speedJobBonus: { explorer: { mult: 0.5, mode: "participant" } }
  },
  {
    inputs: { human: 1, cemetery: 1 }, variants: search_cemetery, exploreRecipes: "cemetery",
    time: 40, keepAttrs: ["human", "search"], speedJobBonus: { explorer: { mult: 0.5, mode: "participant" } }
  },
  {
    inputs: { human: 1, ancient_city: 1 }, variants: search_ancient_city, exploreRecipes: "ancient_city",
    time: 40, keepAttrs: ["human", "search"], speedJobBonus: { explorer: { mult: 0.5, mode: "participant" } }
  },

  // ── 冥界 ──
  {
    inputs: { rotten_wood: 1, wood: 1, stone: 1 }, variants: [{ out: "wood_doll", w: 100 }],
    time: 10, keepAttrs: [], recipeTag: "uwPackA", recipeAttr: ["underworld"]
  },
  {
    inputs: { cursed_wood: 1, wood: 1, stone: 1 }, variants: [{ out: "cursed_wood_doll", w: 100 }],
    time: 10, keepAttrs: [], recipeTag: "uwPackD", recipeAttr: ["underworld"]
  },
  {
    inputs: { rotten_stone: 1, wood: 1, stone: 1 }, variants: [{ out: "stone_doll", w: 100 }],
    time: 10, keepAttrs: [],
  },
  {
    inputs: { dead_stone: 1, wood: 1, stone: 1 }, variants: [{ out: "dead_stone_doll", w: 100 }],
    time: 10, keepAttrs: [],
  },
  {
    inputs: { rusted_iron_ingot: 1, wood: 1, stone: 1 }, variants: [{ out: "iron_doll", w: 100 }],
    time: 15, keepAttrs: [],
  },
  {
    inputs: { uw_iron_ingot: 1, wood: 1, stone: 1 }, variants: [{ out: "uw_iron_doll", w: 100 }],
    time: 15, keepAttrs: [],
  },
  {
    inputs: { rusted_gold_ingot: 1, wood: 1, stone: 1 }, variants: [{ out: "gold_doll", w: 100 }],
    time: 25, keepAttrs: [],
  },
  {
    inputs: { uw_gold_ingot: 1, wood: 1, stone: 1 }, variants: [{ out: "uw_gold_doll", w: 100 }],
    time: 25, keepAttrs: [],
  },
  {
    inputs: { wood_doll: 1, soul: 1 }, variants: [{ out: "wood_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { cursed_wood_doll: 1, soul: 1 }, variants: [{ out: "cursed_wood_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { stone_doll: 1, soul: 1 }, variants: [{ out: "stone_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { dead_stone_doll: 1, soul: 1 }, variants: [{ out: "dead_stone_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { iron_doll: 1, soul: 1 }, variants: [{ out: "iron_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { uw_iron_doll: 1, soul: 1 }, variants: [{ out: "uw_iron_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { gold_doll: 1, soul: 1 }, variants: [{ out: "gold_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { uw_gold_doll: 1, soul: 1 }, variants: [{ out: "uw_gold_soul_doll", w: 100 }],
    time: 3, keepAttrs: [], desc: "依り代に霊魂を定着中"
  },
  {
    inputs: { defilement_spring: 1, wood: 1 }, variants: [{ out: "rotten_wood", w: 100 }],
    time: 30, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, wood: 1 }, variants: [{ out: "rotten_wood", w: 100 }],
    time: 22.5, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { defilement_spring: 1, stone: 1 }, variants: [{ out: "rotten_stone", w: 100 }],
    time: 30, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, stone: 1 }, variants: [{ out: "rotten_stone", w: 100 }],
    time: 22.5, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { defilement_spring: 1, iron_ore: 1 }, variants: [{ out: "rusted_iron_ore", w: 100 }],
    time: 60, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, iron_ore: 1 }, variants: [{ out: "rusted_iron_ore", w: 100 }],
    time: 45, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { defilement_spring: 1, gold_ore: 1 }, variants: [{ out: "rusted_gold_ore", w: 100 }],
    time: 90, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, gold_ore: 1 }, variants: [{ out: "rusted_gold_ore", w: 100 }],
    time: 67.5, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { defilement_spring: 1, rotten_wood: 1 }, variants: [{ out: "cursed_wood", w: 100 }],
    time: 90, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, rotten_wood: 1 }, variants: [{ out: "cursed_wood", w: 100 }],
    time: 67.5, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { defilement_spring: 1, rotten_stone: 1 }, variants: [{ out: "dead_stone", w: 100 }],
    time: 90, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, rotten_stone: 1 }, variants: [{ out: "dead_stone", w: 100 }],
    time: 67.5, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { defilement_spring: 1, rusted_iron_ore: 1 }, variants: [{ out: "uw_iron_ore", w: 100 }],
    time: 120, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, rusted_iron_ore: 1 }, variants: [{ out: "uw_iron_ore", w: 100 }],
    time: 90, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { defilement_spring: 1, rusted_gold_ore: 1 }, variants: [{ out: "uw_gold_ore", w: 100 }],
    time: 150, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { resentment_swamp: 1, rusted_gold_ore: 1 }, variants: [{ out: "uw_gold_ore", w: 100 }],
    time: 112.5, keepAttrs: ["building"], desc: ""
  },
  {
    inputs: { purification_spring: 1, rotten_wood: 1 }, variants: [{ out: "wood", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, rotten_stone: 1 }, variants: [{ out: "stone", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, rusted_iron_ore: 1 }, variants: [{ out: "iron_ore", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, rusted_iron_ingot: 1 }, variants: [{ out: "iron_ingot", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, rusted_gold_ore: 1 }, variants: [{ out: "gold_ore", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, rusted_gold_ingot: 1 }, variants: [{ out: "gold_ingot", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, cursed_wood: 1 }, variants: [{ out: "rotten_wood", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, dead_stone: 1 }, variants: [{ out: "rotten_stone", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, uw_iron_ore: 1 }, variants: [{ out: "rusted_iron_ore", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, uw_iron_ingot: 1 }, variants: [{ out: "rusted_iron_ingot", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, uw_gold_ore: 1 }, variants: [{ out: "rusted_gold_ore", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },
  {
    inputs: { purification_spring: 1, uw_gold_ingot: 1 }, variants: [{ out: "rusted_gold_ingot", w: 100 }],
    time: 15, keepAttrs: ["building"],
  },

  // ── その他 ──
  {
    inputs: { bone: 2, stone: 2 }, variants: [{ out: "cemetery", w: 100 }],
    time: 60, keepAttrs: [], recipeTag: "packG", recipeAttr: ["important"]
  },
  {
    inputs: { smithing_table: 1, gold_ingot: 1 }, variants: [{ out: "key", w: 100 }],
    time: 30, keepAttrs: ["building"], recipeTag: "ancient_city"
  },
  {
    inputs: { temple: 1, holy_grail: 1 }, variants: [{ out: "jormungand", w: 100 }],
    time: 30, keepAttrs: ["building"], desc: "神殿に遺物を奉納中"
  },
  {
    inputs: { serpent_scale: 1, witch_blood: 1, pluto_heart: 1 }, variants: [{ out: "end_grail", w: 100 }],
    time: 30, keepAttrs: []
  },
  {
    inputs: { temple: 1, end_grail: 1 }, variants: [{ out: "abyss", w: 100 }],
    time: 30, keepAttrs: ["building"], desc: "神殿に遺物を奉納中"
  },
];

// ── パック排出テーブル ─────────────────────────
// type: カード種類, w: 重み（数字が大きいほど出やすい）
const PACK_A = [
  { type: "tree", w: 15 },
  { type: "rock", w: 15 },
  { type: "apple_tree", w: 15 },
  { type: "wood", w: 10 },
  { type: "stone", w: 10 },
  { type: "dirt", w: 10 },
  { type: "apple", w: 10 },
  { type: "rabbit", w: 10 },
  { type: "key", w: 3 },
];
const PACK_B = [
  { type: "tree", w: 15 },
  { type: "rock", w: 15 },
  { type: "apple_tree", w: 14 },
  { type: "wood", w: 15 },
  { type: "stone", w: 15 },
  { type: "dirt", w: 6 },
  { type: "stick", w: 10 },
  { type: "flint", w: 10 },
  { type: "poop", w: 3 },
];
const PACK_C = [
  { type: "apple", w: 8 },
  { type: "dirt", w: 5 },
  { type: "soil", w: 5 },
  { type: "apple_tree", w: 8 },
  { type: "rabbit", w: 10 },
  { type: "cow", w: 10 },
  { type: "chicken", w: 10 },
  { type: "tree", w: 8 },
  { type: "rock", w: 8 },
  { type: "raw_meat", w: 8 },
  { type: "seed", w: 10 },
  { type: "carrot", w: 10 },
  { type: "sugar_cane", w: 5 },
];
const PACK_D = [
  { type: "apple", w: 8 },
  { type: "egg", w: 8 },
  { type: "milk", w: 8 },
  { type: "apple_tree", w: 8 },
  { type: "potato", w: 8 },
  { type: "mushroom", w: 8 },
  { type: "onion", w: 8 },
  { type: "tree", w: 8 },
  { type: "rock", w: 8 },
  { type: "raw_meat", w: 8 },
  { type: "seed", w: 8 },
  { type: "carrot", w: 8 },
  { type: "sugar_cane", w: 8 },
];
const PACK_E = [
  { type: "apple_tree", w: 16 },
  { type: "tree", w: 16 },
  { type: "rock", w: 16 },
  { type: "plank", w: 16 },
  { type: "brick", w: 16 },
  { type: "iron_ore", w: 16 },
];
const PACK_F = [
  { type: "apple_tree", w: 8 },
  { type: "tree", w: 8 },
  { type: "rock", w: 8 },
  { type: "plank", w: 8 },
  { type: "brick", w: 8 },
  { type: "iron_ore", w: 8 },
  { type: "skeleton", w: 8 },
  { type: "spider", w: 8 },
  { type: "bat", w: 8 },
  { type: "zombie", w: 8 },
  { type: "creeper", w: 8 },
];
const PACK_G = [
  { type: "apple_tree", w: 7 },
  { type: "tree", w: 7 },
  { type: "rock", w: 7 },
  { type: "skeleton", w: 7 },
  { type: "spider", w: 7 },
  { type: "bat", w: 7 },
  { type: "zombie", w: 7 },
  { type: "creeper", w: 7 },
  { type: "forest", w: 8 },
  { type: "mountain", w: 8 },
  { type: "plain", w: 8 },
  { type: "beach", w: 8 },
];
const PACK_H = [
  { type: "apple_tree", w: 16 },
  { type: "tree", w: 16 },
  { type: "rock", w: 16 },
  { type: "plank", w: 16 },
  { type: "brick", w: 16 },
  { type: "iron_ore", w: 16 },
  { type: "gold_ore", w: 8 },
];

const UW_PACK_A = [
  { type: "dead_tree", w: 15 },
  { type: "tomb_stone", w: 15 },
  { type: "wood", w: 15 },
  { type: "stone", w: 15 },
  { type: "bone", w: 15 },
  { type: "flint", w: 5 },
  { type: "rotten_wood", w: 5 },
  { type: "rotten_stone", w: 5 },
  { type: "hungry_ghost", w: 5 },
  { type: "wandering_soul", w: 5 },
  { type: "shadow_stitching", w: 5 },
];
const UW_PACK_B = [
  { type: "dead_tree", w: 12 },
  { type: "tomb_stone", w: 12 },
  { type: "iron_vein", w: 7 },
  { type: "gold_vein", w: 5 },
  { type: "bone", w: 10 },
  { type: "wood", w: 9 },
  { type: "stone", w: 9 },
  { type: "rotten_wood", w: 4 },
  { type: "rotten_stone", w: 4 },
  { type: "flint", w: 13 },
  { type: "defeated_warrior", w: 10 },
  { type: "skeleton_soldier", w: 10 },
  { type: "crying_woman", w: 10 },
];
const UW_PACK_C = [
  { type: "dead_tree", w: 12 },
  { type: "tomb_stone", w: 12 },
  { type: "iron_vein", w: 10 },
  { type: "gold_vein", w: 6 },
  { type: "flint", w: 5 },
  { type: "hungry_ghost", w: 10 },
  { type: "wandering_soul", w: 10 },
  { type: "shadow_stitching", w: 10 },
  { type: "defeated_warrior", w: 10 },
  { type: "skeleton_soldier", w: 10 },
  { type: "crying_woman", w: 10 },
];
const UW_PACK_D = [
  { type: "dead_tree", w: 13 },
  { type: "tomb_stone", w: 13 },
  { type: "iron_vein", w: 10 },
  { type: "gold_vein", w: 8 },
  { type: "rotten_wood", w: 5 },
  { type: "rotten_stone", w: 5 },
  { type: "rusted_iron_ore", w: 3 },
  { type: "rusted_gold_ore", w: 3 },
  { type: "flint", w: 5 },
  { type: "bone", w: 5 },
  { type: "rakshasa", w: 10 },
  { type: "crow_tengu", w: 10 },
  { type: "curse_monk", w: 10 },
];

// パックごとに排出されるカードの枚数
const PACK_A_COUNT = 3;
const PACK_B_COUNT = 4;
const PACK_C_COUNT = 4;
const PACK_D_COUNT = 4;
const PACK_E_COUNT = 4;
const PACK_F_COUNT = 4;
const PACK_G_COUNT = 4;
const PACK_H_COUNT = 4;

const UW_PACK_A_COUNT = 4;
const UW_PACK_B_COUNT = 4;
const UW_PACK_C_COUNT = 4;
const UW_PACK_D_COUNT = 4;

// パックの値段
const PACK_COSTS = {
  packShopA: 3,
  packShopB: 4,
  packShopC: 10,
  packShopD: 10,
  packShopE: 15,
  packShopF: 15,
  packShopG: 20,
  packShopH: 25,

  uwPackShopA: 4,
  uwPackShopB: 10,
  uwPackShopC: 15,
  uwPackShopD: 20,
};

// レシピカードの排出設定
// recipeWeight: パック内でのレシピカードの出やすさ（重み）
// null = デフォルト（重み10）
// 数値指定で変更可能
const PACK_A_RECIPE_WEIGHT = 20;
const PACK_B_RECIPE_WEIGHT = 25;
const PACK_C_RECIPE_WEIGHT = 10;
const PACK_D_RECIPE_WEIGHT = 10;
const PACK_E_RECIPE_WEIGHT = 25;
const PACK_F_RECIPE_WEIGHT = 10;
const PACK_G_RECIPE_WEIGHT = 10;
const PACK_H_RECIPE_WEIGHT = 10;

const UW_PACK_A_RECIPE_WEIGHT = 20;
const UW_PACK_B_RECIPE_WEIGHT = 20;
const UW_PACK_C_RECIPE_WEIGHT = 20;
const UW_PACK_D_RECIPE_WEIGHT = 20;

const PACK_A_RECIPES = "packA";
const PACK_B_RECIPES = "packB";
const PACK_C_RECIPES = "packC";
const PACK_D_RECIPES = "packD";
const PACK_E_RECIPES = "packE";
const PACK_F_RECIPES = "packF";
const PACK_G_RECIPES = "packG";
const PACK_H_RECIPES = "packH";

const UW_PACK_A_RECIPES = "uwPackA";
const UW_PACK_B_RECIPES = "uwPackB";
const UW_PACK_C_RECIPES = "uwPackC";
const UW_PACK_D_RECIPES = "uwPackD";