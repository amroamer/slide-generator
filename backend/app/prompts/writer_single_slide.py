"""Focused single-slide content generation prompt."""

import json


def build_single_slide_system_prompt(language: str, tone: str, audience: str) -> str:
    prompt = (
        "You are the Writer Agent for Slides Generator by KPMG. "
        "You are generating content for a SINGLE slide in a presentation. "
        "Return ONLY valid JSON with no markdown, no explanation."
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
        parts.append(f"\nRELEVANT DATA:\n{json.dumps(source_data, indent=2)[:2000]}")

    # Output schema
    parts.append(
        '\nReturn ONLY this JSON:\n'
        '{"slide_id": "' + slide_plan.get("slide_id", "sl1") + '", '
        '"title": "...", '
        '"body": {"type": "bullets", "content": ["Point 1", "Point 2"]}, '
        '"key_takeaway": "One key message", '
        '"speaker_notes": "Presenter guidance", '
    )

    if "chart" in (slide_plan.get("slide_type") or "").lower():
        parts.append(
            '"chart_data": {"chart_type": "bar|line|pie|donut", "labels": [...], '
            '"datasets": [{"label": "...", "values": [...]}]}, '
        )
    else:
        parts.append('"chart_data": null, ')

    if slide_plan.get("slide_type") in ("table", "comparison"):
        parts.append('"data_table": {"headers": [...], "rows": [[...]]}')
    else:
        parts.append('"data_table": null')

    parts.append("}")
    return "\n".join(parts)
