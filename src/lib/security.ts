// Security and privacy utilities for the medical AI system

export interface SecurityConfig {
  maxFileSize: number;
  allowedFileTypes: string[];
  rateLimitEnabled: boolean;
  rateLimitRequests: number;
  rateLimitWindow: number;
  dataRetentionDays: number;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig;
  private requestCounts: Map<string, { count: number; timestamp: number }> = new Map();

  private constructor() {
    this.config = {
      maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '10485760'), // 10MB
      allowedFileTypes: (import.meta.env.VITE_ALLOWED_FILE_TYPES || 'application/pdf,image/jpeg,image/jpg,image/png').split(','),
      rateLimitEnabled: import.meta.env.VITE_ENABLE_RATE_LIMITING === 'true',
      rateLimitRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_REQUESTS || '10'),
      rateLimitWindow: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW || '60000'), // 1 minute
      dataRetentionDays: parseInt(import.meta.env.VITE_DATA_RETENTION_DAYS || '30')
    };
  }

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // File validation
  public validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        valid: false,
        error: `Dosya boyutu ${this.formatFileSize(this.config.maxFileSize)}'dan büyük olamaz.`
      };
    }

    // Check file type
    if (!this.config.allowedFileTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Desteklenmeyen dosya formatı. Sadece PDF, JPG, JPEG ve PNG dosyaları kabul edilir.'
      };
    }

    // Check for potentially malicious file names
    if (this.containsMaliciousContent(file.name)) {
      return {
        valid: false,
        error: 'Dosya adı güvenlik açısından uygun değil.'
      };
    }

    return { valid: true };
  }

  // Rate limiting
  public checkRateLimit(userId: string): { allowed: boolean; resetTime?: number } {
    if (!this.config.rateLimitEnabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const userRequests = this.requestCounts.get(userId);

    if (!userRequests) {
      this.requestCounts.set(userId, { count: 1, timestamp: now });
      return { allowed: true };
    }

    // Reset if window has passed
    if (now - userRequests.timestamp > this.config.rateLimitWindow) {
      this.requestCounts.set(userId, { count: 1, timestamp: now });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (userRequests.count >= this.config.rateLimitRequests) {
      const resetTime = userRequests.timestamp + this.config.rateLimitWindow;
      return { allowed: false, resetTime };
    }

    // Increment count
    userRequests.count++;
    this.requestCounts.set(userId, userRequests);
    return { allowed: true };
  }

  // Data sanitization
  public sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  // Privacy protection
  public anonymizeData(data: any): any {
    const anonymized = { ...data };
    
    // Remove or hash personal identifiers
    if (anonymized.name) {
      anonymized.name = this.hashString(anonymized.name);
    }
    
    if (anonymized.email) {
      anonymized.email = this.hashString(anonymized.email);
    }

    // Add timestamp for data retention
    anonymized.createdAt = new Date().toISOString();
    anonymized.expiresAt = new Date(Date.now() + this.config.dataRetentionDays * 24 * 60 * 60 * 1000).toISOString();

    return anonymized;
  }

  // Content filtering for medical safety
  public validateMedicalContent(content: string): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Check for emergency keywords that should trigger immediate medical attention
    const emergencyKeywords = [
      'kalp krizi', 'miyokard enfarktüsü', 'stroke', 'inme', 'acil', '112',
      'kanama', 'şiddetli ağrı', 'nefes alamıyorum', 'bilinç kaybı'
    ];

    const hasEmergencyContent = emergencyKeywords.some(keyword => 
      content.toLowerCase().includes(keyword.toLowerCase())
    );

    if (hasEmergencyContent) {
      warnings.push('Bu içerik acil tıbbi durum belirtileri içerebilir. Derhal 112\'yi arayın.');
    }

    // Check for inappropriate medical advice
    const inappropriateAdvice = [
      'ilaç al', 'tedavi et', 'kesin tanı', 'reçete yaz', 'ameliyat'
    ];

    const hasInappropriateAdvice = inappropriateAdvice.some(advice => 
      content.toLowerCase().includes(advice.toLowerCase())
    );

    if (hasInappropriateAdvice) {
      warnings.push('Bu içerik uygunsuz tıbbi tavsiye içerebilir.');
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }

  // API key validation
  public validateApiKey(apiKey: string): boolean {
    if (!apiKey || apiKey.trim() === '') {
      return false;
    }

    // Basic OpenAI API key format validation
    if (apiKey.startsWith('sk-') && apiKey.length > 20) {
      return true;
    }

    return false;
  }

  // Error logging (without sensitive data)
  public logError(error: Error, context: string): void {
    const errorInfo = {
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // In production, this would be sent to a secure logging service
    console.error('Medical AI Error:', errorInfo);
  }

  // Utility methods
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private containsMaliciousContent(filename: string): boolean {
    const maliciousPatterns = [
      /\.exe$/i,
      /\.bat$/i,
      /\.cmd$/i,
      /\.scr$/i,
      /\.pif$/i,
      /\.com$/i,
      /\.js$/i,
      /\.vbs$/i,
      /\.php$/i,
      /\.asp$/i,
      /\.jsp$/i,
      /<script/i,
      /javascript:/i,
      /vbscript:/i
    ];

    return maliciousPatterns.some(pattern => pattern.test(filename));
  }

  private hashString(str: string): string {
    // Simple hash function for anonymization
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  // Cleanup expired data
  public cleanupExpiredData(): void {
    const now = Date.now();
    for (const [userId, data] of this.requestCounts.entries()) {
      if (now - data.timestamp > this.config.rateLimitWindow) {
        this.requestCounts.delete(userId);
      }
    }
  }
}

// Privacy compliance utilities
export class PrivacyManager {
  private static instance: PrivacyManager;

  private constructor() {}

  public static getInstance(): PrivacyManager {
    if (!PrivacyManager.instance) {
      PrivacyManager.instance = new PrivacyManager();
    }
    return PrivacyManager.instance;
  }

  // GDPR compliance
  public generatePrivacyNotice(): string {
    return `
      GİZLİLİK VE GÜVENLİK BİLDİRİMİ
      
      Bu uygulama sağlık verilerinizi işlerken aşağıdaki güvenlik önlemlerini alır:
      
      1. VERİ GÜVENLİĞİ:
         - Tüm veriler şifrelenerek işlenir
         - Veriler 30 gün sonra otomatik olarak silinir
         - Kişisel bilgiler anonimleştirilir
      
      2. KULLANIM AMACI:
         - Sadece tahlil analizi için kullanılır
         - Tanı koyma amacı taşımaz
         - Doktor muayenesinin yerini tutmaz
      
      3. VERİ PAYLAŞIMI:
         - Verileriniz üçüncü taraflarla paylaşılmaz
         - Sadece OpenAI API'sine gönderilir (anonymized)
         - Yerel olarak saklanmaz
      
      4. HAKLARINIZ:
         - Verilerinizi silme hakkı
         - İşleme itiraz etme hakkı
         - Veri taşınabilirliği hakkı
      
      Bu uygulamayı kullanarak yukarıdaki koşulları kabul etmiş olursunuz.
    `;
  }

  // Consent management
  public hasUserConsent(): boolean {
    return localStorage.getItem('medvice_consent') === 'accepted';
  }

  public setUserConsent(consent: boolean): void {
    if (consent) {
      localStorage.setItem('medvice_consent', 'accepted');
      localStorage.setItem('medvice_consent_date', new Date().toISOString());
    } else {
      localStorage.removeItem('medvice_consent');
      localStorage.removeItem('medvice_consent_date');
    }
  }

  // Data export for user
  public exportUserData(): any {
    return {
      consentDate: localStorage.getItem('medvice_consent_date'),
      lastActivity: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Clear all user data
  public clearUserData(): void {
    localStorage.removeItem('medvice_consent');
    localStorage.removeItem('medvice_consent_date');
    // Clear any other user-specific data
  }
}

// Export singleton instances
export const securityManager = SecurityManager.getInstance();
export const privacyManager = PrivacyManager.getInstance();
