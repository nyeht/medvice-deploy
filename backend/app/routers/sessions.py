from fastapi import APIRouter
from app.store import store
from app.models import CreateSessionResp, SessionSnapshot

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post("", response_model=CreateSessionResp)
def create_session():
    sess = store.create()
    return CreateSessionResp(session_id=sess.id)

@router.get("/{sid}", response_model=SessionSnapshot)
def get_session(sid: str):
    s = store.snapshot(sid)
    if not s:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return SessionSnapshot(
        id=s.id,
        stage=s.stage,
        patient=s.patient,
        history=s.history,
        created_at=s.created_at,
        last_used_at=s.last_used_at,
    )