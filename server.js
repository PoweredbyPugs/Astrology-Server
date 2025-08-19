const express = require("express");
const cors = require("cors");
const sweph = require("sweph");
const moment = require("moment-timezone");

const app = express();
app.use(cors());

// .se1 files in /app/ephemeris
sweph.set_ephe_path("/app/ephemeris");
console.log("Ephemeris path set to '/app/ephemeris'");
console.log("Current working directory:", process.cwd());

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
    localEasternTime: localNow.format(), // e.g. "2025-03-05T23:18:00-05:00"
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
      
      // Check if retrograde (only applicable for planets, not Sun/Moon)
      const isRetrograde = planet.id !== sweph.constants.SE_SUN && 
                          planet.id !== sweph.constants.SE_MOON && 
                          result.data[3] < 0;
      
      return {
        name: planet.name,
        sign,
        degreeInSign,
        isRetrograde
      };
    });

    // 7) Return JSON with all planetary positions
    res.json({
      localEasternTime: localNow.format(),
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

// Helper to check if a phase is a major phase
function isMajorPhase(phaseName) {
  return ["New Moon", "Full Moon", "First Quarter", "Last Quarter"].includes(phaseName);
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
    version: "1.0.0",
    endpoints: [
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
      }
      // Add any other endpoints here
    ]
  });
});

// Listen on all network interfaces (0.0.0.0) instead of just localhost
const PORT = process.env.PORT || 3000;
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
      { name: "Quintile", symbol: "Q", angle: 72, orb: 2 } // Unicode alternatives: ⊥ or ⊻
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
      
      // Check if retrograde (only applicable for planets, not Sun/Moon)
      const isRetrograde = planet.id !== sweph.constants.SE_SUN && 
                          planet.id !== sweph.constants.SE_MOON && 
                          result.data[3] < 0;
      
      planetaryPositions.push({
        name: planet.name,
        longitude,
        sign,
        degreeInSign,
        isRetrograde
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
      localEasternTime: localNow.format(),
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
    console.error("Error calculating void of course moons:", error);
    return res.status(500).json({
      error: "Failed to calculate void of course moons"
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
          endBoundary = moment(star+tBoundary).add(6, 'days').endOf('day');
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
    console.error("Error calculating planetary ingresses:", error);
    return res.status(500).json({
      error: "Failed to calculate planetary ingresses"
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
    // One lunation is about 29.53 days
    const moonAge = (phaseAngle / 360 * 29.53).toFixed(2);
    
    return res.json({
      date: dateStr,
      localEasternTime: targetDate.format(),
      moonPhase,
      moonSign,
      degreeInSign,
      age: parseFloat(moonAge)
    });
  } catch (error) {
    console.error("Error in /moon-for-date:", error);
    return res.status(500).json({ error: "Server error calculating moon data" });
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
    console.error("Error calculating planetary stations:", error);
    return res.status(500).json({
      error: "Failed to calculate planetary stations"
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
        const isRetrograde = planet.id !== sweph.constants.SE_SUN && 
                             planet.id !== sweph.constants.SE_MOON && 
                             result.data[3] < 0;
        
        positions.push({
          name: planet.name,
          longitude,
          isRetrograde
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
    console.error("Error calculating important transits:", error);
    return res.status(500).json({
      error: "Failed to calculate important transits"
    });
  }
});
