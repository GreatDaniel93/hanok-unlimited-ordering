export const STARTER_RECIPES = {
  2: [['Wagyu Brisket',1],['Wagyu Scotch Fillet',1],['Marinated LA Short Rib',1],['Pork Belly',1]],
  3: [['Wagyu Brisket',1],['Wagyu Scotch Fillet',1],['Wagyu Inside Skirt',1],['Marinated LA Short Rib',1],['Pork Belly',1],['Marinated Chicken Thigh',1]],
  4: [['Wagyu Brisket',1],['Wagyu Scotch Fillet',1],['Wagyu Inside Skirt',1],['Wagyu Intercostal',1],['Marinated LA Short Rib',1],['Pork Belly',1],['Marinated Chicken Thigh',1],['Soy Marinated Chicken Thigh',1]],
  5: [['Wagyu Brisket',1],['Wagyu Scotch Fillet',1],['Wagyu Inside Skirt',1],['Wagyu Intercostal',1],['Marinated LA Short Rib',1],['Marinated Angus Flap Meat',1],['Pork Belly',1],['Marinated Chicken Thigh',1],['Soy Marinated Chicken Thigh',1],['Sausage',1]],
  6: [['Wagyu Brisket',2],['Wagyu Scotch Fillet',1],['Wagyu Inside Skirt',1],['Wagyu Intercostal',1],['Marinated LA Short Rib',1],['Marinated Angus Flap Meat',1],['Pork Belly',2],['Marinated Chicken Thigh',1],['Soy Marinated Chicken Thigh',1],['Sausage',1]],
};

export function starterEquivalent({ adults = 0, children_8_12 = 0, children_4_7 = 0 }) {
  return Math.max(1, adults + children_8_12 + children_4_7 * 0.5);
}

export function starterSizes(equivalent) {
  let n = Math.max(2, Math.ceil(equivalent));
  const sizes = [];
  while (n > 6) {
    if (n === 7) return [...sizes, 4, 3];
    if (n === 8) return [...sizes, 4, 4];
    if (n === 9) return [...sizes, 5, 4];
    if (n === 10) return [...sizes, 5, 5];
    if (n === 11) return [...sizes, 6, 5];
    sizes.push(6);
    n -= 6;
  }
  if (n > 0) sizes.push(Math.max(2, n));
  return sizes;
}
