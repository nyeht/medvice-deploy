from openai import OpenAI
from app.settings import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)

def complete(system: str, user: str, model: str | None = None, temperature: float = 0.2) -> str:
    """
    Basit chat completion. Stream gerekirse burada genişletebilirsin.
    """
    response = client.chat.completions.create(
        model=model or settings.OPENAI_MODEL,
        temperature=temperature,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return response.choices[0].message.content.strip()