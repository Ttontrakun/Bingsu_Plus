from __future__ import annotations

import io
import os
from typing import Any

from dotenv import load_dotenv
import httpx
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

load_dotenv(".env.local")
load_dotenv()

app = FastAPI(title="ask_AA API", version="0.1.0")

cors_origins_env = os.getenv("CORS_ORIGINS", "")
cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
# Dev (port 3000) and prod (port 80 / nginx); add LAN IP in .env if needed (e.g. http://192.168.1.8)
dev_defaults = [
    "http://localhost:3000", "http://127.0.0.1:3000",
    "http://localhost", "http://127.0.0.1",
]
origins = list(dict.fromkeys([*cors_origins, *dev_defaults]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


LEGACY_API_URL = os.getenv("LEGACY_API_URL", "http://legacy:5050").rstrip("/")
DEFAULT_OCR_LANG = os.getenv("OCR_LANG", "th")
DEFAULT_OCR_MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "30"))
DEFAULT_OCR_DPI = int(os.getenv("OCR_DPI", "200"))
DEFAULT_OCR_USE_ANGLE_CLS = os.getenv("OCR_USE_ANGLE_CLS", "true").lower() == "true"
OCR_PROVIDER = (os.getenv("OCR_PROVIDER", "paddle") or "paddle").strip().lower()
TYPHOON_OCR_API_KEY = (os.getenv("TYPHOON_OCR_API_KEY", "") or "").strip()

_ocr_instance: Any | None = None
_ocr_lang: str | None = None


def _require_paddle_deps() -> tuple[Any, Any]:
    try:
        from paddleocr import PaddleOCR  # type: ignore
        import numpy as np  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "PaddleOCR dependencies are not installed. "
            "Run: pip install -r backend/requirements.txt"
        ) from e
    return PaddleOCR, np


def _require_pdf_image_deps() -> tuple[Any, Any]:
    try:
        import fitz  # PyMuPDF  # type: ignore
        from PIL import Image  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "PDF/Image dependencies are not installed. "
            "Run: pip install -r backend/requirements.txt"
        ) from e
    return fitz, Image


def get_ocr(lang: str) -> Any:
    global _ocr_instance, _ocr_lang
    normalized = (lang or DEFAULT_OCR_LANG or "th").strip() or "th"
    if _ocr_instance is None or _ocr_lang != normalized:
        # PaddleOCR will download models on first use (cached afterward).
        PaddleOCR, _np = _require_paddle_deps()
        _ocr_instance = PaddleOCR(lang=normalized, use_angle_cls=DEFAULT_OCR_USE_ANGLE_CLS)
        _ocr_lang = normalized
    return _ocr_instance


def _filter_outgoing_headers(headers: dict[str, str]) -> dict[str, str]:
    # Avoid hop-by-hop headers; let client/server manage those.
    hop_by_hop = {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "host",
        "content-length",
    }
    return {k: v for k, v in headers.items() if k.lower() not in hop_by_hop}


def _is_pdf(upload: UploadFile) -> bool:
    ct = (upload.content_type or "").lower()
    name = (upload.filename or "").lower()
    return ct == "application/pdf" or name.endswith(".pdf")


def _pil_from_pdf_page(page: Any, dpi: int) -> Any:
    fitz, Image = _require_pdf_image_deps()
    scale = max(72, dpi) / 72.0
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


def _run_ocr_on_image(ocr: Any, image: Any, use_angle_cls: bool) -> tuple[str, float | None, int]:
    _PaddleOCR, np = _require_paddle_deps()
    arr = np.array(image.convert("RGB"))
    results = ocr.ocr(arr, cls=use_angle_cls) or []
    lines: list[str] = []
    confidences: list[float] = []
    for item in results:
        if not item or len(item) < 2:
            continue
        rec = item[1]
        if not rec or len(rec) < 2:
            continue
        text = (rec[0] or "").strip()
        conf = rec[1]
        if text:
            lines.append(text)
            try:
                confidences.append(float(conf))
            except Exception:
                pass
    avg_conf = (sum(confidences) / len(confidences)) if confidences else None
    return "\n".join(lines).strip(), avg_conf, len(lines)

def _run_typhoon_ocr_on_image(image: Any) -> str:
    # typhoon-ocr expects a file path (PDF or image). We'll save a temporary PNG.
    # It calls OpenTyphoon OCR API (OpenAI-compatible) using TYPHOON_OCR_API_KEY or OPENAI_API_KEY.
    if TYPHOON_OCR_API_KEY:
        os.environ["TYPHOON_OCR_API_KEY"] = TYPHOON_OCR_API_KEY
    try:
        from tempfile import NamedTemporaryFile
        from typhoon_ocr import ocr_document
    except Exception as e:
        raise RuntimeError("typhoon-ocr is not installed. Run: pip install -r backend/requirements.txt") from e

    with NamedTemporaryFile(suffix=".png", delete=True) as tmp:
        image.convert("RGB").save(tmp.name, format="PNG")
        text = ocr_document(tmp.name)
        return (text or "").strip()


@app.post("/api/ocr/extract")
async def ocr_extract(
    file: UploadFile = File(...),
    lang: str = DEFAULT_OCR_LANG,
    max_pages: int = DEFAULT_OCR_MAX_PAGES,
    dpi: int = DEFAULT_OCR_DPI,
    use_angle_cls: bool = DEFAULT_OCR_USE_ANGLE_CLS,
) -> dict:
    data = await file.read()
    if not data:
        return {"ok": False, "error": "empty file"}

    provider = OCR_PROVIDER
    if provider not in ("paddle", "typhoon"):
        provider = "paddle"
    ocr = get_ocr(lang) if provider == "paddle" else None

    pages_out: list[dict] = []
    merged_parts: list[str] = []

    if _is_pdf(file):
        fitz, _Image = _require_pdf_image_deps()
        doc = fitz.open(stream=data, filetype="pdf")
        limit = max(1, min(int(max_pages), doc.page_count))
        for idx in range(limit):
            page = doc.load_page(idx)
            image = _pil_from_pdf_page(page, dpi=dpi)
            if provider == "typhoon":
                text = _run_typhoon_ocr_on_image(image)
                pages_out.append({"page": idx + 1, "text": text})
            else:
                text, avg_conf, line_count = _run_ocr_on_image(ocr, image, use_angle_cls=use_angle_cls)
                pages_out.append(
                    {
                        "page": idx + 1,
                        "text": text,
                        "lines": line_count,
                        "avgConfidence": avg_conf,
                    }
                )
            if text:
                merged_parts.append(text)
        doc.close()
    else:
        _fitz, Image = _require_pdf_image_deps()
        image = Image.open(io.BytesIO(data))
        if provider == "typhoon":
            text = _run_typhoon_ocr_on_image(image)
            pages_out.append({"page": 1, "text": text})
        else:
            text, avg_conf, line_count = _run_ocr_on_image(ocr, image, use_angle_cls=use_angle_cls)
            pages_out.append({"page": 1, "text": text, "lines": line_count, "avgConfidence": avg_conf})
        if text:
            merged_parts.append(text)

    merged_text = "\n\n".join(merged_parts).strip()
    return {
        "ok": True,
        "lang": (lang or DEFAULT_OCR_LANG or "th").strip() or "th",
        "pages": pages_out,
        "text": merged_text,
    }


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_to_legacy(path: str, request: Request) -> Response:
    """
    Temporary compatibility layer:
    - FastAPI will gradually replace the old Node/Express API.
    - Any /api/* route not yet implemented here is proxied to the legacy service.
    """

    upstream_url = f"{LEGACY_API_URL}/api/{path}"
    if request.url.query:
        upstream_url = f"{upstream_url}?{request.url.query}"

    body = await request.body()
    headers = _filter_outgoing_headers(dict(request.headers))
    # Legacy may expect Host; use the upstream host so it doesn't depend on client Host
    headers["Host"] = (LEGACY_API_URL or "").replace("https://", "").replace("http://", "").split("/")[0] or "legacy"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            upstream = await client.request(
                request.method,
                upstream_url,
                content=body if body else None,
                headers=headers,
            )
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
        return Response(
            content=b'{"error":"Legacy backend ไม่ตอบสนอง (เชื่อมต่อไม่ได้). ลองรอสักครู่แล้วรีเฟรช หรือตรวจสอบ Docker: legacy, postgres, redis, qdrant."}',
            status_code=503,
            media_type="application/json",
        )

    response_headers = _filter_outgoing_headers(dict(upstream.headers))
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )

