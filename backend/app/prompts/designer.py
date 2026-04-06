import json


def build_designer_system_prompt(language: str) -> str:
    prompt = (
        "You are the Designer Agent for Slides Generator by KPMG. "
        "You receive slide content metadata and must select ONE optimal visual layout for each slide. "
        "Return ONLY valid JSON with no markdown, no explanation.\n\n"
        "Follow these layout assignment rules strictly:\n"
        "- has_chart=true → ALWAYS use 'title_chart'\n"
        "- has_table=true and has_chart=false → ALWAYS use 'title_table'\n"
        "- slide_type contains 'title' → use 'title_slide'\n"
        "- slide_type contains 'divider' → use 'section_divider'\n"
        "- slide_type contains 'summary' or has_key_takeaway=true → use 'key_takeaway'\n"
        "- slide_type contains 'comparison' → use 'two_column'\n"
        "- Otherwise → use 'title_bullets'\n"
        "Each slide gets exactly ONE layout value, never pipe-separated options."
    )
    if language in ("arabic", "bilingual"):
        prompt += (
            "\n\nLayouts must account for RTL text direction. "
            "Place primary content on the right side for two-column layouts."
        )
    return prompt


def build_designer_user_prompt(slides: list[dict], brand_profile: dict | None = None) -> str:
    parts = [f"SLIDES TO DESIGN:\n{json.dumps(slides, indent=2)}"]

    if brand_profile:
        parts.append(f"\nBRAND PROFILE:\n{json.dumps(brand_profile, indent=2)}")

    parts.append(
        "\nFor EACH slide, select exactly ONE layout. "
        "Return JSON:\n"
        '{"slides": [{"slide_id": "sl1", '
        '"layout": "title_bullets", '
        '"layout_config": {"title_position": "top", '
        '"content_alignment": "left", '
        '"accent_color_usage": "header_bar"}}]}'
    )
    return "\n".join(parts)
