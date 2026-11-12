// 校验 面料换算工具.html 里的计算逻辑与页面引用
// 运行：node test/check.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const htmlPath = new URL('../index.html', import.meta.url);
const html = readFileSync(htmlPath, 'utf8');

const block = html.match(/\/\/ ==== MATH START ====([\s\S]*?)\/\/ ==== MATH END ====/);
assert.ok(block, '找不到 MATH 标记块');
const Calc = new Function(block[1] + '\nreturn Calc;')();

let pass = 0;
function check(name, actual, expected, tol = 0.005) {
  assert.ok(Number.isFinite(actual), `${name}: 结果不是数字 (${actual})`);
  assert.ok(Math.abs(actual - expected) <= tol, `${name}: 期望 ${expected}，实际 ${actual}`);
  pass++;
  console.log(`  ✓ ${name} = ${Number(actual).toFixed(4)}`);
}

console.log('笔记中的 5 个公式：');

// ① 1公斤出米数 = 1000 ÷ 门幅 ÷ 克重
check('① 1000÷1.4÷150', Calc.metersPerKg(1.4, 150), 4.7619);
check('① 1公斤出码数', Calc.yardsPerKg(1.4, 150), 5.2077);
check('① 每米重量 1.4×150', Calc.gramsPerMeter(1.4, 150), 210);
check('① 每码重量', Calc.gramsPerYard(1.4, 150), 192.02, 0.01);

// ② 净布价 = 每卷金额 ÷ 实得净布重量（报价含纸管）
check('② 28×25÷(25-0.5-1.5)', Calc.netPricePerKg(28, 25, 0.5, 1.5), 30.4348, 0.001);
check('② 每卷金额 28×25', Calc.rollAmount(28, 25), 700);
check('② 对照口径 28÷25×(25+0.5+1.5)', Calc.netPricePerKgExtraBasis(28, 25, 0.5, 1.5), 30.24);
check('② 空差按 7% 折算 = 1.75kg', Calc.gapInKg(7, '%', 25), 1.75);
check('② 空差按 kg 直填', Calc.gapInKg(1.5, 'kg', 25), 1.5);
check('② 7%空差 → 净布价', Calc.netPricePerKg(28, 25, 0.5, Calc.gapInKg(7, '%', 25)), 30.7692, 0.001);
check('② 对照口径(7%空差)', Calc.netPricePerKgExtraBasis(28, 25, 0.5, Calc.gapInKg(7, '%', 25)), 30.52);

// ③ 空差：4元/米 93空 → 4 ÷ 0.93
check('③ 4÷0.93', Calc.priceWithGap(4, 7), 4.3011);
check('③ 折扣率 93%', Calc.gapRate(7), 0.93, 1e-9);
check('③ 100元实得 100÷4.3011', 100 / Calc.priceWithGap(4, 7), 23.25, 0.01);

// ④ 米价 = 码价 ÷ 0.9144
check('④ 10÷0.9144', Calc.yardPriceToMeterPrice(10), 10.9361);
check('④ 反算 米价×0.9144', Calc.meterPriceToYardPrice(10.9361), 10.0);
check('④ 100米折合码数', 100 / Calc.YARD_M, 109.36, 0.01);

// ⑤ 公斤价 = 码价 × 1000 ÷ (0.9144 × 门幅 × 克重) → 笔记结论 78.11
check('⑤ 15×1000÷(0.9144×1.4×150)', Calc.pricePerKgFromYardPrice(15, 1.4, 150), 78.1152, 0.001);
check('⑤ 米价反算公斤价', Calc.pricePerKgFromMeterPrice(10.94, 1.4, 150), 52.0952);
check('⑤ 公斤价→米价', Calc.pricePerMeterFromKg(78.1152, 1.4, 150), 16.4042);
check('⑤ 公斤价→码价', Calc.pricePerYardFromKg(78.1152, 1.4, 150), 15.0, 0.001);

console.log('单位换算（实现细节）：');
check('英寸 → 米：57"', Calc.widthToMeters(57, 'in'), 1.4478);
check('厘米 → 米：140cm', Calc.widthToMeters(140, 'cm'), 1.4);
check('米不变：1.4m', Calc.widthToMeters(1.4, 'm'), 1.4);
check('oz/yd² → g/m²：10oz', Calc.gsmFrom(10, 'ozyd2'), 339.0571, 0.001);
check('g/m² 不变：150', Calc.gsmFrom(150, 'gm2'), 150);
check('57" + 150g 公斤价', Calc.pricePerKgFromYardPrice(15, Calc.widthToMeters(57, 'in'), 150), 75.5362, 0.001);

console.log('三价互转（一致性）：门幅1.4m 克重150g 三价应为 kg 78.1152 / 米 16.4042 / 码 15.0000');
for (const unit of ['千克', '米', '码']) {
  const seed = { 千克: 78.1152, 米: 16.4042, 码: 15.0 }[unit];
  const t = Calc.priceTriangle(seed, unit, 1.4, 150);
  check(`⑤ 以${unit}为起点→kg`, t.kg, 78.1152, 0.01);
  check(`⑤ 以${unit}为起点→米`, t.m, 16.4042, 0.01);
  check(`⑤ 以${unit}为起点→码`, t.yard, 15.0, 0.01);
}

console.log('异常输入：');
for (const [w, g] of [[0, 150], [1.4, 0], [NaN, 150], [1.4, NaN], [-1, 150]]) {
  assert.ok(Number.isNaN(Calc.metersPerKg(w, g)), `门幅=${w} 克重=${g} 应返回 NaN`);
  assert.ok(Number.isNaN(Calc.pricePerKgFromYardPrice(15, w, g)), `门幅=${w} 克重=${g} 应返回 NaN`);
  pass++;
}
assert.ok(Number.isNaN(Calc.priceWithGap(4, 100)), '空差 100% 应返回 NaN');
assert.ok(Number.isNaN(Calc.priceWithGap(4, 120)), '空差 120% 应返回 NaN');
assert.ok(Number.isNaN(Calc.netPricePerKg(28, 25, 20, 10)), '纸管+空差超过毛重应返回 NaN');
assert.ok(Number.isNaN(Calc.netPricePerKg(28, 25, 0.5, 24.5)), '净布重量为 0 应返回 NaN');
assert.ok(Number.isNaN(Calc.gapInKg(1.5, 'kg', 0)), '标称卷重为 0 应返回 NaN');
assert.ok(Number.isNaN(Calc.widthToMeters(0, 'in')), '门幅为 0 应返回 NaN');
pass += 4;
console.log('  ✓ 非法输入返回 NaN，不会显示 Infinity / 负价格');

console.log('页面结构与引用：');
const usedIds = [
  ...html.matchAll(/\$\('([a-zA-Z_0-9]+)'\)/g),
  ...html.matchAll(/\bval\('([a-zA-Z_0-9]+)'\)/g),
  ...html.matchAll(/\bput\('([a-zA-Z_0-9]+)'/g),
].map(m => m[1]);
const declaredIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
const missing = [...new Set(usedIds)].filter(id => !declaredIds.has(id));
assert.deepEqual(missing, [], `HTML 中缺少这些 id: ${missing.join(', ')}`);
pass++;
console.log(`  ✓ ${new Set(usedIds).size} 个 id 引用全部存在`);

// 门幅快捷选项指向的元素必须存在
const chipTargets = [...html.matchAll(/data-target="([^"]+)" data-unit="([^"]+)"/g)];
assert.ok(chipTargets.length > 0, '应有门幅快捷选项');
for (const [, t, u] of chipTargets) {
  assert.ok(declaredIds.has(t) && declaredIds.has(u), `快捷选项指向了不存在的元素: ${t} / ${u}`);
}
pass++;
console.log(`  ✓ ${chipTargets.length} 组门幅快捷选项指向有效元素`);

assert.ok(!/<script[^>]+src=/.test(html), '不应依赖外部脚本（需离线可用）');
assert.ok(!/<link[^>]+href=/.test(html), '不应依赖外部样式（需离线可用）');
pass += 2;
console.log('  ✓ 无任何外部依赖，可离线双击打开');

console.log(`\n全部通过：${pass} 项断言`);
