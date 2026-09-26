/**
 * Player attributes, rated 1-20 like Football Manager. 12 is a tour-average
 * professional (TOUR_AVERAGE); a 20 is the best in the world at that skill.
 *
 * Every attribute is "higher is better" except injuryProneness, where higher
 * means more often hurt (as in FM).
 */
export const TOUR_AVERAGE = 12;

export const ATTRIBUTE_GROUPS = {
  longGame: ["drivingDistance", "drivingAccuracy", "longIrons", "fairwayWoods"],
  approach: ["midIrons", "wedges", "distanceControl", "shotShaping", "trajectoryControl"],
  shortGame: ["chipping", "pitching", "bunkerPlay", "creativity"],
  putting: ["lagPutting", "shortPutts", "greenReading", "speedControl"],
  mental: ["composure", "courseManagement", "aggression", "focus", "sundayNerves", "bounceBack"],
  physical: ["stamina", "injuryProneness", "flexibility"],
} as const;

/** Never shown to the user directly; only glimpsed through scout reports. */
export const HIDDEN_ATTRIBUTES = [
  "professionalism",
  "ambition",
  "coachability",
  "windTolerance",
] as const;

export type VisibleAttribute = (typeof ATTRIBUTE_GROUPS)[keyof typeof ATTRIBUTE_GROUPS][number];
export type HiddenAttribute = (typeof HIDDEN_ATTRIBUTES)[number];
export type AttributeKey = VisibleAttribute | HiddenAttribute;
export type Attributes = Record<AttributeKey, number>;

export const VISIBLE_ATTRIBUTES: readonly VisibleAttribute[] = Object.values(ATTRIBUTE_GROUPS).flat();
export const ALL_ATTRIBUTES: readonly AttributeKey[] = [...VISIBLE_ATTRIBUTES, ...HIDDEN_ATTRIBUTES];

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  drivingDistance: "Driving Distance",
  drivingAccuracy: "Driving Accuracy",
  longIrons: "Long Irons",
  fairwayWoods: "Fairway Woods",
  midIrons: "Mid Irons",
  wedges: "Wedges",
  distanceControl: "Distance Control",
  shotShaping: "Shot Shaping",
  trajectoryControl: "Trajectory Control",
  chipping: "Chipping",
  pitching: "Pitching",
  bunkerPlay: "Bunker Play",
  creativity: "Creativity",
  lagPutting: "Lag Putting",
  shortPutts: "Short Putts",
  greenReading: "Green Reading",
  speedControl: "Speed Control",
  composure: "Composure",
  courseManagement: "Course Management",
  aggression: "Aggression",
  focus: "Focus",
  sundayNerves: "Sunday Nerves",
  bounceBack: "Bounce-Back",
  stamina: "Stamina",
  injuryProneness: "Injury Proneness",
  flexibility: "Flexibility",
  professionalism: "Professionalism",
  ambition: "Ambition",
  coachability: "Coachability",
  windTolerance: "Wind Tolerance",
};
