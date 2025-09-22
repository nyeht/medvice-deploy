# app/services/pdf_service.py
import PyPDF2
import io
from typing import Optional

def extract_text_from_pdf(file_content: bytes) -> str:
    """
    PDF dosyasından text çıkarır.
    """
    try:
        pdf_file = io.BytesIO(file_content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            text += page.extract_text() + "\n"
        
        return text.strip()
    
    except Exception as e:
        raise Exception(f"PDF okuma hatası: {str(e)}")

def extract_text_from_upload(file_content: bytes, filename: str) -> str:
    """
    Yüklenen dosyadan text çıkarır (PDF için).
    """
    if not filename.lower().endswith('.pdf'):
        raise Exception("Sadece PDF dosyaları desteklenir")
    
    return extract_text_from_pdf(file_content)
