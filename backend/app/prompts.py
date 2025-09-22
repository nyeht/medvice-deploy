# app/prompts.py

SYSTEM_GENERAL = (
    "Sen bir sağlık danışmanı yapay zekâsın. Tanı koymazsın; bilgilendirir ve "
    "yönlendirirsin. Acil durumları tanır ve gerektiğinde 112'ye yönlendirirsin. "
    "Dilin net, kısa ve sakin olsun. Aynı bilgiyi tekrar sorma; mevcut veriyi kullan. "
    "Başlık/markdown süsleme yapma; gereksiz girizgâh yazma. "
    "‘Acil değil/normal’ gibi kesin güvence cümleleri kurma; yalnızca gerekli olduğunda acil uyarısı yap. "
    "Mesajlarını ‘geçmiş olsun’ gibi kapanışlarla bitirme."
)

# ---------------------------------------------------------------------
# İlk değerlendirme — formdan (SORU MODU)
# ---------------------------------------------------------------------
def prompt_initial_from_form(form: dict) -> tuple[str, str]:
    user = f"""
HASTA FORMU
- İsim: {form.get('name') or '-'}
- Yaş: {form.get('age') or '-'}
- Cinsiyet: {form.get('gender') or '-'}
- Ana şikayet/belirtiler: {form.get('symptoms') or '-'}
- Süre: {form.get('duration') or '-'}
- Ek notlar: {form.get('extra_notes') or '-'}

KURALLAR:
- SELAM: Hasta formunda isim sağlanmamış/boş gibi ise isim kullanmadan giriş cümlesi kur.
- SELAM: İsim sağlandıysa ilk cümlede yalnızca “Merhaba {form.get('name')}, geçmiş olsun.” diyerek giriş cümlesi kur.
- SORU MODU: Tanı tahmini, açıklama veya öneri YAPMA. Yalnızca eksik bilgiye yönelik 1–3 (maks 5) kısa, numaralı soru sor.
- TUR SINIRI: En fazla 2 tur soru-cevap yap.
- ACİL KARARI: Yalnızca ŞU İKİ durumda acil kabul et:
  * durdurulamayan KANAMA,
  * olası ZEHİRLENME (ilaç/kimyasal/madde alımı; duman/gaz maruziyeti).
- ACİL ise: netçe belirt; 2–4 maddelik “şimdi yapman gerekenler” listesi + 112 yönlendirmesi ver. Ek soru sorma. “112 ile görüştün mü?” gibi teyit cümleleri KULLANMA.
- BİTİRME: Bilgi uzman değerlendirmesi için YETERLİ ise veya ~2 tur soru-cevap olduysa, TEK SATIRDA yalnızca [GO_EXPERT] yaz.
"""
    return SYSTEM_GENERAL, user

def prompt_chat_followup(user_msg: str, patient: dict, history: list[dict]) -> tuple[str, str]:
    # --- Debug: gelen full history hakkında kısa log ---
    print("[prompt_chat_followup] -- START --")
    print("[prompt_chat_followup] total_turns:", len(history))

    # son 8 turu prompta koyuyoruz (ayrıca loglayalım)
    recent = history[-8:]
    print("[prompt_chat_followup] recent_turns:", len(recent))
    for i, t in enumerate(recent, 1):
        role = t.get("role")
        content = str(t.get("content") or "")

        cleaned = content[:220].replace("\n", " ")
        print(f"[prompt_chat_followup] recent[{i}] {role}: {cleaned}")
        
    convo = "\n".join([f"{t['role']}: {t['content']}" for t in recent])

    # --- Heuristik: şimdiye kadar kaç "soru turu" yapıldı? ---
    # Not: regex kullanmadan basit işaretlerle sayıyoruz.
    # Bir turu saymak için: asistan mesajında numaralı soru kalıbından en az biri olsun.
    # (örn. "1." ve "?" barındırması veya satır içi "\n2." / "\n3." geçmesi)
    qa_rounds = 0
    for t in history:
        if t.get("role") == "assistant":
            c = (t.get("content") or "")
            if (("1." in c and "?" in c) or ("\n2." in c) or ("\n3." in c)):
                qa_rounds += 1

    # --- Expert mod kontrolü (sohbet uzman aşamasına geçtiyse) ---
    # Sahnenin 'expert_evaluation' olmasından veya uzman imza cümlesinin geçmişte bulunmasından anlayalım
    expert_signature = "Merak ettiğin bir şey var mı, başka nasıl yardımcı olabilirim?"
    in_expert_mode = any(
        ("expert_evaluation" in ((getattr(t, "stage", None) or t.get("stage") or ""))) or
        (t.get("role") == "assistant" and expert_signature in (t.get("content") or ""))
        for t in history
    )

    print("[prompt_chat_followup] qa_rounds:", qa_rounds, "in_expert_mode:", in_expert_mode)

    name = (patient.get("name") or "").strip()
    # Selam sadece ilk turda
    selam = (f"Merhaba {name}, birkaç kısa sorum olacak."
             if (name and qa_rounds == 0) else
             ("Birkaç kısa sorum olacak." if qa_rounds == 0 else ""))

    if in_expert_mode:
        # Expert modu promptu: soru sorma, doğrudan yanıt
        sys = (
            SYSTEM_GENERAL +
            " EXPERT MOD: Artık anamnez sorusu sorma, yeni soru üretme. "
            "Önceki soruları veya vaka özetini tekrar etme. "
            "Kullanıcı bundan sonra ne sorarsa sadece doğrudan yanıt ver. "
            "Yanıtın kısa, net ve hastaya hitaben olsun. Konuşma bağlamını koru. "
            "Mesajın sonunda alt satıra geçip: ‘Merak ettiğin bir şey var mı, başka nasıl yardımcı olabilirim?’ diye sor."
        )
        usr = f"""
HASTA ÖZETİ
- Yaş/Cinsiyet: {patient.get('age')}/{patient.get('gender')}
- Ana şikayet: {patient.get('symptoms')}
- Önceki yanıtlar: {patient.get('previousAnswers')}
- Ek: {patient.get('additionalInfo')}

SON KONUŞMA
{convo}

KULLANICI MESAJI
{user_msg}

GÖREV:
- Sorunun cevabını doğrudan ver; uzun açıklama ve tekrar yok.
- Kısa, anlaşılır, tek-paragraf yanıt ver.
- Son cümlede alt satıra geçip: ‘Merak ettiğin bir şey var mı, başka nasıl yardımcı olabilirim?’ yaz.
"""
        return sys, usr

    # SORU MODU (yalnızca tur sayısına göre karar ver)
    sys = (
        SYSTEM_GENERAL +
        " SORU MODU: Açıklama/yorum/öneri verme; tanısal çıkarım yapma. "
        "Yalnızca eksik noktaları tamamlamak için 1–3 (maks 5) kısa, numaralı soru sor. "
        "Acil değerlendirmesinde SADECE kanama veya zehirlenme red-flag sayılır. "
        "Acil talimatı daha önce verdiysen tekrarlama; teyit isteme."
    )

    usr = f"""
HASTA ÖZETİ
- İsim: {patient.get('name') or '-'}
- Yaş/Cinsiyet: {patient.get('age')}/{patient.get('gender')}
- Şikayet: {patient.get('symptoms')}
- Süre: {patient.get('duration')}
- Notlar: {patient.get('extra_notes')}
- Ek: {patient.get('additionalInfo')}

ŞU ANA KADAR SORU–CEVAP TURU: {qa_rounds}

SON KONUŞMA
{convo}

KULLANICI MESAJI
{user_msg}

GÖREV — KESİN KURAL:
1) Eğer (ŞU ANA KADAR TUR SAYISI ≥ 4) ise: başka metin ekleme, TEK SATIRDA SADECE [GO_EXPERT] yaz.
2) Red-flag (kanama/zehirlenme) varsa: acil uyarısı + 2–4 adımlık talimat + 112 (teyit isteme, soru sorma).
3) Aksi halde:
   {(selam + " ") if selam else ""}“Size daha iyi yardımcı olabilmem için lütfen aşağıdaki soruları cevaplayın.” diye tek cümlelik giriş yaz;
   ardından birbirinden farklı 1–3 numaralı hedefli soru üret; açıklama/öneri yazma.
"""
    return sys, usr
# ---------------------------------------------------------------------
# Geri uyumluluk — SORU MODU korunur (tur sınırı eklendi)
# ---------------------------------------------------------------------
def prompt_initial_assessment(patient: dict) -> tuple[str, str]:
    user = f"""
HASTA BİLGİLERİ
- İsim: {patient.get('name') or '-'}
- Yaş: {patient.get('age') or '-'}
- Cinsiyet: {patient.get('gender') or '-'}
- Ana şikayet/belirtiler: {patient.get('symptoms') or '-'}

Görev:
- Yalnızca KANAMA veya ZEHİRLENME varsa acil uyarısı + 2–4 adımlık talimat + 112 (teyit isteme).
- Red-flag yoksa: eksiklere 1–3 kısa soru (maks 5); açıklama/öneri yok.
- Toplam soru-cevap turu 2'yi aşma.
- Yeterliyse tek satırda [GO_EXPERT].
"""
    return SYSTEM_GENERAL, user

def prompt_follow_up(patient: dict) -> tuple[str, str]:
    name = (patient.get("name") or "").strip()
    selam = f"Merhaba {name}, birkaç kısa sorum olacak." if name else "Birkaç kısa sorum olacak."
    user = f"""
ÖNCEKİ CEVAPLAR: {patient.get('previousAnswers') or '—'}
MEVCUT ŞİKAYET/ÖYKÜ: {patient.get('symptoms') or '—'}

Görev:
- Acil (kanama/zehirlenme) talimatı daha önce verildiyse tekrarlama; teyit isteme; yeni soru sorma.
- Red-flag yoksa: {selam} Sonrasında 1–3 hedefli soru; açıklama/öneri yazma.
- Toplam soru-cevap turu 2'yi aşma.
- Yeterliyse SADECE [GO_EXPERT].
"""
    return SYSTEM_GENERAL, user
# ---------------------------------------------------------------------
# Uzman değerlendirme — paragraf üslubu, sonda nazik soru
# ---------------------------------------------------------------------
def prompt_expert_from_summary(summary: str) -> tuple[str, str]:
    sys = SYSTEM_GENERAL + (
        " Uzmansın; klinik ve aksiyon odaklı konuş. "
        "Konuşma dilini hastaya hitaben konuşuyormuş gibi ayarla"
        "Çıktın başlıksız ve madde işaretsiz, kısa bir paragraf olsun. "
        "Artık anamnez sorusu sorma, yeni soru üretme. "
        "Önceki soruları veya vaka özetini tekrar etme. "
        "Kullanıcı bundan sonra ne sorarsa sadece doğrudan yanıt ver. "
        "Konuşma bağlamını koru. "
        "Son cümlende nazikçe alt satıra geçip: "
        "‘Merak ettiğin bir şey var mı, başka nasıl yardımcı olabilirim?’ diye sor."
    )
    usr = f"""
Aşağıdaki vaka özetini değerlendir ve tek-paragraf halinde, uygulanabilir, kısa bir klinik yorum yaz.

VAKA ÖZETİ
{summary}

İçerik: en olası neden(ler) + kısa gerekçe; ne zaman başvurmalı (bugün/48–72s/elektif);
evde yapılabilecekler/kaçınılacaklar; gerekli test/bölüm; hangi durumda tekrar başvurmalı.
Liste ve başlık kullanma.
"""
    return sys, usr

def prompt_expert(patient: dict) -> tuple[str, str]:
    sys = SYSTEM_GENERAL + (
        " Uzmansın; klinik ve aksiyon odaklı konuş. "
        "Konuşma dilini hastaya hitaben konuşuyormuş gibi ayarla"
        "Çıktın başlıksız ve madde işaretsiz, kısa bir paragraf olsun. "
        "Artık anamnez sorusu sorma, yeni soru üretme. "
        "Önceki soruları veya vaka özetini tekrar etme. "
        "Kullanıcı bundan sonra ne sorarsa sadece doğrudan yanıt ver. "
        "Konuşma bağlamını koru. "
        "Son cümlende nazikçe alt satıra geçip: "
        "‘Merak ettiğin bir şey var mı, başka nasıl yardımcı olabilirim?’ diye sor."
    )
    usr = f"""
HASTA DOSYASI
- Yaş/Cinsiyet: {patient.get('age')}/{patient.get('gender')}
- Ana şikayet: {patient.get('symptoms')}
- Önceki yanıtlar: {patient.get('previousAnswers')}

Tek-paragraf kısa bir değerlendirme yaz:
olası neden(ler) + kısa gerekçe; ne zaman başvurmalı; evde yapılabilecekler/kaçınılacaklar;
gerekli test/bölüm; takip tetikleyicileri.
"""
    return sys, usr

# ---------------------------------------------------------------------
# Tahlil akışı — AYNEN BIRAKILDI
# ---------------------------------------------------------------------
def prompt_lab_analysis(patient: dict) -> tuple[str, str]:
    user = f"""
TAHLİL BİLGİLERİ
- Yaş/Cinsiyet: {patient.get('age')}/{patient.get('gender')}
- Sonuçlar: {patient.get('labResults')}
- Ek metin: {(patient.get('additionalInfo') or {}).get('extractedText', '—')}

ÖNEMLİ KURALLAR:
- SADECE verilen tahlil sonuçlarına göre analiz yap
- Ek soru sorma, başka test önerme
- Eldeki verilerle sadece bilgilendirme yap
- Acil durum tespiti yapma (sadece gerçekten kritik değerler varsa uyar)
- Soru sorma, sadece analiz ve öneriler ver

Çıktı formatı:
1. Genel değerlendirme (normal/anormal değerler)
2. Anormal değerlerin olası nedenleri
3. Yaşam tarzı önerileri (beslenme, spor, dikkat edilecekler)
4. Hangi durumda doktora başvurulmalı

Kısa, net ve uygulanabilir öneriler ver. Başlık kullanma, liste yapma.
"""
    return SYSTEM_GENERAL, user

def prompt_lab_follow_up(patient: dict) -> tuple[str, str]:
    user = f"""
LAB ÖZETİ
- Sonuçlar: {patient.get('labResults')}
- Ek bilgiler/cevaplar: {patient.get('additionalInfo')}

Görev:
- Kısa açıklama + 2–4 hedefli ek soru çıkar (sadece gerekiyorsa).
- Tekrar yok, numaralı ve kısa.
"""
    return SYSTEM_GENERAL, user

def prompt_lab_final(patient: dict) -> tuple[str, str]:
    user = f"""
HASTA PROFİLİ
- Yaş/Cinsiyet: {patient.get('age')}/{patient.get('gender')}
- Lab sonuçları: {patient.get('labResults')}
- Ek/cevaplar: {patient.get('additionalInfo')}

Çıktı:
- Sonuç özeti (kritik/dikkat/normal)
- Risk düzeyi (yüksek/orta/düşük) ve başvuru zamanı
- Kısa öneriler (evde, kaçınılacaklar, gerekirse test/bölüm)
- Takip planı (ne zaman tekrar bakılmalı)
Elde olmayan alanlar için '—' kullan; gereksiz tekrar ve başlık yok.
"""
    return SYSTEM_GENERAL, user