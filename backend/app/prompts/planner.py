import json


def build_planner_system_prompt(language: str, tone: str) -> str:
    prompt = (
        "You are the Planner Agent for Slides Generator by KPMG. "
        "You analyze the user's data and intent, then produce a structured presentation plan. "
        "You must return ONLY valid JSON with no markdown, no explanation, no preamble."
    )

    if language == "arabic":
        prompt += (
            "\n\nStructure all slide titles and outlines in formal Modern Standard Arabic "
            "suitable for government executive leadership."
        )
    elif language == "bilingual":
        prompt += (
            '\n\nStructure all slide titles and outlines in both English and Arabic. '
            'Use format: {"en": "...", "ar": "..."} for all text fields.'
        )

    tone_map = {
        "Formal Board-Level": (
            "Use strategic executive language, focus on decisions and outcomes. "
            "Structure content for board-level brevity and impact."
        ),
        "Client-Facing Professional": (
            "Use professional advisory language, focus on insights and recommendations. "
            "Structure content to guide client decision-making."
        ),
        "Internal Working Session": (
            "Use clear operational language, focus on status and actions. "
            "Structure content for working-level detail and next steps."
        ),
    }
    if tone in tone_map:
        prompt += f"\n\nTone guidance: {tone_map[tone]}"

    return prompt


def build_planner_user_prompt(
    prompt: str,
    data_summary: dict | None,
    audience: str,
    tone: str,
    slide_count: int,
    template_structure: dict | None = None,
) -> str:
    parts = []

    parts.append(f"USER REQUEST:\n{prompt}")

    # Data summary
    if data_summary and data_summary.get("files"):
        parts.append("\nDATA FILES PROVIDED:")
        for f in data_summary["files"]:
            fname = f.get("filename", "unknown")
            ftype = f.get("type", "unknown")
            if ftype == "tabular":
                if "sheets" in f:
                    for sheet in f["sheets"]:
                        cols = sheet.get("columns", [])
                        rows = sheet.get("row_count", 0)
                        stats = sheet.get("stats", {})
                        parts.append(
                            f"  - {fname} (sheet: {sheet.get('sheet_name', '?')}): "
                            f"{rows} rows, columns: {cols}"
                        )
                        for col, st in stats.items():
                            if st.get("type") == "numeric":
                                parts.append(
                                    f"    {col}: min={st.get('min')}, max={st.get('max')}, "
                                    f"mean={st.get('mean')}, count={st.get('count')}"
                                )
                            else:
                                parts.append(
                                    f"    {col}: {st.get('unique')} unique values, "
                                    f"count={st.get('count')}"
                                )
                else:
                    cols = f.get("columns", [])
                    rows = f.get("row_count", 0)
                    stats = f.get("stats", {})
                    parts.append(f"  - {fname}: {rows} rows, columns: {cols}")
                    for col, st in stats.items():
                        if st.get("type") == "numeric":
                            parts.append(
                                f"    {col}: min={st.get('min')}, max={st.get('max')}, "
                                f"mean={st.get('mean')}, count={st.get('count')}"
                            )
                        else:
                            parts.append(
                                f"    {col}: {st.get('unique')} unique values, "
                                f"count={st.get('count')}"
                            )
            elif ftype == "text":
                chars = f.get("char_count", 0)
                pages = f.get("page_count")
                desc = f"  - {fname}: {chars} characters"
                if pages:
                    desc += f", {pages} pages"
                parts.append(desc)
                text_preview = f.get("text_content", "")[:500]
                if text_preview:
                    parts.append(f"    Preview: {text_preview}")
            elif ftype == "structured":
                parts.append(f"  - {fname}: structured JSON data")
                data_str = json.dumps(f.get("data", {}))[:500]
                parts.append(f"    Preview: {data_str}")

    parts.append(f"\nCONFIGURATION:")
    parts.append(f"  Target audience: {audience or 'General'}")
    parts.append(f"  Tone: {tone or 'Professional'}")
    parts.append(f"  Target slide count: {slide_count}")

    if template_structure:
        parts.append(
            f"\nTEMPLATE STRUCTURE (use as starting framework, adapt based on data):\n"
            f"{json.dumps(template_structure, indent=2)}"
        )

    parts.append(
        "\nRETURN the presentation plan as JSON with this exact schema:\n"
        '{"sections": [{"section_id": "s1", "section_title": "...", '
        '"section_purpose": "...", "slides": [{"slide_id": "sl1", '
        '"slide_title": "...", "slide_type": "title|content|chart|table|comparison|summary|section_divider", '
        '"content_outline": ["bullet 1", "bullet 2", "..."], '
        '"data_references": ["filename.csv:column_name"], '
        '"speaker_notes_hint": "..."}]}]}'
    )

    return "\n".join(parts)
