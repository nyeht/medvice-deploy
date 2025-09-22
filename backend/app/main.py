from __future__ import annotations
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import json
import asyncio

from app.settings import settings
from app.routers import sessions, assessment, labs, chat
from app.store import store

app = FastAPI(title="Medvise Backend", version="0.1.0", docs_url="/docs")

# CORS — dev için 8080'leri whitelist'e ekle
origins = set(filter(None, [
    settings.FRONTEND_ORIGIN,
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(origins) if origins else ["*"],  # dev'de esnek
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 422 ayrıntılı log (gelen ham body + hata listesi)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    try:
        raw = await request.body()
        raw_text = raw.decode("utf-8") if raw else ""
    except Exception:
        raw_text = "<could not read body>"

    print("=== 422 VALIDATION ERROR ===")
    print("Path:", str(request.url))
    print("Raw body:", raw_text)
    print("Errors:", json.dumps(exc.errors(), ensure_ascii=False, indent=2))
    print("============================")

    return JSONResponse(status_code=422, content={"detail": exc.errors()})

# Basit sağlık kontrolü
@app.get("/health")
def health():
    return {"ok": True}

# Routers
app.include_router(sessions.router)
app.include_router(assessment.router)
app.include_router(labs.router)
app.include_router(chat.router)

# TTL temizlik döngüsü (opsiyonel)
async def janitor():
    while True:
        store.sweep()
        await asyncio.sleep(60)

@app.on_event("startup")
async def _startup():
    asyncio.create_task(janitor())