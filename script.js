(() => {
  'use strict';

  // ---------- Helpers ----------
  const $ = id => document.getElementById(id);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const sum = (arr, key) => arr.reduce((t, x) => t + x[key], 0);
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // ---------- Food database ----------
  // Values are per 100 g: [kcal, protein, carbs, fat].
  // tags: B = breakfast, M = lunch/dinner, S = snack. min/max are grams per serving.
  // unit: optional natural unit (egg, roti...) used to round to whole items.
  const food = (id, name, cat, diet, [k, p, c, f], tags, min, max, unit = null) =>
    ({ id, name, cat, diet, k, p, c, f, tags, min, max, unit });

  const FOODS = [
    // protein
    food('egg',     'Whole eggs',               'protein', 'egg', [143, 12.6, 0.7, 9.5], 'BMS', 50, 300, { label: 'egg', plural: 'eggs', g: 50 }),
    food('chicken', 'Chicken breast (cooked)',  'protein', 'non', [165, 31, 0, 3.6],     'M',    80, 320),
    food('fish',    'Fish fillet (cooked)',     'protein', 'non', [128, 26, 0, 2.7],     'M',    80, 320),
    food('paneer',  'Paneer',                   'protein', 'veg', [265, 18, 1.2, 20.8],  'BM',   60, 200),
    food('tofu',    'Firm tofu',                'protein', 'veg', [144, 17, 3, 9],       'BM',   80, 300),
    food('yogurt',  'Greek yogurt (plain)',     'protein', 'veg', [59, 10, 3.6, 0.4],    'BS',  100, 350),
    food('whey',    'Whey protein',             'protein', 'veg', [400, 80, 8, 6],       'BS',   30,  60, { label: 'scoop (30 g)', plural: 'scoops (30 g)', g: 30 }),
    food('soya',    'Soya chunks (dry)',        'protein', 'veg', [345, 52, 33, 0.5],    'M',    25,  80),
    // carbs
    food('rice',    'White rice (cooked)',      'carb',    'veg', [130, 2.7, 28, 0.3],   'M',   100, 500),
    food('oats',    'Rolled oats (dry)',        'carb',    'veg', [389, 16.9, 66, 6.9],  'B',    30, 150),
    food('roti',    'Whole-wheat roti',         'carb',    'veg', [300, 10, 51, 5],      'BM',   40, 320, { label: 'roti', plural: 'rotis', g: 40 }),
    food('sweetpotato', 'Sweet potato (boiled)', 'carb',   'veg', [90, 2, 21, 0.2],      'MS',  100, 300),
    food('bread',   'Whole-wheat bread',        'carb',    'veg', [247, 13, 41, 3.4],    'BS',   30, 210, { label: 'slice', plural: 'slices', g: 30 }),
    // fruit, veg, fats (fixed portions: min = max)
    food('banana',  'Banana',                   'fruit',   'veg', [89, 1.1, 23, 0.3],    'BS',  120, 120, { label: 'banana', plural: 'bananas', g: 120 }),
    food('apple',   'Apple',                    'fruit',   'veg', [52, 0.3, 14, 0.2],    'BS',  180, 180, { label: 'apple', plural: 'apples', g: 180 }),
    food('veg',     'Mixed vegetables (cooked)', 'veg',    'veg', [35, 2.5, 7, 0.4],     'M',   150, 150),
    food('pb',      'Peanut butter',            'fat',     'veg', [588, 25, 20, 50],     'BS',   15,  15),
    food('almonds', 'Almonds',                  'fat',     'veg', [579, 21, 22, 50],     'BS',   15,  15),
    food('oil',     'Olive oil',                'fat',     'veg', [884, 0, 0, 100],      'M',     5,   5)
  ];

  const DIET_OK = { veg: ['veg'], egg: ['veg', 'egg'], non: ['veg', 'egg', 'non'] };

  // [label, kind, share of the day's calories and protein]
  const MEAL_SETS = {
    3: [['Breakfast', 'B', 0.30], ['Lunch', 'M', 0.40], ['Dinner', 'M', 0.30]],
    4: [['Breakfast', 'B', 0.25], ['Lunch', 'M', 0.30], ['Pre-workout snack', 'S', 0.15], ['Dinner', 'M', 0.30]],
    5: [['Breakfast', 'B', 0.22], ['Lunch', 'M', 0.28], ['Pre-workout snack', 'S', 0.12],
        ['Dinner', 'M', 0.26], ['Post-workout snack', 'S', 0.12]]
  };

  const GOAL_LABEL = { bulk: 'Build muscle', maintain: 'Maintain', cut: 'Lose fat' };
  const STORAGE_KEY = 'dailyMealPlanner.profile';

  // ---------- State ----------
  let profile = null;
  let targets = null;
  let plan = [];

  // ---------- Targets ----------
  function calcTargets(p) {
    // Mifflin-St Jeor equation
    const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'male' ? 5 : -161);
    const tdee = bmr * p.activity;
    let kcal = p.goal === 'bulk' ? tdee * 1.10 : p.goal === 'cut' ? tdee * 0.85 : tdee;
    kcal = Math.round(Math.max(kcal, bmr) / 10) * 10; // never plan below BMR
    const protein = Math.round(p.weight * (p.goal === 'cut' ? 2.2 : p.goal === 'bulk' ? 2.0 : 1.8));
    const fat = Math.round(p.weight * (p.goal === 'cut' ? 0.8 : 0.9));
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    const water = Math.round(p.weight * 0.035 * 10) / 10;
    return { bmr, tdee, kcal, protein, fat, carbs, water };
  }

  // ---------- Meal building ----------
  function pick(cat, kind, diet, avoid = []) {
    let all = FOODS.filter(f => f.cat === cat && f.tags.includes(kind) && DIET_OK[diet].includes(f.diet));
    // On a fat-loss plan, skip very fatty protein sources (e.g. paneer)
    if (cat === 'protein' && profile && profile.goal === 'cut') {
      const lean = all.filter(f => f.f <= 15);
      if (lean.length) all = lean;
    }
    const fresh = all.filter(f => !avoid.includes(f.id));
    const pool = fresh.length ? fresh : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function amountLabel(f, grams) {
    if (f.unit) {
      const n = Math.round(grams / f.unit.g);
      return `${n} ${n === 1 ? f.unit.label : f.unit.plural}`;
    }
    return `${grams} g`;
  }

  function makeItem(f, grams) {
    const s = grams / 100;
    return { id: f.id, name: f.name, grams, label: amountLabel(f, grams),
             k: f.k * s, p: f.p * s, c: f.c * s, f: f.f * s };
  }

  // Round to a realistic serving: whole units (eggs, rotis...) or the nearest 5 g.
  function snap(f, grams) {
    if (f.unit) return Math.max(0, Math.round(grams / f.unit.g)) * f.unit.g;
    return Math.max(0, Math.round(grams / 5) * 5);
  }

  function buildMeal(slot, diet, avoid = []) {
    const [label, kind, share] = slot;
    const K = targets.kcal * share;
    const P = targets.protein * share;

    const protein = pick('protein', kind, diet, avoid);
    const carb = pick('carb', kind, diet);

    // Fixed side items (fruit, vegetables, a little fat)
    const fixed = [];
    const addFixed = f => { if (f) fixed.push(makeItem(f, f.min)); };
    if (kind === 'M') { addFixed(pick('veg', kind, diet)); addFixed(pick('fat', kind, diet)); }
    if (kind === 'B') {
      if (K >= 300) addFixed(pick('fruit', kind, diet));
      if (K >= 450) addFixed(pick('fat', kind, diet));
    }
    if (kind === 'S' && K >= 300) addFixed(pick('fruit', kind, diet));

    const fixedK = sum(fixed, 'k');
    const fixedP = sum(fixed, 'p');

    // Size the protein and carb items so the meal lands near its calorie and protein share.
    let prG = protein.min;
    let cbG = 0;
    for (let pass = 0; pass < 3; pass++) {
      cbG = clamp((K - fixedK - prG * protein.k / 100) / (carb.k / 100), 0, carb.max);
      prG = clamp((P - fixedP - cbG * carb.p / 100) / (protein.p / 100), protein.min, protein.max);
    }
    cbG = clamp((K - fixedK - prG * protein.k / 100) / (carb.k / 100), 0, carb.max);

    prG = Math.max(protein.min, snap(protein, prG));
    cbG = snap(carb, cbG);

    // If the first carb source hit its serving limit, add a second one to fill the calories.
    let carb2 = null;
    let cb2G = 0;
    const left = K - fixedK - prG * protein.k / 100 - cbG * carb.k / 100;
    if (left > 120) {
      const c2 = pick('carb', kind, diet, [carb.id]);
      if (c2.id !== carb.id) {
        cb2G = snap(c2, clamp(left / (c2.k / 100), 0, c2.max));
        if (cb2G > 0) carb2 = c2;
      }
    }

    const items = [makeItem(protein, prG)];
    if (cbG > 0) items.push(makeItem(carb, cbG));
    if (carb2) items.push(makeItem(carb2, cb2G));
    items.push(...fixed);

    return { slot, label, kind, proteinId: protein.id, items };
  }

  function buildPlan() {
    const diet = profile.diet;
    const meals = [];
    let prev = [];
    for (const slot of MEAL_SETS[profile.meals]) {
      const m = buildMeal(slot, diet, prev);
      meals.push(m);
      prev = [m.proteinId];
    }
    return meals;
  }

  const totalsOf = items => ({ k: sum(items, 'k'), p: sum(items, 'p'), c: sum(items, 'c'), f: sum(items, 'f') });

  // ---------- Rendering ----------
  function renderTargets() {
    const t = targets;
    $('targets').innerHTML = `
      <h2>Your daily targets <span class="tag">${GOAL_LABEL[profile.goal]}</span></h2>
      <div class="stats">
        <div class="stat kcal"><b>${fmt(t.kcal)}</b><span>kcal</span></div>
        <div class="stat protein"><b>${t.protein} g</b><span>protein</span></div>
        <div class="stat carbs"><b>${t.carbs} g</b><span>carbs</span></div>
        <div class="stat fat"><b>${t.fat} g</b><span>fat</span></div>
        <div class="stat water"><b>${t.water} L</b><span>water</span></div>
      </div>
      <p class="muted">Resting burn (BMR) ≈ ${fmt(t.bmr)} kcal · maintenance ≈ ${fmt(t.tdee)} kcal</p>`;
  }

  function renderPlan() {
    $('plan').innerHTML = plan.map((m, i) => {
      const tot = totalsOf(m.items);
      const rows = m.items.map(it => `
        <li><span class="name">${it.name}</span><span class="amt">${it.label}</span><span class="kcal">${fmt(it.k)} kcal</span></li>`).join('');
      return `
        <article class="meal">
          <div class="meal-head">
            <h3>${m.label}</h3>
            <button type="button" class="reroll" data-index="${i}" title="Swap this meal">↻ Swap</button>
          </div>
          <div class="chips"><b>${fmt(tot.k)} kcal</b> · P ${Math.round(tot.p)} g · C ${Math.round(tot.c)} g · F ${Math.round(tot.f)} g</div>
          <ul>${rows}</ul>
        </article>`;
    }).join('');
  }

  function renderSummary() {
    const tot = totalsOf(plan.flatMap(m => m.items));
    const rows = [
      ['Calories', tot.k, targets.kcal, 'kcal', 'kcal'],
      ['Protein', tot.p, targets.protein, 'g', 'protein'],
      ['Carbs', tot.c, targets.carbs, 'g', 'carbs'],
      ['Fat', tot.f, targets.fat, 'g', 'fat']
    ].map(([name, got, want, unit, cls]) => {
      const pct = want ? clamp((got / want) * 100, 0, 100) : 0;
      return `
        <div class="bar-row ${cls}">
          <div class="bar-label"><span>${name}</span><span>${fmt(got)} / ${fmt(want)} ${unit}</span></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>`;
    }).join('');

    const off = Math.abs(tot.k - targets.kcal) / targets.kcal;
    const note = off > 0.08
      ? `<p class="muted">Totals differ from your targets by ${Math.round(off * 100)}% because portions are rounded to realistic servings. Try “Shuffle all meals” for a closer match.</p>`
      : '';
    $('summary').innerHTML = `<h2>Day total vs target</h2>${rows}${note}`;
  }

  function renderGrocery() {
    const totals = new Map();
    plan.flatMap(m => m.items).forEach(it => totals.set(it.id, (totals.get(it.id) || 0) + it.grams));
    const lines = [...totals].map(([id, grams]) => {
      const f = FOODS.find(x => x.id === id);
      return `<li>${f.name}: <b>${amountLabel(f, grams)}</b></li>`;
    }).join('');
    $('grocery').innerHTML = `<h2>Grocery list (1 day)</h2><ul>${lines}</ul>`;
  }

  function renderAll() {
    renderTargets();
    renderPlan();
    renderSummary();
    renderGrocery();
  }

  // ---------- Profile form ----------
  function readForm() {
    return {
      weight: parseFloat($('weight').value),
      height: parseFloat($('height').value),
      age: parseInt($('age').value, 10),
      sex: $('sex').value,
      activity: parseFloat($('activity').value),
      goal: $('goal').value,
      diet: $('diet').value,
      meals: parseInt($('meals').value, 10)
    };
  }

  function validate(p) {
    if (!(p.weight >= 35 && p.weight <= 200)) return 'Weight should be between 35 and 200 kg.';
    if (!(p.height >= 120 && p.height <= 230)) return 'Height should be between 120 and 230 cm.';
    if (!(p.age >= 16 && p.age <= 80)) return 'Age should be between 16 and 80.';
    if (!MEAL_SETS[p.meals]) return 'Choose 3, 4 or 5 meals per day.';
    return '';
  }

  function saveProfile(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ }
  }

  function loadProfile() {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (p && !validate(p)) {
        $('weight').value = p.weight;
        $('height').value = p.height;
        $('age').value = p.age;
        $('sex').value = p.sex;
        $('activity').value = String(p.activity);
        $('goal').value = p.goal;
        $('diet').value = p.diet;
        $('meals').value = String(p.meals);
      }
    } catch (e) { /* ignore bad or missing data */ }
  }

  function generate() {
    const p = readForm();
    const err = validate(p);
    $('error').textContent = err;
    if (err) return;
    profile = p;
    saveProfile(p);
    targets = calcTargets(p);
    plan = buildPlan();
    renderAll();
  }

  // ---------- Actions ----------
  function planText() {
    const lines = [
      `Daily Meal Planner · ${GOAL_LABEL[profile.goal]} · ${fmt(targets.kcal)} kcal`,
      `Targets: protein ${targets.protein} g, carbs ${targets.carbs} g, fat ${targets.fat} g, water ${targets.water} L`,
      ''
    ];
    plan.forEach(m => {
      lines.push(`${m.label} (${fmt(totalsOf(m.items).k)} kcal)`);
      m.items.forEach(it => lines.push(`- ${it.name}: ${it.label}`));
      lines.push('');
    });
    return lines.join('\n');
  }

  async function copyPlan() {
    const btn = $('copy');
    const old = btn.textContent;
    try {
      await navigator.clipboard.writeText(planText());
      btn.textContent = '✅ Copied!';
    } catch (e) {
      btn.textContent = 'Copy failed';
    }
    setTimeout(() => { btn.textContent = old; }, 1500);
  }

  function rerollMeal(i) {
    const avoid = [plan[i].proteinId, plan[i - 1] && plan[i - 1].proteinId, plan[i + 1] && plan[i + 1].proteinId]
      .filter(Boolean);
    plan[i] = buildMeal(plan[i].slot, profile.diet, avoid);
    renderPlan();
    renderSummary();
    renderGrocery();
  }

  // ---------- Events ----------
  $('profile').addEventListener('submit', e => { e.preventDefault(); generate(); });

  $('shuffle').addEventListener('click', () => {
    if (!profile) return;
    plan = buildPlan();
    renderAll();
  });

  $('plan').addEventListener('click', e => {
    const btn = e.target.closest('.reroll');
    if (btn && plan.length) rerollMeal(Number(btn.dataset.index));
  });

  $('groceryBtn').addEventListener('click', () => { $('grocery').hidden = !$('grocery').hidden; });
  $('copy').addEventListener('click', () => { if (profile) copyPlan(); });
  $('print').addEventListener('click', () => window.print());

  // ---------- Start ----------
  loadProfile();
  generate();
})();
