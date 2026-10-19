# 💪 Daily Meal Planner for Gym Guys

A small, dependency-free web app that builds a full day of meals for someone who lifts. Enter your stats and goal, and it works out your calories and macros, then fills your day with real foods in sensible portions. Plain HTML, CSS and JavaScript, no frameworks and no build step.

## Features

- Calorie and macro targets from your weight, height, age, sex, training level and goal (build muscle, maintain, lose fat)
- Vegetarian, eggetarian or non-vegetarian meal plans
- 3, 4 or 5 meals per day (pre- and post-workout snacks included)
- Portions rounded to real servings (2 eggs, 3 rotis, 150 g chicken)
- **Shuffle all meals**, or **swap a single meal** you don't fancy
- Day-total bars showing how close the plan is to your targets
- One-day grocery list, copy-to-clipboard and print-friendly layout
- Your stats are remembered in the browser (`localStorage`)

## Run it

Open `index.html` in any modern browser. Or serve it locally:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How it works

**1. Targets**

- BMR uses the Mifflin-St Jeor equation: `10·kg + 6.25·cm − 5·age + 5` (men) or `− 161` (women).
- Maintenance calories = BMR × activity multiplier (1.375 / 1.55 / 1.725 / 1.9).
- Goal adjustment: **+10%** to build muscle, **−15%** to lose fat. Calories never drop below BMR.
- Protein: 2.0 g/kg (bulk), 1.8 g/kg (maintain), 2.2 g/kg (cut).
- Fat: 0.9 g/kg (0.8 g/kg on a cut). Carbs fill the remaining calories.
- Water: about 35 ml per kg.

**2. Meals**

Each meal gets a share of the day's calories and protein (for example, 25% breakfast, 30% lunch). For every meal the planner randomly picks a protein source and a carb source that suit the meal type and your diet, adds fixed sides (fruit, vegetables, a little fat), then sizes the protein and carbs to hit the meal's calorie and protein share. If the first carb source hits its serving limit, a second carb is added to fill the remaining calories. Amounts are rounded to whole units or the nearest 5 g.

Because servings have sensible minimums (one whey scoop, two eggs), calories usually land within about 10% of target and protein tends to land at or slightly above target, rarely below. Fat-loss plans skip very fatty protein sources such as paneer.

## Project structure

```
.
├── index.html   # page layout and stats form
├── style.css    # dark theme, responsive layout, print styles
├── script.js    # food database, target maths, meal builder, UI
└── README.md
```

## Add your own foods

Open `script.js` and add a line to the `FOODS` array:

```js
food('id', 'Display name', 'protein', 'veg', [kcal, protein, carbs, fat], 'BMS', minGrams, maxGrams)
```

Nutrition values are per 100 g. The meal tags are `B` (breakfast), `M` (lunch/dinner) and `S` (snack). The category is `protein`, `carb`, `fruit`, `veg` or `fat`, and the diet is `veg`, `egg` or `non`. Add a last argument like `{ label: 'roti', plural: 'rotis', g: 40 }` for foods eaten by the piece.

## Ideas for improvements

- Weekly plans with a repeat-free rotation
- Calorie cycling (higher on training days)
- Supplement and meal-timing reminders
- Food swaps with equal macros
- Export to PDF or a shareable link
- Cost estimates per day

## Disclaimer

The numbers are estimates from standard formulas and approximate food values, not medical or dietitian advice. If you have a health condition, are under 18, or are making big diet changes, check with a doctor or registered dietitian first.
