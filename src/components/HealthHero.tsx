import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  Heart, 
  Brain, 
  FileText, 
  AlertTriangle, 
  Stethoscope,
  Shield,
  Clock,
  Users
} from "lucide-react";

const HealthHero = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-accent-light">
      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img 
                src="/medvice.png" 
                alt="Medvice Logo" 
                className="h-12 w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-accent font-medium">
                <Shield className="w-3 h-3 mr-1" />
                Güvenli & Gizli
              </Badge>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <Badge className="mb-6 bg-accent text-white border-accent/20">
            <Heart className="w-4 h-4 mr-2" />
            Sağlık Danışmanlığı AI Sistemi
          </Badge>
          <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
            Sağlık Sorularınıza 
            <span className="text-primary block mt-2">Akıllı Yanıtlar</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Belirtilerinizi değerlendirin, tahlil sonuçlarınızı analiz edin ve 
            sağlığınız hakkında bilinçli kararlar alın. 7/24 yapay zeka desteği.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              variant="hero" 
              size="xl"
              asChild
            >
              <Link to="/belirti-degerlendirme">
                <Brain className="w-5 h-5 mr-2" />
                Belirti Değerlendirmesi Başlat
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="xl"
              asChild
            >
              <Link to="/tahlil-analizi">
                <FileText className="w-5 h-5 mr-2" />
                Tahlil Analizi
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card className="p-8 text-center hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-secondary/50">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Belirti Değerlendirme</h3>
            <p className="text-muted-foreground mb-4">
              Aşamalı soru-cevap sistemi ile belirtilerinizi profesyonel şekilde değerlendirin
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Detaylı anamnez</li>
              <li>• Risk faktörü analizi</li>
              <li>• Aciliyet değerlendirmesi</li>
            </ul>
          </Card>

          <Card className="p-8 text-center hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-secondary/50">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Tahlil Analizi</h3>
            <p className="text-muted-foreground mb-4">
              Kan, idrar ve diğer tahlil sonuçlarınızı anlayın ve yorumlayın
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Normal değer karşılaştırması</li>
              <li>• Yaşam tarzı önerileri</li>
              <li>• Uzman yönlendirmesi</li>
            </ul>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">7/24</div>
            <div className="text-sm text-muted-foreground">Kesintisiz Hizmet</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent mb-2">3 Dakika</div>
            <div className="text-sm text-muted-foreground">Ortalama Yanıt Süresi</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">%99</div>
            <div className="text-sm text-muted-foreground">Güvenlik Oranı</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent mb-2">50+</div>
            <div className="text-sm text-muted-foreground">Hastalık Kategorisi</div>
          </div>
        </div>

        {/* Important Notice */}
        <Card className="p-8 bg-warning-light border-warning/30">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-warning-foreground mb-2">Önemli Uyarı</h3>
              <p className="text-warning-foreground leading-relaxed">
                Bu sistem tanı koymaz ve doktor muayenesinin yerini tutmaz. 
                Sunulan bilgiler yalnızca bilgilendirme amaçlıdır. 
                Kesin tanı ve tedavi için mutlaka bir sağlık kuruluşuna başvurunuz. 
                Acil durumlarda 112'yi arayın.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default HealthHero;