import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  ArrowLeft,
  ArrowRight,
  Brain,
  AlertTriangle,
  Heart,
  Activity,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";
import { SymptomChat } from "@/components/SymptomChat";

interface PatientData {
  name: string;
  age: string;
  gender: string;
  symptoms: string;
  duration: string;
  additionalInfo: string;
}

const SymptomAssessment = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showChat, setShowChat] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<PatientData>({
    name: "",
    age: "",
    gender: "",
    symptoms: "",
    duration: "",
    additionalInfo: ""
  });

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  const handleNext = () => {
    // Validation for each step
    if (currentStep === 1) {
      const errors: Record<string, boolean> = {};
      
      if (!patientData.age) {
        errors.age = true;
      }
      if (!patientData.gender) {
        errors.gender = true;
      }
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setErrorMessage('Lütfen yaş ve cinsiyet bilgilerinizi girin.');
        return;
      }
      
      setValidationErrors({});
      setErrorMessage(null);
    }
    
    if (currentStep === 2) {
      const errors: Record<string, boolean> = {};
      
      if (!patientData.symptoms.trim()) {
        errors.symptoms = true;
      }
      if (!patientData.duration) {
        errors.duration = true;
      }
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setErrorMessage('Lütfen belirtilerinizi açıklayın ve süresini belirtin.');
        return;
      }
      
      setValidationErrors({});
      setErrorMessage(null);
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleInputChange = (field: keyof PatientData, value: string) => {
    setPatientData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Kişisel Bilgiler
              </CardTitle>
              <CardDescription>
                Size daha iyi yardımcı olabilmemiz için temel bilgilerinizi paylaşın
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ad Soyad <span className="text-muted-foreground text-sm">(İsteğe bağlı)</span></Label>
                  <Input
                    id="name"
                    value={patientData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Adınız ve soyadınız"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Yaş <span className="text-destructive">*</span></Label>
                  <Input
                    id="age"
                    type="number"
                    value={patientData.age}
                    onChange={(e) => handleInputChange("age", e.target.value)}
                    placeholder="Yaşınız"
                    min="0"
                    max="120"
                    required
                    className={validationErrors.age ? "border-destructive" : ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cinsiyet <span className="text-destructive">*</span></Label>
                <Select onValueChange={(value) => handleInputChange("gender", value)}>
                  <SelectTrigger className={validationErrors.gender ? "border-destructive" : ""}>
                    <SelectValue placeholder="Cinsiyetinizi seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kadın">Kadın</SelectItem>
                    <SelectItem value="erkek">Erkek</SelectItem>
                    <SelectItem value="diğer">Diğer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Ana Şikayetler
              </CardTitle>
              <CardDescription>
                Yaşadığınız belirtileri detaylı şekilde açıklayın
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="symptoms">Belirtiler ve Şikayetler <span className="text-destructive">*</span></Label>
                <Textarea
                  id="symptoms"
                  value={patientData.symptoms}
                  onChange={(e) => handleInputChange("symptoms", e.target.value)}
                  placeholder="Yaşadığınız belirtileri mümkün olduğunca detaylı açıklayın (ağrı, bulantı, yorgunluk vs.)"
                  rows={4}
                  required
                  className={validationErrors.symptoms ? "border-destructive" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>Şikayetleriniz ne kadar süredir devam ediyor? <span className="text-destructive">*</span></Label>
                <Select onValueChange={(value) => handleInputChange("duration", value)}>
                  <SelectTrigger className={validationErrors.duration ? "border-destructive" : ""}>
                    <SelectValue placeholder="Süre seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birkaç saat">Birkaç saat</SelectItem>
                    <SelectItem value="1-2 gün">1-2 gün</SelectItem>
                    <SelectItem value="3-7 gün">3-7 gün</SelectItem>
                    <SelectItem value="1-2 hafta">1-2 hafta</SelectItem>
                    <SelectItem value="1 aydan fazla">1 aydan fazla</SelectItem>
                    <SelectItem value="kronik (3 aydan fazla)">Kronik (3 aydan fazla)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card className="form-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Ek Bilgiler
              </CardTitle>
              <CardDescription>
                Sağlık geçmişiniz ve ek bilgiler
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="additional">Ek Bilgiler</Label>
                <Textarea
                  id="additional"
                  value={patientData.additionalInfo}
                  onChange={(e) => handleInputChange("additionalInfo", e.target.value)}
                  placeholder="Kronik hastalıklarınız, kullandığınız ilaçlar, alerjileriniz, son zamanlarda yaşadığınız değişiklikler vs."
                  rows={4}
                />
              </div>
              <div className="bg-warning-light border border-warning/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-warning-foreground mb-1">Acil Durum Kontrolü</p>
                    <p className="text-warning-foreground/80">
                      Göğüs ağrısı, nefes darlığı, şiddetli baş ağrısı veya bilinç bulanıklığı yaşıyorsanız 
                      derhal 112'yi arayın veya acil servise başvurun.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  // Show chat interface if chat is started
  if (showChat) {
    return (
      <SymptomChat 
        patientData={patientData}
        onBack={() => setShowChat(false)}
      />
    );
  }

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
              <Clock className="w-3 h-3 mr-1" />
              Ortalama 5 dakika
            </Badge>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-foreground">Belirti Değerlendirmesi</h1>
              <span className="text-sm text-muted-foreground">
                Adım {currentStep} / {totalSteps}
              </span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <Alert variant="destructive" className="mb-6 animate-fade-in-up">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Current Step */}
          <div className="animate-fade-in-up">
            {renderStep()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Önceki
            </Button>
            
            {currentStep < totalSteps ? (
              <Button onClick={handleNext} variant="medical">
                Sonraki
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                variant="success" 
                size="lg"
                onClick={() => {
                  const errors: Record<string, boolean> = {};
                  
                  if (!patientData.symptoms.trim()) {
                    errors.symptoms = true;
                  }
                  if (!patientData.duration) {
                    errors.duration = true;
                  }
                  
                  if (Object.keys(errors).length > 0) {
                    setValidationErrors(errors);
                    setErrorMessage('Lütfen belirtilerinizi açıklayın ve süresini belirtin.');
                    return;
                  }
                  
                  setValidationErrors({});
                  setErrorMessage(null);
                  // Start AI chat session
                  setShowChat(true);
                }}
              >
                <Brain className="w-4 h-4 mr-2" />
                AI Danışmanı ile Sohbet Et
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SymptomAssessment;