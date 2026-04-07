import json

# Shared anti-hallucination rules — appended to all agent system prompts
DATA_INTEGRITY_RULES = """
DATA INTEGRITY — ZERO HALLUCINATION RULES:
These rules are MANDATORY and override all other instructions when there is a conflict.

RULE 1 — EXACT VALUES ONLY:
Every name, label, title, category, number, date, percentage, and status in your response
must be copied character-by-character from the uploaded source data. If a value does not
appear in the source data, it must not appear in your response.

RULE 2 — NO INVENTION:
Do not invent, fabricate, create, or infer any value not explicitly present in the source data.
- Do not create group names or category labels that don't exist as values in a column.
- Do not create project names, phase names, or workstream names unless they appear in the data.
- Do not create summary labels to replace actual row values.
- Do not infer relationships between rows unless a column explicitly defines that relationship.

RULE 3 — NO MODIFICATION:
Do not rename, abbreviate, translate, paraphrase, merge, or reword any value from the source
data. Use the exact string as it appears in the data.

RULE 4 — NO UNSUPPORTED GROUPING:
Do not group, merge, or categorize rows unless the grouping already exists as a column in the
source data. You may group by exact values of an existing column, but you may not create new
categories that don't exist in any column.

RULE 5 — EXACT NUMBERS:
Use exact numbers from the data. Do not round, estimate, average, or recalculate values.
If the data says 65%, use 65% — not "about 60%" or "nearly 70%".

RULE 6 — MISSING DATA:
If a value is missing, empty, or null in the source data, represent it as "N/A" or
"غير متوفر" in Arabic. Do not guess or fill in a plausible value.

RULE 7 — SELF-CHECK:
Before finalizing your response, verify every name, label, and number against the source data.
If a value does not appear in the uploaded data — remove it and replace with one that does.
"""

# Additional rules specific to the Writer Agent
WRITER_DATA_INTEGRITY_RULES = """
ADDITIONAL DATA INTEGRITY RULES FOR CONTENT GENERATION:
- For TABLE slides: every cell value in data_table.rows must be directly copied from the source
  data. Do not rewrite, summarize, or abbreviate any cell. Use exact column headers from the
  source as table headers.
- For CHART slides: labels must be exact values from a column in the source data. Numeric data
  must be exact counts or values computed from the source — not LLM estimates. If you count
  occurrences of a category, count them precisely.
- For CONTENT slides: when citing a specific item, person, date, or metric, use the exact
  string as it appears in the source data.
- If the plan's content_outline references a term that does not exist in the source data,
  ignore that term and use real values from the data instead.
- When listing items, use the actual individual values from the data — do not merge multiple
  items into a single summary statement.
"""

# Reinforcement text appended after data sections in user prompts
DATA_REINFORCEMENT = (
    "Every value in your response must come directly from the data above. "
    "Do not add any name, category, number, or label that does not exist in the data above."
)


def build_planner_system_prompt(language: str, tone: str) -> str:
    prompt = (
        "You are the Planner Agent for Slides Generator by KPMG. "
        "You analyze the user's data and intent, then produce a structured presentation plan. "
        "You must return ONLY valid JSON with no markdown, no explanation, no preamble."
        "\n\nDATA USAGE — CRITICAL RULES:"
        "\n- You will receive actual data extracted from the user's uploaded files below the user's request."
        "\n- You MUST use specific values, names, numbers, dates, and statuses from the provided data in your slide titles and content outlines."
        "\n- Every content_outline item must reference real data points found in the uploaded data — not generic placeholders."
        "\n- BAD example: 'Display the status of key tasks' — this is a description, not content."
        "\n- GOOD example: Use the actual task names, owner names, completion percentages, and status values from the data."
        "\n- If the data contains status categories, count them and include the actual counts and percentages."
        "\n- If the data contains dates, reference the actual dates and any variances."
        "\n- If the data contains names of people, projects, or items — use those exact names in your output."
        "\n- Do NOT generalize, summarize, or paraphrase the data into vague descriptions. Present the real data."
        + DATA_INTEGRITY_RULES
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
    parsed_data_text: str | None = None,
) -> str:
    parts = []

    parts.append(f"USER REQUEST:\n{prompt}")

    # Data — prefer parsed_data_text (has actual cell values)
    if parsed_data_text:
        parts.append(
            "\nACTUAL DATA FROM UPLOADED FILES:\n"
            + parsed_data_text
            + "\n\n" + DATA_REINFORCEMENT
        )
    elif data_summary and data_summary.get("files"):
        parts.append("\nACTUAL DATA FROM UPLOADED FILES — Use these exact values in your plan:")
        for f in data_summary["files"]:
            fname = f.get("filename", "unknown")
            ftype = f.get("type", "unknown")
            if ftype == "tabular":
                if "sheets" in f:
                    for sheet in f["sheets"]:
                        cols = sheet.get("columns", [])
                        rows = sheet.get("row_count", 0)
                        sample_rows = sheet.get("sample_rows", [])
                        parts.append(
                            f"  - {fname} (sheet: {sheet.get('sheet_name', '?')}): "
                            f"{rows} rows, columns: {cols}"
                        )
                        if sample_rows:
                            parts.append(f"  Data rows:")
                            for row in sample_rows[:30]:
                                row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                                if row_parts:
                                    parts.append(f"    {' | '.join(row_parts)}")
                else:
                    cols = f.get("columns", [])
                    rows = f.get("row_count", 0)
                    sample_rows = f.get("sample_rows", [])
                    parts.append(f"  - {fname}: {rows} rows, columns: {cols}")
                    if sample_rows:
                        parts.append(f"  Data rows:")
                        for row in sample_rows[:30]:
                            row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                            if row_parts:
                                parts.append(f"    {' | '.join(row_parts)}")
            elif ftype == "text":
                chars = f.get("char_count", 0)
                pages = f.get("page_count")
                desc = f"  - {fname}: {chars} characters"
                if pages:
                    desc += f", {pages} pages"
                parts.append(desc)
                text_preview = f.get("text_content", "")[:2000]
                if text_preview:
                    parts.append(f"    {text_preview}")
            elif ftype == "structured":
                parts.append(f"  - {fname}: structured JSON data")
                data_str = json.dumps(f.get("data", {}))[:2000]
                parts.append(f"    {data_str}")
        parts.append(
            "\n" + DATA_REINFORCEMENT
        )

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
        "\n\nDATA INTEGRITY CHECK FOR YOUR OUTPUT:"
        "\n- Every value in slide_title must exist in the uploaded data."
        "\n- Every value in content_outline items must reference values from the uploaded data."
        "\n- If you cannot find a value in the data to support a content_outline item, do not include that item."
    )

    return "\n".join(parts)


def build_structure_system_prompt(language: str, tone: str) -> str:
    """System prompt for Phase 1: structure-only generation."""
    prompt = (
        "You are the Planner Agent for Slides Generator by KPMG. "
        "Generate ONLY the high-level structure of the presentation. "
        "Do NOT generate detailed slide content — only section titles, slide counts, and slide types. "
        "You must return ONLY valid JSON with no markdown, no explanation, no preamble."
        "\n\nSection titles should reflect the actual data provided — use specific names, "
        "categories, and topics from the uploaded files, not generic titles."
    )

    if language == "arabic":
        prompt += (
            "\n\nStructure all section titles in formal Modern Standard Arabic "
            "suitable for government executive leadership."
        )
    elif language == "bilingual":
        prompt += (
            '\n\nStructure all section titles in both English and Arabic. '
            'Use format: {"en": "...", "ar": "..."} for text fields.'
        )

    tone_map = {
        "Formal Board-Level": (
            "Use strategic executive language. "
            "Structure sections for board-level brevity and impact."
        ),
        "Client-Facing Professional": (
            "Use professional advisory language. "
            "Structure sections to guide client decision-making."
        ),
        "Internal Working Session": (
            "Use clear operational language. "
            "Structure sections for working-level detail and next steps."
        ),
    }
    if tone in tone_map:
        prompt += f"\n\nTone guidance: {tone_map[tone]}"

    return prompt


def build_structure_user_prompt(
    prompt: str,
    data_summary: dict | None,
    audience: str,
    tone: str,
    slide_count: int,
    parsed_data_text: str | None = None,
) -> str:
    """User prompt for Phase 1: generate only the section skeleton."""
    parts = []
    parts.append(f"USER REQUEST:\n{prompt}")

    # Include actual data so the LLM can create data-specific section titles
    if parsed_data_text:
        parts.append(
            "\nACTUAL DATA FROM UPLOADED FILES:\n" + parsed_data_text[:3000]
        )
    elif data_summary and data_summary.get("files"):
        parts.append("\nDATA FILES PROVIDED:")
        for f in data_summary["files"]:
            fname = f.get("filename", "unknown")
            ftype = f.get("type", "unknown")
            if ftype == "tabular":
                if "sheets" in f:
                    for sheet in f["sheets"]:
                        cols = sheet.get("columns", [])
                        rows = sheet.get("row_count", 0)
                        sample_rows = sheet.get("sample_rows", [])
                        parts.append(
                            f"  - {fname} (sheet: {sheet.get('sheet_name', '?')}): "
                            f"{rows} rows, columns: {cols}"
                        )
                        for row in sample_rows[:10]:
                            row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                            if row_parts:
                                parts.append(f"    {' | '.join(row_parts)}")
                else:
                    cols = f.get("columns", [])
                    rows = f.get("row_count", 0)
                    sample_rows = f.get("sample_rows", [])
                    parts.append(f"  - {fname}: {rows} rows, columns: {cols}")
                    for row in sample_rows[:10]:
                        row_parts = [f"{k}: {v}" for k, v in row.items() if v not in (None, "", "nan")]
                        if row_parts:
                            parts.append(f"    {' | '.join(row_parts)}")
            elif ftype == "text":
                chars = f.get("char_count", 0)
                parts.append(f"  - {fname}: {chars} characters")
            elif ftype == "structured":
                parts.append(f"  - {fname}: structured JSON data")

    parts.append(f"\nCONFIGURATION:")
    parts.append(f"  Target audience: {audience or 'General'}")
    parts.append(f"  Tone: {tone or 'Professional'}")
    parts.append(f"  Target slide count: {slide_count}")

    parts.append(
        "\nRETURN ONLY the presentation structure as JSON with this exact schema:\n"
        '{"title": "Specific Presentation Title with Topic and Date", '
        '"sections": [{"section_id": "s1", "section_title": "Section Name", '
        '"section_purpose": "Why this section matters", '
        '"slide_count": 2, '
        '"slide_types": ["summary", "chart"]}]}'
        "\n\nRULES:"
        f"\n- Total slides across all sections must equal exactly {slide_count}"
        "\n- Create 3-5 sections"
        "\n- Each section has 1-4 slides"
        '\n- First section must be "Executive Summary" or similar overview'
        '\n- Last section must be "Recommendations" or "Next Steps"'
        "\n- slide_types: choose from summary, content, chart, table, comparison, section_divider"
        "\n- section_purpose: one sentence explaining why the audience needs this section"
    )

    return "\n".join(parts)


def build_section_detail_system_prompt(language: str, tone: str) -> str:
    """System prompt for Phase 2: section detail generation."""
    prompt = (
        "You are the Planner Agent for Slides Generator by KPMG. "
        "You are generating detailed slides for ONE section of a presentation. "
        "Generate ONLY the slides for the specified section. "
        "You must return ONLY valid JSON with no markdown, no explanation, no preamble."
        "\n\nDATA USAGE — CRITICAL RULES:"
        "\n- Use specific values, names, numbers, dates, and statuses from the provided data."
        "\n- Every content_outline item must reference real data points — not generic placeholders."
        "\n- Slide titles must include actual data (e.g., specific names, numbers, percentages)."
        "\n- Do NOT generalize or paraphrase data into vague descriptions. Present the real data."
        + DATA_INTEGRITY_RULES
    )

    if language == "arabic":
        prompt += (
            "\n\nAll slide titles and outlines must be in formal Modern Standard Arabic "
            "suitable for government executive leadership."
        )
    elif language == "bilingual":
        prompt += (
            '\n\nAll slide titles and outlines must be in both English and Arabic. '
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


def build_section_detail_user_prompt(
    presentation_title: str,
    section_number: int,
    total_sections: int,
    section_title: str,
    section_purpose: str,
    slide_count: int,
    slide_types: list[str],
    previous_sections_summary: str,
    upcoming_sections_summary: str,
    data_context: str,
    next_slide_id_start: int,
) -> str:
    """User prompt for Phase 2: generate detailed slides for one section."""
    parts = []

    parts.append(f"PRESENTATION: {presentation_title}")
    parts.append(
        f'THIS SECTION: Section {section_number} of {total_sections}: "{section_title}"'
    )
    parts.append(f"PURPOSE: {section_purpose}")
    parts.append(
        f"SLIDES NEEDED: {slide_count} slides with types: {', '.join(slide_types)}"
    )

    if previous_sections_summary:
        parts.append(
            f"\nCONTEXT — Previous sections already planned:\n{previous_sections_summary}"
        )

    if upcoming_sections_summary:
        parts.append(
            f"\nCONTEXT — Upcoming sections:\n{upcoming_sections_summary}"
        )

    if data_context:
        parts.append(
            "\nACTUAL DATA FROM UPLOADED FILES:\n"
            + data_context
            + "\n\n" + DATA_REINFORCEMENT
        )

    # Build expected slide IDs
    slide_ids = [f"sl{next_slide_id_start + i}" for i in range(slide_count)]

    parts.append(
        f"\nGenerate EXACTLY {slide_count} slides for this section. "
        "Respond with ONLY valid JSON:\n"
        '{"slides": [{"slide_id": "' + slide_ids[0] + '", '
        '"slide_title": "Specific Title with Data Points", '
        '"slide_type": "expected_type", '
        '"content_outline": ['
        '"Specific point 1 with real data from the uploaded files", '
        '"Specific point 2 with comparison or trend", '
        '"Specific point 3 with actionable insight"], '
        '"data_references": ["filename:sheet"], '
        '"speaker_notes_hint": "What to emphasize"}]}'
    )

    parts.append(
        "\nRULES:"
        "\n- Use SPECIFIC data from the uploaded files — include actual numbers, percentages, names"
        "\n- Do NOT repeat content from previous sections"
        "\n- Each content_outline item must be a complete, specific statement"
        '\n- slide_title must include data (e.g., "Revenue: SAR 52.3M, +4.6%" not "Revenue Overview")'
        f"\n- Use these slide_ids in order: {', '.join(slide_ids)}"
        f"\n- Use these slide_types in order: {', '.join(slide_types)}"
    )

    return "\n".join(parts)
