import json

from app.prompts.planner import DATA_INTEGRITY_RULES, WRITER_DATA_INTEGRITY_RULES, DATA_REINFORCEMENT


def build_writer_system_prompt(language: str, tone: str, audience: str) -> str:
    prompt = (
        "You are the Writer Agent for Slides Generator by KPMG. "
        "You receive a presentation plan and source data. "
        "Generate the full text content for each slide. "
        "Return ONLY valid JSON with no markdown, no explanation."
        "\n\nDATA USAGE — CRITICAL RULES:"
        "\n- Your slide content MUST include real values from the data: exact names, numbers, percentages, dates, and statuses."
        "\n- Do NOT write 'the data shows...' or 'according to the file...' — present the actual data directly."
        "\n\nOUTPUT FORMAT RULES BASED ON SLIDE TYPE:"
        "\n"
        "\nWhen slide_type is 'table':"
        "\n  You MUST generate a data_table field with actual rows and columns from the source data."
        "\n  Do NOT write bullet points describing the table — generate the actual table structure."
        '\n  data_table: {"headers": ["Col1", "Col2"], "rows": [["val1", "val2"], ["val3", "val4"]]}'
        "\n  - Use ACTUAL data from the uploaded files — real names, numbers, dates, statuses"
        "\n  - Maximum 10 rows — show the most important ones"
        "\n"
        "\nWhen slide_type is 'chart':"
        "\n  You MUST generate a chart_data field with actual numeric values from the source data."
        "\n  Do NOT write bullet points describing what the chart should look like — generate the actual data."
        '\n  chart_data: {"chart_type": "bar", "labels": ["A", "B"], "datasets": [{"label": "Series", "values": [10, 20]}]}'
        "\n  - chart_type: bar|horizontal_bar|pie|donut|line|area|gantt|timeline"
        "\n  - labels array and values array MUST have the same length"
        "\n  - Use REAL numeric values from the data, not invented numbers"
        "\n"
        "\nWhen slide_type is 'comparison' or 'two_column':"
        "\n  Include left_column and right_column objects with heading and items."
        "\n"
        "\nFor ALL slide types: always include body.content with at least 1 context sentence."
        "\n"
        "\nCRITICAL: When slide_type is 'table', data_table MUST NOT be null."
        "\n          When slide_type is 'chart', chart_data MUST NOT be null."
        "\n          A table/chart slide with only bullet text is a FAILURE."
        + DATA_INTEGRITY_RULES
        + WRITER_DATA_INTEGRITY_RULES
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
    parsed_data_text: str | None = None,
) -> str:
    parts = []

    parts.append(f"ORIGINAL USER REQUEST:\n{original_prompt}")

    parts.append(f"\nAPPROVED PRESENTATION PLAN:\n{json.dumps(plan, indent=2)}")

    if parsed_data_text:
        parts.append(
            "\nSOURCE DATA FROM UPLOADED FILES:\n"
            + parsed_data_text
            + "\n\n" + DATA_REINFORCEMENT
        )
    elif data_summary and data_summary.get("files"):
        parts.append("\nSOURCE DATA FROM UPLOADED FILES:")
        for f in data_summary["files"]:
            fname = f.get("filename", "unknown")
            ftype = f.get("type", "unknown")
            if ftype == "tabular":
                if "sheets" in f:
                    for sheet in f["sheets"]:
                        cols = sheet.get("columns", [])
                        rows = sheet.get("sample_rows", [])[:30]
                        parts.append(f"  {fname} (sheet: {sheet.get('sheet_name', '?')}): columns={cols}")
                        if rows:
                            parts.append(f"  Data rows ({len(rows)}):")
                            for row in rows:
                                row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                                if row_parts:
                                    parts.append(f"    {' | '.join(row_parts)}")
                else:
                    cols = f.get("columns", [])
                    rows = f.get("sample_rows", [])[:30]
                    parts.append(f"  {fname}: columns={cols}")
                    if rows:
                        parts.append(f"  Data rows ({len(rows)}):")
                        for row in rows:
                            row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                            if row_parts:
                                parts.append(f"    {' | '.join(row_parts)}")
            elif ftype == "text":
                text = f.get("text_content", "")[:3000]
                parts.append(f"  {fname}: {text}")
            elif ftype == "structured":
                data_str = json.dumps(f.get("data", {}))[:3000]
                parts.append(f"  {fname}: {data_str}")

    parts.append(
        "\nGENERATE content for EVERY slide in the plan. Return JSON:\n"
        '{"slides": [<slide objects>]}\n\n'
        "Each slide object MUST include: slide_id, title, body, key_takeaway, speaker_notes, chart_data, data_table.\n\n"
        "OUTPUT FORMAT PER SLIDE TYPE:\n\n"
        "For slide_type 'content' or 'summary':\n"
        '  {"slide_id": "sl1", "title": "...", '
        '"body": {"type": "bullets", "content": ["Bullet 1", "Bullet 2"]}, '
        '"key_takeaway": "...", "speaker_notes": "...", "chart_data": null, "data_table": null}\n\n'
        "For slide_type 'table':\n"
        '  {"slide_id": "sl2", "title": "...", '
        '"body": {"type": "bullets", "content": ["Context sentence"]}, '
        '"data_table": {"headers": ["Col1", "Col2", "Col3"], "rows": [["val", "val", "val"], ["val", "val", "val"]]}, '
        '"key_takeaway": "...", "speaker_notes": "...", "chart_data": null}\n'
        "  - data_table MUST have actual data from uploaded files. Maximum 10 rows.\n"
        "  - A table slide with data_table: null is a FAILURE.\n\n"
        "For slide_type 'chart':\n"
        '  {"slide_id": "sl3", "title": "...", '
        '"body": {"type": "bullets", "content": ["Context sentence"]}, '
        '"chart_data": {"chart_type": "bar", "labels": ["A", "B"], "datasets": [{"label": "Series", "values": [10, 20]}]}, '
        '"key_takeaway": "...", "speaker_notes": "...", "data_table": null}\n'
        "  - chart_type: bar|horizontal_bar|pie|donut|line|area|gantt|timeline\n"
        "  - labels and values arrays MUST have the same length\n"
        "  - Use REAL numeric values from the data\n"
        "  - A chart slide with chart_data: null is a FAILURE.\n\n"
        "For slide_type 'comparison':\n"
        '  Include left_column and right_column: {"heading": "...", "items": ["...", "..."]}\n\n'
        "CRITICAL RULES:\n"
        "1. Generate content for EVERY slide_id in the plan.\n"
        "2. Use REAL data values from the source files.\n"
        "3. Every slide MUST have body.content with at least 1 sentence.\n"
        "4. Table slides MUST have data_table. Chart slides MUST have chart_data. This is NOT optional."
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
