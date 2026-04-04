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
        FROM green
        WHERE geometry && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
        LIMIT 10000
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


@router.get("/buildings")
def get_buildings(minx: float, miny: float, maxx: float, maxy: float, zoom: int):

    # TO PREVENT overload
    if zoom < 14:
        return {"type": "FeatureCollection", "features": []}

    tolerance = 0.00001

    query = text("""
        SELECT 
            id,
            building,
            ST_AsGeoJSON(
                ST_SimplifyPreserveTopology(geometry, :tolerance)
            ) AS geometry
        FROM buildings
        WHERE geometry && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
        ORDER BY ST_Area(geometry) DESC
        LIMIT 5000
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
                    "building": row.building,
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }


@router.get("/transport")
def get_transport(minx: float, miny: float, maxx: float, maxy: float):

    query = text("""
        SELECT 
            id,
            highway,
            railway,
            public_transport,
            ST_AsGeoJSON(
                ST_SimplifyPreserveTopology(geometry, 0.00001)
            ) AS geometry
        FROM transport
        WHERE geometry && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
    """)
    
    with engine.connect() as conn:
        result = conn.execute(query, {
            "minx": minx,
            "miny": miny,
            "maxx": maxx,
            "maxy": maxy,
            })

        features = []
        for row in result:
            features.append({
                "type": "Feature",
                "geometry": json.loads(row.geometry),
                "properties": {
                    "id": row.id,
                    "highway": row.highway,
                    "railway": row.railway,
                    "public_transport": row.public_transport,
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }