# Helios

A Swiss Ephemeris-based astrology REST API providing natal chart calculations, essential dignities, timing techniques, planetary positions, transits, midpoints, eclipses, dashas, and planetary cycle timelines. Used as the backend by the [Obsidian Moon](https://github.com/PoweredbyPugs/moon-phase) plugin and the [Stella MCP server](https://github.com/PoweredbyPugs/Stella-Astrological-System).

## Quick start

```bash
git clone https://github.com/PoweredbyPugs/Helios.git
cd Helios

# 1. Download Swiss Ephemeris data files (~600MB, covers 1800–2400 CE)
mkdir -p ephemeris && cd ephemeris
wget https://www.astro.com/ftp/swisseph/ephe/se12000.zip
unzip se12000.zip && rm se12000.zip
cd ..

# 2. (Optional) Provide a default natal chart for /daily-transits — see "Default natal chart" below

# 3. Start the server
docker compose up -d --build

# 4. Verify
curl http://localhost:3000/test
# {"status":"Server is running correctly"}
```

The server listens on port 3000. Point your client (e.g. Obsidian Moon's Server URL setting) at it.

### Why ephemeris files have to be downloaded separately

The Swiss Ephemeris distribution is ~600MB, well over GitHub's 100MB per-file limit. Bundling it in the repo would also bloat clones unnecessarily for anyone who only wants to read the code. The Dockerfile bind-mounts `./ephemeris/` so the files live alongside the repo but aren't tracked.

If you want a narrower year range, browse the alternatives at [astro.com/ftp/swisseph/ephe/](https://www.astro.com/ftp/swisseph/ephe/) — `se06_18.zip` (1800–1899) is smaller, `se1800_2399.zip` covers all 600 years in one bundle, etc.

### Default natal chart

The `/daily-transits` endpoint computes transits against a default natal chart, loaded at startup from `natal_charts/default.json` (gitignored). The expected shape is one entry per planet:

```json
{
  "sun":     { "degrees": <0–360>, "sign": "<Aries..Pisces>", "position": "DD°Sg MM'SS''" },
  "moon":    { ... },
  "mercury": { ... },
  "venus":   { ... },
  "mars":    { ... },
  "jupiter": { ... },
  "saturn":  { ... },
  "uranus":  { ... },
  "neptune": { ... },
  "pluto":   { ... }
}
```

The fastest way to produce a valid file: POST your birth data to `/generate-chart` with `save: true`, then pluck the `planets` block from the resulting `natal_charts/<name>.json` and rename to `default.json`. Without this file, `/daily-transits` returns an error; all other endpoints work normally.

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
