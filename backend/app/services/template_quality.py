"""Compute parsing status, content slot counts, quality scores, and usability flags for template variations."""

import logging

logger = logging.getLogger("template_quality")


def compute_variation_metrics(objects_json: dict | None) -> dict:
    """Compute parsing status, slot counts, and quality score for a template variation."""
    if not objects_json:
        return {
            "parsing_status": {
                "overall": "failed",
                "total_objects": 0,
                "total_parsed": 0,
                "total_failed": 0,
                "text": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
                "shapes": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
                "images": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
                "tables": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
                "charts": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
                "groups": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
            },
            "content_slots": {
                "total": 0,
                "title_slots": 0,
                "subtitle_slots": 0,
                "body_slots": 0,
                "item_slots": 0,
                "label_slots": 0,
                "date_slots": 0,
                "slots": [],
            },
            "usability": "not_parsed",
            "quality_score": 0,
            "quality_breakdown": {},
        }

    objects = objects_json.get("objects", [])

    # === PARSING STATUS ===
    parsing = {
        "text": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
        "shapes": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
        "images": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
        "tables": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
        "charts": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
        "groups": {"count": 0, "parsed": 0, "failed": 0, "status": "none", "details": []},
    }

    def _analyze_object(obj: dict) -> None:
        obj_type = obj.get("object_type", obj.get("type", "unknown"))
        obj_name = obj.get("object_name", obj.get("name", "Unknown"))

        if obj_type in ("text_box", "placeholder"):
            parsing["text"]["count"] += 1
            if obj.get("text_frames") or obj.get("text_content") is not None:
                parsing["text"]["parsed"] += 1
            else:
                parsing["text"]["failed"] += 1
                parsing["text"]["details"].append(f"{obj_name}: text frame not extracted")

        elif obj_type in ("auto_shape", "freeform", "line"):
            parsing["shapes"]["count"] += 1
            pos = obj.get("position", {})
            has_position = (pos.get("width_emu", 0) > 0) or (pos.get("width", 0) > 0)
            if has_position:
                parsing["shapes"]["parsed"] += 1
            else:
                parsing["shapes"]["failed"] += 1
                parsing["shapes"]["details"].append(f"{obj_name}: position/dimensions not extracted")

        elif obj_type == "picture":
            parsing["images"]["count"] += 1
            img_data = obj.get("image_data", {})
            if img_data and (img_data.get("image_base64") or img_data.get("image_saved_path") or img_data.get("base64")):
                parsing["images"]["parsed"] += 1
            elif img_data and img_data.get("content_type"):
                parsing["images"]["parsed"] += 1
                parsing["images"]["details"].append(f"{obj_name}: metadata only, image data not stored")
            else:
                parsing["images"]["failed"] += 1
                parsing["images"]["details"].append(f"{obj_name}: image extraction failed")

        elif obj_type == "table":
            parsing["tables"]["count"] += 1
            table_data = obj.get("table_data", {})
            if table_data and table_data.get("rows", 0) > 0 and table_data.get("cells"):
                parsing["tables"]["parsed"] += 1
            else:
                parsing["tables"]["failed"] += 1
                parsing["tables"]["details"].append(f"{obj_name}: table structure not extracted")

        elif obj_type == "chart":
            parsing["charts"]["count"] += 1
            chart_data = obj.get("chart_data", {})
            if chart_data and chart_data.get("chart_type"):
                parsing["charts"]["parsed"] += 1
            else:
                parsing["charts"]["failed"] += 1
                parsing["charts"]["details"].append(f"{obj_name}: chart data not extracted")

        elif obj_type == "group":
            parsing["groups"]["count"] += 1
            children = obj.get("group_children", [])
            if children and len(children) > 0:
                parsing["groups"]["parsed"] += 1
                for child in children:
                    _analyze_object(child)
            else:
                parsing["groups"]["failed"] += 1
                parsing["groups"]["details"].append(f"{obj_name}: group children not extracted")

    for obj in objects:
        _analyze_object(obj)

    # Set status per category
    for category in parsing.values():
        if category["count"] == 0:
            category["status"] = "none"
        elif category["failed"] == 0:
            category["status"] = "success"
        elif category["parsed"] > 0:
            category["status"] = "partial"
        else:
            category["status"] = "failed"

    total_objects = sum(c["count"] for c in parsing.values())
    total_parsed = sum(c["parsed"] for c in parsing.values())
    total_failed = sum(c["failed"] for c in parsing.values())

    if total_objects == 0:
        overall_status = "empty"
    elif total_failed == 0:
        overall_status = "success"
    elif total_parsed > total_failed:
        overall_status = "partial"
    else:
        overall_status = "failed"

    # === CONTENT SLOTS ===
    content_slots_data = {
        "total": 0,
        "title_slots": 0,
        "subtitle_slots": 0,
        "body_slots": 0,
        "item_slots": 0,
        "label_slots": 0,
        "date_slots": 0,
        "slots": [],
    }

    # Check design_json content_slots if passed through objects_json
    if "content_slots" in objects_json:
        for slot in objects_json.get("content_slots", []):
            slot_type = slot.get("slot_type", "item")
            content_slots_data["total"] += 1
            key = f"{slot_type}_slots"
            if key in content_slots_data:
                content_slots_data[key] += 1
            else:
                content_slots_data["item_slots"] += 1
            content_slots_data["slots"].append(slot)

    # Also scan objects for placeholder-like text
    counted_indices = {s.get("shape_index") for s in content_slots_data["slots"]}
    for obj in objects:
        obj_id = obj.get("object_id", obj.get("id"))
        if obj_id in counted_indices:
            continue
        if obj.get("is_placeholder"):
            content_slots_data["total"] += 1
            content_slots_data["item_slots"] += 1
            content_slots_data["slots"].append({
                "slot_type": "item",
                "shape_index": obj_id,
                "placeholder_text": (obj.get("text_content") or "")[:50],
                "source": "placeholder_detection",
            })

    # === USABILITY CLASSIFICATION ===
    if content_slots_data["total"] == 0:
        usability = "decorative_only"
    elif content_slots_data["title_slots"] == 0 and content_slots_data["item_slots"] == 0:
        usability = "limited"
    elif content_slots_data["total"] >= 3 and content_slots_data["title_slots"] >= 1:
        usability = "fully_usable"
    elif content_slots_data["total"] >= 1:
        usability = "partially_usable"
    else:
        usability = "unknown"

    # === QUALITY SCORE (0-100) ===
    quality_breakdown = {}
    score = 0

    # Parsing success (0-30 points)
    if total_objects > 0:
        parse_ratio = total_parsed / total_objects
        parse_points = int(parse_ratio * 30)
    else:
        parse_points = 0
    quality_breakdown["parsing"] = {"points": parse_points, "max": 30, "detail": f"{total_parsed}/{total_objects} objects parsed"}
    score += parse_points

    # Content slots (0-30 points)
    slot_count = content_slots_data["total"]
    if slot_count >= 5:
        slot_points = 30
    elif slot_count >= 3:
        slot_points = 25
    elif slot_count >= 1:
        slot_points = 15
    else:
        slot_points = 0
    if content_slots_data["title_slots"] >= 1:
        slot_points = min(30, slot_points + 5)
    quality_breakdown["content_slots"] = {"points": slot_points, "max": 30, "detail": f"{slot_count} slots detected"}
    score += slot_points

    # Colors extracted (0-20 points)
    color_count = len(objects_json.get("color_palette", []))
    if color_count >= 4:
        color_points = 20
    elif color_count >= 2:
        color_points = 15
    elif color_count >= 1:
        color_points = 10
    else:
        color_points = 0
    quality_breakdown["colors"] = {"points": color_points, "max": 20, "detail": f"{color_count} colors extracted"}
    score += color_points

    # Fonts detected (0-10 points)
    font_count = len(objects_json.get("font_inventory", []))
    if font_count >= 2:
        font_points = 10
    elif font_count >= 1:
        font_points = 7
    else:
        font_points = 0
    quality_breakdown["fonts"] = {"points": font_points, "max": 10, "detail": f"{font_count} fonts detected"}
    score += font_points

    # Visual complexity bonus (0-10 points)
    has_variety = sum([
        parsing["text"]["count"] > 0,
        parsing["shapes"]["count"] > 0,
        parsing["images"]["count"] > 0,
        parsing["tables"]["count"] > 0,
        parsing["charts"]["count"] > 0,
    ])
    variety_points = min(10, has_variety * 3)
    quality_breakdown["variety"] = {"points": variety_points, "max": 10, "detail": f"{has_variety} object types present"}
    score += variety_points

    return {
        "parsing_status": {
            "overall": overall_status,
            "total_objects": total_objects,
            "total_parsed": total_parsed,
            "total_failed": total_failed,
            "text": dict(parsing["text"]),
            "shapes": dict(parsing["shapes"]),
            "images": dict(parsing["images"]),
            "tables": dict(parsing["tables"]),
            "charts": dict(parsing["charts"]),
            "groups": dict(parsing["groups"]),
        },
        "content_slots": content_slots_data,
        "usability": usability,
        "quality_score": min(100, score),
        "quality_breakdown": quality_breakdown,
    }
