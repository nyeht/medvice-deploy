import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Brain,
  Shield,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PdfUpload } from "@/components/PdfUpload";
import { PrivacyConsent } from "@/components/PrivacyConsent";

// 🔗 Backend client (OpenAI anahtarı YOK; sadece FastAPI'ye gider)
import {
  createSession,
  analyzeLabs,
  LabValue,
} from "@/lib/gpt-api";

import { securityManager } from "@/lib/security";

// ---- Local types (backend response/payload) ---------------------------
type AnalysisPhase = "initial" | "lab_analysis" | "completed";

type BackendResp = {
  content: string;
  criticalAlerts?: string[];
};

type PatientDataLabs = {
  age: number;
  gender: "erkek" | "kadın" | string;
  labResults: LabValue[];
  additionalInfo?: Record<string, any>;
};

interface AnalysisState {
  phase: AnalysisPhase;
  currentResponse: BackendResp | null;
  extractedText: string;
  patientData: PatientDataLabs | null;
  isLoading: boolean;
  error: string | null;
}

const LabAnalysis = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const [patientInfo, setPatientInfo] = useState({
    age: 30,
    gender: "erkek" as "erkek" | "kadın",
  });

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    phase: "initial",
    currentResponse: null,
    extractedText: "",
    patientData: null,
    isLoading: false,
    error: null,
  });

  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(false);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);

  // küçük yardımcı: session’ı garanti et
  async function ensureSession(): Promise<string> {
    let sid = localStorage.getItem("sid");
    if (!sid) {
      const r = await createSession();
      sid = r.session_id;
      localStorage.setItem("sid", sid);
    }
    setSessionId(sid);
    return sid;
  }

  const handleFileProcessed = (extractedText: string, fileName: string) => {
    const sanitizedText = securityManager.sanitizeInput(extractedText);
    const contentValidation = securityManager.validateMedicalContent(sanitizedText);

    setSecurityWarnings(contentValidation.warnings);

    setAnalysisState((prev) => ({
      ...prev,
      extractedText: sanitizedText,
      error: null,
    }));
    setUploadedFile(new File([extractedText], fileName)); // sadece bayrak için
  };

  const handleFileError = (error: string) => {
    setAnalysisState((prev) => ({
      ...prev,
      error,
    }));
  };

  const handlePrivacyConsentChange = (hasConsent: boolean) => {
    setHasPrivacyConsent(hasConsent);
  };


  const startAnalysis = async () => {
    console.log("🚀 Analiz başlatılıyor...");
    console.log("👤 Hasta bilgileri:", patientInfo);
    console.log("📄 Çıkarılan metin:", analysisState.extractedText);
    console.log("🔒 Gizlilik onayı:", hasPrivacyConsent);

    try {
      // Basit validasyon
      const errors: Record<string, boolean> = {};
      if (!patientInfo.age || patientInfo.age === 0) errors.age = true;
      if (!patientInfo.gender) errors.gender = true;

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setAnalysisState((prev) => ({
          ...prev,
          error: "Lütfen yaş ve cinsiyet bilgilerinizi girin.",
        }));
        return;
      }

      setValidationErrors({});
      setAnalysisState((prev) => ({ ...prev, error: null }));

      if (!hasPrivacyConsent) {
        setAnalysisState((prev) => ({
          ...prev,
          error: "Analiz başlatabilmek için gizlilik onayını vermeniz gerekiyor.",
        }));
        return;
      }

      // Rate limit örneği (lokal)
      const userId = "user_" + Date.now();
      const rateLimitCheck = securityManager.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        setAnalysisState((prev) => ({
          ...prev,
          error: `Çok fazla istek gönderdiniz. ${Math.ceil(
            (rateLimitCheck.resetTime! - Date.now()) / 60000
          )} dakika sonra tekrar deneyin.`,
        }));
        return;
      }

      setAnalysisState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        phase: "lab_analysis",
      }));

      // Session
      const sid = await ensureSession();

      // Payload
      const patientData: PatientDataLabs = {
        age: patientInfo.age,
        gender: patientInfo.gender,
        labResults: [], // PDF'den çıkarılacak
        additionalInfo: {
          extractedText: analysisState.extractedText,
          hasUploadedFile: !!uploadedFile,
        },
      };

      setAnalysisState((prev) => ({
        ...prev,
        patientData,
      }));

      // Backend çağrısı
      const labAnalysisResponse = await analyzeLabs(patientData);

      setAnalysisState((prev) => ({
        ...prev,
        currentResponse: labAnalysisResponse as BackendResp,
        phase: "completed",
        isLoading: false,
      }));
    } catch (error: any) {
      setAnalysisState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || "Analiz sırasında hata oluştu",
      }));
    }
  };


  const resetAnalysis = () => {
    setAnalysisState({
      phase: "initial",
      currentResponse: null,
      extractedText: "",
      patientData: null,
      isLoading: false,
      error: null,
    });
  };

  // Analiz başlarken progress kartına, bittiğinde sonuçlara kaydır
  useEffect(() => {
    if (analysisState.isLoading) {
      progressRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [analysisState.isLoading]);

  useEffect(() => {
    if (analysisState.phase === "completed" && analysisState.currentResponse) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [analysisState.phase, analysisState.currentResponse]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-accent-light">
      {/* Header */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Ana Sayfaya Dön
            </Link>
            <Badge variant="outline">
              <BarChart3 className="w-3 h-3 mr-1" />
              Tahlil Analizi
            </Badge>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Tahlil Analizi</h1>
            <p className="text-muted-foreground">Tahlil sonuçlarınızı PDF olarak yükleyin</p>
          </div>

          {/* Patient Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Hasta Bilgileri
              </CardTitle>
              <CardDescription>Analiz için gerekli temel bilgiler</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">
                    Yaş <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="age"
                    type="text"
                    value={patientInfo.age || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numeric input
                      if (value === "" || /^\d+$/.test(value)) {
                        const numValue = value === "" ? 0 : parseInt(value);
                        if (numValue >= 0 && numValue <= 120) {
                          setPatientInfo((prev) => ({ ...prev, age: numValue }));
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      // Allow: backspace, delete, tab, escape, enter
                      if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                          // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                          (e.keyCode === 65 && e.ctrlKey === true) ||
                          (e.keyCode === 67 && e.ctrlKey === true) ||
                          (e.keyCode === 86 && e.ctrlKey === true) ||
                          (e.keyCode === 88 && e.ctrlKey === true) ||
                          // Allow: home, end, left, right
                          (e.keyCode >= 35 && e.keyCode <= 39)) {
                        return;
                      }
                      // Ensure that it is a number and stop the keypress
                      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="30"
                    required
                    className={validationErrors.age ? "border-destructive" : ""}
                  />
                </div>
                <div>
                  <Label htmlFor="gender">
                    Cinsiyet <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="gender"
                    value={patientInfo.gender}
                    onChange={(e) =>
                      setPatientInfo((prev) => ({ ...prev, gender: e.target.value as "erkek" | "kadın" }))
                    }
                    className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-background ${
                      validationErrors.gender ? "border-destructive" : "border-input"
                    }`}
                    required
                  >
                    <option value="">Cinsiyetinizi seçin</option>
                    <option value="erkek">Erkek</option>
                    <option value="kadın">Kadın</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Consent */}
          <PrivacyConsent onConsentChange={handlePrivacyConsentChange} />

          {/* Güvenlik uyarısı görünümü kaldırıldı */}

          {/* PDF Upload */}
          <PdfUpload onFileProcessed={handleFileProcessed} onError={handleFileError} />

          {/* Analysis Button */}
          <div className="text-center mt-8">
            <Button
              variant="medical"
              size="xl"
              onClick={startAnalysis}
              disabled={
                !analysisState.extractedText ||
                analysisState.isLoading ||
                !patientInfo.age ||
                !hasPrivacyConsent
              }
            >
              {analysisState.isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analiz Ediliyor...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5 mr-2" />
                  AI Analizi Başlat
                </>
              )}
            </Button>
          </div>

          {/* Error Display */}
          {analysisState.error && (
            <Alert variant="destructive" className="mt-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{analysisState.error}</AlertDescription>
            </Alert>
          )}

          {/* Analysis Progress */}
          {analysisState.isLoading && (
            <Card className="mt-6" ref={progressRef}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Analiz Durumu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={50} className="w-full" />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tahlil Analizi</span>
                    <span>İşleniyor...</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Analysis Results */}
          {analysisState.currentResponse && (
            <div className="space-y-6 mt-8" ref={resultsRef}>
              {/* 112 acil uyarısı geçici olarak devre dışı bırakıldı */}

              {/* Lab Analysis Results */}
              <Card className="animate-fade-in-up">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Tahlil Analizi Sonuçları
                  </CardTitle>
                  <CardDescription>Tahlil sonuçlarınızın AI analizi</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {analysisState.currentResponse.content}
                    </div>
                  </div>

                  {/* Important Notice */}
                  <div className="bg-warning-light border border-warning/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning-foreground mb-1">Önemli Uyarı</p>
                        <p className="text-warning-foreground/80">
                          Bu değerlendirme tanı koymaz ve doktor muayenesinin yerini tutmaz. Kesin tanı ve tedavi için
                          mutlaka bir sağlık kuruluşuna başvurunuz.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reset Button */}
                  <div className="text-center pt-4">
                    <Button variant="outline" onClick={resetAnalysis}>
                      Yeni Analiz Başlat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LabAnalysis;