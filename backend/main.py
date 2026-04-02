from fastapi import FastAPI

app = FastAPI(title='Wiesbaden WebGIS API')

@app.get("/health")
def health():
    return {"status":"ok"}