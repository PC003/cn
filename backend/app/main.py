from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.api import meta, simulation

app = FastAPI(
    title=config.PROJECT_NAME,
    description=config.PROJECT_SUBTITLE,
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
