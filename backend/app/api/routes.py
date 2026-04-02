from fastapi import APIRouter
from sqlalchemy import create_engine, text
import os

router = APIRouter()

# =========================
# DB CONFIG
# =========================

DB_USER = "REMOVED_DB_USER"
DB_PASSWORD = "REMOVED_DB_PASSWORD"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "webgis_demo"

engine = create_engine(
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# =========================


@router.get("/green")
def get_green_areas(limit: int = 100):

    query = text(f"""
        SELECT 
            id,
            ST_AsGeoJSON(geometry) AS geometry
        FROM green_areas
        LIMIT :limit
    """)

    with engine.connect() as conn:
        result = conn.execute(query, {"limit": limit})

        features = []
        for row in result:
            features.append({
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "id": row.id
                }
            })

    return {
        "type": "FeatureCollection",
        "features": features
    }