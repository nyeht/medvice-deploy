# app/models.py
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal, Any
from datetime import datetime
from uuid import uuid4

Stage = Literal[
    "initial_assessment", "follow_up", "expert_evaluation",
    "lab_analysis", "lab_follow_up", "lab_final"
]

# ——— UI’deki “Tahlil Değerleri” ile birebir uyumlu ———
class LabValue(BaseModel):
    name: str
    # UI bazen "11" gibi string gönderebilir; tolerans için union
    value: float | str
    unit: Optional[str] = None
    normalRange: Optional[str] = None  # "12-15" biçimi
    status: Optional[Literal["normal", "high", "low"]] = None

# ——— Form (belirti) tarafı ———
class InitialForm(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    symptoms: Optional[str] = None
    duration: Optional[str] = None
    extra_notes: Optional[str] = None

# ——— Oturum profili ———
class PatientData(BaseModel):
    # Temel
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    symptoms: Optional[str] = None

    # Form ek alanlar
    duration: Optional[str] = None
    extra_notes: Optional[str] = None

    # Sohbet/akış
    previousAnswers: Optional[List[str]] = None

    # LAB: UI’deki dizi yapısı
    labResults: Optional[List[LabValue]] = None

    # Serbest ek bilgi (string, number, bool…)
    additionalInfo: Optional[Dict[str, Any]] = None

class ChatTurn(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    ts: datetime = Field(default_factory=datetime.utcnow)

class Session(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    stage: Optional[Stage] = None
    patient: PatientData = Field(default_factory=PatientData)
    history: List[ChatTurn] = Field(default_factory=list)
    last_used_at: datetime = Field(default_factory=datetime.utcnow)

class CreateSessionResp(BaseModel):
    session_id: str

class CompleteRequest(BaseModel):
    stage: Stage
    patientData: PatientData
    promptOverride: Optional[str] = None

class GenericMessageReq(BaseModel):
    message: str

class ChatRequest(BaseModel):
    message: str
    mode: Literal["follow_up", "qa"] = "follow_up"

class SessionSnapshot(BaseModel):
    id: str
    stage: Optional[Stage]
    patient: PatientData
    history: List[ChatTurn]
    created_at: datetime
    last_used_at: datetime