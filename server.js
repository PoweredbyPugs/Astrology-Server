const express = require("express");
const sweph = require("sweph");
const moment = require("moment-timezone");
const cors = require("cors");

const app = express();

// Enable CORS for all routes - allows Obsidian to access the API
app.use(cors({
  origin: '*', // Allow all origins (you can restrict this to specific origins if needed)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// .se1 files in /app/ephemeris
sweph.set_ephe_path("/app/ephemeris");
console.log("Ephemeris path set to '/app/ephemeris'");
console.log("Current working directory:", process.cwd());

// ============================================================================
// ASTROLOGICAL CONSTANTS & DIGNITY TABLES
// ============================================================================

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];

const PLANETS = {
  SUN: "Sun",
  MOON: "Moon",
  MERCURY: "Mercury",
  VENUS: "Venus",
  MARS: "Mars",
  JUPITER: "Jupiter",
  SATURN: "Saturn"
};

// Traditional Domicile Rulerships
const DOMICILE = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter"
};

// Exaltation Signs
const EXALTATION = {
  Sun: "Aries",
  Moon: "Taurus",
  Mercury: "Virgo",
  Venus: "Pisces",
  Mars: "Capricorn",
  Jupiter: "Cancer",
  Saturn: "Libra"
};

// Detriment (opposite of domicile)
const DETRIMENT = {
  Sun: "Aquarius",
  Moon: "Capricorn",
  Mercury: ["Sagittarius", "Pisces"],
  Venus: ["Aries", "Scorpio"],
  Mars: ["Taurus", "Libra"],
  Jupiter: ["Gemini", "Virgo"],
  Saturn: ["Cancer", "Leo"]
};

// Fall (opposite of exaltation)
const FALL = {
  Sun: "Libra",
  Moon: "Scorpio",
  Mercury: "Pisces",
  Venus: "Virgo",
  Mars: "Cancer",
  Jupiter: "Capricorn",
  Saturn: "Aries"
};

// Triplicity Rulers (Dorothean system)
// Each element has day ruler, night ruler, and participating ruler
const TRIPLICITY = {
  Fire: { day: "Sun", night: "Jupiter", participating: "Saturn" },    // Aries, Leo, Sagittarius
  Earth: { day: "Venus", night: "Moon", participating: "Mars" },      // Taurus, Virgo, Capricorn
  Air: { day: "Saturn", night: "Mercury", participating: "Jupiter" }, // Gemini, Libra, Aquarius
  Water: { day: "Venus", night: "Mars", participating: "Moon" }       // Cancer, Scorpio, Pisces
};

const SIGN_ELEMENTS = {
  Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
  Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
  Gemini: "Air", Libra: "Air", Aquarius: "Air",
  Cancer: "Water", Scorpio: "Water", Pisces: "Water"
};

// Egyptian Terms (Bounds) - degrees within each sign ruled by each planet
// Format: [planet, startDegree, endDegree] for each sign
const TERMS = {
  Aries: [
    ["Jupiter", 0, 6], ["Venus", 6, 12], ["Mercury", 12, 20], ["Mars", 20, 25], ["Saturn", 25, 30]
  ],
  Taurus: [
    ["Venus", 0, 8], ["Mercury", 8, 14], ["Jupiter", 14, 22], ["Saturn", 22, 27], ["Mars", 27, 30]
  ],
  Gemini: [
    ["Mercury", 0, 6], ["Jupiter", 6, 12], ["Venus", 12, 17], ["Mars", 17, 24], ["Saturn", 24, 30]
  ],
  Cancer: [
    ["Mars", 0, 7], ["Venus", 7, 13], ["Mercury", 13, 19], ["Jupiter", 19, 26], ["Saturn", 26, 30]
  ],
  Leo: [
    ["Jupiter", 0, 6], ["Venus", 6, 11], ["Saturn", 11, 18], ["Mercury", 18, 24], ["Mars", 24, 30]
  ],
  Virgo: [
    ["Mercury", 0, 7], ["Venus", 7, 17], ["Jupiter", 17, 21], ["Mars", 21, 28], ["Saturn", 28, 30]
  ],
  Libra: [
    ["Saturn", 0, 6], ["Mercury", 6, 14], ["Jupiter", 14, 21], ["Venus", 21, 28], ["Mars", 28, 30]
  ],
  Scorpio: [
    ["Mars", 0, 7], ["Venus", 7, 11], ["Mercury", 11, 19], ["Jupiter", 19, 24], ["Saturn", 24, 30]
  ],
  Sagittarius: [
    ["Jupiter", 0, 12], ["Venus", 12, 17], ["Mercury", 17, 21], ["Saturn", 21, 26], ["Mars", 26, 30]
  ],
  Capricorn: [
    ["Mercury", 0, 7], ["Jupiter", 7, 14], ["Venus", 14, 22], ["Saturn", 22, 26], ["Mars", 26, 30]
  ],
  Aquarius: [
    ["Mercury", 0, 7], ["Venus", 7, 13], ["Jupiter", 13, 20], ["Mars", 20, 25], ["Saturn", 25, 30]
  ],
  Pisces: [
    ["Venus", 0, 12], ["Jupiter", 12, 16], ["Mercury", 16, 19], ["Mars", 19, 28], ["Saturn", 28, 30]
  ]
};

// Faces (Decans) - Chaldean order starting from Mars in Aries
// Each face is 10 degrees, ruled in Chaldean order: Mars, Sun, Venus, Mercury, Moon, Saturn, Jupiter (repeat)
const CHALDEAN_ORDER = ["Mars", "Sun", "Venus", "Mercury", "Moon", "Saturn", "Jupiter"];
const FACES = {};
let faceIndex = 0;
SIGNS.forEach(sign => {
  FACES[sign] = [
    { start: 0, end: 10, ruler: CHALDEAN_ORDER[faceIndex % 7] },
    { start: 10, end: 20, ruler: CHALDEAN_ORDER[(faceIndex + 1) % 7] },
    { start: 20, end: 30, ruler: CHALDEAN_ORDER[(faceIndex + 2) % 7] }
  ];
  faceIndex += 3;
});

// ============================================================================
// DIGNITY HELPER FUNCTIONS
// ============================================================================

/**
 * Get the zodiac sign from ecliptic longitude
 */
function getSignFromLongitude(longitude) {
  const normalizedLon = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedLon / 30);
  return SIGNS[signIndex];
}

/**
 * Get the degree within the sign (0-30)
 */
function getDegreeInSign(longitude) {
  const normalizedLon = ((longitude % 360) + 360) % 360;
  return normalizedLon % 30;
}

/**
 * Check if planet is in its domicile
 */
function isInDomicile(planet, sign) {
  return DOMICILE[sign] === planet;
}

/**
 * Check if planet is in its exaltation
 */
function isInExaltation(planet, sign) {
  return EXALTATION[planet] === sign;
}

/**
 * Check if planet is in detriment
 */
function isInDetriment(planet, sign) {
  const detriment = DETRIMENT[planet];
  if (Array.isArray(detriment)) {
    return detriment.includes(sign);
  }
  return detriment === sign;
}

/**
 * Check if planet is in fall
 */
function isInFall(planet, sign) {
  return FALL[planet] === sign;
}

/**
 * Get triplicity ruler for a planet in a sign
 * @param {string} planet - The planet name
 * @param {string} sign - The zodiac sign
 * @param {boolean} isDaySect - True if day chart, false if night chart
 * @returns {object} { isTriplicityRuler, rulerType }
 */
function getTriplicityStatus(planet, sign, isDaySect) {
  const element = SIGN_ELEMENTS[sign];
  const triplicity = TRIPLICITY[element];
  
  if (isDaySect && triplicity.day === planet) {
    return { isTriplicityRuler: true, rulerType: "day" };
  }
  if (!isDaySect && triplicity.night === planet) {
    return { isTriplicityRuler: true, rulerType: "night" };
  }
  if (triplicity.participating === planet) {
    return { isTriplicityRuler: true, rulerType: "participating" };
  }
  return { isTriplicityRuler: false, rulerType: null };
}

/**
 * Get term ruler for a degree in a sign
 */
function getTermRuler(sign, degree) {
  const terms = TERMS[sign];
  for (const [planet, start, end] of terms) {
    if (degree >= start && degree < end) {
      return planet;
    }
  }
  return null;
}

/**
 * Check if planet is in its own term
 */
function isInOwnTerm(planet, sign, degree) {
  return getTermRuler(sign, degree) === planet;
}

/**
 * Get face ruler for a degree in a sign
 */
function getFaceRuler(sign, degree) {
  const faces = FACES[sign];
  for (const face of faces) {
    if (degree >= face.start && degree < face.end) {
      return face.ruler;
    }
  }
  return null;
}

/**
 * Check if planet is in its own face
 */
function isInOwnFace(planet, sign, degree) {
  return getFaceRuler(sign, degree) === planet;
}

/**
 * Calculate essential dignity score for a planet
 * Traditional scoring: Domicile +5, Exaltation +4, Triplicity +3, Term +2, Face +1
 * Debilities: Detriment -5, Fall -4
 * 
 * @param {string} planet - Planet name
 * @param {number} longitude - Ecliptic longitude
 * @param {boolean} isDaySect - Is this a day chart?
 * @returns {object} Complete dignity analysis
 */
function calculateDignities(planet, longitude, isDaySect = true) {
  const sign = getSignFromLongitude(longitude);
  const degree = getDegreeInSign(longitude);
  
  const dignities = {
    planet,
    sign,
    degree: degree.toFixed(2),
    longitude: longitude.toFixed(4),
    
    // Essential dignities
    domicile: isInDomicile(planet, sign),
    exaltation: isInExaltation(planet, sign),
    triplicity: getTriplicityStatus(planet, sign, isDaySect),
    term: {
      isInOwnTerm: isInOwnTerm(planet, sign, degree),
      termRuler: getTermRuler(sign, degree)
    },
    face: {
      isInOwnFace: isInOwnFace(planet, sign, degree),
      faceRuler: getFaceRuler(sign, degree)
    },
    
    // Debilities
    detriment: isInDetriment(planet, sign),
    fall: isInFall(planet, sign),
    
    // Score calculation
    score: 0
  };
  
  // Calculate score
  if (dignities.domicile) dignities.score += 5;
  if (dignities.exaltation) dignities.score += 4;
  if (dignities.triplicity.isTriplicityRuler) dignities.score += 3;
  if (dignities.term.isInOwnTerm) dignities.score += 2;
  if (dignities.face.isInOwnFace) dignities.score += 1;
  if (dignities.detriment) dignities.score -= 5;
  if (dignities.fall) dignities.score -= 4;
  
  // Condition assessment
  if (dignities.score >= 5) {
    dignities.condition = "strong";
  } else if (dignities.score >= 2) {
    dignities.condition = "moderate";
  } else if (dignities.score >= 0) {
    dignities.condition = "neutral";
  } else if (dignities.score >= -4) {
    dignities.condition = "weakened";
  } else {
    dignities.condition = "debilitated";
  }
  
  return dignities;
}

// ============================================================================
// ZODIACAL RELEASING (from Vettius Valens)
// ============================================================================

/**
 * Zodiacal Releasing period lengths for each sign
 * Based on the "minor years" of the planetary rulers
 */
const ZR_PERIOD_YEARS = {
  Aries: 15,      // Mars
  Taurus: 8,      // Venus
  Gemini: 20,     // Mercury
  Cancer: 25,     // Moon
  Leo: 19,        // Sun
  Virgo: 20,      // Mercury
  Libra: 8,       // Venus
  Scorpio: 15,    // Mars
  Sagittarius: 12, // Jupiter
  Capricorn: 27,   // Saturn
  Aquarius: 30,    // Saturn
  Pisces: 12      // Jupiter
};

// Convert years to months for L2
const ZR_PERIOD_MONTHS = {};
Object.entries(ZR_PERIOD_YEARS).forEach(([sign, years]) => {
  ZR_PERIOD_MONTHS[sign] = years; // Each L1 year = L2 month
});

// L3 periods are in days (L2 months become L3 days with a factor)
// L2 month = ~30.4 days, so each L1 year = 30.4 days at L3

/**
 * Calculate which L1 period is active for a given date
 * @param {string} lotSign - Starting sign (Lot of Fortune or Spirit)
 * @param {moment} birthDate - Birth date
 * @param {moment} targetDate - Date to check (defaults to now)
 * @returns {object} Active L1 period info
 */
function calculateZRL1(lotSign, birthDate, targetDate = moment()) {
  const signIndex = SIGNS.indexOf(lotSign);
  if (signIndex === -1) return null;
  
  const birth = moment(birthDate);
  const target = moment(targetDate);
  const daysSinceBirth = target.diff(birth, 'days', true);
  const yearsSinceBirth = daysSinceBirth / 365.25;
  
  // Walk through signs from the lot, accumulating years
  let accumulatedYears = 0;
  let currentSignIndex = signIndex;
  let periodNumber = 1;
  let periodsVisited = [];
  
  while (accumulatedYears <= yearsSinceBirth) {
    const currentSign = SIGNS[currentSignIndex];
    const periodYears = ZR_PERIOD_YEARS[currentSign];
    
    periodsVisited.push({
      period: periodNumber,
      sign: currentSign,
      ruler: DOMICILE[currentSign],
      startYear: accumulatedYears,
      endYear: accumulatedYears + periodYears,
      duration: periodYears
    });
    
    accumulatedYears += periodYears;
    currentSignIndex = (currentSignIndex + 1) % 12;
    periodNumber++;
    
    // Safety check - don't loop forever
    if (periodNumber > 100) break;
  }
  
  // Find the active period
  const activePeriod = periodsVisited.find(p => 
    yearsSinceBirth >= p.startYear && yearsSinceBirth < p.endYear
  ) || periodsVisited[periodsVisited.length - 1];
  
  // Calculate how far into the period we are
  const yearsIntoPeriod = yearsSinceBirth - activePeriod.startYear;
  const percentComplete = (yearsIntoPeriod / activePeriod.duration) * 100;
  const yearsRemaining = activePeriod.endYear - yearsSinceBirth;
  
  return {
    currentAge: yearsSinceBirth.toFixed(2),
    activePeriod: {
      ...activePeriod,
      yearsIntoPeriod: yearsIntoPeriod.toFixed(2),
      yearsRemaining: yearsRemaining.toFixed(2),
      percentComplete: percentComplete.toFixed(1)
    },
    periodsVisited: periodsVisited.slice(0, 10), // First 10 periods
    lotSign
  };
}

/**
 * Calculate L2 sub-periods within the active L1
 * L2 periods use the same cycle but in months instead of years
 */
function calculateZRL2(lotSign, birthDate, targetDate = moment()) {
  const l1 = calculateZRL1(lotSign, birthDate, targetDate);
  if (!l1) return null;
  
  const birth = moment(birthDate);
  const target = moment(targetDate);
  
  // Start of L1 period in actual time
  const l1StartDate = moment(birth).add(l1.activePeriod.startYear * 365.25, 'days');
  const monthsSinceL1Start = target.diff(l1StartDate, 'months', true);
  
  // L2 starts from L1's sign and cycles through
  const l1SignIndex = SIGNS.indexOf(l1.activePeriod.sign);
  
  let accumulatedMonths = 0;
  let currentSignIndex = l1SignIndex;
  let l2Periods = [];
  
  while (accumulatedMonths <= monthsSinceL1Start + 24) { // Calculate ahead a bit
    const currentSign = SIGNS[currentSignIndex];
    const periodMonths = ZR_PERIOD_MONTHS[currentSign];
    
    l2Periods.push({
      sign: currentSign,
      ruler: DOMICILE[currentSign],
      startMonth: accumulatedMonths,
      endMonth: accumulatedMonths + periodMonths,
      duration: periodMonths
    });
    
    accumulatedMonths += periodMonths;
    currentSignIndex = (currentSignIndex + 1) % 12;
    
    if (l2Periods.length > 15) break;
  }
  
  // Find active L2 period
  const activeL2 = l2Periods.find(p => 
    monthsSinceL1Start >= p.startMonth && monthsSinceL1Start < p.endMonth
  ) || l2Periods[0];
  
  const monthsIntoL2 = monthsSinceL1Start - activeL2.startMonth;
  const monthsRemainingL2 = activeL2.endMonth - monthsSinceL1Start;
  
  // Check for "loosing of the bond" - when L2 is opposite to L1
  const l1SignIdx = SIGNS.indexOf(l1.activePeriod.sign);
  const l2SignIdx = SIGNS.indexOf(activeL2.sign);
  const isLoosingBond = Math.abs(l1SignIdx - l2SignIdx) === 6;
  
  // Check for peak period - L2 in same sign as L1
  const isPeakPeriod = l1.activePeriod.sign === activeL2.sign;
  
  return {
    ...l1,
    l2: {
      activePeriod: {
        ...activeL2,
        monthsIntoPeriod: monthsIntoL2.toFixed(2),
        monthsRemaining: monthsRemainingL2.toFixed(2)
      },
      isLoosingBond,
      isPeakPeriod,
      note: isPeakPeriod 
        ? "🌟 Peak period - L2 returns to L1 sign" 
        : isLoosingBond 
          ? "⚠️ Loosing of the bond - L2 opposite L1" 
          : null
    }
  };
}

// ============================================================================
// ANNUAL PROFECTIONS
// ============================================================================

/**
 * Calculate annual profections for a given age
 * Each year, the chart "advances" one house from the Ascendant
 * Returns the profected house and its ruler (lord of the year)
 * 
 * @param {number} ascendantSign - The sign on the Ascendant (0-11 index or name)
 * @param {number} age - Current age
 * @returns {object} Profection data
 */
function calculateProfections(ascendantSign, age) {
  // Convert sign name to index if needed
  let ascIndex;
  if (typeof ascendantSign === 'string') {
    ascIndex = SIGNS.indexOf(ascendantSign);
    if (ascIndex === -1) ascIndex = 0;
  } else {
    ascIndex = ascendantSign;
  }
  
  // Each year advances one sign from the Ascendant
  // Age 0 = 1st house (Ascendant)
  // Age 1 = 2nd house
  // Age 12 = back to 1st house
  const houseNumber = (age % 12) + 1;
  const profectedSignIndex = (ascIndex + (age % 12)) % 12;
  const profectedSign = SIGNS[profectedSignIndex];
  const lordOfYear = DOMICILE[profectedSign];
  
  // Determine which life area is activated
  const houseThemes = {
    1: "Self, identity, vitality, new beginnings",
    2: "Resources, values, possessions, self-worth",
    3: "Communication, siblings, local travel, learning",
    4: "Home, family, roots, foundations, endings",
    5: "Creativity, children, romance, pleasure, self-expression",
    6: "Health, daily work, service, routines, pets",
    7: "Partnerships, relationships, open enemies, contracts",
    8: "Death, transformation, shared resources, inheritance",
    9: "Higher learning, travel, philosophy, beliefs, publishing",
    10: "Career, reputation, public life, authority, achievements",
    11: "Friends, groups, hopes, wishes, community",
    12: "Hidden matters, solitude, spirituality, self-undoing, rest"
  };
  
  // Determine the planetary year type
  const yearTypeMap = {
    "Sun": { type: "Solar", theme: "Visibility, leadership, vitality, father figures" },
    "Moon": { type: "Lunar", theme: "Emotions, changes, mother figures, public" },
    "Mercury": { type: "Mercurial", theme: "Communication, learning, commerce, siblings" },
    "Venus": { type: "Venusian", theme: "Relationships, pleasure, art, beauty, money" },
    "Mars": { type: "Martial", theme: "Action, conflict, energy, competition, surgery" },
    "Jupiter": { type: "Jovian", theme: "Growth, expansion, luck, education, travel" },
    "Saturn": { type: "Saturnian", theme: "Discipline, limitation, structure, elders, lessons" }
  };
  
  return {
    age,
    activatedHouse: houseNumber,
    profectedSign,
    lordOfYear,
    yearType: yearTypeMap[lordOfYear],
    houseTheme: houseThemes[houseNumber],
    cycleYear: (age % 12) + 1, // Which year in the 12-year cycle
    note: `Age ${age} is a ${yearTypeMap[lordOfYear]?.type || ''} year, activating the ${houseNumber}${getOrdinalSuffix(houseNumber)} house in ${profectedSign}`
  };
}

/**
 * Get ordinal suffix for a number
 */
function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Calculate profection timeline for multiple years
 */
function calculateProfectionTimeline(ascendantSign, currentAge, yearsAhead = 12) {
  const timeline = [];
  for (let i = 0; i < yearsAhead; i++) {
    timeline.push(calculateProfections(ascendantSign, currentAge + i));
  }
  return timeline;
}

// ============================================================================
// SECT CALCULATION
// ============================================================================

/**
 * Determine if a chart is day or night sect
 * Day sect: Sun above the horizon (houses 7-12)
 * Night sect: Sun below the horizon (houses 1-6)
 * 
 * @param {number} sunLongitude - Sun's ecliptic longitude
 * @param {number} ascLongitude - Ascendant longitude
 * @returns {object} Sect information
 */
function calculateSect(sunLongitude, ascLongitude) {
  // Calculate if Sun is above or below horizon
  // Sun is above horizon if it's between Desc and Asc (going through MC)
  const descLongitude = (ascLongitude + 180) % 360;
  
  // Normalize
  let sunNorm = ((sunLongitude % 360) + 360) % 360;
  let ascNorm = ((ascLongitude % 360) + 360) % 360;
  let descNorm = ((descLongitude % 360) + 360) % 360;
  
  // Check if Sun is in upper hemisphere
  let isAboveHorizon;
  if (descNorm > ascNorm) {
    // Normal case: Desc is ahead of Asc
    isAboveHorizon = sunNorm >= ascNorm && sunNorm < descNorm;
    isAboveHorizon = !isAboveHorizon; // Flip because above is Desc to Asc through MC
  } else {
    // Wrapped case
    isAboveHorizon = sunNorm >= descNorm && sunNorm < ascNorm;
  }
  
  // Simpler approach: just check if Sun's house would be 7-12
  // For now, use a simplified calculation based on longitude difference
  let diff = sunNorm - ascNorm;
  if (diff < 0) diff += 360;
  isAboveHorizon = diff >= 180; // Sun in upper half of chart
  
  const isDaySect = isAboveHorizon;
  
  return {
    isDaySect,
    isNightSect: !isDaySect,
    sectLabel: isDaySect ? "Day" : "Night",
    sectLight: isDaySect ? "Sun" : "Moon",
    sectBenefic: isDaySect ? "Jupiter" : "Venus",
    sectMalefic: isDaySect ? "Saturn" : "Mars",
    
    // Contrary to sect (the "outsider" planets)
    contrarySectLight: isDaySect ? "Moon" : "Sun",
    contrarySectBenefic: isDaySect ? "Venus" : "Jupiter",
    contrarySectMalefic: isDaySect ? "Mars" : "Saturn"
  };
}

/**
 * Get a planet's sect status within a chart
 */
function getPlanetSectStatus(planet, sect) {
  const dayPlanets = ["Sun", "Jupiter", "Saturn"];
  const nightPlanets = ["Moon", "Venus", "Mars"];
  
  const isPlanetDaySect = dayPlanets.includes(planet);
  const isPlanetNightSect = nightPlanets.includes(planet);
  
  // Mercury is neutral (sect of the planet it's with)
  if (planet === "Mercury") {
    return {
      isInSect: true, // Mercury adapts
      sectAlignment: "neutral",
      note: "Mercury adapts to the sect it finds itself in"
    };
  }
  
  const isInSect = (sect.isDaySect && isPlanetDaySect) || (sect.isNightSect && isPlanetNightSect);
  
  return {
    isInSect,
    sectAlignment: isInSect ? "in sect" : "contrary to sect",
    isSectLight: planet === sect.sectLight,
    isSectBenefic: planet === sect.sectBenefic,
    isSectMalefic: planet === sect.sectMalefic
  };
}

// ============================================================================
// DEPOSITOR CHAINS
// ============================================================================

/**
 * Get the domicile ruler (depositor) for a planet based on its sign
 */
function getDepositor(sign) {
  return DOMICILE[sign];
}

/**
 * Calculate the depositor chain for all planets in a chart
 * Returns the final dispositor if one exists, and identifies mutual receptions
 */
function calculateDepositorChain(planetPositions) {
  // planetPositions is an array of { name, sign, longitude }
  
  const chains = {};
  const mutualReceptions = [];
  
  // Build initial depositor map
  planetPositions.forEach(p => {
    const depositor = getDepositor(p.sign);
    chains[p.name] = {
      planet: p.name,
      sign: p.sign,
      depositor: depositor,
      depositsTo: depositor,
      receivesFrom: []
    };
  });
  
  // Find who deposits to whom
  Object.values(chains).forEach(chain => {
    const target = chains[chain.depositor];
    if (target) {
      target.receivesFrom.push(chain.planet);
    }
  });
  
  // Check for mutual receptions (traditional: by domicile)
  const planetNames = Object.keys(chains);
  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const p1 = chains[planetNames[i]];
      const p2 = chains[planetNames[j]];
      
      // Mutual reception: A is in B's sign AND B is in A's sign
      const p1RulesP2Sign = isInDomicile(p1.planet, p2.sign);
      const p2RulesP1Sign = isInDomicile(p2.planet, p1.sign);
      
      if (p1.depositor === p2.planet && p2.depositor === p1.planet) {
        mutualReceptions.push({
          planets: [p1.planet, p2.planet],
          type: "domicile",
          description: `${p1.planet} in ${p1.sign} and ${p2.planet} in ${p2.sign}`
        });
      }
    }
  }
  
  // Find final dispositor (planet in own sign that receives all chains)
  let finalDispositor = null;
  Object.values(chains).forEach(chain => {
    if (isInDomicile(chain.planet, chain.sign)) {
      // This planet rules its own sign - could be final dispositor
      // Check if all chains eventually lead here
      finalDispositor = chain.planet; // Simplified - proper check would trace all chains
    }
  });
  
  return {
    chains,
    mutualReceptions,
    finalDispositor,
    hasFinalDispositor: finalDispositor !== null
  };
}

// ============================================================================
// ORIGINAL ENDPOINTS (preserved)
// ============================================================================

// Original /moon-now endpoint - This works accurately
app.get("/moon-now", (req, res) => {
  // 1) Get current local time in Eastern Time
  const localNow = moment.tz("America/New_York");

  // 2) Convert local time to UTC for Swiss Ephemeris
  const yearUTC = localNow.utc().year();
  const monthUTC = localNow.utc().month() + 1; // +1 because month() is 0-based
  const dayUTC = localNow.utc().date();
  const hourUTC =
    localNow.utc().hour() +
    localNow.utc().minute() / 60 +
    localNow.utc().second() / 3600;

  console.log(`Local Eastern time: ${localNow.format()} => UTC: ${yearUTC}-${monthUTC}-${dayUTC} ${hourUTC}`);

  // 3) Calculate the Moon
  const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
  const flags = sweph.constants.SEFLG_SWIEPH;

  const moonResult = sweph.calc(jd, sweph.constants.SE_MOON, flags);
  if (!moonResult || (moonResult.flag !== 0 && moonResult.flag !== 2)) {
    return res.json({ error: moonResult?.error || "Moon calc error" });
  }
  const moonLon = moonResult.data[0]; // ecliptic longitude

  // 4) Calculate the Sun
  const sunResult = sweph.calc(jd, sweph.constants.SE_SUN, flags);
  if (!sunResult || (sunResult.flag !== 0 && sunResult.flag !== 2)) {
    return res.json({ error: sunResult?.error || "Sun calc error" });
  }
  const sunLon = sunResult.data[0];

  // 5) Phase angle = (MoonLon - SunLon) mod 360
  let phaseAngle = (moonLon - sunLon) % 360;
  if (phaseAngle < 0) phaseAngle += 360;

  // Basic 8-phase classification
  let phaseName = "New Moon";
  if (phaseAngle >= 22.5 && phaseAngle < 67.5) {
    phaseName = "Waxing Crescent";
  } else if (phaseAngle >= 67.5 && phaseAngle < 112.5) {
    phaseName = "First Quarter";
  } else if (phaseAngle >= 112.5 && phaseAngle < 157.5) {
    phaseName = "Waxing Gibbous";
  } else if (phaseAngle >= 157.5 && phaseAngle < 202.5) {
    phaseName = "Full Moon";
  } else if (phaseAngle >= 202.5 && phaseAngle < 247.5) {
    phaseName = "Waning Gibbous";
  } else if (phaseAngle >= 247.5 && phaseAngle < 292.5) {
    phaseName = "Last Quarter";
  } else if (phaseAngle >= 292.5 && phaseAngle < 337.5) {
    phaseName = "Waning Crescent";
  }

  // 6) Find zodiac sign and degree within that sign
  const signNames = [
    "Aries", "Taurus", "Gemini", "Cancer",
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  const signIndex = Math.floor((moonLon % 360) / 30);
  const moonSign = signNames[signIndex];

  // e.g. if moonLon=45.2 => 15.2 Taurus
  const signDegree = (moonLon % 30).toFixed(2);

  const synodicMonth = 29.53058867;
  const moonAgeDays = (phaseAngle * synodicMonth) / 360;
  console.log("✅ Moon age calculation running:", moonAgeDays);

  // 7) Return JSON
  res.json({
    localEasternTime: localNow.format(),          // Eastern time display
    moonPhase: phaseName,
    moonSign,
    degreeInSign: signDegree,
    moonAge: moonAgeDays.toFixed(2)
  });
});

// New endpoint for all planetary positions
app.get("/planets-now", (req, res) => {
  try {
    // 1) Get current local time in Eastern Time
    const localNow = moment.tz("America/New_York");

    // 2) Convert local time to UTC for Swiss Ephemeris
    const yearUTC = localNow.utc().year();
    const monthUTC = localNow.utc().month() + 1; // +1 because month() is 0-based
    const dayUTC = localNow.utc().date();
    const hourUTC =
      localNow.utc().hour() +
      localNow.utc().minute() / 60 +
      localNow.utc().second() / 3600;

    console.log(`Local Eastern time: ${localNow.format()} => UTC: ${yearUTC}-${monthUTC}-${dayUTC} ${hourUTC}`);

    // 3) Calculate the Julian Day
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;

    // 4) Define planets to calculate
    const planets = [
      { id: sweph.constants.SE_SUN, name: "Sun" },
      { id: sweph.constants.SE_MOON, name: "Moon" },
      { id: sweph.constants.SE_MERCURY, name: "Mercury" },
      { id: sweph.constants.SE_VENUS, name: "Venus" },
      { id: sweph.constants.SE_MARS, name: "Mars" },
      { id: sweph.constants.SE_JUPITER, name: "Jupiter" },
      { id: sweph.constants.SE_SATURN, name: "Saturn" },
      { id: sweph.constants.SE_URANUS, name: "Uranus" },
      { id: sweph.constants.SE_NEPTUNE, name: "Neptune" },
      { id: sweph.constants.SE_PLUTO, name: "Pluto" }
    ];

    // 5) Define zodiac signs
    const signNames = [
      "Aries", "Taurus", "Gemini", "Cancer",
      "Leo", "Virgo", "Libra", "Scorpio", 
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];

    // 6) Calculate positions for all planets
    const planetaryPositions = planets.map(planet => {
      const result = sweph.calc(jd, planet.id, flags);
      
      if (!result || (result.flag !== 0 && result.flag !== 2)) {
        console.error(`Error calculating ${planet.name}: ${result?.error || "unknown error"}`);
        return {
          name: planet.name,
          error: result?.error || "Calculation error"
        };
      }
      
      // Get longitude
      const longitude = result.data[0];
      
      // Calculate sign and degree
      const signIndex = Math.floor((longitude % 360) / 30);
      const sign = signNames[signIndex];
      const degreeInSign = (longitude % 30).toFixed(2);
      
      // Check if retrograde using helper function
      const planetIsRetrograde = isRetrograde(planet.id, jd, flags);
      
      return {
        name: planet.name,
        sign,
        degreeInSign,
        isRetrograde: planetIsRetrograde
      };
    });

    // 7) Return JSON with all planetary positions
    res.json({
      localEasternTime: localNow.format(),          // Eastern time display
      planets: planetaryPositions
    });
    
  } catch (error) {
    console.error("Error calculating planetary positions:", error);
    res.status(500).json({
      error: "Failed to calculate planetary positions"
    });
  }
});

// Improved /weekly-major-phase endpoint using the same ephemeris approach
app.get("/weekly-major-phase", (req, res) => {
  try {
    console.log("Finding accurate major moon phase for the week using ephemeris");
    
    // Get current time
    const now = moment.tz("America/New_York");
    
    // Define current week boundaries (Monday to Sunday)
    const currentDay = now.day(); // 0 is Sunday, 1 is Monday, etc.
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Days back to Monday
    const mondayDate = moment(now).subtract(daysToMonday, 'days').startOf('day');
    const sundayDate = moment(mondayDate).add(6, 'days').endOf('day');
    
    console.log(`Week range: ${mondayDate.format('YYYY-MM-DD')} to ${sundayDate.format('YYYY-MM-DD')}`);
    
    // Get current moon phase info - using the accurate existing method
    const currentPhaseInfo = getMoonPhaseForDate(now);
    console.log(`Current moon: ${currentPhaseInfo.moonPhase} in ${currentPhaseInfo.moonSign} (${currentPhaseInfo.phaseAngle}°)`);
    
    // Check if we're currently in a major phase
    if (isMajorPhase(currentPhaseInfo.moonPhase)) {
      console.log(`Currently in a major phase: ${currentPhaseInfo.moonPhase}`);
      return res.json({
        date: now.format('YYYY-MM-DD HH:mm:ss'),
        moonPhase: currentPhaseInfo.moonPhase,
        moonSign: currentPhaseInfo.moonSign
      });
    }
    
    // Find all major phases in the current week
    const phasesToCheck = [
      { phase: "New Moon", targetAngle: 0 },
      { phase: "First Quarter", targetAngle: 90 },
      { phase: "Full Moon", targetAngle: 180 },
      { phase: "Last Quarter", targetAngle: 270 }
    ];
    
    // We'll check every 6 hours throughout the week for phase changes
    // This gives us enough granularity to detect major phases
    let majorPhasesInWeek = [];
    let datePointer = moment(mondayDate);
    
    // Analysis data for determining closest major phase if none found
    const angleData = [];
    
    while (datePointer.isSameOrBefore(sundayDate)) {
      const phaseInfo = getMoonPhaseForDate(datePointer);
      const phaseAngle = parseFloat(phaseInfo.phaseAngle);
      
      // Store phase angle for analysis
      angleData.push({
        date: datePointer.format('YYYY-MM-DD HH:mm'),
        angle: phaseAngle,
        moonSign: phaseInfo.moonSign
      });
      
      // Check if we're at or very near a major phase
      for (const phaseCheck of phasesToCheck) {
        // Check if we're within 3 degrees of the target angle
        // Also handle the case of New Moon (0/360 degrees)
        let angleDistance;
        if (phaseCheck.targetAngle === 0) {
          angleDistance = Math.min(phaseAngle, 360 - phaseAngle);
        } else {
          angleDistance = Math.abs(phaseAngle - phaseCheck.targetAngle);
        }
        
        if (angleDistance <= 3) { // Within 3 degrees of major phase
          console.log(`Found ${phaseCheck.phase} at ${datePointer.format('YYYY-MM-DD HH:mm')} (angle: ${phaseAngle.toFixed(2)}°)`);
          
          majorPhasesInWeek.push({
            date: datePointer.format('YYYY-MM-DD HH:mm:ss'),
            moonPhase: phaseCheck.phase,
            moonSign: phaseInfo.moonSign,
            distance: angleDistance
          });
        }
      }
      
      // Move to next 6-hour increment
      datePointer.add(6, 'hours');
    }
    
    console.log(`Found ${majorPhasesInWeek.length} major phases in the week`);
    
    // If we found major phases, return the best one
    if (majorPhasesInWeek.length > 0) {
      // First, sort by distance to exact phase
      majorPhasesInWeek.sort((a, b) => a.distance - b.distance);
      
      // Get the most exact phase
      const exactPhase = majorPhasesInWeek[0];
      console.log(`Returning exact major phase: ${exactPhase.moonPhase} in ${exactPhase.moonSign}`);
      
      return res.json({
        date: exactPhase.date,
        moonPhase: exactPhase.moonPhase,
        moonSign: exactPhase.moonSign
      });
    }
    
    // If no exact major phases in the week, find the closest upcoming major phase
    // This approach determines which major phase we're currently progressing toward
    console.log("No exact major phases this week, finding closest upcoming phase");
    
    // Determine the phase we're progressing toward
    // The moon moves ~12 degrees per day, so we need to find which major phase
    // is coming up next based on the current phase angle
    
    // We've been storing phase angles throughout the week
    // Sort by time to get the most recent angle
    angleData.sort((a, b) => moment(b.date).valueOf() - moment(a.date).valueOf());
    
    // Get the most recent angle data
    const latestAngle = angleData[0].angle;
    const latestSign = angleData[0].moonSign;
    const latestDate = angleData[0].date;
    
    console.log(`Latest angle: ${latestAngle.toFixed(2)}° in ${latestSign} at ${latestDate}`);
    
    // Determine which major phase is coming next
    let nextMajorPhase, nextAngle;
    if (latestAngle < 90) {
      nextMajorPhase = "First Quarter";
      nextAngle = 90;
    } else if (latestAngle < 180) {
      nextMajorPhase = "Full Moon";
      nextAngle = 180;
    } else if (latestAngle < 270) {
      nextMajorPhase = "Last Quarter";
      nextAngle = 270;
    } else {
      nextMajorPhase = "New Moon";
      nextAngle = 360; // Will be treated as 0 in the phase calculation
    }
    
    // Estimate when this phase will occur and in what sign
    // The moon moves about 12-13 degrees per day through the zodiac
    // and the phase angle changes at roughly the same rate
    
    // Calculate days until the next major phase
    const degreesToNext = nextAngle - latestAngle;
    const daysToNext = degreesToNext / 12.2; // Approx degrees per day
    
    // Calculate the date of the next major phase
    const nextPhaseDate = moment(latestDate).add(daysToNext, 'days');
    
    // For the sign, we need to estimate how many signs the moon will move through
    // Each sign is 30 degrees, and the moon moves ~12 degrees per day
    
    // Calculate the sign at the next major phase
    const signNames = [
      "Aries", "Taurus", "Gemini", "Cancer",
      "Leo", "Virgo", "Libra", "Scorpio",
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];
    
    let signIndex = signNames.indexOf(latestSign);
    const daysPerSign = 30 / 12.2; // Approx days to move through one sign
    const signsToMove = Math.floor(daysToNext / daysPerSign);
    
    // Calculate new sign index
    signIndex = (signIndex + signsToMove) % 12;
    const nextPhaseSign = signNames[signIndex];
    
    console.log(`Next major phase: ${nextMajorPhase} estimated at ${nextPhaseDate.format('YYYY-MM-DD HH:mm')} in ${nextPhaseSign}`);
    
    // Return the next major phase information
    return res.json({
      date: nextPhaseDate.format('YYYY-MM-DD HH:mm:ss'),
      moonPhase: nextMajorPhase,
      moonSign: nextPhaseSign
    });
    
  } catch (error) {
    console.error("Error finding weekly major phase:", error);
    
    // Fallback to a safe response based on current phase
    try {
      const now = moment.tz("America/New_York");
      const currentPhase = getMoonPhaseForDate(now);
      
      // Convert the current phase to the nearest major phase
      const phaseAngle = parseFloat(currentPhase.phaseAngle);
      let majorPhase;
      
      if (phaseAngle < 45 || phaseAngle >= 315) {
        majorPhase = "New Moon";
      } else if (phaseAngle >= 45 && phaseAngle < 135) {
        majorPhase = "First Quarter";
      } else if (phaseAngle >= 135 && phaseAngle < 225) {
        majorPhase = "Full Moon";
      } else {
        majorPhase = "Last Quarter";
      }
      
      return res.json({
        date: now.format('YYYY-MM-DD HH:mm:ss'),
        moonPhase: majorPhase,
        moonSign: currentPhase.moonSign
      });
    } catch (e) {
      console.error("Fallback error:", e);
      return res.json({
        error: "Could not determine moon phase"
      });
    }
  }
});

// Function to get moon phase information for a given date
function getMoonPhaseForDate(dateTime) {
  // Convert to UTC for Swiss Ephemeris calculations
  const yearUTC = dateTime.utc().year();
  const monthUTC = dateTime.utc().month() + 1; // +1 because month() is 0-based
  const dayUTC = dateTime.utc().date();
  const hourUTC =
    dateTime.utc().hour() +
    dateTime.utc().minute() / 60 +
    dateTime.utc().second() / 3600;
  
  // Calculate Julian day
  const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
  const flags = sweph.constants.SEFLG_SWIEPH;
  
  // Calculate Moon position
  const moonResult = sweph.calc(jd, sweph.constants.SE_MOON, flags);
  if (!moonResult || (moonResult.flag !== 0 && moonResult.flag !== 2)) {
    throw new Error(moonResult?.error || "Moon calc error");
  }
  const moonLon = moonResult.data[0]; // ecliptic longitude
  
  // Calculate Sun position
  const sunResult = sweph.calc(jd, sweph.constants.SE_SUN, flags);
  if (!sunResult || (sunResult.flag !== 0 && sunResult.flag !== 2)) {
    throw new Error(sunResult?.error || "Sun calc error");
  }
  const sunLon = sunResult.data[0];
  
  // Calculate phase angle
  let phaseAngle = (moonLon - sunLon) % 360;
  if (phaseAngle < 0) phaseAngle += 360;
  
  // Determine phase name - using the same logic as moon-now
  let phaseName = "New Moon";
  if (phaseAngle >= 22.5 && phaseAngle < 67.5) {
    phaseName = "Waxing Crescent";
  } else if (phaseAngle >= 67.5 && phaseAngle < 112.5) {
    phaseName = "First Quarter";
  } else if (phaseAngle >= 112.5 && phaseAngle < 157.5) {
    phaseName = "Waxing Gibbous";
  } else if (phaseAngle >= 157.5 && phaseAngle < 202.5) {
    phaseName = "Full Moon";
  } else if (phaseAngle >= 202.5 && phaseAngle < 247.5) {
    phaseName = "Waning Gibbous";
  } else if (phaseAngle >= 247.5 && phaseAngle < 292.5) {
    phaseName = "Last Quarter";
  } else if (phaseAngle >= 292.5 && phaseAngle < 337.5) {
    phaseName = "Waning Crescent";
  }
  
  // Calculate zodiac sign
  const signNames = [
    "Aries", "Taurus", "Gemini", "Cancer",
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  const signIndex = Math.floor((moonLon % 360) / 30);
  const moonSign = signNames[signIndex];
  
  // Calculate degree in sign
  const signDegree = (moonLon % 30).toFixed(2);
  
  return {
    moonPhase: phaseName,
    moonSign,
    degreeInSign: signDegree,
    phaseAngle: phaseAngle.toFixed(2)
  };
}

// Helper function to calculate date boundaries based on timeframe or explicit dates
function getDateBoundaries(timeframe, now, startDate, endDate) {
  let startBoundary, endBoundary;

  if (startDate && endDate) {
    startBoundary = startDate.startOf('day');
    endBoundary = endDate.endOf('day');
    console.log(`Using custom date range: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
  } else {
    switch(timeframe) {
      case "day":
        startBoundary = moment(now).startOf('day');
        endBoundary = moment(now).endOf('day');
        break;
      case "week":
        const currentDay = now.day();
        const daysToMonday = currentDay === 0 ? 6 : currentDay - 1;
        startBoundary = moment(now).subtract(daysToMonday, 'days').startOf('day');
        endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
        break;
      case "month":
        startBoundary = moment(now).startOf('month');
        endBoundary = moment(now).endOf('month');
        break;
      default:
        const defaultDay = now.day();
        const defaultDaysToMonday = defaultDay === 0 ? 6 : defaultDay - 1;
        startBoundary = moment(now).subtract(defaultDaysToMonday, 'days').startOf('day');
        endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
    }
    console.log(`Finding for ${timeframe}: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
  }

  return { startBoundary, endBoundary };
}

// Helper to check if a phase is a major phase
function isMajorPhase(phaseName) {
  return ["New Moon", "Full Moon", "First Quarter", "Last Quarter"].includes(phaseName);
}

// Helper function to accurately determine if a planet is retrograde using ephemeris data
function isRetrograde(planetId, julianDay, flags) {
  if (planetId === sweph.constants.SE_SUN || planetId === sweph.constants.SE_MOON) {
    return false; // Sun and Moon never go retrograde
  }

  const result = sweph.calc(julianDay, planetId, flags);
  if (!result || (result.flag !== 0 && result.flag !== 2)) {
    return false; // Default to direct if calculation fails
  }

  // result.data[3] is the daily motion in longitude (degrees per day)
  // Negative values indicate retrograde motion
  return result.data[3] < 0;
}

// Add a simple test endpoint to verify server is running
app.get("/test", (req, res) => {
  res.json({ status: "Server is running correctly" });
});

// Add this new endpoint before the app.listen call

// API info endpoint for discovery
app.get("/api-info", (req, res) => {
  res.json({
    name: "Sweph Astrological API",
    version: "2.0.0",
    endpoints: [
      // Core endpoints
      {
        path: "/test",
        description: "Test if server is running"
      },
      {
        path: "/moon-now",
        description: "Get current moon phase and sign"
      },
      {
        path: "/planets-now",
        description: "Get current positions of all planets"
      },
      {
        path: "/aspects-now",
        description: "Get current planetary aspects"
      },
      {
        path: "/weekly-major-phase",
        description: "Get the major moon phase for the current week"
      },
      // Dignity endpoints
      {
        path: "/dignity-score",
        method: "GET",
        description: "Calculate essential dignity score for any planet at any position",
        parameters: "?planet=Mars&sign=Capricorn&degree=15&isDaySect=true"
      },
      {
        path: "/current-dignities",
        method: "GET",
        description: "Get dignity scores for all planets at current positions",
        parameters: "?lat=40.0&lon=-74.0 (optional location for houses)"
      },
      // Chart generation endpoints
      {
        path: "/generate-chart",
        method: "POST",
        description: "Generate a comprehensive natal chart with dignities, sect, depositors, and lots",
        parameters: "Body: {name, year, month, day, hour, minute, latitude, longitude, timezone, save: true/false}"
      },
      {
        path: "/chart/:name",
        method: "GET",
        description: "Retrieve a stored natal chart by name"
      },
      {
        path: "/charts",
        method: "GET",
        description: "List all stored natal charts"
      },
      // Timing technique endpoints
      {
        path: "/profections/:name",
        method: "GET",
        description: "Get annual profections for a stored chart",
        parameters: "?age=39 (optional, calculates from birth date if not provided)"
      },
      {
        path: "/profections-calc",
        method: "GET",
        description: "Calculate profections without a stored chart",
        parameters: "?ascSign=Libra&age=39"
      },
      {
        path: "/zr/:name",
        method: "GET",
        description: "Get Zodiacal Releasing L1 and L2 periods for a stored chart",
        parameters: "?lot=spirit|fortune&date=YYYY-MM-DD (optional)"
      },
      {
        path: "/zr-calc",
        method: "GET",
        description: "Calculate Zodiacal Releasing without a stored chart",
        parameters: "?lotSign=Capricorn&birthDate=1986-05-01&targetDate=2026-01-28"
      },
      // Transit endpoints
      {
        path: "/transits/:name/now",
        method: "GET",
        description: "Get all current transits to a stored natal chart",
        parameters: "?major=true&orb=8 (optional filters)"
      },
      {
        path: "/transits/:name/summary",
        method: "GET",
        description: "Get high-level summary of major outer planet transits with timing context"
      },
      // Existing timing endpoints
      {
        path: "/planetary-retrogrades",
        description: "Get current retrograde status of all planets with optional timeframe",
        parameters: "?timeframe=day|week|month or ?start=YYYY-MM-DD&end=YYYY-MM-DD"
      },
      {
        path: "/daily-transits",
        description: "Get current planetary transits to Chris's natal chart"
      },
      {
        path: "/moon-for-date",
        description: "Get moon phase and sign for specific date",
        parameters: "?date=YYYY-MM-DD (required)"
      },
      {
        path: "/void-of-course-moons",
        description: "Get void of course moon periods",
        parameters: "?timeframe=day|week|month or ?start=YYYY-MM-DD&end=YYYY-MM-DD"
      },
      {
        path: "/planetary-ingresses",
        description: "Get planetary sign changes",
        parameters: "?timeframe=day|week|month or ?start=YYYY-MM-DD&end=YYYY-MM-DD"
      },
      {
        path: "/planetary-stations",
        description: "Get planetary retrograde/direct stations",
        parameters: "?timeframe=day|week|month or ?start=YYYY-MM-DD&end=YYYY-MM-DD"
      },
      {
        path: "/important-transits",
        description: "Get significant planetary aspects between outer planets",
        parameters: "?timeframe=day|week|month or ?start=YYYY-MM-DD&end=YYYY-MM-DD"
      }
    ]
  });
});

// Enhanced Planetary Retrogrades endpoint with flexible timeframe
app.get("/planetary-retrogrades", (req, res) => {
  try {
    // Get current time
    const now = moment.tz("America/New_York");

    // Get timeframe from query parameters, default to "week"
    const timeframe = req.query.timeframe || "week";

    // Get optional start and end dates from query parameters
    let startDate = req.query.start ? moment.tz(req.query.start, "YYYY-MM-DD", "America/New_York") : null;
    let endDate = req.query.end ? moment.tz(req.query.end, "YYYY-MM-DD", "America/New_York") : null;

    // Define date boundaries using the helper function
    const { startBoundary, endBoundary } = getDateBoundaries(timeframe, now, startDate, endDate);

    // Define planets to check (only planets that can go retrograde)
    const planets = [
      { id: sweph.constants.SE_MERCURY, name: "Mercury" },
      { id: sweph.constants.SE_VENUS, name: "Venus" },
      { id: sweph.constants.SE_MARS, name: "Mars" },
      { id: sweph.constants.SE_JUPITER, name: "Jupiter" },
      { id: sweph.constants.SE_SATURN, name: "Saturn" },
      { id: sweph.constants.SE_URANUS, name: "Uranus" },
      { id: sweph.constants.SE_NEPTUNE, name: "Neptune" },
      { id: sweph.constants.SE_PLUTO, name: "Pluto" }
    ];

    // Define zodiac signs
    const signNames = [
      "Aries", "Taurus", "Gemini", "Cancer",
      "Leo", "Virgo", "Libra", "Scorpio",
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];

    // Check current retrograde status
    const currentRetrogrades = [];

    // Convert current time to UTC for Swiss Ephemeris calculations
    const yearUTC = now.utc().year();
    const monthUTC = now.utc().month() + 1;
    const dayUTC = now.utc().date();
    const hourUTC =
      now.utc().hour() +
      now.utc().minute() / 60 +
      now.utc().second() / 3600;

    // Calculate Julian day for current time
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;

    // Check each planet's current retrograde status
    for (const planet of planets) {
      const result = sweph.calc(jd, planet.id, flags);
      if (!result || (result.flag !== 0 && result.flag !== 2)) {
        console.error(`Error calculating ${planet.name}: ${result?.error || "unknown error"}`);
        continue;
      }

      // Get position and speed data
      const longitude = result.data[0]; // ecliptic longitude
      const speed = result.data[3]; // daily motion rate in degrees per day

      // Calculate sign and degree
      const signIndex = Math.floor((longitude % 360) / 30);
      const sign = signNames[signIndex];
      const degreeInSign = (longitude % 30).toFixed(2);

      // Determine retrograde status using helper function
      const planetIsRetrograde = isRetrograde(planet.id, jd, flags);

      currentRetrogrades.push({
        planet: planet.name,
        isRetrograde: planetIsRetrograde,
        sign,
        degreeInSign,
        dailyMotion: speed.toFixed(6), // Show precise daily motion
        status: planetIsRetrograde ? "Retrograde" : "Direct"
      });
    }

    // Optional: Track retrograde periods within the timeframe
    const retrogradeHistory = [];

    // If timeframe is more than just current moment, track changes
    if (timeframe !== "now") {
      let datePointer = moment(startBoundary);
      const checkInterval = timeframe === "day" ? 2 : timeframe === "week" ? 6 : 12; // hours

      // Store previous retrograde status for comparison
      const previousStatus = {};

      while (datePointer.isSameOrBefore(endBoundary)) {
        // Convert to UTC for Swiss Ephemeris calculations
        const yearUTCCheck = datePointer.utc().year();
        const monthUTCCheck = datePointer.utc().month() + 1;
        const dayUTCCheck = datePointer.utc().date();
        const hourUTCCheck =
          datePointer.utc().hour() +
          datePointer.utc().minute() / 60 +
          datePointer.utc().second() / 3600;

        const jdCheck = sweph.julday(yearUTCCheck, monthUTCCheck, dayUTCCheck, hourUTCCheck, sweph.constants.SE_GREG_CAL);

        // Check each planet at this time
        for (const planet of planets) {
          const result = sweph.calc(jdCheck, planet.id, flags);
          if (!result || (result.flag !== 0 && result.flag !== 2)) {
            continue;
          }

          const speed = result.data[3];
          const longitude = result.data[0];
          const isRetrograde = speed < 0;

          // Check for status change
          if (previousStatus[planet.name] !== undefined && previousStatus[planet.name] !== isRetrograde) {
            const signIndex = Math.floor((longitude % 360) / 30);
            const sign = signNames[signIndex];
            const degreeInSign = (longitude % 30).toFixed(2);

            retrogradeHistory.push({
              planet: planet.name,
              date: datePointer.format('YYYY-MM-DD HH:mm'),
              changeType: isRetrograde ? "Turned Retrograde" : "Turned Direct",
              sign,
              degreeInSign,
              speed: speed.toFixed(6)
            });
          }

          previousStatus[planet.name] = isRetrograde;
        }

        datePointer.add(checkInterval, 'hours');
      }
    }

    return res.json({
      localEasternTime: now.format(),
      timeframe: startDate && endDate ? 'custom' : timeframe,
      dateRange: timeframe !== "now" ? {
        start: startBoundary.format('YYYY-MM-DD'),
        end: endBoundary.format('YYYY-MM-DD')
      } : undefined,
      currentRetrogrades,
      retrogradeHistory: retrogradeHistory.length > 0 ? retrogradeHistory : undefined
    });

  } catch (error) {
    console.error("Error calculating planetary retrogrades:", error);
    return res.status(500).json({
      error: "Failed to calculate planetary retrogrades",
      details: error.message
    });
  }
});

// Listen on all network interfaces (0.0.0.0) instead of just localhost
// Clean Daily Transits endpoint with proper Eastern timezone
const PORT = process.env.PORT || 3000;
app.get("/daily-transits", (req, res) => {
  try {
    console.log("🚀 Daily transits endpoint hit - FULL VERSION");
    const easternNow = moment.tz("America/New_York");
    const easternDate = easternNow.format("YYYY-MM-DD");
    const easternTime = easternNow.format("HH:mm");

    // Check if natal chart exists
    console.log("📋 Checking natal chart...");
    if (!CHRIS_NATAL_CHART || Object.keys(CHRIS_NATAL_CHART).length === 0) {
      console.log("❌ Natal chart is empty or undefined");
      return res.status(500).json({ error: "Natal chart not available" });
    }
    console.log("✅ Natal chart has", Object.keys(CHRIS_NATAL_CHART).length, "planets");

    // Convert to UTC for Swiss Ephemeris calculations
    const yearUTC = easternNow.utc().year();
    const monthUTC = easternNow.utc().month() + 1;
    const dayUTC = easternNow.utc().date();
    const hourUTC = easternNow.utc().hour() + easternNow.utc().minute() / 60 + easternNow.utc().second() / 3600;

    console.log(`⏰ Eastern: ${easternNow.format()} => UTC calc: ${yearUTC}-${monthUTC}-${dayUTC} ${hourUTC}`);

    const jdNow = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const jdYesterday = jdNow - 1; // 1 day ago for applying/separating logic
    const flags = sweph.constants.SEFLG_SWIEPH;
    const transits = [];

    // Planet priority for sorting (faster = more important for transits)
    const planetPriority = {
      "moon": 1, "sun": 2, "mercury": 3, "venus": 4, "mars": 5,
      "jupiter": 6, "saturn": 7, "uranus": 8, "neptune": 9, "pluto": 10
    };

    const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];

    // Get current and yesterday positions
    const currentPositions = {};
    const yesterdayPositions = {};

    planets.forEach(planetName => {
      const planetConstant = sweph.constants[`SE_${planetName.toUpperCase()}`];
      if (planetConstant === undefined) {
        console.log(`❌ Planet constant not found for: ${planetName}`);
        return;
      }

      // Current position
      const currentResult = sweph.calc(jdNow, planetConstant, flags);
      if (currentResult && (currentResult.flag === 0 || currentResult.flag === 2)) {
        currentPositions[planetName] = {
          degrees: currentResult.data[0],
          position: formatPosition(currentResult.data[0])
        };
        console.log(`🌍 ${planetName}: ${currentResult.data[0].toFixed(2)}° (${formatPosition(currentResult.data[0])})`);
      } else {
        console.log(`❌ Failed to calculate current position for ${planetName}:`, currentResult?.error);
      }

      // Yesterday position
      const yesterdayResult = sweph.calc(jdYesterday, planetConstant, flags);
      if (yesterdayResult && (yesterdayResult.flag === 0 || yesterdayResult.flag === 2)) {
        yesterdayPositions[planetName] = {
          degrees: yesterdayResult.data[0]
        };
      } else {
        console.log(`❌ Failed to calculate yesterday position for ${planetName}:`, yesterdayResult?.error);
      }
    });

    console.log(`📊 Calculated positions for ${Object.keys(currentPositions).length} planets`);

    // Enhanced aspect calculation with applying/separating logic
    function calculateAspectWithPhase(currentDegrees, yesterdayDegrees, natalDegrees) {
      const aspect = calculateAspect(currentDegrees, natalDegrees);
      if (!aspect) return null;

      // Calculate yesterday's aspect to determine phase
      const yesterdayAspect = calculateAspect(yesterdayDegrees, natalDegrees);
      if (!yesterdayAspect || yesterdayAspect.type !== aspect.type) {
        // If yesterday wasn't the same aspect type, we can't determine phase reliably
        return { ...aspect, phase: "stable", orbChange: "0.000" };
      }

      const currentOrb = parseFloat(aspect.orb);
      const yesterdayOrb = parseFloat(yesterdayAspect.orb);
      const orbChange = currentOrb - yesterdayOrb;

      let phase = "stable";
      if (orbChange < -0.05) {
        phase = "applying"; // Orb getting smaller (tighter)
      } else if (orbChange > 0.05) {
        phase = "separating"; // Orb getting larger (looser)
      }

      return {
        ...aspect,
        phase,
        orbChange: orbChange.toFixed(3)
      };
    }

    // Calculate all transits (including same-planet transits like Moon Return, etc.)
    console.log(`🔄 Starting transit calculations...`);
    let transitCount = 0;

    for (const [transitPlanet, transitData] of Object.entries(currentPositions)) {
      if (!transitData) continue;

      for (const [natalPlanet, natalData] of Object.entries(CHRIS_NATAL_CHART)) {
        transitCount++;
        if (transitCount % 20 === 0) {
          console.log(`🔄 Processed ${transitCount} transit comparisons...`);
        }

        const yesterdayData = yesterdayPositions[transitPlanet];
        if (!yesterdayData) continue;

        const aspect = calculateAspectWithPhase(
          transitData.degrees,
          yesterdayData.degrees,
          natalData.degrees
        );

        if (aspect) {
          const orbValue = parseFloat(aspect.orb);

          // Determine priority level
          let priority = "normal";
          if (orbValue < 1) priority = "exact";
          else if (orbValue < 3) priority = "close";
          else if (aspect.phase === "applying") priority = "applying";
          else if (aspect.phase === "separating") priority = "separating";

          transits.push({
            date: easternDate,
            time: easternTime,
            transitPlanet: PLANET_GLYPHS[transitPlanet] || transitPlanet,
            transitPlanetName: transitPlanet,
            transitPosition: transitData.position,
            aspectType: aspect.glyph,
            aspectName: aspect.type,
            natalPlanet: PLANET_GLYPHS[natalPlanet] || natalPlanet,
            natalPlanetName: natalPlanet,
            natalPosition: natalData.position,
            orb: `${aspect.orb}°`,
            phase: aspect.phase,
            orbChange: aspect.orbChange,
            priority,
            planetPriority: planetPriority[transitPlanet] || 10,
            isExact: orbValue < 1,
            isClose: orbValue < 3,
            isApplying: aspect.phase === "applying",
            isSeparating: aspect.phase === "separating",
            description: `${PLANET_GLYPHS[transitPlanet] || transitPlanet} ${aspect.glyph} ${PLANET_GLYPHS[natalPlanet] || natalPlanet} (${aspect.orb}° ${aspect.phase})`
          });
        }
      }
    }

    // Enhanced sorting: exact -> close -> applying -> separating -> normal, then by planet speed, then by orb
    const priorityOrder = { exact: 1, close: 2, applying: 3, separating: 4, normal: 5 };

    transits.sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.planetPriority !== b.planetPriority) {
        return a.planetPriority - b.planetPriority;
      }
      return parseFloat(a.orb) - parseFloat(b.orb);
    });

    // ASPECT PATTERN DETECTION
    function detectAspectPatterns(transits, currentPositions, natalChart) {
      const patterns = [];

      // Get all active planets (transiting + natal positions combined)
      const allPositions = [];

      // Add current transiting planets
      Object.entries(currentPositions).forEach(([name, data]) => {
        allPositions.push({ name: `T-${name}`, degrees: data.degrees, type: 'transit' });
      });

      // Add natal planets
      Object.entries(natalChart).forEach(([name, data]) => {
        allPositions.push({ name: `N-${name}`, degrees: data.degrees, type: 'natal' });
      });

      // Helper: Check if two planets are in aspect within orb
      function isInAspect(deg1, deg2, targetAngle, orb = 8) {
        let diff = Math.abs(deg1 - deg2);
        if (diff > 180) diff = 360 - diff;
        return Math.abs(diff - targetAngle) <= orb;
      }

      // GRAND TRINE DETECTION (3 planets in 120° triangle)
      for (let i = 0; i < allPositions.length; i++) {
        for (let j = i + 1; j < allPositions.length; j++) {
          for (let k = j + 1; k < allPositions.length; k++) {
            const p1 = allPositions[i];
            const p2 = allPositions[j];
            const p3 = allPositions[k];

            if (isInAspect(p1.degrees, p2.degrees, 120, 6) &&
                isInAspect(p2.degrees, p3.degrees, 120, 6) &&
                isInAspect(p3.degrees, p1.degrees, 120, 6)) {

              patterns.push({
                type: "Grand Trine",
                planets: [p1.name, p2.name, p3.name],
                description: `Grand Trine: ${p1.name} - ${p2.name} - ${p3.name}`,
                significance: "high"
              });
            }
          }
        }
      }

      // GRAND CROSS DETECTION (4 planets in 90° cross with oppositions)
      for (let i = 0; i < allPositions.length; i++) {
        for (let j = i + 1; j < allPositions.length; j++) {
          for (let k = j + 1; k < allPositions.length; k++) {
            for (let l = k + 1; l < allPositions.length; l++) {
              const p1 = allPositions[i];
              const p2 = allPositions[j];
              const p3 = allPositions[k];
              const p4 = allPositions[l];

              // Check for grand cross pattern (2 oppositions intersecting at squares)
              const hasOpposition1 = isInAspect(p1.degrees, p3.degrees, 180, 6);
              const hasOpposition2 = isInAspect(p2.degrees, p4.degrees, 180, 6);
              const hasSquare1 = isInAspect(p1.degrees, p2.degrees, 90, 6);
              const hasSquare2 = isInAspect(p2.degrees, p3.degrees, 90, 6);
              const hasSquare3 = isInAspect(p3.degrees, p4.degrees, 90, 6);
              const hasSquare4 = isInAspect(p4.degrees, p1.degrees, 90, 6);

              if (hasOpposition1 && hasOpposition2 && hasSquare1 && hasSquare2 && hasSquare3 && hasSquare4) {
                patterns.push({
                  type: "Grand Cross",
                  planets: [p1.name, p2.name, p3.name, p4.name],
                  description: `Grand Cross: ${p1.name} - ${p2.name} - ${p3.name} - ${p4.name}`,
                  significance: "very high"
                });
              }
            }
          }
        }
      }

      // T-SQUARE DETECTION (2 squares + 1 opposition)
      for (let i = 0; i < allPositions.length; i++) {
        for (let j = i + 1; j < allPositions.length; j++) {
          for (let k = j + 1; k < allPositions.length; k++) {
            const p1 = allPositions[i];
            const p2 = allPositions[j];
            const p3 = allPositions[k];

            // Check T-square: p1 squares both p2 and p3, while p2 opposes p3
            if (isInAspect(p1.degrees, p2.degrees, 90, 6) &&
                isInAspect(p1.degrees, p3.degrees, 90, 6) &&
                isInAspect(p2.degrees, p3.degrees, 180, 6)) {

              patterns.push({
                type: "T-Square",
                planets: [p1.name, p2.name, p3.name],
                description: `T-Square: ${p1.name} squares ${p2.name} & ${p3.name} (${p2.name} opp ${p3.name})`,
                significance: "high"
              });
            }
          }
        }
      }

      // KITE PATTERN DETECTION (Grand Trine + opposition to one point)
      // This is complex - look for grand trine first, then opposition to one point
      patterns.forEach(pattern => {
        if (pattern.type === "Grand Trine") {
          const trineParticipants = pattern.planets;

          // Look for a 4th planet that opposes one of the trine participants
          for (let i = 0; i < allPositions.length; i++) {
            const candidate = allPositions[i];
            if (trineParticipants.includes(candidate.name)) continue;

            // Check if this planet opposes any trine participant
            for (const trinePlanet of trineParticipants) {
              const trinePlanetPos = allPositions.find(p => p.name === trinePlanet);
              if (trinePlanetPos && isInAspect(candidate.degrees, trinePlanetPos.degrees, 180, 6)) {
                patterns.push({
                  type: "Kite",
                  planets: [...trineParticipants, candidate.name],
                  description: `Kite: Grand Trine (${trineParticipants.join('-')}) + ${candidate.name} opposing ${trinePlanet}`,
                  significance: "very high"
                });
                break;
              }
            }
          }
        }
      });

      return patterns;
    }

    console.log(`🎯 Found ${transits.length} total transits`);
    console.log(`⚡ Exact transits: ${transits.filter(t => t.isExact).length}`);
    console.log(`📈 Applying transits: ${transits.filter(t => t.isApplying).length}`);
    console.log(`📉 Separating transits: ${transits.filter(t => t.isSeparating).length}`);

    // Temporarily disable aspect pattern detection (was causing timeout)
    const aspectPatterns = [];
    console.log(`🔮 Aspect pattern detection disabled for now`);

    return res.json({
      date: easternDate,
      localEasternTime: easternNow.format(),
      natalChart: "Chris",
      totalTransits: transits.length,
      exactTransits: transits.filter(t => t.isExact),
      applyingTransits: transits.filter(t => t.isApplying),
      separatingTransits: transits.filter(t => t.isSeparating),
      aspectPatterns: aspectPatterns,
      allTransits: transits,
      summary: transits.slice(0, 5).map(t => t.description).join(" | ")
    });


  } catch (error) {
    console.error("💥 Error in simplified daily transits:", error.message, error.stack);
    return res.status(500).json({
      error: "Failed to calculate daily transits. Please check your natal chart data and try again.",
      details: error.message
    });
  }
});


// Chris's natal chart data (May 1, 1986 2:35 PM EST = 7:35 PM UTC)
// Using fallback data since calculateNatalChart function is not implemented
let CHRIS_NATAL_CHART;

// Fallback static chart data (in case calculation fails)
const CHRIS_NATAL_CHART_FALLBACK = {
  sun: { degrees: 41.084, sign: "Taurus", position: "11°Ta05'02''" },
  moon: { degrees: 319.022, sign: "Aquarius", position: "19°Aq01'18''" },
  mercury: { degrees: 20.069, sign: "Aries", position: "20°Ar04'10''" },
  venus: { degrees: 66.059, sign: "Gemini", position: "06°Ge03'31''" },
  mars: { degrees: 285.372, sign: "Capricorn", position: "15°Cp22'18''" },
  jupiter: { degrees: 345.495, sign: "Pisces", position: "15°Pi29'43''" },
  saturn: { degrees: 248.253, sign: "Sagittarius", position: "08°Sg15'08''" },
  uranus: { degrees: 261.866, sign: "Sagittarius", position: "21°Sg51'58''" },
  neptune: { degrees: 275.654, sign: "Capricorn", position: "05°Cp39'16''" },
  pluto: { degrees: 215.825, sign: "Scorpio", position: "05°Sc49'30''" }
};

// Use fallback natal chart data
CHRIS_NATAL_CHART = CHRIS_NATAL_CHART_FALLBACK;

// Planetary glyphs
const PLANET_GLYPHS = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇"
};

// Aspect glyphs
const ASPECT_GLYPHS = {
  conjunction: "☌", opposition: "☍", square: "□",
  trine: "△", sextile: "⚹", quincunx: "⚻"
};

// Calculate aspect between two degrees
function calculateAspect(degree1, degree2) {
  let diff = Math.abs(degree1 - degree2);
  if (diff > 180) diff = 360 - diff;

  // Major aspects only: conjunction, opposition, square, trine, sextile
  const aspects = [
    { name: "conjunction", angle: 0, orb: 8 },
    { name: "sextile", angle: 60, orb: 6 },
    { name: "square", angle: 90, orb: 8 },
    { name: "trine", angle: 120, orb: 8 },
    { name: "opposition", angle: 180, orb: 8 }
  ];

  for (let aspect of aspects) {
    if (Math.abs(diff - aspect.angle) <= aspect.orb) {
      return {
        type: aspect.name,
        glyph: ASPECT_GLYPHS[aspect.name],
        orb: Math.abs(diff - aspect.angle).toFixed(2),
        angle: diff
      };
    }
  }
  return null;
}

// Helper function to format degrees as zodiac position
function formatPosition(degrees) {
  const signs = ["Ar", "Ta", "Ge", "Cn", "Le", "Vi", "Li", "Sc", "Sg", "Cp", "Aq", "Pi"];
  const signIndex = Math.floor(degrees / 30);
  const degInSign = degrees % 30;
  const deg = Math.floor(degInSign);
  const minFloat = (degInSign - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.floor((minFloat - min) * 60);

  return `${deg}°${signs[signIndex]}${min.toString().padStart(2, '0')}'${sec.toString().padStart(2, '0')}''`;
}

// Daily Transits endpoint (TIMEZONE FIXED)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sweph service listening on port ${PORT} on all interfaces`);
  console.log(`Test the server at: http://localhost:${PORT}/test`);
});

// New endpoint for planetary aspects
app.get("/aspects-now", (req, res) => {
  try {
    // 1) Get current local time in Eastern Time
    const localNow = moment.tz("America/New_York");

    // 2) Convert local time to UTC for Swiss Ephemeris
    const yearUTC = localNow.utc().year();
    const monthUTC = localNow.utc().month() + 1; // +1 because month() is 0-based
    const dayUTC = localNow.utc().date();
    const hourUTC =
      localNow.utc().hour() +
      localNow.utc().minute() / 60 +
      localNow.utc().second() / 3600;

    // 3) Calculate the Julian Day
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;

    // 4) Define planets to calculate
    const planets = [
      { id: sweph.constants.SE_SUN, name: "Sun" },
      { id: sweph.constants.SE_MOON, name: "Moon" },
      { id: sweph.constants.SE_MERCURY, name: "Mercury" },
      { id: sweph.constants.SE_VENUS, name: "Venus" },
      { id: sweph.constants.SE_MARS, name: "Mars" },
      { id: sweph.constants.SE_JUPITER, name: "Jupiter" },
      { id: sweph.constants.SE_SATURN, name: "Saturn" },
      { id: sweph.constants.SE_URANUS, name: "Uranus" },
      { id: sweph.constants.SE_NEPTUNE, name: "Neptune" },
      { id: sweph.constants.SE_PLUTO, name: "Pluto" }
    ];

    // 5) Define zodiac signs (for reference)
    const signNames = [
      "Aries", "Taurus", "Gemini", "Cancer",
      "Leo", "Virgo", "Libra", "Scorpio", 
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];

    // 6) Define aspects with their angles and orbs
    const aspectTypes = [
      { name: "Conjunction", symbol: "☌", angle: 0, orb: 8 },
      { name: "Sextile", symbol: "⚹", angle: 60, orb: 6 },
      { name: "Square", symbol: "□", angle: 90, orb: 8 },
      { name: "Trine", symbol: "△", angle: 120, orb: 8 },
      { name: "Opposition", symbol: "☍", angle: 180, orb: 10 },
      { name: "Quincunx", symbol: "⚻", angle: 150, orb: 3 },
      { name: "Semi-sextile", symbol: "⚺", angle: 30, orb: 3 },
      { name: "Semi-square", symbol: "⚼", angle: 45, orb: 3 },
      { name: "Sesquiquadrate", symbol: "⚿", angle: 135, orb: 3 },
      { name: "Quintile", symbol: "Q", angle: 72, orb: 2 }
    ];

    // 7) Calculate positions for all planets
    const planetaryPositions = [];
    
    for (const planet of planets) {
      const result = sweph.calc(jd, planet.id, flags);
      
      if (!result || (result.flag !== 0 && result.flag !== 2)) {
        console.error(`Error calculating ${planet.name}: ${result?.error || "unknown error"}`);
        continue;
      }
      
      // Get longitude
      const longitude = result.data[0];
      
      // Calculate sign and degree
      const signIndex = Math.floor((longitude % 360) / 30);
      const sign = signNames[signIndex];
      const degreeInSign = (longitude % 30).toFixed(2);
      
      // Check if retrograde using helper function
      const planetIsRetrograde = isRetrograde(planet.id, jd, flags);
      
      planetaryPositions.push({
        name: planet.name,
        longitude,
        sign,
        degreeInSign,
        isRetrograde: planetIsRetrograde
      });
    }

    // 8) Calculate aspects between all planets
    const aspects = [];
    
    for (let i = 0; i < planetaryPositions.length; i++) {
      for (let j = i + 1; j < planetaryPositions.length; j++) {
        const planet1 = planetaryPositions[i];
        const planet2 = planetaryPositions[j];
        
        // Calculate angle between planets (smallest angle)
        let angle = Math.abs(planet1.longitude - planet2.longitude) % 360;
        if (angle > 180) angle = 360 - angle;
        
        // Check if this angle corresponds to a known aspect
        for (const aspectType of aspectTypes) {
          const difference = Math.abs(angle - aspectType.angle);
          
          if (difference <= aspectType.orb) {
            // This is a valid aspect
            aspects.push({
              planet1: planet1.name,
              planet2: planet2.name,
              aspectName: aspectType.name,
              aspectSymbol: aspectType.symbol,
              exactAngle: angle.toFixed(2),
              orb: difference.toFixed(2),
              planet1Sign: planet1.sign,
              planet2Sign: planet2.sign,
              planet1Retrograde: planet1.isRetrograde,
              planet2Retrograde: planet2.isRetrograde
            });
            break; // Only count the most precise aspect between two planets
          }
        }
      }
    }

    // 9) Return JSON with all aspects
    res.json({
      localEasternTime: localNow.format(),          // Eastern time display
      aspects
    });
    
  } catch (error) {
    console.error("Error calculating planetary aspects:", error);
    res.status(500).json({
      error: "Failed to calculate planetary aspects"
    });
  }
});

// Helper function to get aspect symbol
function getAspectSymbol(aspectName) {
  const aspectSymbols = {
    "Conjunction": "☌",
    "Opposition": "☍",
    "Trine": "△",
    "Square": "□", 
    "Sextile": "⚹",
    "Quincunx": "⚻",
    "Semi-sextile": "⚺",
    "Semi-square": "⚼",
    "Sesquiquadrate": "⚿"
  };
  
  return aspectSymbols[aspectName] || aspectName;
}

// Void of Course Moon endpoint
// Enhanced Void of Course Moon endpoint with flexible timeframe
app.get("/void-of-course-moons", (req, res) => {
  try {
    // Get current time
    const now = moment.tz("America/New_York");
    
    // Get timeframe from query parameters, default to "week"
    const timeframe = req.query.timeframe || "week";
    
    // Get optional start and end dates from query parameters
    let startDate = req.query.start ? moment.tz(req.query.start, "YYYY-MM-DD", "America/New_York") : null;
    let endDate = req.query.end ? moment.tz(req.query.end, "YYYY-MM-DD", "America/New_York") : null;
    
    // Define date boundaries based on timeframe or explicit dates
    let startBoundary, endBoundary;
    
    if (startDate && endDate) {
      // Use explicit date range if provided
      startBoundary = startDate.startOf('day');
      endBoundary = endDate.endOf('day');
      console.log(`Using custom date range: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    } else {
      // Calculate based on timeframe
      switch(timeframe) {
        case "day":
          startBoundary = moment(now).startOf('day');
          endBoundary = moment(now).endOf('day');
          break;
        case "week":
          const currentDay = now.day(); // 0 is Sunday, 1 is Monday, etc.
          const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Days back to Monday
          startBoundary = moment(now).subtract(daysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
          break;
        case "month":
          startBoundary = moment(now).startOf('month');
          endBoundary = moment(now).endOf('month');
          break;
        default:
          // Default to week if invalid timeframe
          const defaultDay = now.day();
          const defaultDaysToMonday = defaultDay === 0 ? 6 : defaultDay - 1;
          startBoundary = moment(now).subtract(defaultDaysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
      }
      
      console.log(`Finding void of course moons for ${timeframe}: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    }
    
    // Define planets to check against
    const planets = [
      { id: sweph.constants.SE_SUN, name: "Sun" },
      { id: sweph.constants.SE_MERCURY, name: "Mercury" },
      { id: sweph.constants.SE_VENUS, name: "Venus" },
      { id: sweph.constants.SE_MARS, name: "Mars" },
      { id: sweph.constants.SE_JUPITER, name: "Jupiter" },
      { id: sweph.constants.SE_SATURN, name: "Saturn" },
      { id: sweph.constants.SE_URANUS, name: "Uranus" },
      { id: sweph.constants.SE_NEPTUNE, name: "Neptune" },
      { id: sweph.constants.SE_PLUTO, name: "Pluto" }
    ];
    
    // Define major aspects to check for
    const majorAspects = [
      { name: "Conjunction", angle: 0, orb: 1 },
      { name: "Sextile", angle: 60, orb: 1 },
      { name: "Square", angle: 90, orb: 1 },
      { name: "Trine", angle: 120, orb: 1 },
      { name: "Opposition", angle: 180, orb: 1 }
    ];
    
    // Define zodiac signs
    const signNames = [
      "Aries", "Taurus", "Gemini", "Cancer",
      "Leo", "Virgo", "Libra", "Scorpio", 
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];
    
    // We'll check hourly intervals
    const vocMoons = [];
    let datePointer = moment(startBoundary);
    
    // Track moon position and status
    let lastSign = null;
    let vocStart = null;
    let lastAspectTime = null;
    
    while (datePointer.isSameOrBefore(endBoundary)) {
      // Convert to UTC for Swiss Ephemeris calculations
      const yearUTC = datePointer.utc().year();
      const monthUTC = datePointer.utc().month() + 1;
      const dayUTC = datePointer.utc().date();
      const hourUTC =
        datePointer.utc().hour() +
        datePointer.utc().minute() / 60 +
        datePointer.utc().second() / 3600;
      
      // Calculate Julian day
      const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
      const flags = sweph.constants.SEFLG_SWIEPH;
      
      // Calculate Moon position
      const moonResult = sweph.calc(jd, sweph.constants.SE_MOON, flags);
      if (!moonResult || (moonResult.flag !== 0 && moonResult.flag !== 2)) {
        datePointer.add(1, 'hour');
        continue;
      }
      
      const moonLon = moonResult.data[0];
      const signIndex = Math.floor((moonLon % 360) / 30);
      const currentSign = signNames[signIndex];
      
      // If sign changed, record the end of VOC period if one was ongoing
      if (lastSign && currentSign !== lastSign && vocStart) {
        vocMoons.push({
          start: vocStart.format('YYYY-MM-DD HH:mm'),
          end: datePointer.format('YYYY-MM-DD HH:mm'),
          previousSign: lastSign,
          newSign: currentSign,
          duration: datePointer.diff(vocStart, 'hours', true).toFixed(1) + ' hours'
        });
        vocStart = null;
      }
      
      // Check if the moon is making any aspects
      let hasMajorAspect = false;
      
      // Check aspects with all planets
      for (const planet of planets) {
        const planetResult = sweph.calc(jd, planet.id, flags);
        if (!planetResult || (planetResult.flag !== 0 && planetResult.flag !== 2)) {
          continue;
        }
        
        const planetLon = planetResult.data[0];
        
        // Calculate angle between moon and planet
        let angle = Math.abs(moonLon - planetLon) % 360;
        if (angle > 180) angle = 360 - angle;
        
        // Check if this angle is a major aspect (within orb)
        for (const aspect of majorAspects) {
          const orb = Math.abs(angle - aspect.angle);
          if (orb <= aspect.orb) {
            hasMajorAspect = true;
            lastAspectTime = datePointer.clone();
            break;
          }
        }
        
        if (hasMajorAspect) break;
      }
      
      // If no aspect, check if we should start VOC period
      if (!hasMajorAspect && lastAspectTime && !vocStart && lastSign === currentSign) {
        vocStart = datePointer.clone();
        console.log(`VOC starts: ${vocStart.format('YYYY-MM-DD HH:mm')} in ${currentSign}`);
      }
      
      lastSign = currentSign;
      datePointer.add(1, 'hour');
    }
    
    // If period ends with an ongoing VOC period, record it with end at boundary
    if (vocStart) {
      vocMoons.push({
        start: vocStart.format('YYYY-MM-DD HH:mm'),
        end: endBoundary.format('YYYY-MM-DD HH:mm') + ' (continues)',
        previousSign: lastSign,
        duration: endBoundary.diff(vocStart, 'hours', true).toFixed(1) + ' hours (ongoing)'
      });
    }
    
    return res.json({
      localEasternTime: now.format(),
      timeframe: startDate && endDate ? 'custom' : timeframe,
      dateRange: {
        start: startBoundary.format('YYYY-MM-DD'),
        end: endBoundary.format('YYYY-MM-DD')
      },
      voidOfCourseMoons: vocMoons
    });
    
  } catch (error) {
    console.error("Error calculating void of course moons:", error.message, error.stack);
    return res.status(500).json({
      error: "Failed to calculate void of course moons. Please verify the timeframe or date range and try again."
    });
  }
});

// Enhanced Planetary Ingresses endpoint with flexible timeframe
app.get("/planetary-ingresses", (req, res) => {
  try {
    // Get current time
    const now = moment.tz("America/New_York");
    
    // Get timeframe from query parameters, default to "week"
    const timeframe = req.query.timeframe || "week";
    
    // Get optional start and end dates from query parameters
    let startDate = req.query.start ? moment.tz(req.query.start, "YYYY-MM-DD", "America/New_York") : null;
    let endDate = req.query.end ? moment.tz(req.query.end, "YYYY-MM-DD", "America/New_York") : null;
    
    // Define date boundaries based on timeframe or explicit dates
    let startBoundary, endBoundary;
    
    if (startDate && endDate) {
      // Use explicit date range if provided
      startBoundary = startDate.startOf('day');
      endBoundary = endDate.endOf('day');
      console.log(`Using custom date range: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    } else {
      // Calculate based on timeframe
      switch(timeframe) {
        case "day":
          startBoundary = moment(now).startOf('day');
          endBoundary = moment(now).endOf('day');
          break;
        case "week":
          const currentDay = now.day(); // 0 is Sunday, 1 is Monday, etc.
          const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Days back to Monday
          startBoundary = moment(now).subtract(daysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
          break;
        case "month":
          startBoundary = moment(now).startOf('month');
          endBoundary = moment(now).endOf('month');
          break;
        default:
          // Default to week if invalid timeframe
          const defaultDay = now.day();
          const defaultDaysToMonday = defaultDay === 0 ? 6 : defaultDay - 1;
          startBoundary = moment(now).subtract(defaultDaysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
      }
      
      console.log(`Finding planetary ingresses for ${timeframe}: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    }
    
    // Define planets to check
    const planets = [
      { id: sweph.constants.SE_SUN, name: "Sun" },
      { id: sweph.constants.SE_MOON, name: "Moon" },
      { id: sweph.constants.SE_MERCURY, name: "Mercury" },
      { id: sweph.constants.SE_VENUS, name: "Venus" },
      { id: sweph.constants.SE_MARS, name: "Mars" },
      { id: sweph.constants.SE_JUPITER, name: "Jupiter" },
      { id: sweph.constants.SE_SATURN, name: "Saturn" },
      { id: sweph.constants.SE_URANUS, name: "Uranus" },
      { id: sweph.constants.SE_NEPTUNE, name: "Neptune" },
      { id: sweph.constants.SE_PLUTO, name: "Pluto" }
    ];
    
    // Define zodiac signs
    const signNames = [
      "Aries", "Taurus", "Gemini", "Cancer",
      "Leo", "Virgo", "Libra", "Scorpio", 
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];
    
    // Track ingresses
    const ingresses = [];
    
    // Check interval based on planet speed
    const moonCheckInterval = 2; // hours
    const sunCheckInterval = 6; // hours
    const otherPlanetsInterval = 12; // hours
    
    // Initialize last signs
    const lastSigns = {};
    for (const planet of planets) {
      lastSigns[planet.name] = null;
    }
    
    // Start at the boundary
    let datePointer = moment(startBoundary);
    
    while (datePointer.isSameOrBefore(endBoundary)) {
      // Convert to UTC for Swiss Ephemeris calculations
      const yearUTC = datePointer.utc().year();
      const monthUTC = datePointer.utc().month() + 1;
      const dayUTC = datePointer.utc().date();
      const hourUTC =
        datePointer.utc().hour() +
        datePointer.utc().minute() / 60 +
        datePointer.utc().second() / 3600;
      
      // Calculate Julian day
      const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
      const flags = sweph.constants.SEFLG_SWIEPH;
      
      // Check each planet
      for (const planet of planets) {
        const result = sweph.calc(jd, planet.id, flags);
        if (!result || (result.flag !== 0 && result.flag !== 2)) {
          continue;
        }
        
        // Get sign
        const longitude = result.data[0];
        const signIndex = Math.floor((longitude % 360) / 30);
        const sign = signNames[signIndex];
        const degreeInSign = (longitude % 30).toFixed(2);
        
        // Check for sign change
        if (lastSigns[planet.name] !== null && sign !== lastSigns[planet.name]) {
          ingresses.push({
            planet: planet.name,
            date: datePointer.format('YYYY-MM-DD HH:mm'),
            fromSign: lastSigns[planet.name],
            toSign: sign,
            degreeInSign
          });
        }
        
        lastSigns[planet.name] = sign;
      }
      
      // Advance time - different interval based on planet type
      if (datePointer.hour() % sunCheckInterval === 0) {
        // Check slower planets only at intervals
        datePointer.add(moonCheckInterval, 'hours');
      } else {
        // Always check moon at moonCheckInterval
        datePointer.add(moonCheckInterval, 'hours');
      }
    }
    
    return res.json({
      localEasternTime: now.format(),
      timeframe: startDate && endDate ? 'custom' : timeframe,
      dateRange: {
        start: startBoundary.format('YYYY-MM-DD'),
        end: endBoundary.format('YYYY-MM-DD')
      },
      ingresses
    });
  } catch (error) {
    console.error("Error calculating planetary ingresses:", error.message, error.stack);
    return res.status(500).json({
      error: "Failed to calculate planetary ingresses. Please check your query parameters and try again."
    });
  }
});

app.get("/moon-for-date", (req, res) => {
  try {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res.status(400).json({ error: "Date parameter is required (YYYY-MM-DD)" });
    }
    
    // Parse the date string (YYYY-MM-DD)
    const targetDate = moment.tz(dateStr, "America/New_York");
    if (!targetDate.isValid()) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }
    
    // Convert to UTC for Swiss Ephemeris
    const yearUTC = targetDate.utc().year();
    const monthUTC = targetDate.utc().month() + 1; // +1 because month() is 0-based
    const dayUTC = targetDate.utc().date();
    // Use noon (12:00) for the target date to get the general phase for that day
    const hourUTC = 12;
    
    console.log(`Requested date: ${dateStr} => UTC: ${yearUTC}-${monthUTC}-${dayUTC} ${hourUTC}`);
    
    // Calculate Julian day
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;
    
    // Calculate Moon position
    const moonResult = sweph.calc(jd, sweph.constants.SE_MOON, flags);
    if (!moonResult || (moonResult.flag !== 0 && moonResult.flag !== 2)) {
      return res.json({ error: moonResult?.error || "Moon calc error" });
    }
    const moonLon = moonResult.data[0]; // ecliptic longitude
    
    // Calculate Sun position
    const sunResult = sweph.calc(jd, sweph.constants.SE_SUN, flags);
    if (!sunResult || (sunResult.flag !== 0 && sunResult.flag !== 2)) {
      return res.json({ error: sunResult?.error || "Sun calc error" });
    }
    const sunLon = sunResult.data[0];
    
    // Calculate phase angle
    let phaseAngle = (moonLon - sunLon) % 360;
    if (phaseAngle < 0) phaseAngle += 360;
    
    // Determine moon phase
    let moonPhase = "New Moon";
    if (phaseAngle >= 22.5 && phaseAngle < 67.5) {
      moonPhase = "Waxing Crescent";
    } else if (phaseAngle >= 67.5 && phaseAngle < 112.5) {
      moonPhase = "First Quarter";
    } else if (phaseAngle >= 112.5 && phaseAngle < 157.5) {
      moonPhase = "Waxing Gibbous";
    } else if (phaseAngle >= 157.5 && phaseAngle < 202.5) {
      moonPhase = "Full Moon";
    } else if (phaseAngle >= 202.5 && phaseAngle < 247.5) {
      moonPhase = "Waning Gibbous";
    } else if (phaseAngle >= 247.5 && phaseAngle < 292.5) {
      moonPhase = "Last Quarter";
    } else if (phaseAngle >= 292.5 && phaseAngle < 337.5) {
      moonPhase = "Waning Crescent";
    }
    
    // Determine moon sign
    // Each sign is 30 degrees
    const signIndex = Math.floor(moonLon / 30) % 12;
    const signs = [
      "Aries", "Taurus", "Gemini", "Cancer", 
      "Leo", "Virgo", "Libra", "Scorpio", 
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];
    const moonSign = signs[signIndex];
    
    // Calculate degree in sign
    const degreeInSign = (moonLon % 30).toFixed(2);
    
    // Calculate moon age in days (0-29.53)
    // One lunation is about 29.53058867 days
    const moonAge = (phaseAngle / 360 * 29.53058867).toFixed(2);
    
    return res.json({
      date: dateStr,
      localEasternTime: targetDate.format(),
      moonPhase,
      moonSign,
      degreeInSign,
      age: parseFloat(moonAge)
    });
  } catch (error) {
    console.error("Error in /moon-for-date:", error.message);
    return res.status(500).json({ error: "Server error calculating moon data", details: error.message });
  }
});

// Enhanced Planetary Stations endpoint with flexible timeframe
app.get("/planetary-stations", (req, res) => {
  try {
    // Get current time
    const now = moment.tz("America/New_York");
    
    // Get timeframe from query parameters, default to "week"
    const timeframe = req.query.timeframe || "week";
    
    // Get optional start and end dates from query parameters
    let startDate = req.query.start ? moment.tz(req.query.start, "YYYY-MM-DD", "America/New_York") : null;
    let endDate = req.query.end ? moment.tz(req.query.end, "YYYY-MM-DD", "America/New_York") : null;
    
    // Define date boundaries based on timeframe or explicit dates
    let startBoundary, endBoundary;
    
    if (startDate && endDate) {
      // Use explicit date range if provided
      startBoundary = startDate.startOf('day');
      endBoundary = endDate.endOf('day');
      console.log(`Using custom date range: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    } else {
      // Calculate based on timeframe
      switch(timeframe) {
        case "day":
          startBoundary = moment(now).startOf('day');
          endBoundary = moment(now).endOf('day');
          break;
        case "week":
          const currentDay = now.day(); // 0 is Sunday, 1 is Monday, etc.
          const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Days back to Monday
          startBoundary = moment(now).subtract(daysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
          break;
        case "month":
          startBoundary = moment(now).startOf('month');
          endBoundary = moment(now).endOf('month');
          break;
        default:
          // Default to week if invalid timeframe
          const defaultDay = now.day();
          const defaultDaysToMonday = defaultDay === 0 ? 6 : defaultDay - 1;
          startBoundary = moment(now).subtract(defaultDaysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
      }
      
      console.log(`Finding planetary stations for ${timeframe}: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    }
    
    // Define planets to check (only planets that can go retrograde)
    const planets = [
      { id: sweph.constants.SE_MERCURY, name: "Mercury" },
      { id: sweph.constants.SE_VENUS, name: "Venus" },
      { id: sweph.constants.SE_MARS, name: "Mars" },
      { id: sweph.constants.SE_JUPITER, name: "Jupiter" },
      { id: sweph.constants.SE_SATURN, name: "Saturn" },
      { id: sweph.constants.SE_URANUS, name: "Uranus" },
      { id: sweph.constants.SE_NEPTUNE, name: "Neptune" },
      { id: sweph.constants.SE_PLUTO, name: "Pluto" }
    ];
    
    // Define zodiac signs
    const signNames = [
      "Aries", "Taurus", "Gemini", "Cancer",
      "Leo", "Virgo", "Libra", "Scorpio", 
      "Sagittarius", "Capricorn", "Aquarius", "Pisces"
    ];
    
    // Track retrograde changes
    const stations = [];
    
    // Initialize last directions and speeds
    const lastDirections = {};
    const lastSpeeds = {};
    
    for (const planet of planets) {
      lastDirections[planet.name] = null;
      lastSpeeds[planet.name] = null;
    }
    
    // Check every 12 hours for slow-moving planets
    // This is a reasonable interval for detection while keeping computation time reasonable
    let datePointer = moment(startBoundary);
    
    while (datePointer.isSameOrBefore(endBoundary)) {
      // Convert to UTC for Swiss Ephemeris calculations
      const yearUTC = datePointer.utc().year();
      const monthUTC = datePointer.utc().month() + 1;
      const dayUTC = datePointer.utc().date();
      const hourUTC =
        datePointer.utc().hour() +
        datePointer.utc().minute() / 60 +
        datePointer.utc().second() / 3600;
      
      // Calculate Julian day
      const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
      const flags = sweph.constants.SEFLG_SWIEPH;
      
      // Check each planet
      for (const planet of planets) {
        const result = sweph.calc(jd, planet.id, flags);
        if (!result || (result.flag !== 0 && result.flag !== 2)) {
          continue;
        }
        
        // Get speed and position info
        const longitude = result.data[0];
        const speed = result.data[3]; // Daily motion rate
        const signIndex = Math.floor((longitude % 360) / 30);
        const sign = signNames[signIndex];
        const degreeInSign = (longitude % 30).toFixed(2);
        
        const isRetrograde = speed < 0;
        
        // Check for direction change
        if (lastDirections[planet.name] !== null && isRetrograde !== lastDirections[planet.name]) {
          // A station (direction change) has occurred
          const stationType = isRetrograde ? "Retrograde" : "Direct";
          
          stations.push({
            planet: planet.name,
            date: datePointer.format('YYYY-MM-DD HH:mm'),
            type: stationType,
            sign,
            degreeInSign,
            // Include the speed to see how close to stationary
            speed: Math.abs(speed).toFixed(6)
          });
        }
        
        // Also check for near-zero speed (station)
        if (lastSpeeds[planet.name] !== null) {
          // If the speed crosses zero or is very close to zero
          if ((lastSpeeds[planet.name] * speed <= 0) && 
              Math.abs(speed) < 0.0001 && 
              Math.abs(lastSpeeds[planet.name]) < 0.0001) {
            
            // This is an almost exact station point
            const stationExactType = speed < 0 ? "Retrograde Station" : "Direct Station";
            
            // Check if we already logged this station - prevent duplicates
            const alreadyLogged = stations.some(s => 
              s.planet === planet.name && 
              Math.abs(moment(s.date).diff(datePointer, 'hours')) < 24
            );
            
            if (!alreadyLogged) {
              stations.push({
                planet: planet.name,
                date: datePointer.format('YYYY-MM-DD HH:mm'),
                type: stationExactType,
                sign,
                degreeInSign,
                speed: Math.abs(speed).toFixed(6),
                notes: "Exact station point"
              });
            }
          }
        }
        
        lastDirections[planet.name] = isRetrograde;
        lastSpeeds[planet.name] = speed;
      }
      
      // Advance 12 hours - this should be sufficient to catch any direction changes
      // Mercury, the fastest retrograde planet, takes about a day to station
      datePointer.add(12, 'hours');
    }
    
    return res.json({
      localEasternTime: now.format(),
      timeframe: startDate && endDate ? 'custom' : timeframe,
      dateRange: {
        start: startBoundary.format('YYYY-MM-DD'),
        end: endBoundary.format('YYYY-MM-DD')
      },
      stations
    });
    
  } catch (error) {
    console.error("Error calculating planetary stations:", error.message, error.stack);
    return res.status(500).json({
      error: "Failed to calculate planetary stations. Please check your query parameters and try again."
    });
  }
});

// Enhanced Important Transits endpoint with flexible timeframe
app.get("/important-transits", (req, res) => {
  try {
    // Get current time
    const now = moment.tz("America/New_York");
    
    // Get timeframe from query parameters, default to "week"
    const timeframe = req.query.timeframe || "week";
    
    // Get optional start and end dates from query parameters
    let startDate = req.query.start ? moment.tz(req.query.start, "YYYY-MM-DD", "America/New_York") : null;
    let endDate = req.query.end ? moment.tz(req.query.end, "YYYY-MM-DD", "America/New_York") : null;
    
    // Define date boundaries based on timeframe or explicit dates
    let startBoundary, endBoundary;
    
    if (startDate && endDate) {
      // Use explicit date range if provided
      startBoundary = startDate.startOf('day');
      endBoundary = endDate.endOf('day');
      console.log(`Using custom date range: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    } else {
      // Calculate based on timeframe
      switch(timeframe) {
        case "day":
          startBoundary = moment(now).startOf('day');
          endBoundary = moment(now).endOf('day');
          break;
        case "week":
          const currentDay = now.day(); // 0 is Sunday, 1 is Monday, etc.
          const daysToMonday = currentDay === 0 ? 6 : currentDay - 1; // Days back to Monday
          startBoundary = moment(now).subtract(daysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
          break;
        case "month":
          startBoundary = moment(now).startOf('month');
          endBoundary = moment(now).endOf('month');
          break;
        default:
          // Default to week if invalid timeframe
          const defaultDay = now.day();
          const defaultDaysToMonday = defaultDay === 0 ? 6 : defaultDay - 1;
          startBoundary = moment(now).subtract(defaultDaysToMonday, 'days').startOf('day');
          endBoundary = moment(startBoundary).add(6, 'days').endOf('day');
      }
      
      console.log(`Finding important transits for ${timeframe}: ${startBoundary.format('YYYY-MM-DD')} to ${endBoundary.format('YYYY-MM-DD')}`);
    }
    
    // Define planets to check
    const planets = [
      { id: sweph.constants.SE_SUN, name: "Sun" },
      { id: sweph.constants.SE_MOON, name: "Moon" },
      { id: sweph.constants.SE_MERCURY, name: "Mercury" },
      { id: sweph.constants.SE_VENUS, name: "Venus" },
      { id: sweph.constants.SE_MARS, name: "Mars" },
      { id: sweph.constants.SE_JUPITER, name: "Jupiter" },
      { id: sweph.constants.SE_SATURN, name: "Saturn" },
      { id: sweph.constants.SE_URANUS, name: "Uranus" },
      { id: sweph.constants.SE_NEPTUNE, name: "Neptune" },
      { id: sweph.constants.SE_PLUTO, name: "Pluto" }
    ];
    
    // Define major aspects with their angles and orbs
    const majorAspects = [
      { name: "Conjunction", symbol: "☌", angle: 0, orb: 1 },
      { name: "Opposition", symbol: "☍", angle: 180, orb: 1 },
      { name: "Trine", symbol: "△", angle: 120, orb: 1 },
      { name: "Square", symbol: "□", angle: 90, orb: 1 }
    ];
    
    // Important planetary pairs to track
    const significantPairs = [
      { planet1: "Sun", planet2: "Jupiter" },
      { planet1: "Sun", planet2: "Saturn" },
      { planet1: "Sun", planet2: "Uranus" },
      { planet1: "Sun", planet2: "Neptune" },
      { planet1: "Sun", planet2: "Pluto" },
      { planet1: "Jupiter", planet2: "Saturn" },
      { planet1: "Jupiter", planet2: "Uranus" },
      { planet1: "Jupiter", planet2: "Neptune" },
      { planet1: "Jupiter", planet2: "Pluto" },
      { planet1: "Saturn", planet2: "Uranus" },
      { planet1: "Saturn", planet2: "Neptune" },
      { planet1: "Saturn", planet2: "Pluto" },
      { planet1: "Uranus", planet2: "Neptune" },
      { planet1: "Uranus", planet2: "Pluto" },
      { planet1: "Neptune", planet2: "Pluto" },
      { planet1: "Mars", planet2: "Jupiter" },
      { planet1: "Mars", planet2: "Saturn" },
      { planet1: "Mars", planet2: "Uranus" },
      { planet1: "Mars", planet2: "Neptune" },
      { planet1: "Mars", planet2: "Pluto" }
    ];
    
    // Storage for important transits
    const significantAspects = [];
    
    // Interval to check (6 hours is reasonable for most transits)
    // For very precise work, could be reduced to 1-2 hours
    const checkInterval = 6; // hours
    
    // Keep track of aspects that have been logged to prevent duplicates
    const loggedAspects = new Set();
    
    let datePointer = moment(startBoundary);
    
    while (datePointer.isSameOrBefore(endBoundary)) {
      // Convert to UTC for Swiss Ephemeris calculations
      const yearUTC = datePointer.utc().year();
      const monthUTC = datePointer.utc().month() + 1;
      const dayUTC = datePointer.utc().date();
      const hourUTC =
        datePointer.utc().hour() +
        datePointer.utc().minute() / 60 +
        datePointer.utc().second() / 3600;
      
      // Calculate Julian day
      const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
      const flags = sweph.constants.SEFLG_SWIEPH;
      
      // Get positions of all planets for this time
      const positions = [];
      
      for (const planet of planets) {
        const result = sweph.calc(jd, planet.id, flags);
        if (!result || (result.flag !== 0 && result.flag !== 2)) {
          continue;
        }
        
        const longitude = result.data[0];
        const planetIsRetrograde = isRetrograde(planet.id, jd, flags);

        positions.push({
          name: planet.name,
          longitude,
          isRetrograde: planetIsRetrograde
        });
      }
      
      // Check for important aspects
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const planet1 = positions[i];
          const planet2 = positions[j];
          
          // Check if this pair is in our significant pairs list
          const isPairSignificant = significantPairs.some(
            pair => (pair.planet1 === planet1.name && pair.planet2 === planet2.name) ||
                   (pair.planet1 === planet2.name && pair.planet2 === planet1.name)
          );
          
          if (!isPairSignificant) {
            continue;
          }
          
          // Calculate angle between planets
          let angle = Math.abs(planet1.longitude - planet2.longitude) % 360;
          if (angle > 180) angle = 360 - angle;
          
          // Check if angle matches any major aspect within orb
          for (const aspect of majorAspects) {
            const orb = Math.abs(angle - aspect.angle);
            
            if (orb <= aspect.orb) {
              // Create a unique key for this aspect to prevent duplicates
              const aspKey = `${planet1.name}-${planet2.name}-${aspect.name}`;
              
              // Only log if we haven't seen this aspect before
              if (!loggedAspects.has(aspKey)) {
                significantAspects.push({
                  date: datePointer.format('YYYY-MM-DD HH:mm'),
                  planet1: planet1.name,
                  planet2: planet2.name,
                  aspect: aspect.name,
                  symbol: aspect.symbol,
                  orb: orb.toFixed(2),
                  planet1Retrograde: planet1.isRetrograde,
                  planet2Retrograde: planet2.isRetrograde
                });
                
                loggedAspects.add(aspKey);
              }
              
              break;
            }
          }
        }
      }
      
      // Move forward in time
      datePointer.add(checkInterval, 'hours');
    }
    
    return res.json({
      localEasternTime: now.format(),
      timeframe: startDate && endDate ? 'custom' : timeframe,
      dateRange: {
        start: startBoundary.format('YYYY-MM-DD'),
        end: endBoundary.format('YYYY-MM-DD')
      },
      significantAspects
    });
    
  } catch (error) {
    console.error("Error calculating important transits:", error.message, error.stack);
    return res.status(500).json({
      error: "Failed to calculate important transits. Please verify the timeframe or date range and try again."
    });
  }
});

// Daily moon phase endpoint - returns major phase if one perfects on the given date
app.get("/daily-moon-phase", (req, res) => {
  try {
    const dateParam = req.query.date;
    const targetDate = dateParam
      ? moment.tz(dateParam, "America/New_York").startOf('day')
      : moment.tz("America/New_York").startOf('day');

    console.log(`Checking for major moon phase on: ${targetDate.format('YYYY-MM-DD')}`);

    const dayEnd = moment(targetDate).endOf('day');

    const majorPhases = [
      { name: "New Moon", targetAngle: 0, emoji: "🌑" },
      { name: "First Quarter", targetAngle: 90, emoji: "🌓" },
      { name: "Full Moon", targetAngle: 180, emoji: "🌕" },
      { name: "Last Quarter", targetAngle: 270, emoji: "🌗" }
    ];

    let foundPhase = null;
    let datePointer = moment(targetDate);
    let prevAngle = null;

    while (datePointer.isSameOrBefore(dayEnd) && !foundPhase) {
      const phaseInfo = getMoonPhaseForDate(datePointer);
      const currentAngle = parseFloat(phaseInfo.phaseAngle);

      if (prevAngle !== null) {
        for (const phase of majorPhases) {
          let crossed = false;

          if (phase.targetAngle === 0) {
            crossed = (prevAngle > 350 && currentAngle < 10);
          } else {
            crossed = (prevAngle < phase.targetAngle && currentAngle >= phase.targetAngle);
          }

          if (crossed) {
            let searchStart = moment(datePointer).subtract(1, 'hour');
            let searchEnd = moment(datePointer);

            for (let i = 0; i < 8; i++) {
              const midPoint = moment(searchStart).add(
                moment.duration(searchEnd.diff(searchStart)).asMilliseconds() / 2, 'milliseconds'
              );
              const midPhase = getMoonPhaseForDate(midPoint);
              const midAngle = parseFloat(midPhase.phaseAngle);

              let pastTarget;
              if (phase.targetAngle === 0) {
                pastTarget = midAngle < 180;
              } else {
                pastTarget = midAngle >= phase.targetAngle;
              }

              if (pastTarget) {
                searchEnd = midPoint;
              } else {
                searchStart = midPoint;
              }
            }

            const exactPhaseInfo = getMoonPhaseForDate(searchEnd);

            foundPhase = {
              date: searchEnd.format('YYYY-MM-DD HH:mm:ss'),
              moonPhase: phase.name,
              moonSign: exactPhaseInfo.moonSign,
              degreeInSign: exactPhaseInfo.degreeInSign,
              emoji: phase.emoji
            };
            break;
          }
        }
      }

      prevAngle = currentAngle;
      datePointer.add(1, 'hour');
    }

    if (foundPhase) {
      console.log(`Found ${foundPhase.moonPhase} in ${foundPhase.moonSign} at ${foundPhase.date}`);
      return res.json({
        hasMajorPhase: true,
        ...foundPhase
      });
    } else {
      const currentPhase = getMoonPhaseForDate(moment.tz("America/New_York"));
      console.log(`No major phase on ${targetDate.format('YYYY-MM-DD')}`);
      return res.json({
        hasMajorPhase: false,
        moonPhase: null,
        moonSign: currentPhase.moonSign,
        emoji: null
      });
    }

  } catch (error) {
    console.error("Error calculating daily moon phase:", error);
    return res.status(500).json({
      error: "Failed to calculate daily moon phase"
    });
  }
});

// ============================================================================
// NEW ENDPOINTS: Essential Dignities & Chart Generation
// ============================================================================

/**
 * GET /dignity-score
 * Calculate essential dignity score for any planet at any position
 * Query params: planet, longitude OR (sign, degree), isDaySect (optional)
 */
app.get("/dignity-score", (req, res) => {
  try {
    const { planet, longitude, sign, degree, isDaySect = "true" } = req.query;
    
    if (!planet) {
      return res.status(400).json({ error: "Planet name required" });
    }
    
    let lon;
    if (longitude) {
      lon = parseFloat(longitude);
    } else if (sign && degree) {
      const signIndex = SIGNS.indexOf(sign);
      if (signIndex === -1) {
        return res.status(400).json({ error: "Invalid sign name" });
      }
      lon = signIndex * 30 + parseFloat(degree);
    } else {
      return res.status(400).json({ error: "Provide either longitude OR sign+degree" });
    }
    
    const isDayChart = isDaySect === "true" || isDaySect === true;
    const dignities = calculateDignities(planet, lon, isDayChart);
    
    res.json(dignities);
    
  } catch (error) {
    console.error("Error calculating dignity score:", error);
    res.status(500).json({ error: "Failed to calculate dignity score" });
  }
});

/**
 * GET /current-dignities
 * Get dignity scores for all planets at current positions
 */
app.get("/current-dignities", (req, res) => {
  try {
    const localNow = moment.tz("America/New_York");
    const yearUTC = localNow.utc().year();
    const monthUTC = localNow.utc().month() + 1;
    const dayUTC = localNow.utc().date();
    const hourUTC = localNow.utc().hour() + localNow.utc().minute() / 60 + localNow.utc().second() / 3600;
    
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;
    
    // Get Ascendant for sect calculation (need latitude - default to 40°N)
    const lat = parseFloat(req.query.lat) || 40.0;
    const lon = parseFloat(req.query.lon) || -74.0;
    
    const houses = sweph.houses(jd, lat, lon, 'P'); // Placidus
    const ascLongitude = houses.data.points[0];
    
    // Get Sun position for sect
    const sunResult = sweph.calc(jd, sweph.constants.SE_SUN, flags);
    const sunLongitude = sunResult.data[0];
    
    const sect = calculateSect(sunLongitude, ascLongitude);
    
    // Calculate all planets
    const planets = [
      { name: "Sun", id: sweph.constants.SE_SUN },
      { name: "Moon", id: sweph.constants.SE_MOON },
      { name: "Mercury", id: sweph.constants.SE_MERCURY },
      { name: "Venus", id: sweph.constants.SE_VENUS },
      { name: "Mars", id: sweph.constants.SE_MARS },
      { name: "Jupiter", id: sweph.constants.SE_JUPITER },
      { name: "Saturn", id: sweph.constants.SE_SATURN }
    ];
    
    const dignityResults = planets.map(planet => {
      const result = sweph.calc(jd, planet.id, flags);
      const longitude = result.data[0];
      const dignities = calculateDignities(planet.name, longitude, sect.isDaySect);
      const sectStatus = getPlanetSectStatus(planet.name, sect);
      
      return {
        ...dignities,
        sect: sectStatus
      };
    });
    
    res.json({
      timestamp: localNow.format(),
      chartSect: sect,
      location: { lat, lon },
      planets: dignityResults
    });
    
  } catch (error) {
    console.error("Error calculating current dignities:", error);
    res.status(500).json({ error: "Failed to calculate current dignities" });
  }
});

/**
 * POST /generate-chart
 * Generate a comprehensive natal chart and optionally save it
 * Body: { name, year, month, day, hour, minute, latitude, longitude, timezone, save: true/false }
 */
app.post("/generate-chart", (req, res) => {
  try {
    const { 
      name, 
      year, month, day, 
      hour = 12, minute = 0, second = 0,
      latitude, longitude, 
      timezone = "America/New_York",
      save = false 
    } = req.body;
    
    if (!name || !year || !month || !day || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        error: "Required: name, year, month, day, latitude, longitude" 
      });
    }
    
    // Create moment for birth time
    const birthMoment = moment.tz({ year, month: month - 1, day, hour, minute, second }, timezone);
    const utcMoment = birthMoment.clone().utc();
    
    const yearUTC = utcMoment.year();
    const monthUTC = utcMoment.month() + 1;
    const dayUTC = utcMoment.date();
    const hourUTC = utcMoment.hour() + utcMoment.minute() / 60 + utcMoment.second() / 3600;
    
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;
    
    // Calculate houses
    const houses = sweph.houses(jd, latitude, longitude, 'P'); // Placidus
    const ascLongitude = houses.data.points[0];
    const mcLongitude = houses.data.points[1];
    
    // Get Sun position for sect
    const sunResult = sweph.calc(jd, sweph.constants.SE_SUN, flags);
    const sunLongitude = sunResult.data[0];
    
    const sect = calculateSect(sunLongitude, ascLongitude);
    
    // Calculate all planets
    const planetDefs = [
      { name: "Sun", id: sweph.constants.SE_SUN },
      { name: "Moon", id: sweph.constants.SE_MOON },
      { name: "Mercury", id: sweph.constants.SE_MERCURY },
      { name: "Venus", id: sweph.constants.SE_VENUS },
      { name: "Mars", id: sweph.constants.SE_MARS },
      { name: "Jupiter", id: sweph.constants.SE_JUPITER },
      { name: "Saturn", id: sweph.constants.SE_SATURN },
      { name: "Uranus", id: sweph.constants.SE_URANUS },
      { name: "Neptune", id: sweph.constants.SE_NEPTUNE },
      { name: "Pluto", id: sweph.constants.SE_PLUTO },
      { name: "North Node", id: sweph.constants.SE_TRUE_NODE },
      { name: "Chiron", id: sweph.constants.SE_CHIRON }
    ];
    
    const planets = planetDefs.map(planet => {
      const result = sweph.calc(jd, planet.id, flags);
      const lon = result.data[0];
      const speed = result.data[3];
      const sign = getSignFromLongitude(lon);
      const degreeInSign = getDegreeInSign(lon);
      
      // Only calculate traditional dignities for traditional planets
      const traditionalPlanets = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
      const dignities = traditionalPlanets.includes(planet.name) 
        ? calculateDignities(planet.name, lon, sect.isDaySect)
        : null;
      
      const sectStatus = traditionalPlanets.includes(planet.name)
        ? getPlanetSectStatus(planet.name, sect)
        : null;
      
      // Determine house placement
      let houseNum = 1;
      const cusps = houses.data.houses;
      for (let i = 0; i < 12; i++) {
        const nextHouse = (i + 1) % 12;
        const cusp1 = cusps[i];
        const cusp2 = cusps[nextHouse];
        
        if (cusp2 > cusp1) {
          if (lon >= cusp1 && lon < cusp2) {
            houseNum = i + 1;
            break;
          }
        } else {
          if (lon >= cusp1 || lon < cusp2) {
            houseNum = i + 1;
            break;
          }
        }
      }
      
      return {
        name: planet.name,
        longitude: lon.toFixed(4),
        sign,
        degreeInSign: degreeInSign.toFixed(2),
        house: houseNum,
        speed: speed.toFixed(4),
        isRetrograde: speed < 0,
        dignities,
        sect: sectStatus
      };
    });
    
    // Build house data
    const houseData = houses.data.houses.map((cusp, i) => ({
      house: i + 1,
      cusp: cusp.toFixed(2),
      sign: getSignFromLongitude(cusp),
      degreeInSign: getDegreeInSign(cusp).toFixed(2),
      ruler: DOMICILE[getSignFromLongitude(cusp)]
    }));
    
    // Calculate depositor chains (traditional planets only)
    const traditionalPositions = planets
      .filter(p => ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].includes(p.name))
      .map(p => ({ name: p.name, sign: p.sign, longitude: parseFloat(p.longitude) }));
    
    const depositors = calculateDepositorChain(traditionalPositions);
    
    // Calculate Lot of Fortune and Spirit
    const moonResult = sweph.calc(jd, sweph.constants.SE_MOON, flags);
    const moonLongitude = moonResult.data[0];
    
    let fortuneLon, spiritLon;
    if (sect.isDaySect) {
      // Day chart: Fortune = Asc + Moon - Sun
      fortuneLon = (ascLongitude + moonLongitude - sunLongitude + 360) % 360;
      // Day chart: Spirit = Asc + Sun - Moon
      spiritLon = (ascLongitude + sunLongitude - moonLongitude + 360) % 360;
    } else {
      // Night chart: Fortune = Asc + Sun - Moon
      fortuneLon = (ascLongitude + sunLongitude - moonLongitude + 360) % 360;
      // Night chart: Spirit = Asc + Moon - Sun
      spiritLon = (ascLongitude + moonLongitude - sunLongitude + 360) % 360;
    }
    
    const lots = {
      fortune: {
        longitude: fortuneLon.toFixed(2),
        sign: getSignFromLongitude(fortuneLon),
        degreeInSign: getDegreeInSign(fortuneLon).toFixed(2),
        ruler: DOMICILE[getSignFromLongitude(fortuneLon)]
      },
      spirit: {
        longitude: spiritLon.toFixed(2),
        sign: getSignFromLongitude(spiritLon),
        degreeInSign: getDegreeInSign(spiritLon).toFixed(2),
        ruler: DOMICILE[getSignFromLongitude(spiritLon)]
      }
    };
    
    // Build the complete chart
    const chart = {
      meta: {
        name,
        generated: moment().format(),
        version: "1.0.0"
      },
      birthData: {
        date: birthMoment.format("YYYY-MM-DD"),
        time: birthMoment.format("HH:mm:ss"),
        timezone,
        location: { latitude, longitude },
        julianDay: jd.toFixed(6)
      },
      sect,
      angles: {
        ascendant: {
          longitude: ascLongitude.toFixed(2),
          sign: getSignFromLongitude(ascLongitude),
          degreeInSign: getDegreeInSign(ascLongitude).toFixed(2)
        },
        midheaven: {
          longitude: mcLongitude.toFixed(2),
          sign: getSignFromLongitude(mcLongitude),
          degreeInSign: getDegreeInSign(mcLongitude).toFixed(2)
        },
        descendant: {
          longitude: ((ascLongitude + 180) % 360).toFixed(2),
          sign: getSignFromLongitude((ascLongitude + 180) % 360),
          degreeInSign: getDegreeInSign((ascLongitude + 180) % 360).toFixed(2)
        },
        imumCoeli: {
          longitude: ((mcLongitude + 180) % 360).toFixed(2),
          sign: getSignFromLongitude((mcLongitude + 180) % 360),
          degreeInSign: getDegreeInSign((mcLongitude + 180) % 360).toFixed(2)
        }
      },
      houses: houseData,
      planets,
      depositors,
      lots,
      // Placeholder for future additions
      timing: {
        zodiacalReleasing: null, // TODO
        profections: null // TODO
      }
    };
    
    // Save to file if requested
    if (save) {
      const fs = require('fs');
      const path = require('path');
      const filename = `${name.toLowerCase().replace(/\s+/g, '_')}.json`;
      const filepath = path.join(__dirname, 'natal_charts', filename);
      
      // Ensure directory exists
      if (!fs.existsSync(path.join(__dirname, 'natal_charts'))) {
        fs.mkdirSync(path.join(__dirname, 'natal_charts'));
      }
      
      fs.writeFileSync(filepath, JSON.stringify(chart, null, 2));
      chart.meta.savedTo = filepath;
    }
    
    res.json(chart);
    
  } catch (error) {
    console.error("Error generating chart:", error);
    res.status(500).json({ error: "Failed to generate chart", details: error.message });
  }
});

/**
 * GET /chart/:name
 * Retrieve a stored natal chart
 */
app.get("/chart/:name", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const name = req.params.name.toLowerCase().replace(/\s+/g, '_');
    const filepath = path.join(__dirname, 'natal_charts', `${name}.json`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: `Chart not found: ${name}` });
    }
    
    const chart = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    res.json(chart);
    
  } catch (error) {
    console.error("Error retrieving chart:", error);
    res.status(500).json({ error: "Failed to retrieve chart" });
  }
});

/**
 * GET /charts
 * List all stored charts
 */
app.get("/charts", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const chartsDir = path.join(__dirname, 'natal_charts');
    
    if (!fs.existsSync(chartsDir)) {
      return res.json({ charts: [] });
    }
    
    const files = fs.readdirSync(chartsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
    
    res.json({ charts: files });
    
  } catch (error) {
    console.error("Error listing charts:", error);
    res.status(500).json({ error: "Failed to list charts" });
  }
});

/**
 * PUT /chart/:name
 * Save or update a natal chart with raw JSON data
 */
app.put("/chart/:name", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const name = req.params.name.toLowerCase().replace(/\s+/g, '_');
    const chartsDir = path.join(__dirname, 'natal_charts');
    
    if (!fs.existsSync(chartsDir)) {
      fs.mkdirSync(chartsDir, { recursive: true });
    }
    
    const filepath = path.join(chartsDir, `${name}.json`);
    const chartData = { name, ...req.body };
    
    fs.writeFileSync(filepath, JSON.stringify(chartData, null, 2));
    
    res.json({ success: true, message: `Chart '${name}' saved`, chart: chartData });
  } catch (error) {
    console.error("Error saving chart:", error);
    res.status(500).json({ error: "Failed to save chart", details: error.message });
  }
});

/**
 * DELETE /chart/:name
 * Delete a stored natal chart
 */
app.delete("/chart/:name", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const name = req.params.name.toLowerCase().replace(/\s+/g, '_');
    const filepath = path.join(__dirname, 'natal_charts', `${name}.json`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: `Chart '${name}' not found` });
    }
    
    fs.unlinkSync(filepath);
    res.json({ success: true, message: `Chart '${name}' deleted` });
  } catch (error) {
    console.error("Error deleting chart:", error);
    res.status(500).json({ error: "Failed to delete chart", details: error.message });
  }
});

/**
 * GET /profections/:name
 * Get current profection for a stored chart
 * Query param: age (optional, calculates from birth date if not provided)
 */
app.get("/profections/:name", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const name = req.params.name.toLowerCase().replace(/\s+/g, '_');
    const filepath = path.join(__dirname, 'natal_charts', `${name}.json`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: `Chart not found: ${name}` });
    }
    
    const chart = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    
    // Calculate age from birth date if not provided
    let age = parseInt(req.query.age);
    if (isNaN(age)) {
      const birthDate = moment(chart.birthData.date);
      const now = moment();
      age = now.diff(birthDate, 'years');
    }
    
    const ascSign = chart.angles.ascendant.sign;
    const profection = calculateProfections(ascSign, age);
    
    // Find the lord of year in the natal chart
    const lordPlanet = chart.planets.find(p => p.name === profection.lordOfYear);
    
    res.json({
      name: chart.meta.name,
      currentAge: age,
      profection,
      lordOfYearNatal: lordPlanet || null,
      timeline: calculateProfectionTimeline(ascSign, age, 12)
    });
    
  } catch (error) {
    console.error("Error calculating profections:", error);
    res.status(500).json({ error: "Failed to calculate profections" });
  }
});

/**
 * GET /profections-calc
 * Calculate profections without a stored chart
 * Query params: ascSign, age
 */
app.get("/profections-calc", (req, res) => {
  try {
    const { ascSign, age } = req.query;
    
    if (!ascSign || age === undefined) {
      return res.status(400).json({ error: "Required: ascSign, age" });
    }
    
    const profection = calculateProfections(ascSign, parseInt(age));
    const timeline = calculateProfectionTimeline(ascSign, parseInt(age), 12);
    
    res.json({
      profection,
      timeline
    });
    
  } catch (error) {
    console.error("Error calculating profections:", error);
    res.status(500).json({ error: "Failed to calculate profections" });
  }
});

/**
 * GET /zr/:name
 * Get Zodiacal Releasing for a stored chart
 * Query params: lot (fortune|spirit, default: spirit), date (optional)
 */
app.get("/zr/:name", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const name = req.params.name.toLowerCase().replace(/\s+/g, '_');
    const filepath = path.join(__dirname, 'natal_charts', `${name}.json`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: `Chart not found: ${name}` });
    }
    
    const chart = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const lot = req.query.lot === 'fortune' ? 'fortune' : 'spirit';
    const lotData = chart.lots[lot];
    
    if (!lotData) {
      return res.status(400).json({ error: `Lot of ${lot} not found in chart` });
    }
    
    const birthDate = moment.tz(
      `${chart.birthData.date} ${chart.birthData.time}`,
      chart.birthData.timezone || "America/New_York"
    );
    
    const targetDate = req.query.date 
      ? moment(req.query.date) 
      : moment();
    
    const zr = calculateZRL2(lotData.sign, birthDate, targetDate);
    
    res.json({
      name: chart.meta.name,
      lot: {
        name: lot,
        sign: lotData.sign,
        ruler: lotData.ruler
      },
      targetDate: targetDate.format(),
      ...zr
    });
    
  } catch (error) {
    console.error("Error calculating ZR:", error);
    res.status(500).json({ error: "Failed to calculate Zodiacal Releasing" });
  }
});

/**
 * GET /zr-calc
 * Calculate ZR without a stored chart
 * Query params: lotSign, birthDate, targetDate (optional)
 */
app.get("/zr-calc", (req, res) => {
  try {
    const { lotSign, birthDate, targetDate } = req.query;
    
    if (!lotSign || !birthDate) {
      return res.status(400).json({ error: "Required: lotSign, birthDate (YYYY-MM-DD)" });
    }
    
    const birth = moment(birthDate);
    const target = targetDate ? moment(targetDate) : moment();
    
    const zr = calculateZRL2(lotSign, birth, target);
    
    res.json({
      lotSign,
      birthDate: birth.format(),
      targetDate: target.format(),
      ...zr
    });
    
  } catch (error) {
    console.error("Error calculating ZR:", error);
    res.status(500).json({ error: "Failed to calculate Zodiacal Releasing" });
  }
});
// ============================================================================
// TRANSIT TRACKING
// ============================================================================

/**
 * Calculate aspects between two positions
 */
function findAspect(lon1, lon2, orb = 8) {
  const aspects = [
    { name: "conjunction", angle: 0, symbol: "☌", nature: "major" },
    { name: "sextile", angle: 60, symbol: "⚹", nature: "major" },
    { name: "square", angle: 90, symbol: "□", nature: "major" },
    { name: "trine", angle: 120, symbol: "△", nature: "major" },
    { name: "opposition", angle: 180, symbol: "☍", nature: "major" },
    { name: "semi-sextile", angle: 30, symbol: "⚺", nature: "minor" },
    { name: "quincunx", angle: 150, symbol: "⚻", nature: "minor" }
  ];
  
  let diff = Math.abs(lon1 - lon2);
  if (diff > 180) diff = 360 - diff;
  
  for (const aspect of aspects) {
    const aspectOrb = aspect.nature === "major" ? orb : orb / 2;
    if (Math.abs(diff - aspect.angle) <= aspectOrb) {
      const exactOrb = Math.abs(diff - aspect.angle);
      return {
        ...aspect,
        orb: exactOrb.toFixed(2),
        isExact: exactOrb < 1,
        isTight: exactOrb < 3
      };
    }
  }
  return null;
}

/**
 * GET /transits/:name/now
 * Get current transits to a stored natal chart
 */
app.get("/transits/:name/now", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const name = req.params.name.toLowerCase().replace(/\s+/g, '_');
    const filepath = path.join(__dirname, 'natal_charts', `${name}.json`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: `Chart not found: ${name}` });
    }
    
    const chart = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const majorOnly = req.query.major === 'true';
    const orb = parseFloat(req.query.orb) || 8;
    
    const localNow = moment.tz("America/New_York");
    const yearUTC = localNow.utc().year();
    const monthUTC = localNow.utc().month() + 1;
    const dayUTC = localNow.utc().date();
    const hourUTC = localNow.utc().hour() + localNow.utc().minute() / 60;
    
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;
    
    const transitPlanets = [
      { name: "Sun", id: sweph.constants.SE_SUN },
      { name: "Moon", id: sweph.constants.SE_MOON },
      { name: "Mercury", id: sweph.constants.SE_MERCURY },
      { name: "Venus", id: sweph.constants.SE_VENUS },
      { name: "Mars", id: sweph.constants.SE_MARS },
      { name: "Jupiter", id: sweph.constants.SE_JUPITER },
      { name: "Saturn", id: sweph.constants.SE_SATURN },
      { name: "Uranus", id: sweph.constants.SE_URANUS },
      { name: "Neptune", id: sweph.constants.SE_NEPTUNE },
      { name: "Pluto", id: sweph.constants.SE_PLUTO }
    ];
    
    const transits = [];
    
    const currentPositions = transitPlanets.map(tp => {
      const result = sweph.calc(jd, tp.id, flags);
      return {
        name: tp.name,
        longitude: result.data[0],
        speed: result.data[3],
        sign: getSignFromLongitude(result.data[0]),
        degree: getDegreeInSign(result.data[0]).toFixed(2),
        isRetrograde: result.data[3] < 0
      };
    });
    
    for (const transit of currentPositions) {
      for (const natal of chart.planets) {
        const natalLon = parseFloat(natal.longitude);
        const aspect = findAspect(transit.longitude, natalLon, orb);
        
        if (aspect) {
          if (majorOnly && aspect.nature !== "major") continue;
          
          transits.push({
            transit: {
              planet: transit.name,
              sign: transit.sign,
              degree: transit.degree,
              isRetrograde: transit.isRetrograde
            },
            natal: {
              planet: natal.name,
              sign: natal.sign,
              degree: natal.degreeInSign,
              house: natal.house
            },
            aspect: aspect.name,
            symbol: aspect.symbol,
            orb: aspect.orb,
            nature: aspect.nature,
            isExact: aspect.isExact,
            isTight: aspect.isTight
          });
        }
      }
      
      // Check transits to angles
      const angles = [
        { name: "Ascendant", longitude: parseFloat(chart.angles.ascendant.longitude) },
        { name: "Midheaven", longitude: parseFloat(chart.angles.midheaven.longitude) }
      ];
      
      for (const angle of angles) {
        const aspect = findAspect(transit.longitude, angle.longitude, orb);
        if (aspect && aspect.nature === "major") {
          transits.push({
            transit: {
              planet: transit.name,
              sign: transit.sign,
              degree: transit.degree,
              isRetrograde: transit.isRetrograde
            },
            natal: {
              point: angle.name,
              sign: getSignFromLongitude(angle.longitude),
              degree: getDegreeInSign(angle.longitude).toFixed(2)
            },
            aspect: aspect.name,
            symbol: aspect.symbol,
            orb: aspect.orb,
            nature: "angular",
            isExact: aspect.isExact
          });
        }
      }
    }
    
    transits.sort((a, b) => parseFloat(a.orb) - parseFloat(b.orb));
    
    // Add profection context
    const birthDate = moment.tz(
      chart.birthData.date + " " + chart.birthData.time,
      chart.birthData.timezone || "America/New_York"
    );
    const age = localNow.diff(birthDate, 'years');
    const profection = calculateProfections(chart.angles.ascendant.sign, age);
    
    transits.forEach(t => {
      if (t.natal.planet === profection.lordOfYear) {
        t.isToLordOfYear = true;
      }
    });
    
    res.json({
      name: chart.meta.name,
      timestamp: localNow.format(),
      currentAge: age,
      profection: {
        lordOfYear: profection.lordOfYear,
        activatedHouse: profection.activatedHouse,
        profectedSign: profection.profectedSign
      },
      transitCount: transits.length,
      transits
    });
    
  } catch (error) {
    console.error("Error calculating transits:", error);
    res.status(500).json({ error: "Failed to calculate transits", details: error.message });
  }
});

/**
 * GET /transits/:name/summary
 * High-level summary of major transits
 */
app.get("/transits/:name/summary", (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const name = req.params.name.toLowerCase().replace(/\s+/g, '_');
    const filepath = path.join(__dirname, 'natal_charts', `${name}.json`);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: `Chart not found: ${name}` });
    }
    
    const chart = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    
    const localNow = moment.tz("America/New_York");
    const yearUTC = localNow.utc().year();
    const monthUTC = localNow.utc().month() + 1;
    const dayUTC = localNow.utc().date();
    const hourUTC = localNow.utc().hour() + localNow.utc().minute() / 60;
    
    const jd = sweph.julday(yearUTC, monthUTC, dayUTC, hourUTC, sweph.constants.SE_GREG_CAL);
    const flags = sweph.constants.SEFLG_SWIEPH;
    
    const outerPlanets = [
      { name: "Jupiter", id: sweph.constants.SE_JUPITER },
      { name: "Saturn", id: sweph.constants.SE_SATURN },
      { name: "Uranus", id: sweph.constants.SE_URANUS },
      { name: "Neptune", id: sweph.constants.SE_NEPTUNE },
      { name: "Pluto", id: sweph.constants.SE_PLUTO }
    ];
    
    const majorTransits = [];
    
    for (const tp of outerPlanets) {
      const result = sweph.calc(jd, tp.id, flags);
      const transitLon = result.data[0];
      const transitSign = getSignFromLongitude(transitLon);
      const isRetrograde = result.data[3] < 0;
      
      for (const natal of chart.planets) {
        const natalLon = parseFloat(natal.longitude);
        const aspect = findAspect(transitLon, natalLon, 5);
        
        if (aspect && aspect.nature === "major") {
          majorTransits.push({
            transit: tp.name + (isRetrograde ? " ℞" : "") + " in " + transitSign,
            aspect: aspect.symbol + " " + aspect.name,
            to: "natal " + natal.name + " in " + natal.sign,
            orb: aspect.orb + "°",
            isTight: aspect.isTight
          });
        }
      }
    }
    
    const birthDate = moment.tz(
      chart.birthData.date + " " + chart.birthData.time,
      chart.birthData.timezone || "America/New_York"
    );
    const age = localNow.diff(birthDate, 'years');
    const profection = calculateProfections(chart.angles.ascendant.sign, age);
    
    const zrSpirit = calculateZRL2(chart.lots.spirit.sign, birthDate, localNow);
    
    res.json({
      name: chart.meta.name,
      timestamp: localNow.format(),
      timing: {
        age: age,
        profection: profection.lordOfYear + " year (" + profection.profectedSign + " - " + profection.activatedHouse + "H)",
        zrL1: zrSpirit.activePeriod.sign + " (" + zrSpirit.activePeriod.percentComplete + "% complete)",
        zrL2: zrSpirit.l2.activePeriod.sign,
        zrNote: zrSpirit.l2.note
      },
      majorTransits: majorTransits
    });
    
  } catch (error) {
    console.error("Error calculating transit summary:", error);
    res.status(500).json({ error: "Failed to calculate transit summary" });
  }
});
