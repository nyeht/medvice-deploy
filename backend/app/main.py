from __future__ import annotations

import asyncio
import json
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.settings import settings
from app.routers import sessions, assessment, labs, chat
from app.store import store

app = FastAPI(title="Medvise Backend", version="0.1.0", docs_url="/docs")

# ===== CORS =====
# Prod'da Render env'den gelen FRONTEND_ORIGIN (örn: https://medvise-deploy.vercel.app)
# Local'de Vite default portu (5173)
origins = list(
    set(
        filter(
            None,
            [
                settings.FRONTEND_ORIGIN,        # prod vercel domaini
                "http://localhost:5173",         # vite
                "http://127.0.0.1:5173",
            ],
        )
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,         # spesifik domain(ler)
    # İstersen Vercel preview URL’lerini de açmak için şu regex'i aktif edebilirsin:
    # allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Root & Health =====
@app.get("/")
def root():
    return {"status": "ok", "service": "medvise-backend"}

@app.get("/health")
def health():
    return {"ok": True}

# ===== Hata günlüğü (422) =====
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

# ===== Routers =====
app.include_router(sessions.router)
app.include_router(assessment.router)
app.include_router(labs.router)
app.include_router(chat.router)

# ===== TTL temizlik döngüsü =====
async def janitor():
    while True:
        store.sweep()
        await asyncio.sleep(60)

@app.on_event("startup")
async def _startup():
    asyncio.create_task(janitor())
