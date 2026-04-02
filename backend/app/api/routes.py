from fastapi import APIRouter
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

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