import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  Eye,
  EyeOff
} from "lucide-react";
import { privacyManager } from "@/lib/security";

interface PrivacyConsentProps {
  onConsentChange: (hasConsent: boolean) => void;
}

export const PrivacyConsent = ({ onConsentChange }: PrivacyConsentProps) => {
  const [hasConsent, setHasConsent] = useState(false);
  const [showFullNotice, setShowFullNotice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const consent = privacyManager.hasUserConsent();
    setHasConsent(consent);
    onConsentChange(consent);
    setIsLoading(false);
  }, [onConsentChange]);

  const handleAcceptConsent = () => {
    privacyManager.setUserConsent(true);
    setHasConsent(true);
    onConsentChange(true);
  };

  const handleDeclineConsent = () => {
    privacyManager.setUserConsent(false);
    setHasConsent(false);
    onConsentChange(false);
  };

  if (isLoading) {
    return (
      <Card className="border-warning/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-4 h-4 animate-pulse" />
            <span>Güvenlik kontrolleri yapılıyor...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (hasConsent) {
    return (
      <Card className="border-accent/20 bg-accent-light/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-accent" />
              <CardTitle className="text-sm">Gizlilik Onayı</CardTitle>
            </div>
            <Badge variant="outline" className="text-accent border-accent/30">
              Onaylandı
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Verilerinizin güvenli işlenmesi için gerekli izinleri verdiniz. 
            Uygulamayı güvenle kullanabilirsiniz.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/20 bg-warning-light/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning-foreground">
          <Shield className="w-5 h-5" />
          Gizlilik ve Güvenlik Onayı Gerekli
        </CardTitle>
        <CardDescription>
          Sağlık verilerinizi işlemeden önce gizlilik politikamızı onaylamanız gerekiyor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Bu uygulama sağlık verilerinizi işler. Kullanmaya devam etmeden önce 
            aşağıdaki koşulları okuyup onaylamanız önemlidir.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div className="text-sm">
            <h4 className="font-medium mb-2">Önemli Bilgiler:</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Verileriniz şifrelenerek işlenir</li>
              <li>• 30 gün sonra otomatik olarak silinir</li>
              <li>• Sadece tahlil analizi için kullanılır</li>
              <li>• Tanı koyma amacı taşımaz</li>
              <li>• Doktor muayenesinin yerini tutmaz</li>
            </ul>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullNotice(!showFullNotice)}
              className="text-xs"
            >
              {showFullNotice ? (
                <>
                  <EyeOff className="w-3 h-3 mr-1" />
                  Gizle
                </>
              ) : (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  Detayları Görüntüle
                </>
              )}
            </Button>
          </div>

          {showFullNotice && (
            <div className="bg-muted/50 rounded-lg p-4 text-xs space-y-2">
              <div className="whitespace-pre-wrap leading-relaxed">
                {privacyManager.generatePrivacyNotice()}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button 
            onClick={handleAcceptConsent}
            className="flex-1"
            size="sm"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Kabul Ediyorum
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDeclineConsent}
            className="flex-1"
            size="sm"
          >
            Kabul Etmiyorum
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2">
          Kabul etmediğiniz takdirde uygulamayı kullanamazsınız.
        </div>
      </CardContent>
    </Card>
  );
};
