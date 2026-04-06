import json
import logging

import pandas as pd
import pdfplumber

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".txt", ".pdf", ".json"}


def parse_file(file_path: str, filename: str) -> dict:
    """Route to the correct parser based on file extension."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        if ext == ".csv":
            return parse_csv(file_path, filename)
        if ext in (".xlsx", ".xls"):
            return parse_excel(file_path, filename)
        if ext == ".pdf":
            return parse_pdf(file_path, filename)
        if ext == ".json":
            return parse_json_file(file_path, filename)
        if ext == ".txt":
            return parse_text(file_path, filename)
        return {"type": "error", "filename": filename, "error": f"Unsupported extension: {ext}"}
    except Exception as e:
        logger.exception("Error parsing %s", filename)
        return {"type": "error", "filename": filename, "error": str(e)}


def _column_stats(df: pd.DataFrame) -> dict:
    """Compute per-column stats for a DataFrame."""
    stats = {}
    for col in df.columns:
        col_data = df[col]
        if pd.api.types.is_numeric_dtype(col_data):
            stats[col] = {
                "type": "numeric",
                "count": int(col_data.count()),
                "min": float(col_data.min()) if col_data.count() > 0 else None,
                "max": float(col_data.max()) if col_data.count() > 0 else None,
                "mean": round(float(col_data.mean()), 2) if col_data.count() > 0 else None,
            }
        else:
            stats[col] = {
                "type": "categorical",
                "count": int(col_data.count()),
                "unique": int(col_data.nunique()),
            }
    return stats


def _df_to_result(df: pd.DataFrame, filename: str, sheet_name: str | None = None) -> dict:
    """Convert a DataFrame to a parse result dict."""
    df = df.fillna("")
    sample = df.head(50)
    result = {
        "columns": list(df.columns),
        "row_count": len(df),
        "sample_rows": sample.to_dict(orient="records"),
        "stats": _column_stats(df),
    }
    if sheet_name is not None:
        result["sheet_name"] = sheet_name
    return result


def parse_csv(file_path: str, filename: str) -> dict:
    df = pd.read_csv(file_path)
    result = _df_to_result(df, filename)
    result.update({"type": "tabular", "filename": filename})
    return result


def parse_excel(file_path: str, filename: str) -> dict:
    sheets_dict = pd.read_excel(file_path, sheet_name=None)
    sheets = []
    for sheet_name, df in sheets_dict.items():
        sheets.append(_df_to_result(df, filename, sheet_name=str(sheet_name)))
    return {"type": "tabular", "filename": filename, "sheets": sheets}


def parse_pdf(file_path: str, filename: str) -> dict:
    text_parts = []
    page_count = 0
    with pdfplumber.open(file_path) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
    full_text = "\n\n".join(text_parts)
    return {
        "type": "text",
        "filename": filename,
        "page_count": page_count,
        "text_content": full_text,
        "char_count": len(full_text),
    }


def parse_text(file_path: str, filename: str) -> dict:
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    return {
        "type": "text",
        "filename": filename,
        "text_content": content,
        "char_count": len(content),
    }


def parse_json_file(file_path: str, filename: str) -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {
        "type": "structured",
        "filename": filename,
        "data": data,
    }
