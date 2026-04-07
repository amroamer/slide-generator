"""Convert uploaded files into human-readable text with actual cell values."""

import json
import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


class FileParserService:
    """Reads any uploaded file and converts it to a structured text summary
    that includes actual data values — not just column names and stats."""

    @staticmethod
    async def parse_file_to_text(file_path: str, max_rows: int = 50) -> str:
        ext = Path(file_path).suffix.lower()

        if ext in (".xlsx", ".xls"):
            return FileParserService._parse_excel(file_path, max_rows)
        elif ext == ".csv":
            return FileParserService._parse_csv(file_path, max_rows)
        elif ext in (".txt", ".md"):
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()[:5000]
        elif ext == ".json":
            with open(file_path, "r", encoding="utf-8") as f:
                return json.dumps(json.load(f), ensure_ascii=False, indent=2)[:5000]
        else:
            return f"[Unsupported file type: {ext}]"

    @staticmethod
    def _parse_excel(file_path: str, max_rows: int) -> str:
        all_sheets = pd.read_excel(file_path, sheet_name=None, dtype=str)
        output: list[str] = []
        for sheet_name, df in all_sheets.items():
            output.append(f"=== SHEET: {sheet_name} ===")
            output.extend(FileParserService._format_dataframe(df, max_rows))
        return "\n".join(output)

    @staticmethod
    def _parse_csv(file_path: str, max_rows: int) -> str:
        df = pd.read_csv(file_path, dtype=str)
        output = ["=== CSV DATA ==="]
        output.extend(FileParserService._format_dataframe(df, max_rows))
        return "\n".join(output)

    @staticmethod
    def _format_dataframe(df: pd.DataFrame, max_rows: int) -> list[str]:
        """Format a DataFrame into human-readable text with actual cell values."""
        df = df.fillna("")
        output: list[str] = []
        output.append(f"Rows: {len(df)}, Columns: {len(df.columns)}")
        output.append("COLUMNS: " + " | ".join(df.columns.tolist()))
        output.append("DATA:")
        for idx, row in df.head(max_rows).iterrows():
            row_parts = []
            for col in df.columns:
                val = row[col]
                if val is not None and str(val).strip():
                    row_parts.append(f"{col}: {val}")
            if row_parts:
                output.append(f"  Row {idx + 1}: {' | '.join(row_parts)}")
        if len(df) > max_rows:
            output.append(f"  ... ({len(df) - max_rows} more rows not shown)")

        # Value counts for categorical columns
        for col in df.columns:
            nunique = df[col].nunique()
            if 2 <= nunique <= 15:
                counts = df[col].value_counts()
                output.append(f"DISTRIBUTION - {col}:")
                for val, count in counts.items():
                    pct = count / len(df) * 100
                    output.append(f"  {val}: {count} ({pct:.0f}%)")
        return output


async def build_parsed_data_text(upload_dir: str) -> str:
    """Scan an upload directory and build a combined parsed text for all files."""
    import os

    if not os.path.exists(upload_dir):
        return ""

    sections: list[str] = []
    for name in sorted(os.listdir(upload_dir)):
        path = os.path.join(upload_dir, name)
        if os.path.isfile(path):
            try:
                file_text = await FileParserService.parse_file_to_text(path)
                sections.append(f"FILE: {name}\n{file_text}")
            except Exception as e:
                logger.warning("Failed to parse %s for text: %s", name, e)
                sections.append(f"FILE: {name}\n[Parse error: {e}]")

    result = "\n\n".join(sections)
    logger.info("Parsed data text length: %d chars", len(result))
    return result
