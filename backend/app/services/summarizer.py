# app/services/summarizer.py
from __future__ import annotations
from typing import List, Dict

def summarize_case(patient: Dict, history: List[Dict], max_user_msgs: int = 6) -> str:
    """
    Basit ama sağlam bir 'Vaka Özeti':
    - Demografi + ana şikayet + süre + önemli notlar
    - Son N kullanıcı mesajını madde madde ekler (tekrarları azaltır)
    """
    age = patient.get("age", "-")
    gender = patient.get("gender", "-")
    symptoms = patient.get("symptoms", "-")
    duration = patient.get("duration") or (patient.get("additionalInfo", {}) or {}).get("duration", "-")
    notes = patient.get("extra_notes") or (patient.get("additionalInfo", {}) or {}).get("extra_notes", "-")

    # En son N kullanıcı mesajı
    user_msgs = [h["content"] for h in history if h.get("role") == "user"]
    user_msgs = user_msgs[-max_user_msgs:]

    bullets = "\n".join([f"- {m.strip()}" for m in user_msgs if m.strip()])

    summary = f"""Demografi: {age} yaş, {gender}
Ana şikayet: {symptoms}
Süre: {duration}
Ek notlar: {notes}

Hasta yanıtları (son mesajlar):
{bullets if bullets else "- (yok)"}"""

    return summary.strip()