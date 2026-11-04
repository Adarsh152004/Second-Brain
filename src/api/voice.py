"""Voice endpoints - STT via Groq Whisper, TTS via gTTS."""
import io
import httpx
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from gtts import gTTS
from src.config.settings import settings
from src.utils.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


class TTSRequest(BaseModel):
    text: str


@router.post("/voice/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio via Groq Whisper API."""
    audio_bytes = await file.read()
    filename = file.filename or "recording.webm"
    content_type = file.content_type or "audio/webm"

    if settings.groq_api_key:
        try:
            headers = {"Authorization": f"Bearer {settings.groq_api_key}"}
            files_data = {"file": (filename, audio_bytes, content_type)}
            form_data = {"model": "whisper-large-v3-turbo", "response_format": "json"}
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers=headers,
                    files=files_data,
                    data=form_data,
                    timeout=30,
                )
                if resp.status_code == 200:
                    text = resp.json().get("text", "").strip()
                    logger.info(f"Transcribed: {text[:60]}")
                    return {"text": text}
                else:
                    logger.warning(f"Groq Whisper error {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.exception(f"Groq Whisper failed: {e}")

    raise HTTPException(status_code=500, detail="Voice transcription service unavailable")


@router.post("/voice/synthesize")
async def synthesize_speech(req: TTSRequest):
    """Convert text to speech via gTTS."""
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "Text cannot be empty")
    try:
        tts = gTTS(text=text, lang="en", slow=False)
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        buf.seek(0)
        return Response(content=buf.getvalue(), media_type="audio/mpeg")
    except Exception as e:
        logger.exception(f"TTS failed: {e}")
        raise HTTPException(500, "Speech synthesis failed")
