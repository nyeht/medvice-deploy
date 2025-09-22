from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()
import os

class Settings(BaseModel):
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    # CORS origin: Vite default port
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    # Session TTL (seconds)
    SESSION_TTL: int = int(os.getenv("SESSION_TTL", "3600"))

settings = Settings()