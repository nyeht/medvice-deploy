// src/lib/gpt-api.ts — Frontend -> FastAPI adapter (NO OpenAI key here)

const API = import.meta.env.VITE_API_BASE || "http://localhost:8001" || "https://medvice-deploy.onrender.com";

// ---- Session helpers -------------------------------------------------
function getLocalSid(): string | null {
  try { return localStorage.getItem("sid"); } catch { return null; }
}
function setLocalSid(sid: string) {
  try { localStorage.setItem("sid", sid); } catch {}
}

export async function createSession(): Promise<{ session_id: string }> {
  const res = await fetch(`${API}/sessions`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (data?.session_id) setLocalSid(data.session_id);
  return data;
}

async function ensureSid(): Promise<string> {
  let sid = getLocalSid();
  if (!sid) {
    const r = await createSession();
    sid = r.session_id;
  }
  return sid!;
}

function authHeaders(sessionId: string) {
  return {
    "Content-Type": "application/json",
    "X-Session-Id": sessionId,
  };
}

// Bir kez 404/expired alırsak yeni session yaratıp tekrar deneriz.
async function withSessionRetry<T>(fn: (sid: string) => Promise<T>): Promise<T> {
  let sid = await ensureSid();
  try {
    return await fn(sid);
  } catch (e: any) {
    const msg = (e?.message || "").toLowerCase();
    if (msg.includes("session not found") || msg.includes("expired") || msg.includes("404")) {
      // yeni session oluştur ve dene
      const r = await createSession();
      sid = r.session_id;
      return await fn(sid);
    }
    throw e;
  }
}

// ---- Assessment (symptoms) -------------------------------------------
// NOT: /assessment/initial ham FORM body bekliyor (patientData sarması yok)
export async function assessmentInitial(form: {
  name?: string;
  age?: number;
  gender?: string;
  symptoms?: string;
  duration?: string;
  extra_notes?: string;
}) {
  return withSessionRetry(async (sid) => {
    const res = await fetch(`${API}/assessment/initial`, {
      method: "POST",
      headers: authHeaders(sid),
      body: JSON.stringify(form),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ content: string }>;
  });
}

export async function assessmentFollowUp(payload: {
  symptoms?: string;
  previousAnswers?: string[];
}) {
  return withSessionRetry(async (sid) => {
    const res = await fetch(`${API}/assessment/follow-up`, {
      method: "POST",
      headers: authHeaders(sid),
      body: JSON.stringify({
        stage: "follow_up",
        patientData: payload,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ content: string }>;
  });
}

export async function assessmentExpert(payload: {
  name?: string;
  age?: number;
  gender?: string;
  symptoms?: string;
  previousAnswers?: string[];
}) {
  return withSessionRetry(async (sid) => {
    const res = await fetch(`${API}/assessment/expert`, {
      method: "POST",
      headers: authHeaders(sid),
      body: JSON.stringify({
        stage: "expert_evaluation",
        patientData: payload,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ content: string }>;
  });
}

// ---- Chat ------------------------------------------------------------
export async function chatSend(message: string) {
  return withSessionRetry(async (sid) => {
    const res = await fetch(`${API}/chat/send`, {
      method: "POST",
      headers: authHeaders(sid),
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ content: string; auto_expert?: boolean; expert?: string }>;
  });
}

// ---- Labs -------------------------------------------------------------
export interface LabValue {
  name: string;
  value: string;
  unit?: string;
  normalRange?: string;
  status?: "normal" | "high" | "low";
}

export async function analyzeLabs(payload: {
  age: number;
  gender: "erkek" | "kadın" | string;
  labResults: LabValue[];
  additionalInfo?: Record<string, any>;
}) {
  return withSessionRetry(async (sid) => {
    const res = await fetch(`${API}/labs/analyze`, {
      method: "POST",
      headers: authHeaders(sid),
      body: JSON.stringify({
        stage: "lab_analysis",
        patientData: payload,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

export async function labsFollowUp(additionalInfo: Record<string, any>) {
  return withSessionRetry(async (sid) => {
    const res = await fetch(`${API}/labs/follow-up`, {
      method: "POST",
      headers: authHeaders(sid),
      body: JSON.stringify({
        stage: "lab_follow_up",
        patientData: { additionalInfo },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

export async function labsFinal(ctx: {
  age?: number;
  gender?: string;
  labResults?: any;
  additionalInfo?: Record<string, any>;
}) {
  return withSessionRetry(async (sid) => {
    const res = await fetch(`${API}/labs/final`, {
      method: "POST",
      headers: authHeaders(sid),
      body: JSON.stringify({
        stage: "lab_final",
        patientData: ctx,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
}

// ---- PDF upload --------------------------------------------------
export async function uploadPDF(file: File): Promise<{
  success: boolean;
  filename: string;
  extracted_text: string;
  text_length: number;
  error?: string;
}> {
  return withSessionRetry(async (sid) => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API}/labs/upload-pdf`, {
      method: "POST",
      headers: {
        "X-Session-Id": sid,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json();
      // Session retry için error mesajını doğru şekilde throw et
      throw new Error(errorData.detail || errorData.error || "PDF yükleme hatası");
    }

    return res.json();
  });
}

// ---- PDF placeholder (fallback) --------------------------------------------------
export async function extractTextFromPDF(file: File): Promise<string> {
  const type = file.type || "unknown";
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const meta = type.includes("pdf") ? "PDF" : type.includes("image") ? "Görüntü" : "Dosya";
  return `(${meta}) "${file.name}" dosyası işlendi. Yaklaşık boyut: ${sizeMB} MB.\n\nNot: Bu önizleme amaçlı yer tutucu metindir.`;
}