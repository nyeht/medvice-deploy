# app/routers/labs.py
from __future__ import annotations
from fastapi import APIRouter, Depends, Body, UploadFile, File
from typing import List, Dict, Any, Tuple
import re
import json
from pydantic import ValidationError

from app.deps import get_session
from app.models import PatientData, LabValue
from app.prompts import (
    prompt_lab_analysis,
    prompt_lab_follow_up,
    prompt_lab_final,
)
from app.services.openai_service import complete
from app.services.pdf_service import extract_text_from_upload
from app.store import store

router = APIRouter(prefix="/labs", tags=["labs"])

# ---------------- helpers ----------------

def _to_float_safe(v: Any) -> float | None:
    try:
        # str "2,97" -> "2.97"
        if isinstance(v, str):
            v = v.replace(",", ".")
        return float(v)
    except Exception:
        return None

def _parse_range(s: str | None) -> Tuple[float | None, float | None]:
    if not s:
        return None, None
    m = re.match(r"^\s*([+-]?\d+(?:[.,]\d+)?)\s*[-–]\s*([+-]?\d+(?:[.,]\d+)?)\s*$", s or "")
    if not m:
        return None, None
    lo = _to_float_safe(m.group(1))
    hi = _to_float_safe(m.group(2))
    return lo, hi

def _compute_status(value: float | None, rng: str | None) -> str | None:
    if value is None:
        return None
    lo, hi = _parse_range(rng)
    if lo is None or hi is None:
        return None
    if value < lo:
        return "low"
    if value > hi:
        return "high"
    return "normal"

def _coerce_lab_values(lst: List[Dict[str, Any]] | List[LabValue] | None) -> List[Dict[str, Any]]:
    """value’ları floata çevir, status yoksa hesapla; temiz dizi döndür."""
    if not lst:
        return []
    out: List[Dict[str, Any]] = []
    for item in lst:
        d = item.model_dump() if isinstance(item, LabValue) else dict(item)
        fval = _to_float_safe(d.get("value"))
        if d.get("status") not in ("normal", "high", "low"):
            d["status"] = _compute_status(fval, d.get("normalRange")) or d.get("status")
        if fval is not None:
            d["value"] = fval
        out.append(d)
    return out

def _merge_profiles(base: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    """Sığ + alan bazlı birleştirme (özellikle labResults & additionalInfo korunur)."""
    merged = dict(base or {})
    for k, v in (incoming or {}).items():
        if v is None:
            continue
        if k == "labResults":
            merged["labResults"] = _coerce_lab_values(v)  # incoming öncelikli
        elif k == "additionalInfo":
            merged.setdefault("additionalInfo", {})
            if isinstance(v, dict):
                merged["additionalInfo"].update(v)
        else:
            merged[k] = v
    return merged

def _looks_like_hex_id(s: str) -> bool:
    return isinstance(s, str) and bool(re.fullmatch(r"[0-9a-f]{32}", s))

def _extract_questions(text: str) -> List[str]:
    qs: List[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        if re.match(r"^\s*\d+[\)\.\-]\s+", s):
            qs.append(re.sub(r"^\s*\d+[\)\.\-]\s+", "", s).strip())
    if not qs:
        for line in text.splitlines():
            s = line.strip()
            if "?" in s and 0 < len(s) <= 180:
                qs.append(s)
    seen = set(); uniq = []
    for q in qs:
        if q not in seen:
            seen.add(q); uniq.append(q)
    return uniq

def _detect_critical(text: str) -> List[str]:
    flags = []
    lowered = text.lower()
    for p in ["acil", "acil servis", "derhal", "112",
              "göğüs ağrısı", "nefes darlığı", "şiddetli baş ağrısı",
              "bilinç bulanıklığı", "felç", "inme", "kanama"]:
        if p in lowered:
            flags.append(f"Kritik uyarı ifadesi tespit edildi: '{p}'")
    return list(dict.fromkeys(flags))

def _normalize_payload(raw: Dict[str, Any], sess_id: str) -> Dict[str, Any]:
    """
    FE’nin olası biçimleri:
      A) {"stage": "...", "patientData": {...}}
      B) {"stage": "...", "patientData": "<hash/hex>"}  -> store’daki profili temel al
      C) Doğrudan patient alanları
    Sonuç: dict (PatientData şemasına uygun) + labResults normalize.
    """
    # Mevcut profil (oturumdan)
    snap = store.snapshot(sess_id)
    current = snap.patient.model_dump(exclude_none=True) if snap else {}

    # --- patientData çıkar ---
    if "patientData" in raw:
        pd = raw["patientData"]
        if isinstance(pd, str):
            # Bazı durumlarda buraya sessionId/reh ber gelebiliyor
            base = current if _looks_like_hex_id(pd) else current
            incoming = {"additionalInfo": {"client_ref": pd}}
            merged = _merge_profiles(base, incoming)
        elif isinstance(pd, dict):
            # additionalInfo string geldiyse sar
            if isinstance(pd.get("additionalInfo"), str):
                pd = {**pd, "additionalInfo": {"client_ref": pd["additionalInfo"]}}
            merged = _merge_profiles(current, pd)
        else:
            # beklenmeyen tip -> client_ref’e göm
            merged = _merge_profiles(current, {"additionalInfo": {"client_ref": str(pd)}})
    else:
        # komple gövdeyi hasta alanı gibi kabul et
        pd = dict(raw)
        if isinstance(pd.get("additionalInfo"), str):
            pd["additionalInfo"] = {"client_ref": pd["additionalInfo"]}
        merged = _merge_profiles(current, pd)

    # pydantic doğrulaması + tekrar normalize
    try:
        p = PatientData.model_validate(merged).model_dump(exclude_none=True)
    except ValidationError as ve:
        print("[labs] VALIDATION ERROR (merged):", ve)
        raise

    # labResults’ı kesin normalize et (float/status)
    if "labResults" in p and isinstance(p["labResults"], list):
        p["labResults"] = _coerce_lab_values(p["labResults"])

    return p

# ---------------- endpoints ----------------

@router.post("/analyze")
def analyze(body: Dict[str, Any] = Body(...), sess=Depends(get_session)):
    print("[/labs/analyze] raw body =", json.dumps(body, ensure_ascii=False))
    patient = _normalize_payload(body, sess.id)
    
    # PDF'den çıkarılan text varsa additionalInfo'ya ekle
    if "additionalInfo" in patient and isinstance(patient["additionalInfo"], dict):
        additional_info = patient["additionalInfo"]
        if "extracted_text" in additional_info:
            # PDF text'i extractedText olarak ekle
            patient["additionalInfo"]["extractedText"] = additional_info["extracted_text"]
    
    store.upsert_patient(sess.id, patient)

    system, user = prompt_lab_analysis(patient)
    out = complete(system, user)  # Uyarı eklemiyoruz; UI gösteriyor

    store.add_turn(sess.id, "user", "[LAB ANALYSIS REQUEST]")
    store.add_turn(sess.id, "assistant", out)
    store.set_stage(sess.id, "lab_analysis")

    return {
        "content": out,
        "requiresFollowUp": False,
        "questions": [],
        "criticalAlerts": _detect_critical(out),
    }

@router.post("/follow-up")
def lab_follow_up(body: Dict[str, Any] = Body(...), sess=Depends(get_session)):
    print("[/labs/follow-up] raw body =", json.dumps(body, ensure_ascii=False))
    patient = _normalize_payload(body, sess.id)
    store.upsert_patient(sess.id, patient)

    system, user = prompt_lab_follow_up(patient)
    out = complete(system, user)

    store.add_turn(sess.id, "user", "[LAB FOLLOW-UP REQUEST]")
    store.add_turn(sess.id, "assistant", out)
    store.set_stage(sess.id, "lab_follow_up")

    return {"content": out, "questions": _extract_questions(out)}

@router.post("/final")
def lab_final(body: Dict[str, Any] = Body(...), sess=Depends(get_session)):
    print("[/labs/final] raw body =", json.dumps(body, ensure_ascii=False))
    patient = _normalize_payload(body, sess.id)
    store.upsert_patient(sess.id, patient)

    system, user = prompt_lab_final(patient)
    out = complete(system, user, temperature=0.2)

    store.add_turn(sess.id, "user", "[LAB FINAL REQUEST]")
    store.add_turn(sess.id, "assistant", out)
    store.set_stage(sess.id, "lab_final")

    return {"content": out}

@router.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), sess=Depends(get_session)):
    """
    PDF dosyasını yükler ve text'e çevirir.
    """
    try:
        # Dosya boyutunu kontrol et (10MB limit)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB
            return {"error": "Dosya boyutu 10MB'dan büyük olamaz"}
        
        # PDF'den text çıkar
        extracted_text = extract_text_from_upload(content, file.filename)
        
        # Session'a kaydet
        store.upsert_patient(sess.id, {
            "additionalInfo": {
                "uploaded_file": file.filename,
                "extracted_text": extracted_text,
                "file_size": len(content)
            }
        })
        
        return {
            "success": True,
            "filename": file.filename,
            "extracted_text": extracted_text,
            "text_length": len(extracted_text)
        }
        
    except Exception as e:
        return {"error": f"PDF işleme hatası: {str(e)}"}