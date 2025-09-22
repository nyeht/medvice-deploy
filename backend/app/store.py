# app/store.py
from __future__ import annotations
from typing import Dict, Optional, List, Any
from datetime import datetime, timedelta

from app.models import (
    Session,
    ChatTurn,
    PatientData,
)
from app.settings import settings


TTL_SECONDS = getattr(settings, "SESSION_TTL", 3600)


class InMemoryStore:
    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}

    # --------- session lifecycle ----------
    def create(self) -> Session:
        s = Session()
        self._sessions[s.id] = s
        print(f"[STORE] create() -> {s.id}")
        return s

    def get(self, sid: str) -> Optional[Session]:
        s = self._sessions.get(sid)
        print(f"[STORE] get({sid}) -> {'found' if s else 'not found'}")
        if s:
            s.last_used_at = datetime.utcnow()
        return s

    def require(self, sid: str) -> Session:
        s = self.get(sid)
        if not s:
            raise KeyError("Session not found or expired")
        return s

    # --------- mutations ----------
    def add_turn(self, sid: str, role: str, content: str) -> None:
        s = self.require(sid)
        s.history.append(ChatTurn(role=role, content=content))
        s.last_used_at = datetime.utcnow()

    def upsert_patient(self, sid: str, patch: dict) -> None:
        """
        Hasta verisini 'shallow + akıllı' şekilde birleştirir:
        - primitives (age, gender, symptoms…) direkt overwrite (None ise yok sayılır)
        - previousAnswers: listeyi mevcutların sonuna ekler (tekrarları filtrelemez)
        - additionalInfo: dict seviyesinde merge eder
        """
        s = self.require(sid)

        cur: dict = s.patient.model_dump(exclude_none=True)

        # previousAnswers merge
        if "previousAnswers" in patch and isinstance(patch["previousAnswers"], list):
            prev: List[str] = list(cur.get("previousAnswers") or [])
            prev.extend([str(x) for x in patch["previousAnswers"]])
            if prev:
                cur["previousAnswers"] = prev

        # additionalInfo merge
        if "additionalInfo" in patch and isinstance(patch["additionalInfo"], dict):
            cur_add: dict[str, Any] = dict(cur.get("additionalInfo") or {})
            for k, v in patch["additionalInfo"].items():
                if v is not None:
                    cur_add[k] = v
            if cur_add:
                cur["additionalInfo"] = cur_add

        # primitive alanlar
        for k, v in patch.items():
            if k in ("previousAnswers", "additionalInfo"):
                continue
            if v is not None:
                cur[k] = v

        s.patient = PatientData(**cur)
        s.last_used_at = datetime.utcnow()

    def set_stage(self, sid: str, stage: str) -> None:
        s = self.require(sid)
        s.stage = stage  # type: ignore
        s.last_used_at = datetime.utcnow()

    def get_stage(self, sid: str) -> str:
        """Session'ın mevcut stage'ini döndür."""
        s = self.require(sid)
        return getattr(s, 'stage', 'initial')

    def get_patient(self, sid: str) -> dict:
        """Promptlar için hasta özetini dict olarak döndür."""
        s = self.require(sid)
        return s.patient.model_dump(exclude_none=True)

    def get_history(self, sid: str) -> List[dict]:
        """Konuşma geçmişini dict listesi olarak döndür."""
        s = self.require(sid)
        return [t.model_dump() for t in s.history]

    def snapshot(self, sid: str) -> Optional[Session]:
        return self.get(sid)

    # --------- janitor ----------
    def sweep(self) -> None:
        """TTL dolan oturumları temizle."""
        now = datetime.utcnow()
        ttl = timedelta(seconds=int(TTL_SECONDS))
        to_del: List[str] = []
        for sid, sess in self._sessions.items():
            if now - sess.last_used_at > ttl:
                to_del.append(sid)
        for sid in to_del:
            self._sessions.pop(sid, None)


store = InMemoryStore()