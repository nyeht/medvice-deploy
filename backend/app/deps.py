from fastapi import Header, HTTPException
from app.store import store
from app.models import Session

async def get_session(x_session_id: str = Header(alias="X-Session-Id")) -> Session:
    """
    Frontend her isteğe X-Session-Id header'ı ile gelsin.
    """
    print(f"[DEPS] get_session called with: {x_session_id}")
    sess = store.get(x_session_id)
    if not sess:
        print(f"[DEPS] Session not found: {x_session_id}")
        raise HTTPException(status_code=404, detail="Session not found or expired")
    print(f"[DEPS] Session found: {x_session_id}")
    return sess