"""Seed all system default prompts into the prompt_configs table."""

import asyncio
import json
import uuid

from sqlalchemy import text

# Adjust path so we can import app modules
import sys
sys.path.insert(0, "/app")

from app.database import async_session_factory


PROMPTS = [
    # ── PLANNER AGENT ─────────────────────────────────────────────────────
    {
        "prompt_key": "planner.system",
        "category": "planner",
        "display_name": "Planner Agent — System Prompt",
        "description": "Core system instructions for the Planner Agent. Defines role, output format, and behavior.",
        "prompt_text": "You are the Planner Agent for Slides Generator by KPMG. You analyze the user's data and intent, then produce a structured presentation plan. You must return ONLY valid JSON with no markdown, no explanation, no preamble.",
        "variables": {},
        "sort_order": 1,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.system.lang.arabic",
        "category": "planner",
        "display_name": "Planner — Arabic Language Addon",
        "description": "Appended to planner system prompt when language is Arabic.",
        "prompt_text": "Structure all slide titles and outlines in formal Modern Standard Arabic suitable for government executive leadership.",
        "variables": {},
        "sort_order": 2,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.system.lang.bilingual",
        "category": "planner",
        "display_name": "Planner — Bilingual Language Addon",
        "description": "Appended to planner system prompt when language is Bilingual.",
        "prompt_text": 'Structure all slide titles and outlines in both English and Arabic. Use format: {"en": "...", "ar": "..."} for all text fields.',
        "variables": {},
        "sort_order": 3,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.system.tone.formal_board",
        "category": "planner",
        "display_name": "Planner — Formal Board-Level Tone",
        "description": "Tone guidance appended when tone is Formal Board-Level.",
        "prompt_text": "Tone guidance: Use strategic executive language, focus on decisions and outcomes. Structure content for board-level brevity and impact.",
        "variables": {},
        "sort_order": 4,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.system.tone.client_facing",
        "category": "planner",
        "display_name": "Planner — Client-Facing Tone",
        "description": "Tone guidance for client-facing presentations.",
        "prompt_text": "Tone guidance: Use professional advisory language, focus on insights and recommendations. Structure content to guide client decision-making.",
        "variables": {},
        "sort_order": 5,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.system.tone.internal_working",
        "category": "planner",
        "display_name": "Planner — Internal Working Tone",
        "description": "Tone guidance for internal working sessions.",
        "prompt_text": "Tone guidance: Use clear operational language, focus on status and actions. Structure content for working-level detail and next steps.",
        "variables": {},
        "sort_order": 6,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.user",
        "category": "planner",
        "display_name": "Planner Agent — User Prompt Template",
        "description": "Template for the user message sent to the Planner Agent. Variables are filled by the system.",
        "prompt_text": "USER REQUEST:\n{prompt}\n\n{data_files_section}\n\nCONFIGURATION:\n  Target audience: {audience}\n  Tone: {tone}\n  Target slide count: {slide_count}\n\n{template_section}",
        "variables": {"prompt": "User's presentation request", "data_files_section": "Formatted data summary (auto-generated)", "audience": "Target audience", "tone": "Presentation tone", "slide_count": "Target number of slides", "template_section": "Template structure if selected"},
        "sort_order": 7,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.user.schema",
        "category": "planner",
        "display_name": "Planner — Output Schema",
        "description": "JSON schema appended to planner user prompt defining the expected output structure. Edit with caution.",
        "prompt_text": 'RETURN the presentation plan as JSON with this exact schema:\n{"sections": [{"section_id": "s1", "section_title": "...", "section_purpose": "...", "slides": [{"slide_id": "sl1", "slide_title": "...", "slide_type": "title|content|chart|table|comparison|summary|section_divider", "content_outline": ["bullet 1", "bullet 2", "..."], "data_references": ["filename.csv:column_name"], "speaker_notes_hint": "..."}]}]}',
        "variables": {},
        "sort_order": 8,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.refine_slide.system",
        "category": "planner",
        "display_name": "Planner — Slide Refinement System",
        "description": "System prompt for refining a single slide in the plan.",
        "prompt_text": "You are the Planner Agent. Refine the given slide based on the user's instruction. Return ONLY the updated slide as valid JSON matching the original slide schema.",
        "variables": {},
        "sort_order": 9,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.refine_slide.user",
        "category": "planner",
        "display_name": "Planner — Slide Refinement User",
        "description": "User prompt for slide refinement with context.",
        "prompt_text": "CURRENT SLIDE:\n{slide_json}\n\nPREVIOUS SLIDE TITLE: {prev_title}\nNEXT SLIDE TITLE: {next_title}\n\nUSER INSTRUCTION: {instruction}\n\nReturn the updated slide JSON only.",
        "variables": {"slide_json": "Current slide JSON", "prev_title": "Previous slide title", "next_title": "Next slide title", "instruction": "User's refinement instruction"},
        "sort_order": 10,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.refine_section.system",
        "category": "planner",
        "display_name": "Planner — Section Refinement System",
        "description": "System prompt for refining an entire section.",
        "prompt_text": "You are the Planner Agent. Refine the given section based on the user's instruction. Return ONLY the updated section as valid JSON matching the original section schema.",
        "variables": {},
        "sort_order": 11,
        "seed_version": 1,
    },
    {
        "prompt_key": "planner.refine_section.user",
        "category": "planner",
        "display_name": "Planner — Section Refinement User",
        "description": "User prompt for section refinement.",
        "prompt_text": "CURRENT SECTION:\n{section_json}\n\nUSER INSTRUCTION: {instruction}\n\nReturn the updated section JSON with the same section_id.",
        "variables": {"section_json": "Current section JSON", "instruction": "User's instruction"},
        "sort_order": 12,
        "seed_version": 1,
    },
    # ── WRITER AGENT ──────────────────────────────────────────────────────
    {
        "prompt_key": "writer.system",
        "category": "writer",
        "display_name": "Writer Agent — System Prompt",
        "description": "Core system instructions for the Writer Agent.",
        "prompt_text": "You are the Writer Agent for Slides Generator by KPMG. You receive a presentation plan and source data. Generate the full text content for each slide. Return ONLY valid JSON with no markdown, no explanation.\n\nThe audience is {audience}. Calibrate detail level, terminology, and context accordingly.",
        "variables": {"audience": "Target audience"},
        "sort_order": 1,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.system.tone.formal_board",
        "category": "writer",
        "display_name": "Writer — Formal Board-Level Tone",
        "description": "Tone guidance for formal board-level writing.",
        "prompt_text": "Tone: Use authoritative executive language. Lead with conclusions, support with data. Every bullet should drive a decision.",
        "variables": {},
        "sort_order": 2,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.system.tone.client_facing",
        "category": "writer",
        "display_name": "Writer — Client-Facing Tone",
        "description": "Tone guidance for client-facing writing.",
        "prompt_text": "Tone: Use professional advisory language. Balance insights with actionable recommendations. Be direct but diplomatic.",
        "variables": {},
        "sort_order": 3,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.system.tone.internal_working",
        "category": "writer",
        "display_name": "Writer — Internal Working Tone",
        "description": "Tone guidance for internal working session writing.",
        "prompt_text": "Tone: Use clear operational language. Focus on status, blockers, and next steps. Be concise.",
        "variables": {},
        "sort_order": 4,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.system.lang.arabic",
        "category": "writer",
        "display_name": "Writer — Arabic Language",
        "description": "Instructions for formal Arabic content generation.",
        "prompt_text": "Write ALL content in formal Modern Standard Arabic (\u0641\u0635\u062d\u0649) suitable for Saudi government executive leadership. Use proper administrative Arabic register. Never use colloquial expressions. Use Arabic numerals. Maintain consistent terminology throughout.",
        "variables": {},
        "sort_order": 5,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.system.lang.bilingual",
        "category": "writer",
        "display_name": "Writer — Bilingual Language",
        "description": "Instructions for bilingual (English + Arabic) content.",
        "prompt_text": 'For EVERY text field, provide both English and Arabic versions in format {"en": "...", "ar": "..."}. Arabic must be formal MSA suitable for government contexts.',
        "variables": {},
        "sort_order": 6,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.user.schema",
        "category": "writer",
        "display_name": "Writer — Output Schema & Rules",
        "description": "Output schema and generation rules for the Writer Agent. Edit with caution.",
        "prompt_text": 'GENERATE content for EVERY slide in the plan. Return JSON with this exact schema:\n{"slides": [{"slide_id": "sl1", "title": "...", "body": {"type": "bullets|paragraphs|data_narrative", "content": ["line 1", "line 2"]}, "key_takeaway": "One sentence key message", "speaker_notes": "Detailed notes for the presenter...", "data_table": {"headers": ["Col A", "Col B"], "rows": [["val1", "val2"]]} or null, "chart_data": {"chart_type": "bar|line|pie|donut|area", "labels": ["Label1", "Label2"], "datasets": [{"label": "Series Name", "values": [10, 20]}]} or null}]}\n\nCRITICAL RULES:\n1. You MUST generate content for EVERY slide_id in the plan.\n2. Use REAL data values from the source files, not placeholder values.\n3. Every slide MUST have body.content with at least 2 bullet points.\n\nCRITICAL CHART DATA RULES:\n- If slide_type contains \'chart\', you MUST generate chart_data. This is NOT optional.\n- chart_data MUST have chart_type, labels array, and datasets array with real numeric values.\n- labels and values arrays MUST have the same length.\n- Every slide with slide_type \'chart\' that has chart_data: null is a FAILURE.',
        "variables": {},
        "sort_order": 8,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.refine.user",
        "category": "writer",
        "display_name": "Writer — Slide Refinement",
        "description": "User prompt for refining a single slide's content.",
        "prompt_text": "CURRENT SLIDE CONTENT:\n{slide_json}\n\nPREVIOUS SLIDE TITLE: {prev_title}\nNEXT SLIDE TITLE: {next_title}\n\nUSER INSTRUCTION: {instruction}\n\nReturn the updated slide as a single JSON object matching the original slide schema. Keep the same slide_id.",
        "variables": {"slide_json": "Current slide JSON", "prev_title": "Previous slide title", "next_title": "Next slide title", "instruction": "User's instruction"},
        "sort_order": 9,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.alternatives.system",
        "category": "writer",
        "display_name": "Writer — Alternatives System",
        "description": "System prompt for generating alternative slide versions.",
        "prompt_text": "You are the Writer Agent. Generate 3 alternative versions of the given slide. Return ONLY valid JSON.",
        "variables": {},
        "sort_order": 10,
        "seed_version": 1,
    },
    {
        "prompt_key": "writer.alternatives.user",
        "category": "writer",
        "display_name": "Writer — Alternatives User",
        "description": "User prompt for generating alternatives.",
        "prompt_text": 'CURRENT SLIDE:\n{slide_json}\n\nGenerate 3 alternatives with different approaches:\nVersion A \u2014 Concise Executive: shorter, conclusion-first, max 3 bullets\nVersion B \u2014 Data-Driven: specific numbers, metrics, percentages\nVersion C \u2014 Narrative: storytelling approach, context and implications\n\nReturn: {"alternatives": [{"version": "A", "label": "Concise Executive", "title": "...", "body": {"type": "bullets", "content": [...]}, "key_takeaway": "...", "speaker_notes": "..."}]}',
        "variables": {"slide_json": "Current slide content JSON"},
        "sort_order": 11,
        "seed_version": 1,
    },
    # ── DESIGNER AGENT ────────────────────────────────────────────────────
    {
        "prompt_key": "designer.redesign.system",
        "category": "designer",
        "display_name": "Designer — Redesign System",
        "description": "System prompt for AI-powered slide design refinement.",
        "prompt_text": "You are the Designer Agent. Redesign the layout for this single slide. Return ONLY valid JSON with slide_id, layout, and layout_config.",
        "variables": {},
        "sort_order": 1,
        "seed_version": 1,
    },
    {
        "prompt_key": "designer.redesign.user",
        "category": "designer",
        "display_name": "Designer — Redesign User",
        "description": "User prompt for slide design refinement.",
        "prompt_text": "CURRENT SLIDE:\n  slide_id: {slide_id}\n  title: {title}\n  current_layout: {current_layout}\n  current_config: {current_config}\n\nUSER INSTRUCTION: {instruction}\n\nReturn: {{\"slide_id\": \"{slide_id}\", \"layout\": \"...\", \"layout_config\": {{...}}}}",
        "variables": {"slide_id": "Slide ID", "title": "Slide title", "current_layout": "Current layout", "current_config": "Current config JSON", "instruction": "User's instruction"},
        "sort_order": 2,
        "seed_version": 1,
    },
    # ── QUICK ACTIONS — PLANNER ───────────────────────────────────────────
    {"prompt_key": "qa.planner.data_driven", "category": "quick_action.planner", "display_name": "Data-driven", "description": "Restructure slide to reference specific metrics and KPIs.", "prompt_text": "Restructure this slide to be data-driven. Reference specific metrics, numbers, and KPIs from the uploaded data. Replace vague statements with concrete data points.", "icon_name": "chart-bar", "sort_order": 1, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.planner.comparison", "category": "quick_action.planner", "display_name": "Comparison", "description": "Add comparison elements (current vs previous, target vs actual).", "prompt_text": "Add a comparison element to this slide. Compare current vs previous period, target vs actual, or before vs after. Structure the content to highlight the delta.", "icon_name": "arrows-compare", "sort_order": 2, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.planner.trends", "category": "quick_action.planner", "display_name": "Trends", "description": "Focus on trends and patterns over time.", "prompt_text": "Refocus this slide on trends and patterns over time. Highlight what's improving, declining, or stable.", "icon_name": "trend-up", "sort_order": 3, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.planner.recommendations", "category": "quick_action.planner", "display_name": "Recommendations", "description": "Add actionable recommendations.", "prompt_text": "Add 2-3 actionable recommendations based on the data. Each should be specific, measurable, and assigned to a stakeholder.", "icon_name": "lightbulb", "sort_order": 4, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.planner.visual", "category": "quick_action.planner", "display_name": "More visual", "description": "Convert text to visual elements.", "prompt_text": "Make this slide more visual. Convert bullets into chart suggestions, add data callout boxes. Minimize text, maximize visual impact.", "icon_name": "layout", "sort_order": 5, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.planner.shorter", "category": "quick_action.planner", "display_name": "Shorter", "description": "Reduce content by 40-50%.", "prompt_text": "Reduce content by 40-50%. Keep only critical points. Maximum 3-4 bullets. Remove supporting detail, keep conclusions.", "icon_name": "minus", "sort_order": 6, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.planner.longer", "category": "quick_action.planner", "display_name": "Longer", "description": "Expand with more detail.", "prompt_text": "Expand with more detail. Add supporting data points, context, and evidence. Aim for 5-7 bullets.", "icon_name": "plus", "sort_order": 7, "seed_version": 1, "variables": {}},
    # ── QUICK ACTIONS — WRITER ────────────────────────────────────────────
    {"prompt_key": "qa.writer.data_driven", "category": "quick_action.writer", "display_name": "Data-driven", "description": "Rewrite with specific numbers and metrics.", "prompt_text": "Rewrite this slide content to be more data-driven. Replace vague statements with specific numbers, percentages, and metrics from the source data. Every bullet should contain at least one concrete data point.", "icon_name": "chart-bar", "sort_order": 1, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.writer.comparison", "category": "quick_action.writer", "display_name": "Comparison", "description": "Add comparison elements with delta values.", "prompt_text": "Add comparison elements to this slide content. Compare current vs previous period, target vs actual, or before vs after. Use delta values (e.g., +15%, -2.3 points) to highlight changes.", "icon_name": "arrows-compare", "sort_order": 2, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.writer.trends", "category": "quick_action.writer", "display_name": "Trends", "description": "Focus on trends with directional language.", "prompt_text": "Refocus this slide content on trends and patterns. Highlight what is improving, declining, or stable. Use directional language (increased, decreased, remained flat).", "icon_name": "trend-up", "sort_order": 3, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.writer.recommendations", "category": "quick_action.writer", "display_name": "Recommendations", "description": "Add specific actionable recommendations.", "prompt_text": "Add 2-3 specific, actionable recommendations to this slide. Each recommendation should include: what to do, who is responsible, and expected impact.", "icon_name": "lightbulb", "sort_order": 4, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.writer.executive", "category": "quick_action.writer", "display_name": "Executive tone", "description": "Rewrite in authoritative executive language.", "prompt_text": "Rewrite this slide content in a more executive tone. Lead with conclusions, not details. Use authoritative language. Remove operational jargon. Every point should connect to a business outcome or decision.", "icon_name": "academic-cap", "sort_order": 5, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.writer.shorter", "category": "quick_action.writer", "display_name": "Shorter", "description": "Cut content by 40-50%.", "prompt_text": "Cut this slide content by 40-50%. Keep only the most impactful points. Maximum 3-4 bullets. Remove supporting details and keep conclusions.", "icon_name": "minus", "sort_order": 6, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.writer.longer", "category": "quick_action.writer", "display_name": "Longer", "description": "Expand with more depth and evidence.", "prompt_text": "Expand this slide with more depth. Add supporting evidence, context, and specific examples from the data. Aim for 5-7 bullets.", "icon_name": "plus", "sort_order": 7, "seed_version": 1, "variables": {}},
    {"prompt_key": "qa.writer.simplify", "category": "quick_action.writer", "display_name": "Simplify", "description": "Use simpler words and clearer structure.", "prompt_text": "Simplify this slide content. Use shorter sentences, simpler words, and clearer structure. Remove acronyms or spell them out. A non-expert should understand every point.", "icon_name": "pencil", "sort_order": 8, "seed_version": 1, "variables": {}},
]


async def seed():
    async with async_session_factory() as db:
        for p in PROMPTS:
            # Check if exists
            result = await db.execute(
                text("SELECT id, seed_version FROM prompt_configs WHERE prompt_key = :key AND user_id IS NULL"),
                {"key": p["prompt_key"]},
            )
            row = result.first()

            if row:
                # Update only if seed_version is higher
                if p["seed_version"] > row.seed_version:
                    await db.execute(
                        text("""UPDATE prompt_configs SET prompt_text = :text, display_name = :name,
                                description = :desc, variables = :vars, category = :cat,
                                icon_name = :icon, sort_order = :sort, seed_version = :ver,
                                updated_at = NOW()
                                WHERE id = :id"""),
                        {"text": p["prompt_text"], "name": p["display_name"],
                         "desc": p.get("description"), "vars": json.dumps(p.get("variables", {})),
                         "cat": p["category"], "icon": p.get("icon_name"),
                         "sort": p["sort_order"], "ver": p["seed_version"], "id": str(row.id)},
                    )
            else:
                # Insert new
                await db.execute(
                    text("""INSERT INTO prompt_configs
                            (id, user_id, prompt_key, prompt_text, category, variables,
                             is_active, seed_version, display_name, description, icon_name, sort_order)
                            VALUES (:id, NULL, :key, :text, :cat, :vars,
                                    true, :ver, :name, :desc, :icon, :sort)"""),
                    {"id": str(uuid.uuid4()), "key": p["prompt_key"], "text": p["prompt_text"],
                     "cat": p["category"], "vars": json.dumps(p.get("variables", {})),
                     "ver": p["seed_version"], "name": p["display_name"],
                     "desc": p.get("description"), "icon": p.get("icon_name"),
                     "sort": p["sort_order"]},
                )

        await db.commit()
        print(f"Seeded {len(PROMPTS)} prompt configs")


if __name__ == "__main__":
    asyncio.run(seed())
