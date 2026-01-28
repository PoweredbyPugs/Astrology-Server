# Sweph Astrology Server

A Swiss Ephemeris-based astrology API providing natal chart calculations, essential dignities, timing techniques, and planetary positions.

## Features

### Core Calculations
- **Natal Charts** - Complete chart generation with planets, houses, angles
- **Essential Dignities** - All 5 traditional dignities (Domicile, Exaltation, Triplicity, Terms, Faces)
- **Day/Night Sect** - Sect calculation with benefic/malefic classification
- **Depositor Chains** - Rulership chains and final dispositor

### Timing Techniques
- **Annual Profections** - Lord of the year with 12-year timeline
- **Zodiacal Releasing** - L1 and L2 periods from Lot of Spirit/Fortune
- **Lots** - Fortune and Spirit calculation (sect-correct)

### Transits & Aspects
- **Current Positions** - Real-time planetary positions
- **Moon Phases** - Current and weekly major phases
- **Aspects** - Current planetary aspects
- **Retrogrades** - Planetary retrograde status
- **Void of Course** - Moon VOC periods
- **Ingresses** - Planetary sign changes
- **Stations** - Retrograde/direct stations

## Endpoints

### Chart Generation
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate-chart` | POST | Generate and optionally save a natal chart |
| `/chart/:name` | GET | Retrieve a stored chart |
| `/charts` | GET | List all stored charts |

### Dignities
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dignity-score` | GET | Calculate dignity for any planet/position |
| `/current-dignities` | GET | All planets' current dignity scores |

### Timing
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/profections/:name` | GET | Annual profections for a chart |
| `/profections-calc` | GET | Calculate profections (no stored chart) |
| `/zr/:name` | GET | Zodiacal Releasing for a chart |
| `/zr-calc` | GET | Calculate ZR (no stored chart) |

### Current Sky
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/moon-now` | GET | Current moon phase and sign |
| `/planets-now` | GET | Current planetary positions |
| `/aspects-now` | GET | Current planetary aspects |
| `/weekly-major-phase` | GET | This week's major moon phase |
| `/planetary-retrogrades` | GET | Current retrograde status |
| `/void-of-course-moons` | GET | Upcoming VOC periods |
| `/planetary-ingresses` | GET | Upcoming sign changes |
| `/planetary-stations` | GET | Upcoming stations |
| `/important-transits` | GET | Significant outer planet aspects |

## Usage

### Docker Compose (Recommended)

```bash
docker compose up -d --build
```

The server runs on port 3000.

### Generate a Chart

```bash
curl -X POST "http://localhost:3000/generate-chart" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Example",
    "year": 1990,
    "month": 6,
    "day": 15,
    "hour": 14,
    "minute": 30,
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timezone": "America/New_York",
    "save": true
  }'
```

### Check Profections

```bash
curl "http://localhost:3000/profections/example?age=35"
```

### Check Zodiacal Releasing

```bash
curl "http://localhost:3000/zr/example?lot=spirit"
```

## Chart JSON Structure

Generated charts include:

```json
{
  "meta": { "name", "generated", "version" },
  "birthData": { "date", "time", "timezone", "location", "julianDay" },
  "sect": { "isDaySect", "sectLight", "sectBenefic", "sectMalefic" },
  "angles": { "ascendant", "midheaven", "descendant", "imumCoeli" },
  "houses": [ { "house", "cusp", "sign", "ruler" } ],
  "planets": [
    {
      "name", "longitude", "sign", "house", "isRetrograde",
      "dignities": { "domicile", "exaltation", "triplicity", "term", "face", "score" },
      "sect": { "isInSect", "sectAlignment" }
    }
  ],
  "depositors": { "chains", "mutualReceptions", "finalDispositor" },
  "lots": { "fortune", "spirit" },
  "timing": { "zodiacalReleasing", "profections" }
}
```

## Requirements

- Docker & Docker Compose
- Swiss Ephemeris files in `./ephemeris/` directory

## MCP Integration

This server is designed to work with the `sweph` MCP wrapper for integration with AI assistants like Claude.

## License

MIT
