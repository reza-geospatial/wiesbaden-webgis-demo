# Wiesbaden WebGIS Demo

A small WebGIS project for exploring urban green areas, buildings, and transport features around Wiesbaden.

The project currently uses:

- `FastAPI` as the backend API
- `PostGIS` as the spatial database
- `GeoPandas` and `pyogrio` for data preparation
- `Leaflet` for the frontend map
- `OpenStreetMap` data from Geofabrik and Overpass

## What The Project Does

The app loads map features dynamically based on the current map extent and zoom level.

Current map layers:

- `green`: parks, forest, and grass polygons
- `buildings`: building polygons
- `transport`: transport-related points such as bus stops and stations

Frontend features already implemented:

- pan and zoom map navigation
- loading data by bounding box
- checkbox-based layer toggles
- hover popups for all current layers
- click selection for green areas

## Project Structure

```text
backend/
  app/api/routes.py            FastAPI routes for green, buildings, transport
  main.py                      FastAPI application entry point
  requirements.txt             Python dependencies for the backend and pipeline
  Dockerfile                   Reserved for container setup

frontend/
  src/index.html               Main HTML page
  src/css/style.css            Frontend styles
  src/js/map.js                Leaflet map logic, fetch calls, interactions
  src/index__old.html          Older frontend version kept for reference

pipeline/
  extract/download_pbf.py      Download Hessen and Rheinland-Pfalz PBF files
  extract/osm_from_pbf.py      Extract green, buildings, and transport from PBF
  extract/osm_green.py         Small Overpass-based green-area extractor
  transform/clean_green.py     Clean raw green data
  load/to_postgis.py           Load GeoPackage layers into PostGIS
  load/to_postgis_greenArea.py Older green-only PostGIS loader
  config.yaml                  Reserved for future pipeline configuration

data/
  raw/                         Raw source datasets
  processed/                   Processed GeoPackage outputs
```

## Current Architecture

The workflow is:

1. Download OSM source data
2. Extract thematic layers with Python
3. Save processed layers into a GeoPackage
4. Load the layers into PostGIS
5. Query PostGIS through FastAPI using the current map extent
6. Render returned GeoJSON in Leaflet

This means the frontend does not load all data at once. It only requests the visible map extent.

## Data Pipeline

### 1. Download regional OSM PBF files

Script:

- `pipeline/extract/download_pbf.py`

This downloads:

- Hessen
- Rheinland-Pfalz

Output folder:

- `data/pbf/`

### 2. Extract GIS layers from PBF

Script:

- `pipeline/extract/osm_from_pbf.py`

This script:

- reads OSM PBF files with `pyogrio`
- extracts buildings from `multipolygons`
- extracts green areas from `multipolygons`
- extracts transport-related points from `points`
- cleans geometries
- removes duplicates
- saves everything into one GeoPackage

Output file:

- `data/processed/osm_data.gpkg`

Layers written to the GeoPackage:

- `green_areas`
- `buildings`
- `transport`

### 3. Load processed layers into PostGIS

Script:

- `pipeline/load/to_postgis.py`

This script:

- reads layers from `data/processed/osm_data.gpkg`
- cleans and validates the geometries again
- writes the layers into PostGIS tables
- adds `id` columns and primary keys
- creates spatial indexes

Created database tables:

- `green`
- `buildings`
- `transport`

### Legacy green-only pipeline

These scripts were part of an earlier green-area-only workflow and are still kept in the repo:

- `pipeline/extract/osm_green.py`
- `pipeline/transform/clean_green.py`
- `pipeline/load/to_postgis_greenArea.py`

## Backend API

Main entry point:

- `backend/main.py`

Routes:

- `GET /green`
- `GET /buildings`
- `GET /transport`

Route implementation:

- `backend/app/api/routes.py`

### Query pattern

The backend expects map bounds as query parameters:

- `minx`
- `miny`
- `maxx`
- `maxy`

Additional behavior:

- `green` also uses `zoom` to simplify geometries more aggressively at smaller scales
- `buildings` only returns features at zoom `14` and above
- `transport` returns point features for the current extent

### Example request

```text
http://127.0.0.1:8000/green?minx=8.2&miny=50.05&maxx=8.35&maxy=50.15&zoom=13
```

## Frontend

Frontend files:

- `frontend/src/index.html`
- `frontend/src/css/style.css`
- `frontend/src/js/map.js`

The frontend currently uses:

- `Leaflet`
- OpenStreetMap raster tiles
- plain HTML, CSS, and JavaScript

Main frontend behavior:

- initializes a Leaflet map centered near Wiesbaden
- loads visible data from the backend on `moveend`
- debounces requests
- shows and hides layers with checkboxes
- supports hover interaction for all layers
- supports selecting green polygons by click

## Environment Variables

The backend and PostGIS loading scripts expect these variables:

```env
DB_USER=your_user
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
```

Create a local `.env` file in the project root or otherwise make these variables available in your shell.

## Local Setup

### Prerequisites

- Python 3.11+ recommended
- PostgreSQL with PostGIS enabled
- a database already created for this project

### 1. Install Python dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Prepare the database

Make sure:

- PostgreSQL is running
- PostGIS is installed in the target database
- the `.env` values match your database

Example inside PostgreSQL:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 3. Download and process data

Download source data:

```bash
python3 pipeline/extract/download_pbf.py
```

Extract layers into GeoPackage:

```bash
python3 pipeline/extract/osm_from_pbf.py
```

Load layers into PostGIS:

```bash
python3 pipeline/load/to_postgis.py
```

### 4. Run the backend

```bash
uvicorn backend.main:app --reload
```

The API will be available at:

- `http://127.0.0.1:8000`

Swagger UI:

- `http://127.0.0.1:8000/docs`

### 5. Run the frontend

The frontend is a static app. A simple way to run it is with a local static server.

From the `frontend/src` directory, for example:

```bash
python3 -m http.server 5500
```

Then open:

- `http://127.0.0.1:5500`

Note:

- CORS in `backend/main.py` is currently configured for `localhost:5500` and `127.0.0.1:5500`

## Notes On The Current Repo State

- `docker-compose.yml` is currently empty
- `backend/Dockerfile` is currently empty
- `pipeline/config.yaml` is currently empty
- the frontend is plain JavaScript, not React yet

## Suggested Next Steps

- add an `.env.example`
- add database setup instructions or SQL bootstrap scripts
- add tests for the backend routes
- containerize the stack if needed
- document data assumptions and study area boundaries

## License

No license file has been added yet.
