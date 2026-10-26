/* 生鲜账 · 农产品电商单位经济计算器
   口径：客户收到足称重量 W 斤，采后损耗由卖家承担，实际采购 W/(1−损耗率) 斤；
   包赔按客单价计提；佣金按客单价费率；保本 = 变动成本合计（固定成本另摊）。 */

const FIELDS = ["price", "weight", "cost", "loss", "pack", "ship", "comp", "fee", "ads", "fixed", "orders"];
const PRESETS = {
  tubo: { label: "土拨购乡橙（5斤装99元）", price: 99, weight: 5, cost: 4.5, loss: 12, pack: 6, ship: 10, comp: 5, fee: 2, ads: 15, fixed: 6000, orders: 30 },
  generic: { label: "通用生鲜（客单50元）", price: 50, weight: 3, cost: 3, loss: 10, pack: 3, ship: 6, comp: 3, fee: 2, ads: 8, fixed: 4000, orders: 20 },
};
const SENS = [
  { key: "loss", label: "损耗率 ±10%", rel: true },
  { key: "ship", label: "快递费 ±10%", rel: true },
  { key: "price", label: "客单价 ±10%", rel: true },
  { key: "ads", label: "推广费 ±10%", rel: true },
  { key: "orders", label: "日均单量 ±10%", rel: true },
];

let charts = {};
const $ = (id) => document.getElementById(id);
const num = (id) => parseFloat($(id).value) || 0;

function calc(p) {
  const buyWeight = p.weight / (1 - p.loss / 100);       // 承担损耗后的实际采购量
  const purchase = buyWeight * p.cost;                    // 采购成本
  const comp = p.price * p.comp / 100;                    // 包赔计提
  const fee = p.price * p.fee / 100;                      // 平台佣金
  const varCost = purchase + p.pack + p.ship + comp + fee + p.ads;
  const unit = p.price - varCost;                         // 单均贡献毛利
  const marginPct = p.price > 0 ? unit / p.price * 100 : 0;
  const monthContrib = unit * p.orders * 30;
  const monthProfit = monthContrib - p.fixed;
  const bePrice = varCost;                                // 保本客单价（贡献毛利=0）
  const beOrders = unit > 0 ? Math.ceil(p.fixed / 30 / unit) : Infinity;
  return { buyWeight, purchase, comp, fee, varCost, unit, marginPct, monthContrib, monthProfit, bePrice, beOrders };
}

function fmt(n, digits = 1) {
  return n.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function render() {
  const p = {};
  FIELDS.forEach((k) => p[k] = num(k));
  const r = calc(p);

  // ---- 瀑布图：一单的钱去哪了 ----
  const items = [
    ["客单价", p.price, "start"],
    ["采购成本", -r.purchase], ["包装", -p.pack], ["快递/冷链", -p.ship],
    ["包赔计提", -r.comp], ["平台佣金", -r.fee], ["推广", -p.ads],
    ["单均贡献", null, "total"],
  ];
  let cum = 0;
  const helper = [], value = [], colors = [];
  items.forEach(([name, v, kind]) => {
    if (kind === "start") { helper.push(0); value.push(v); cum = v; colors.push("#16A34A"); }
    else if (kind === "total") { helper.push(0); value.push(Math.max(cum, 0)); colors.push(cum >= 0 ? "#15803D" : "#E5484D"); }
    else {
      helper.push(Math.min(cum, cum + v));
      value.push(Math.abs(v));
      colors.push("#E5484D");
      cum += v;
    }
  });
  if (!charts.wf) charts.wf = echarts.init($("waterfall"));
  charts.wf.setOption({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => "¥" + fmt(v, 2) },
    grid: { left: 46, right: 10, top: 14, bottom: 46 },
    xAxis: { type: "category", data: items.map((i) => i[0]), axisLabel: { fontSize: 9.5, interval: 0, rotate: 24 } },
    yAxis: { type: "value", name: "元", nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
    series: [
      { type: "bar", stack: "w", data: helper, itemStyle: { color: "transparent" }, barMaxWidth: 34, silent: true },
      { type: "bar", stack: "w", data: value.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })), barMaxWidth: 34 },
    ],
  }, { notMerge: true });

  // ---- 单均损益表 ----
  $("unitRows").innerHTML = `<table class="tbl">
    <tbody>
      <tr><td>客单价收入</td><td class="num pos">+${fmt(p.price, 2)}</td></tr>
      <tr><td>采购成本（含 ${fmt(p.loss, 1)}% 损耗，实采 ${fmt(r.buyWeight, 2)} 斤）</td><td class="num neg">−${fmt(r.purchase, 2)}</td></tr>
      <tr><td>包装材料</td><td class="num neg">−${fmt(p.pack, 2)}</td></tr>
      <tr><td>快递 / 冷链</td><td class="num neg">−${fmt(p.ship, 2)}</td></tr>
      <tr><td>售后包赔计提</td><td class="num neg">−${fmt(r.comp, 2)}</td></tr>
      <tr><td>平台佣金 / 支付费</td><td class="num neg">−${fmt(r.fee, 2)}</td></tr>
      <tr><td>推广费</td><td class="num neg">−${fmt(p.ads, 2)}</td></tr>
      <tr class="total"><td>单均贡献毛利（占售价 ${fmt(r.marginPct, 1)}%）</td><td class="num ${r.unit >= 0 ? "pos" : "neg"}">${r.unit >= 0 ? "+" : ""}${fmt(r.unit, 2)}</td></tr>
    </tbody></table>`;

  // ---- 保本点 ----
  $("breakeven").innerHTML = `<div class="be-grid">
    <div class="be-item"><b>¥${fmt(r.bePrice, 1)}</b><span>保本客单价</span></div>
    <div class="be-item"><b>${r.beOrders === Infinity ? "—" : r.beOrders + " 单/天"}</b><span>保本日均单量</span></div>
    <div class="be-item"><b class="${r.monthProfit >= 0 ? "pos" : "neg"}">¥${fmt(r.monthProfit, 0)}</b><span>月利润（扣固定成本前 ${fmt(r.monthContrib, 0)}）</span></div>
  </div>`;

  // ---- 龙卷风 ----
  const base = r.monthProfit;
  const rowsT = SENS.map((s) => {
    const lo = { ...p }, hi = { ...p };
    if (s.rel) { lo[s.key] = p[s.key] * 0.9; hi[s.key] = p[s.key] * 1.1; }
    return { label: s.label, lo: calc(lo).monthProfit, hi: calc(hi).monthProfit };
  }).sort((a, b) => Math.abs(b.hi - b.lo) - Math.abs(a.hi - a.lo));
  if (!charts.tn) charts.tn = echarts.init($("tornado"));
  charts.tn.setOption({
    tooltip: { trigger: "axis", valueFormatter: (v) => "¥" + fmt(v, 0) },
    legend: { top: 0, textStyle: { fontSize: 11 } },
    grid: { left: 96, right: 20, top: 30, bottom: 26 },
    xAxis: { type: "value", axisLabel: { fontSize: 10, formatter: (v) => v / 10000 + "万" } },
    yAxis: { type: "category", data: rowsT.map((x) => x.label), axisLabel: { fontSize: 11 } },
    series: [
      { name: "参数 −10%", type: "bar", stack: "t", data: rowsT.map((x) => x.lo), itemStyle: { color: "#E5484D" }, barMaxWidth: 16 },
      { name: "参数 +10%", type: "bar", stack: "t", data: rowsT.map((x) => x.hi), itemStyle: { color: "#16A34A" }, barMaxWidth: 16 },
    ],
  }, { notMerge: true });

  // ---- 经营提示 ----
  const tips = [];
  const contrib = r.unit;
  if (contrib < 5) tips.push(`每单贡献毛利只有 ¥${fmt(contrib, 2)}：优先谈产地直采价（采购每降 0.5 元/斤，每单多赚 ¥${fmt(p.weight / (1 - p.loss / 100) * 0.5, 2)}），或把客单价提 ${fmt(Math.max(0, 5 - contrib), 0)} 元。`);
  if (p.loss > 10) tips.push(`损耗率 ${fmt(p.loss, 1)}% 偏高：每优化 1 个百分点，每月省 ¥${fmt(p.weight / (1 - p.loss / 100) * p.cost * 0.01 * p.orders * 30, 0)} 元——分级筛选和冷链时效是主攻方向。`);
  if (p.ads / Math.max(p.price, 1) > 0.12) tips.push(`推广费占售价 ${fmt(p.ads / p.price * 100, 1)}%：付费流量买不来复购——把预算挪到社群老客（复购单没有获客成本），是利润最大杠杆。`);
  if (r.beOrders !== Infinity && p.orders < r.beOrders) tips.push(`当前日均 ${p.orders} 单低于保本线 ${r.beOrders} 单：先解决流量与转化，再谈扩大规模。`);
  if (r.monthProfit > 0) tips.push(`月利润为正（¥${fmt(r.monthProfit, 0)}）：放大前先验证复购率与包赔率在小规模下的稳定性，避免"量上来利润反而没了"。`);
  if (p.comp > 5) tips.push(`包赔计提 ${fmt(p.comp, 1)}% 偏高：坏果赔付的根因多在包装与快递时效，与这两项成本联动优化更划算。`);
  if (!tips.length) tips.push("各项参数均在常见区间：尝试调整任一输入，龙卷风图会实时告诉你月利润对谁最敏感。");
  $("advice").innerHTML = tips.map((t) => `· ${t}`).join("<br>");
}

function setPreset(name) {
  const pr = PRESETS[name];
  if (!pr) return;
  FIELDS.forEach((k) => { if (pr[k] !== undefined) $(k).value = pr[k]; });
  document.querySelectorAll(".preset").forEach((b) => b.classList.toggle("active", b.dataset.preset === name));
  render();
  if (name === "tubo") toast("已载入土拨购乡橙口径（5 斤装 99 元，参数为演示用估计值，可自行修改）");
}

function toast(m) {
  const t = $("toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2200);
}

FIELDS.forEach((k) => $(k).addEventListener("input", () => {
  document.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
  render();
}));
document.querySelectorAll(".preset").forEach((b) => b.addEventListener("click", () => setPreset(b.dataset.preset)));
window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));

setPreset("tubo");
