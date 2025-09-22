import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { uploadPDF, extractTextFromPDF } from "@/lib/gpt-api";

interface PdfUploadProps {
  onFileProcessed: (extractedText: string, fileName: string) => void;
  onError: (error: string) => void;
}

export const PdfUpload = ({ onFileProcessed, onError }: PdfUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      setError("Sadece PDF, JPG, JPEG ve PNG dosyaları desteklenir.");
      return;
    }

    // Validate file size
    if (file.size > maxFileSize) {
      setError("Dosya boyutu 10MB'dan büyük olamaz.");
      return;
    }

    setError(null);
    setUploadedFile(file);
    setIsProcessing(true);
    setProgress(0);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Simulate progress
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            if (progressInterval) clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Extract text via backend
      let extractedText: string;
      if (file.type === "application/pdf") {
        // PDF için backend'e gönder
        const result = await uploadPDF(file);
        if (result.success) {
          extractedText = result.extracted_text;
          console.log("📄 Extracted text (backend):", extractedText.slice(0, 200));
        } else {
          throw new Error(result.error || "PDF işleme hatası");
        }
      } else {
        // Diğer dosya türleri için fallback
        extractedText = await extractTextFromPDF(file);
        console.log("📄 Extracted text (fallback):", extractedText.slice(0, 200));
      }
      
      if (progressInterval) clearInterval(progressInterval);
      setProgress(100);

      // Small delay to show completion
      setTimeout(() => {
        onFileProcessed(extractedText, file.name);
        setIsProcessing(false);
      }, 300);
    } catch (err) {
      if (progressInterval) clearInterval(progressInterval);
      setIsProcessing(false);
      const errorMessage =
        err instanceof Error ? err.message : "Dosya işlenirken hata oluştu.";
      setError(errorMessage);
      onError(errorMessage);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Tahlil Raporu Yükle
          </CardTitle>
          <CardDescription>
            PDF, JPG, JPEG veya PNG formatında tahlil raponuzu yükleyin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {!uploadedFile ? (
              <>
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium">Dosyanızı buraya sürükleyin</p>
                  <p className="text-muted-foreground">veya tıklayarak seçin</p>
                  <p className="text-sm text-muted-foreground">Maksimum dosya boyutu: 10MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Dosya Seç
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                {isProcessing ? (
                  <>
                    <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
                    <div className="space-y-2">
                      <p className="text-lg font-medium">Dosya işleniyor...</p>
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground">{progress}% tamamlandı</p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-12 h-12 text-accent mx-auto" />
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-accent">Dosya başarıyla yüklendi</p>
                      <div className="bg-accent-light rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-accent" />
                          <span className="font-medium">{uploadedFile.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadedFile.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={removeFile}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Dosyayı Kaldır
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File Requirements Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">Desteklenen Dosya Formatları:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• PDF dosyaları (tahlil raporları)</li>
            <li>• JPG, JPEG, PNG görüntü dosyaları</li>
            <li>• Maksimum dosya boyutu: 10MB</li>
            <li>• Okunabilir, net görüntü kalitesi önerilir</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};