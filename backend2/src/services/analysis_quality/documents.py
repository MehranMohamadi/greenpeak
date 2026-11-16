"""Text-only research imports; source publication is always reviewed separately."""
import base64
import binascii
from io import BytesIO


def extract_document(filename, data_base64):
    try:
        data = base64.b64decode(data_base64, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("Invalid document encoding") from None
    if len(data) > 5_000_000:
        raise ValueError("Document must be smaller than 5 MB")
    extension = filename.rsplit(".", 1)[-1].lower()
    if extension in {"txt", "md"}:
        text = data.decode("utf-8-sig")
    elif extension == "pdf":
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError
        try:
            reader = PdfReader(BytesIO(data))
            if reader.is_encrypted or len(reader.pages) > 100:
                raise ValueError("Use an unencrypted PDF of at most 100 pages")
            parts, length, readable = [], 0, 0
            for index, page in enumerate(reader.pages):
                part = page.extract_text() or ""
                length += len(part)
                readable += len(part.strip())
                if length > 200000:
                    raise ValueError("Extracted document exceeds 200000 characters")
                parts.append(f"[Page {index + 1}]\n{part}")
            text = "\n\n".join(parts)
            if readable < 80:
                raise ValueError("Scanned or empty PDF needs OCR before import")
        except PdfReadError:
            raise ValueError("PDF text could not be extracted") from None
    else:
        raise ValueError("Supported documents: PDF, UTF-8 TXT, Markdown")
    if len(text.strip()) < 80 or len(text) > 200000:
        raise ValueError("Document needs 80-200000 readable characters; scanned PDF needs OCR first")
    return {"content": text, "filename": filename}
