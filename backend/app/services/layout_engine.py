"""Rule-based layout auto-assignment. No LLM call — runs instantly."""

import logging

logger = logging.getLogger(__name__)


def auto_assign_layout(slide_content: dict, slide_title: str = "") -> tuple[str, str]:
    """Return (layout, reason) for a single slide based on its content."""
    content = slide_content or {}
    title = (slide_title or content.get("title", "")).lower()
    body = content.get("body", {}) or {}
    body_content = body.get("content", []) if isinstance(body, dict) else []
    bullet_count = len(body_content) if isinstance(body_content, list) else 0
    has_takeaway = bool(content.get("key_takeaway"))

    chart_data = content.get("chart_data")
    has_chart = bool(chart_data and isinstance(chart_data, dict)
                     and chart_data.get("labels") and chart_data.get("datasets"))

    table_data = content.get("data_table")
    has_table = bool(table_data and isinstance(table_data, dict)
                     and table_data.get("headers") and table_data.get("rows"))

    slide_type = content.get("slide_type", "")

    # Title / cover / agenda
    if slide_type == "title" or any(kw in title for kw in ["title slide", "cover", "agenda"]):
        return "title_slide", "slide_type=title or title keyword"

    # Section dividers
    if slide_type == "section_divider" or any(kw in title for kw in [
        "q&a", "questions", "thank you", "appendix", "discussion",
    ]):
        return "section_divider", "section divider keyword"

    # Chart data takes priority
    if has_chart:
        return "title_chart", "has chart_data"

    # Table slides
    if has_table:
        return "title_table", "has data_table"

    # Comparison / SWOT
    if slide_type == "comparison" or any(kw in title for kw in [
        "comparison", " vs ", "versus", "swot", "pros and cons", "before after",
    ]):
        return "two_column", "comparison keyword"

    # Key takeaway with minimal bullets
    if has_takeaway and bullet_count <= 3:
        return "key_takeaway", "has takeaway with few bullets"

    # Default
    return "title_bullets", "default bullets"


def auto_assign_layouts(slides: list[dict]) -> list[dict]:
    """Assign layouts to all slides. Returns list of {slide_id, layout, reason}."""
    results = []
    for sl in slides:
        content = sl.get("content_json", {}) or {}
        title = sl.get("title", "")
        layout, reason = auto_assign_layout(content, title)
        results.append({
            "slide_id": sl.get("slide_id", ""),
            "layout": layout,
            "reason": reason,
        })
        logger.info("Layout %s → %s (%s)", sl.get("slide_id", "?"), layout, reason)
    return results
