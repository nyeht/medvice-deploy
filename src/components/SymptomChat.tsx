import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Send,
  Bot,
  User,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";

import { createSession, assessmentInitial, chatSend } from "@/lib/gpt-api";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface PatientData {
  name: string;
  age: string;          // formdan string gelebilir
  gender: string;
  symptoms: string;
  duration: string;
  additionalInfo: string;
}

interface SymptomChatProps {
  patientData: PatientData;
  onBack: () => void;
}

export const SymptomChat = ({ patientData, onBack }: SymptomChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // yeni mesaj gelince scroll en alta
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // AI cevabı geldikten sonra input alanına otomatik focus
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      // Son mesaj assistant tarafından gönderilmişse ve loading bitmişse focus yap
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === "assistant") {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100); // Kısa bir gecikme ile focus yap
      }
    }
  }, [isLoading, messages]);

  // 1) session yoksa oluştur, 2) backend’den ilk mesajı çek
  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // localStorage’da sid yoksa oluştur (gpt-api zaten handle ediyor ama burada da garanti altına alıyoruz)
        if (!localStorage.getItem("sid")) {
          await createSession();
        }

        // backend promptları belirler; ham form verisini gönderiyoruz
        const initial = await assessmentInitial({
          name: patientData.name?.trim() || undefined,
          age: Number.parseInt(patientData.age) || undefined,
          gender: patientData.gender || undefined,
          symptoms: patientData.symptoms || undefined,
          duration: patientData.duration || undefined,
          extra_notes: patientData.additionalInfo || undefined,
        });

        setMessages([
          {
            id: Date.now().toString(),
            type: "assistant",
            content: initial.content,
            timestamp: new Date(),
          },
        ]);
        
        // İlk mesaj geldikten sonra input alanına focus yap
        setTimeout(() => {
          inputRef.current?.focus();
        }, 200);
      } catch (e: any) {
        console.error(e);
        setError(
          e?.message || "Sohbet başlatılırken bir hata oluştu. Lütfen tekrar deneyin."
        );
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientData]);

  // Kullanıcı mesajını Supabase'e kaydet
  const saveUserMessage = async (message: string) => {
    try {
      await supabase
        .from('chat_messages')
        .insert([{ user_message: message }]);
    } catch (error) {
      console.error('Mesaj kaydedilirken hata:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setError(null);

    // Kullanıcı mesajını Supabase'e kaydet
    await saveUserMessage(userMessage.content);

    try {
      // gpt-api chatSend session’ı içeriden yönetir
      const res = await chatSend(userMessage.content);

      const assistant: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: res.content,
        timestamp: new Date(),
      };

      if (res.auto_expert && res.expert) {
        const expertMsg: ChatMessage = {
          id: (Date.now() + 2).toString(),
          type: "assistant",
          content: res.expert,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistant, expertMsg]);
      } else {
        setMessages((prev) => [...prev, assistant]);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Mesaj gönderilirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-accent-light">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={onBack}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Geri Dön
            </Button>
            <Badge variant="outline">
              <MessageSquare className="w-3 h-3 mr-1" />
              AI Sağlık Danışmanı
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Patient Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                Hasta Özeti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Yaş:</span> {patientData.age}
                </div>
                <div>
                  <span className="font-medium">Cinsiyet:</span> {patientData.gender}
                </div>
                <div>
                  <span className="font-medium">Belirti Süresi:</span> {patientData.duration}
                </div>
              </div>
              <div className="mt-3 text-sm">
                <span className="font-medium">Ana Şikayet:</span> {patientData.symptoms}
              </div>
              {patientData.additionalInfo && (
                <div className="mt-2 text-sm">
                  <span className="font-medium">Ek Bilgiler:</span> {patientData.additionalInfo}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Messages */}
          <Card className="h-[500px] md:h-[600px] lg:h-[700px] mb-4">
            <CardContent className="p-0 h-full">
              <div className="h-full overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && isLoading && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                      <p className="text-muted-foreground">AI danışmanı hazırlanıyor...</p>
                    </div>
                  </div>
                )}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex gap-3 max-w-[80%] ${
                        message.type === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.type === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {message.type === "user" ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div
                        className={`rounded-lg p-3 ${
                          message.type === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                        <div
                          className={`text-xs mt-1 ${
                            message.type === "user"
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && messages.length > 0 && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="rounded-lg p-3 bg-muted">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Yazıyor...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Message Input */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Sorunuzu yazın... (Enter ile gönder)"
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!inputMessage.trim() || isLoading} size="icon">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {/* Important Notice */}
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Bu sohbet yalnızca bilgilendirme amaçlıdır ve doktor muayenesinin yerini tutmaz.
              Kesin tanı ve tedavi için mutlaka bir hekime başvurunuz.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
};