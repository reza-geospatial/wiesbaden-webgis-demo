from fastapi import FastAPI
from backend.app.api.routes import router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WebGIS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500"
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)