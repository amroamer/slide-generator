"""Focused single-slide content generation prompt."""

import json

from app.prompts.planner import DATA_INTEGRITY_RULES, WRITER_DATA_INTEGRITY_RULES, DATA_REINFORCEMENT


def get_output_format_for_slide_type(slide_type: str, slide_id: str = "sl1") -> str:
    """Return the exact JSON schema the LLM must produce for this slide_type."""
    if slide_type == "table":
        return (
            f'Return ONLY this JSON (no markdown, no code blocks):\n'
            f'{{"slide_id": "{slide_id}", '
            f'"title": "...", '
            f'"body": {{"type": "bullets", "content": ["One context sentence above the table"]}}, '
            f'"data_table": {{"headers": ["Col1", "Col2", "Col3", "Col4"], '
            f'"rows": [["val", "val", "val", "val"], ["val", "val", "val", "val"]]}}, '
            f'"chart_data": null, '
            f'"key_takeaway": "One sentence summary", '
            f'"speaker_notes": "..."}}\n\n'
            f"CRITICAL: You MUST include data_table with actual headers and rows from the source data.\n"
            f"- headers: array of column header strings\n"
            f"- rows: array of arrays — each inner array is one row matching header order\n"
            f"- Use ACTUAL values from the uploaded files — real names, numbers, dates, statuses\n"
            f"- Maximum 10 rows — show the most important ones\n"
            f"- Do NOT replace data_table with bullet points describing the data"
        )
    elif "chart" in (slide_type or ""):
        return (
            f'Return ONLY this JSON (no markdown, no code blocks):\n'
            f'{{"slide_id": "{slide_id}", '
            f'"title": "...", '
            f'"body": {{"type": "bullets", "content": ["One context sentence above the chart"]}}, '
            f'"chart_data": {{"chart_type": "bar", "labels": ["Label1", "Label2", "Label3"], '
            f'"datasets": [{{"label": "Series Name", "values": [100, 200, 300]}}]}}, '
            f'"data_table": null, '
            f'"key_takeaway": "One sentence insight", '
            f'"speaker_notes": "..."}}\n\n'
            f"CRITICAL: You MUST include chart_data with actual numeric values from the source data.\n"
            f"- chart_type: choose bar|horizontal_bar|pie|donut|line|area|gantt|timeline\n"
            f"  * Comparing categories → bar or horizontal_bar\n"
            f"  * Distribution/proportions → pie or donut\n"
            f"  * Trends over time → line\n"
            f"  * Schedules/durations → gantt\n"
            f"- labels: array of category names\n"
            f"- datasets: array of series, each with 'label' (string) and 'values' (array of numbers)\n"
            f"- labels array and values array MUST have the same length\n"
            f"- Use REAL numbers from the data. For percentages: use raw number (65 not '65%')\n"
            f"- Do NOT replace chart_data with bullet points describing the chart"
        )
    elif slide_type in ("comparison", "two_column"):
        return (
            f'Return ONLY this JSON (no markdown, no code blocks):\n'
            f'{{"slide_id": "{slide_id}", '
            f'"title": "...", '
            f'"body": {{"type": "bullets", "content": ["Context sentence"]}}, '
            f'"left_column": {{"heading": "Left Title", "items": ["Point 1", "Point 2"]}}, '
            f'"right_column": {{"heading": "Right Title", "items": ["Point 1", "Point 2"]}}, '
            f'"chart_data": null, "data_table": null, '
            f'"key_takeaway": "...", '
            f'"speaker_notes": "..."}}'
        )
    else:  # content, summary, section_divider, title
        return (
            f'Return ONLY this JSON (no markdown, no code blocks):\n'
            f'{{"slide_id": "{slide_id}", '
            f'"title": "...", '
            f'"body": {{"type": "bullets", "content": ["Bullet 1 with specific data", "Bullet 2", "Bullet 3"]}}, '
            f'"chart_data": null, "data_table": null, '
            f'"key_takeaway": "One sentence key message", '
            f'"speaker_notes": "..."}}'
        )


def build_single_slide_system_prompt(language: str, tone: str, audience: str) -> str:
    prompt = (
        "You are the Writer Agent for Slides Generator by KPMG. "
        "You are generating content for a SINGLE slide in a presentation. "
        "Return ONLY valid JSON with no markdown, no explanation."
        "\n\nCRITICAL RULES:"
        "\n- Use real values from the source data: exact names, numbers, percentages, dates, statuses."
        "\n- When slide_type is 'table': you MUST include a data_table field with headers and rows arrays containing actual data. Do NOT substitute bullet points."
        "\n- When slide_type is 'chart': you MUST include a chart_data field with chart_type, labels, and datasets arrays containing actual numbers. Do NOT substitute bullet points."
        "\n- A table slide without data_table, or a chart slide without chart_data, is a FAILURE."
        + DATA_INTEGRITY_RULES
        + WRITER_DATA_INTEGRITY_RULES
    )
    tone_map = {
        "Formal Board-Level": "\n\nTone: Use authoritative executive language. Lead with conclusions, support with data.",
        "Client-Facing Professional": "\n\nTone: Use professional advisory language. Be direct but diplomatic.",
        "Internal Working Session": "\n\nTone: Use clear operational language. Focus on status and next steps.",
    }
    prompt += tone_map.get(tone, "")
    prompt += f"\n\nThe audience is {audience}."

    if language == "arabic":
        prompt += "\n\nWrite ALL content in formal Modern Standard Arabic. Use proper administrative Arabic register."
    elif language == "bilingual":
        prompt += '\n\nProvide both English and Arabic versions: {"en": "...", "ar": "..."}.'

    return prompt


def build_single_slide_user_prompt(
    slide_plan: dict,
    section_title: str,
    section_purpose: str,
    source_data: dict | None,
    prev_summary: dict | None,
    next_title: str | None,
    original_prompt: str,
    slide_number: int,
    total_slides: int,
) -> str:
    parts = [
        f"Generate content for slide {slide_number} of {total_slides}.",
        f"\nPRESENTATION CONTEXT:\n{original_prompt}",
        f"\nSECTION: {section_title}\nPurpose: {section_purpose}",
        f"\nTHIS SLIDE:\nTitle: {slide_plan.get('slide_title')}\nType: {slide_plan.get('slide_type')}",
        f"Outline: {json.dumps(slide_plan.get('content_outline', []))}",
        f"Data references: {json.dumps(slide_plan.get('data_references', []))}",
    ]

    if prev_summary:
        parts.append(f"\nPREVIOUS SLIDE (continuity):\nTitle: {prev_summary.get('title')}\nTakeaway: {prev_summary.get('key_takeaway', 'N/A')}")

    if next_title:
        parts.append(f"\nNEXT SLIDE: {next_title}")

    if source_data:
        if "_parsed_text" in source_data:
            parts.append(
                "\nSOURCE DATA FROM UPLOADED FILES:\n"
                + source_data["_parsed_text"][:4000]
                + "\n\n" + DATA_REINFORCEMENT
            )
        else:
            parts.append(
                "\nSOURCE DATA FROM UPLOADED FILES:\n"
                + json.dumps(source_data, indent=2)[:4000]
                + "\n\n" + DATA_REINFORCEMENT
            )

    # Output format based on slide_type
    slide_type = slide_plan.get("slide_type", "content")
    slide_id = slide_plan.get("slide_id", "sl1")
    parts.append(f"\nREQUIRED OUTPUT FORMAT (slide_type = {slide_type}):")
    parts.append(get_output_format_for_slide_type(slide_type, slide_id))

    return "\n".join(parts)
