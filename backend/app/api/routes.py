from fastapi import APIRouter
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
import json

router = APIRouter()

# =========================
# DB CONFIG
# =========================

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")

engine = create_engine(
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# =========================


@router.get("/green")
def get_green_areas(
    minx: float,
    miny: float,
    maxx: float,
    maxy: float,
    zoom: int
    ):
    
    if zoom < 12:
        tolerance = 0.0001
    elif zoom < 14:
        tolerance = 0.00005
    else:
        tolerance = 0.00001

    query = text("""
        SELECT 
            id,
            landuse,
            leisure,
            ST_AsGeoJSON(
                 ST_SimplifyPreserveTopology(geometry, :tolerance)
                 ) AS geometry,
            ST_Area(ST_Transform(geometry, 25832)) AS area
        FROM green_areas
        WHERE geometry && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
    """)

    with engine.connect() as conn:
        result = conn.execute(query, {
            "minx": minx,
            "miny": miny,
            "maxx": maxx,
            "maxy": maxy,
            "tolerance": tolerance
            })

        features = []
        for row in result:
            features.append({
                "type": "Feature",
                "geometry": json.loads(row.geometry),
                "properties": {
                    "id": row.id,
                    "landuse": row.landuse,
                    "leisure": row.leisure,
                    "area": row.area
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }