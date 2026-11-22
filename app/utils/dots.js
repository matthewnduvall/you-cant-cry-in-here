// DOTS: the score powerlifting federations use to compare lifters of different bodyweights (replaced Wilks). A lift or
// total in kg × 500 ÷ a polynomial of bodyweight in kg, with separate coefficients for men and women. A plain lift ÷
// bodyweight ratio favours light lifters; DOTS doesn't. The leaderboards rank by it (BIG 3, OHP, MOST IMPROVED).
// Sex not set: the men's coefficients.

const LB_PER_KG = 2.20462;
const COEFFS = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706]
};
const BW_LIMITS = { male: [40, 210], female: [40, 150] };

export const normalizeSex = sex => (sex === 'female' ? 'female' : sex === 'male' ? 'male' : null);

/** DOTS score of a lift / total (lb) at a bodyweight (lb); 0 when either is unknown. */
export const dotsScore = (liftLbs, bodyweightLbs, sex = null) => {
  const lift = Number(liftLbs) || 0;
  const bwLbs = Number(bodyweightLbs) || 0;
  if (!(lift > 0) || !(bwLbs > 0)) return 0;
  const key = normalizeSex(sex) || 'male';
  const [lo, hi] = BW_LIMITS[key];
  const bw = Math.min(hi, Math.max(lo, bwLbs / LB_PER_KG));
  const [a, b, c, d, e] = COEFFS[key];
  const denom = a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4;
  return denom > 0 ? (lift / LB_PER_KG) * (500 / denom) : 0;
};
