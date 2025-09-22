from fastapi import APIRouter, Depends, Body
from app.deps import get_session
from app.models import CompleteRequest, InitialForm
from app.prompts import (
    prompt_initial_from_form, prompt_follow_up, prompt_expert, prompt_expert_from_summary
)
from app.services.openai_service import complete
from app.store import store
import json

router = APIRouter(prefix="/assessment", tags=["assessment"])

def _normalize_initial_payload(data: dict) -> InitialForm:
    if "patientData" in data and isinstance(data["patientData"], dict):
        pd = data["patientData"]
        return InitialForm(
            name=pd.get("name"),
            age=pd.get("age"),
            gender=pd.get("gender"),
            symptoms=pd.get("symptoms"),
            duration=pd.get("duration"),
            extra_notes=pd.get("extra_notes"),
        )
    return InitialForm(
        name=data.get("name"),
        age=data.get("age"),
        gender=data.get("gender"),
        symptoms=data.get("symptoms"),
        duration=data.get("duration"),
        extra_notes=data.get("extra_notes"),
    )

@router.post("/initial")
def initial_any(body: dict = Body(...), sess=Depends(get_session)):
    print("[/assessment/initial] raw body =", json.dumps(body, ensure_ascii=False))

    form = _normalize_initial_payload(body)
    form_dict = form.model_dump(exclude_none=True)

    # hasta profilini güncelle
    store.upsert_patient(sess.id, {
        "name": form.name,
        "age": form.age,
        "gender": form.gender,
        "symptoms": form.symptoms,
        "duration": form.duration,
        "extra_notes": form.extra_notes,
        "previousAnswers": [],
        "additionalInfo": {
            "duration": form.duration or "",
            "extra_notes": form.extra_notes or "",
            "source": "initial_form"
        }
    })

    # Formu direkt LLM'e gönder
    system, user = prompt_initial_from_form(form_dict)
    out = complete(system, user)

    # Eğer model soru sormadan eksperte geçmek istiyorsa: [GO_EXPERT] yakala
    if "[GO_EXPERT]" in out:
        # form verisiyle uzman değerlendirmesi
        sys2, usr2 = prompt_expert(form_dict)
        expert = complete(sys2, usr2, temperature=0.1)

        # geçmiş
        store.add_turn(sess.id, "user", f"[INITIAL FORM]\n{json.dumps(form_dict, ensure_ascii=False)}")
        store.add_turn(sess.id, "assistant", expert)
        store.set_stage(sess.id, "expert_evaluation")
        return {"content": expert}

    # normal durumda: soru setini döndür
    store.add_turn(sess.id, "user", f"[INITIAL FORM]\n{json.dumps(form_dict, ensure_ascii=False)}")
    store.add_turn(sess.id, "assistant", out)
    store.set_stage(sess.id, "initial_assessment")
    return {"content": out}

@router.post("/follow-up")
def follow_up(req: CompleteRequest, sess=Depends(get_session)):
    store.upsert_patient(sess.id, req.patientData.model_dump(exclude_none=True))
    system, user = prompt_follow_up(req.patientData.model_dump(exclude_none=True))
    out = complete(system, user)
    store.add_turn(sess.id, "user", f"[FOLLOW-UP ANSWERS]\n{req.patientData.previousAnswers or ''}")
    store.add_turn(sess.id, "assistant", out)
    store.set_stage(sess.id, "follow_up")
    return {"content": out}

@router.post("/expert")
def expert(req: CompleteRequest, sess=Depends(get_session)):
    store.upsert_patient(sess.id, req.patientData.model_dump(exclude_none=True))
    system, user = prompt_expert(req.patientData.model_dump(exclude_none=True))
    out = complete(system, user, temperature=0.1)
    store.add_turn(sess.id, "user", "[REQUEST EXPERT EVALUATION]")
    store.add_turn(sess.id, "assistant", out)
    store.set_stage(sess.id, "expert_evaluation")
    return {"content": out}