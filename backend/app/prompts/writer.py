import json


def build_writer_system_prompt(language: str, tone: str, audience: str) -> str:
    prompt = (
        "You are the Writer Agent for Slides Generator by KPMG. "
        "You receive a presentation plan and source data. "
        "Generate the full text content for each slide. "
        "Return ONLY valid JSON with no markdown, no explanation."
    )

    tone_map = {
        "Formal Board-Level": (
            "Use authoritative executive language. Lead with conclusions, support with data. "
            "Every bullet should drive a decision."
        ),
        "Client-Facing Professional": (
            "Use professional advisory language. Balance insights with actionable recommendations. "
            "Be direct but diplomatic."
        ),
        "Internal Working Session": (
            "Use clear operational language. Focus on status, blockers, and next steps. Be concise."
        ),
    }
    if tone in tone_map:
        prompt += f"\n\nTone: {tone_map[tone]}"

    prompt += f"\n\nThe audience is {audience}. Calibrate detail level, terminology, and context accordingly."

    if language == "arabic":
        prompt += (
            "\n\nWrite ALL content in formal Modern Standard Arabic (\u0641\u0635\u062d\u0649) "
            "suitable for Saudi government executive leadership. "
            "Use proper administrative Arabic register. Never use colloquial expressions. "
            "Use Arabic numerals. Maintain consistent terminology throughout."
        )
    elif language == "bilingual":
        prompt += (
            '\n\nFor EVERY text field, provide both English and Arabic versions in format '
            '{"en": "...", "ar": "..."}. '
            "Arabic must be formal MSA suitable for government contexts."
        )

    return prompt


def build_writer_user_prompt(
    plan: dict,
    data_summary: dict | None,
    original_prompt: str,
) -> str:
    parts = []

    parts.append(f"ORIGINAL USER REQUEST:\n{original_prompt}")

    parts.append(f"\nAPPROVED PRESENTATION PLAN:\n{json.dumps(plan, indent=2)}")

    if data_summary and data_summary.get("files"):
        parts.append("\nSOURCE DATA:")
        for f in data_summary["files"]:
            fname = f.get("filename", "unknown")
            ftype = f.get("type", "unknown")
            if ftype == "tabular":
                if "sheets" in f:
                    for sheet in f["sheets"]:
                        cols = sheet.get("columns", [])
                        rows = sheet.get("sample_rows", [])[:20]
                        parts.append(f"  {fname} (sheet: {sheet.get('sheet_name', '?')}): columns={cols}")
                        if rows:
                            parts.append(f"  Sample rows ({len(rows)}):")
                            for row in rows[:10]:
                                parts.append(f"    {json.dumps(row)}")
                else:
                    cols = f.get("columns", [])
                    rows = f.get("sample_rows", [])[:20]
                    parts.append(f"  {fname}: columns={cols}")
                    if rows:
                        parts.append(f"  Sample rows ({len(rows)}):")
                        for row in rows[:10]:
                            parts.append(f"    {json.dumps(row)}")
            elif ftype == "text":
                text = f.get("text_content", "")[:1000]
                parts.append(f"  {fname}: {text}")
            elif ftype == "structured":
                data_str = json.dumps(f.get("data", {}))[:1000]
                parts.append(f"  {fname}: {data_str}")

    parts.append(
        "\nGENERATE content for EVERY slide in the plan. Return JSON with this exact schema:\n"
        '{"slides": [{"slide_id": "sl1", "title": "...", '
        '"body": {"type": "bullets|paragraphs|data_narrative", "content": ["line 1", "line 2"]}, '
        '"key_takeaway": "One sentence key message", '
        '"speaker_notes": "Detailed notes for the presenter...", '
        '"data_table": {"headers": ["Col A", "Col B"], "rows": [["val1", "val2"]]} or null, '
        '"chart_data": {"chart_type": "bar|line|pie|donut|area", "labels": ["Label1", "Label2"], '
        '"datasets": [{"label": "Series Name", "values": [10, 20]}]} or null}]}\n\n'
        "CRITICAL RULES:\n"
        "1. You MUST generate content for EVERY slide_id in the plan.\n"
        "2. Use REAL data values from the source files, not placeholder values.\n"
        "3. Every slide MUST have body.content with at least 2 bullet points.\n\n"
        "CRITICAL CHART DATA RULES:\n"
        "- Look at each slide's slide_type in the plan. If slide_type contains 'chart', "
        "you MUST generate a chart_data object. This is NOT optional.\n"
        "- Even for slides with slide_type 'content' or 'table', if the data would be "
        "better visualized as a chart, include chart_data as well.\n"
        "- Analyze the uploaded data and create meaningful chart visualizations:\n"
        "  * Comparing categories (e.g., KPIs by status): use 'pie' or 'donut'\n"
        "  * Comparing values across categories (e.g., target vs actual): use 'bar' with multiple datasets\n"
        "  * Showing trends over time: use 'line'\n"
        "  * Showing composition/parts of a whole: use 'pie' or 'donut'\n"
        "- chart_data MUST follow this EXACT structure — no deviations:\n"
        '  {"chart_type": "bar", "labels": ["Label1", "Label2"], '
        '"datasets": [{"label": "Series Name", "values": [100, 200]}]}\n'
        "- labels array and each dataset's values array MUST have the same length.\n"
        "- Use REAL numeric values from the uploaded data. Never use 0 or null.\n"
        "- Every slide with slide_type 'chart' that has chart_data: null in your response is a FAILURE.\n\n"
        "TABLE DATA RULES:\n"
        "- For slides showing tabular comparisons: include data_table with headers and rows.\n"
        "- Use real data from the source files."
    )

    return "\n".join(parts)


def build_slide_refine_prompt(
    slide_content: dict,
    user_instruction: str,
    prev_slide_title: str | None,
    next_slide_title: str | None,
) -> str:
    return (
        f"CURRENT SLIDE CONTENT:\n{json.dumps(slide_content, indent=2)}\n\n"
        f"PREVIOUS SLIDE TITLE: {prev_slide_title or 'N/A'}\n"
        f"NEXT SLIDE TITLE: {next_slide_title or 'N/A'}\n\n"
        f"USER INSTRUCTION: {user_instruction}\n\n"
        "Return the updated slide as a single JSON object matching the original slide schema. "
        "Keep the same slide_id."
    )
