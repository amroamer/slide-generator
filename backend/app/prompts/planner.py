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


def build_structure_system_prompt(language: str, tone: str) -> str:
    """System prompt for Phase 1: structure-only generation."""
    prompt = (
        "You are the Planner Agent for Slides Generator by KPMG. "
        "Generate ONLY the high-level structure of the presentation. "
        "Do NOT generate detailed slide content — only section titles, slide counts, and slide types. "
        "You must return ONLY valid JSON with no markdown, no explanation, no preamble."
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
) -> str:
    """User prompt for Phase 1: generate only the section skeleton."""
    parts = []
    parts.append(f"USER REQUEST:\n{prompt}")

    # Abbreviated data summary — just filenames and key stats
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
                        parts.append(
                            f"  - {fname} (sheet: {sheet.get('sheet_name', '?')}): "
                            f"{rows} rows, columns: {cols}"
                        )
                else:
                    cols = f.get("columns", [])
                    rows = f.get("row_count", 0)
                    parts.append(f"  - {fname}: {rows} rows, columns: {cols}")
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
        parts.append(f"\nUPLOADED DATA:\n{data_context}")

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
