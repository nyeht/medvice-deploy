# app/routers/chat.py

from fastapi import APIRouter, Depends
from app.deps import get_session
from app.models import ChatRequest
from app.prompts import prompt_chat_followup, prompt_expert_from_summary
from app.services.openai_service import complete
from app.store import store

router = APIRouter(prefix="/chat", tags=["chat"])

def summarize_session(patient: dict, history: list[dict]) -> str:
    user_msgs = [h["content"] for h in history if h["role"] == "user"]
    last_user = user_msgs[-1] if user_msgs else ""
    lines = [
        f"Yaş/Cinsiyet: {patient.get('age')}/{patient.get('gender')}",
        f"Ana şikayet: {patient.get('symptoms')}",
        f"Süre: {patient.get('duration') or (patient.get('additionalInfo') or {}).get('duration')}",
        f"Ek notlar: {patient.get('extra_notes')}",
        f"Son kullanıcı mesajı: {last_user}",
    ]
    prev = patient.get("previousAnswers")
    if prev:
        lines.append(f"Önceki yanıtlar: {prev}")
    return "\n".join([s for s in lines if s and s not in ("None", "null")])

@router.post("/send")
def send(req: ChatRequest, sess=Depends(get_session)):
    # 1) Kullanıcı mesajını geçmişe yaz
    store.add_turn(sess.id, "user", req.message)

    patient = sess.patient.model_dump()
    history = [t.model_dump() for t in sess.history]
    stage = store.get_stage(sess.id)

    # === A) UZMAN MODUNDA DEVAM ===
    # Daha önce ekspertize geçildiyse, soru modunu hiç çağırma.
    if stage == "expert_evaluation":
        summary = summarize_session(patient, history)

        EXPERT_REPLY_SYS = (
            "Uzman klinik danışman modundasın. Artık anamnez sorusu sorma ve yeni soru üretme. "
            "Kullanıcının sorusuna bağlamı kullanarak DOĞRUDAN ve KISA cevap ver. "
            "Önceki açıklamaları tekrar etme; gereksiz girizgâh yazma; maddeleme yapma. "
            "Net ve uygulanabilir konuş."
        )
        EXPERT_REPLY_USR = (
            f"Kısa vaka özeti:\n{summary}\n\n"
            f"Kullanıcı sorusu/mesajı:\n{req.message}\n\n"
            "Kısa ve doğrudan cevap ver."
        )

        expert_reply = complete(EXPERT_REPLY_SYS, EXPERT_REPLY_USR, temperature=0.2)
        store.add_turn(sess.id, "assistant", expert_reply)
        # stage expert_evaluation olarak kalır
        return {"content": expert_reply, "auto_expert": False}

    # === B) SORU MODU (UZMANA GEÇMEMİŞ) ===
    system, user = prompt_chat_followup(req.message, patient, history)
    out = complete(system, user)

    # Sadece İLK KEZ kesin eşleşmede uzmana geç (içerik içinde geçen kelimeye değil)
    if out.strip() == "[GO_EXPERT]":
        summary = summarize_session(patient, history)
        sys2, usr2 = prompt_expert_from_summary(summary)
        expert = complete(sys2, usr2, temperature=0.1)

        store.add_turn(sess.id, "assistant", expert)
        store.set_stage(sess.id, "expert_evaluation")  # <-- bundan sonra hep uzman modu
        return {"content": expert, "auto_expert": True}

    # Normal soru modu cevabı
    store.add_turn(sess.id, "assistant", out)
    store.set_stage(sess.id, "follow_up")
    return {"content": out, "auto_expert": False}