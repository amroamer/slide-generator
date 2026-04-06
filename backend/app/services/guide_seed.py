"""Seed default user guide content into the database."""

from sqlalchemy.ext.asyncio import AsyncSession
from app.models.guide_content import GuideBlock, GuideSection


SEED_DATA = [
    {
        "title": "Getting Started",
        "slug": "getting-started",
        "blocks": [
            {"type": "paragraph", "content": {"text": "Welcome to the KPMG Slides Generator — an AI-powered tool that helps you create professional executive presentations in minutes. This guide walks you through every feature."}},
            {"type": "heading", "content": {"text": "System Requirements", "level": 3}},
            {"type": "paragraph", "content": {"text": "Use the latest version of Chrome, Edge, or Firefox. An active internet connection is required for AI generation. All presentations are saved automatically."}},
            {"type": "heading", "content": {"text": "Registration & Login", "level": 3}},
            {"type": "paragraph", "content": {"text": "Navigate to the application URL and create an account with your email. After registration, sign in to access the dashboard."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "The login page", "alt": "Login page"}},
            {"type": "tip", "content": {"text": "Use your corporate KPMG email for seamless integration with internal brand template libraries."}},
        ],
    },
    {
        "title": "Creating a Presentation",
        "slug": "creating-a-presentation",
        "blocks": [
            {"type": "paragraph", "content": {"text": "The Slides Generator follows a structured five-step pipeline that mirrors how professional consultants build presentations. Each step is handled by a dedicated AI agent."}},
            {"type": "steps", "content": {"items": [
                "Input & Configuration — Describe your presentation and upload data files",
                "Presentation Planning — AI generates a structured slide outline",
                "Content Generation — AI writes the content for every slide",
                "Visual Design — Preview and customize slide layouts",
                "Export — Download as PPTX or PDF",
            ]}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "The five-step pipeline in the sidebar", "alt": "Pipeline sidebar"}},
        ],
    },
    {
        "title": "Step 1 — Input & Configuration",
        "slug": "step-1-input",
        "blocks": [
            {"type": "paragraph", "content": {"text": "Start by describing the presentation you want to create. Be specific about the topic, audience, and desired structure. The more detail you provide, the better the AI output."}},
            {"type": "heading", "content": {"text": "Writing an Effective Prompt", "level": 3}},
            {"type": "paragraph", "content": {"text": "Include: the topic, target audience, desired tone, key messages, and any specific data points to highlight. Mention the number of slides and any layout preferences."}},
            {"type": "tip", "content": {"text": "Reference specific data from your uploaded files in the prompt. For example: 'Use the KPI data from the CSV to create a scorecard slide with RAG status indicators.'"}},
            {"type": "heading", "content": {"text": "Uploading Data Files", "level": 3}},
            {"type": "paragraph", "content": {"text": "Upload CSV, Excel, PDF, TXT, or JSON files. The AI will extract data and use it to create data-driven slides with charts, tables, and insights."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "Step 1 with prompt and uploaded data file", "alt": "Step 1 input page"}},
            {"type": "heading", "content": {"text": "Configuration Options", "level": 3}},
            {"type": "paragraph", "content": {"text": "Set the target audience (Board/C-Suite, Senior Management, etc.), tone (Formal, Professional, Internal), language (English, Arabic, Bilingual), and AI model."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "Configuration panel with audience, tone, and language options", "alt": "Config panel"}},
        ],
    },
    {
        "title": "Step 2 — Presentation Planning",
        "slug": "step-2-planning",
        "blocks": [
            {"type": "paragraph", "content": {"text": "The Planner Agent analyzes your prompt and data to generate a structured slide outline organized into sections. You can edit, reorder, add, and remove slides before proceeding."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "Generated plan with sections and slides", "alt": "Plan outline"}},
            {"type": "heading", "content": {"text": "Quick Action Pills", "level": 3}},
            {"type": "paragraph", "content": {"text": "Use the quick action pills (Data-driven, Comparison, Trends, etc.) to refine individual slides with one click. Each pill sends a specific instruction to the AI."}},
            {"type": "heading", "content": {"text": "Adding & Removing Slides", "level": 3}},
            {"type": "paragraph", "content": {"text": "Click 'Add Slide' to insert a new slide at any position. Click the trash icon on a slide to remove it. Changes are saved automatically."}},
        ],
    },
    {
        "title": "Step 3 — Content Generation",
        "slug": "step-3-content",
        "blocks": [
            {"type": "paragraph", "content": {"text": "The Writer Agent generates full content for every slide — bullet points, data tables, chart suggestions, and key takeaways. Slides appear progressively as they complete."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "Content generation in progress", "alt": "Content generation"}},
            {"type": "heading", "content": {"text": "Editing Content", "level": 3}},
            {"type": "paragraph", "content": {"text": "Click any slide card to expand it. Edit bullet points, titles, and key takeaways inline. Use the refine prompt input to ask the Writer Agent to adjust specific aspects."}},
            {"type": "heading", "content": {"text": "Suggest Alternatives", "level": 3}},
            {"type": "paragraph", "content": {"text": "Click 'Alternatives' to generate 3 different versions of a slide's content. Compare and select the version that best fits your needs."}},
        ],
    },
    {
        "title": "Step 4 — Visual Design",
        "slug": "step-4-design",
        "blocks": [
            {"type": "paragraph", "content": {"text": "The Designer Agent assigns appropriate layouts to each slide based on its content type. You can preview slides in real-time, change layouts, and enter full-screen mode."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "Design page with slide preview and filmstrip", "alt": "Design page"}},
            {"type": "heading", "content": {"text": "Changing Layouts", "level": 3}},
            {"type": "paragraph", "content": {"text": "Select a slide in the filmstrip and choose a different layout from the options below: Title, Bullets, Table, Chart, Two-Column, Divider, or Takeaway."}},
        ],
    },
    {
        "title": "Step 5 — Export",
        "slug": "step-5-export",
        "blocks": [
            {"type": "paragraph", "content": {"text": "Select which slides to include in the export and choose your format. PowerPoint (.pptx) is compatible with Microsoft PowerPoint and Google Slides. PDF provides a read-only sharing format."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "Export page with slide selection and format options", "alt": "Export page"}},
            {"type": "tip", "content": {"text": "Use the PDF format with 'Include speaker notes' enabled to create a presenter's version of the deck."}},
        ],
    },
    {
        "title": "Settings & Configuration",
        "slug": "settings",
        "blocks": [
            {"type": "heading", "content": {"text": "LLM Configuration", "level": 3}},
            {"type": "paragraph", "content": {"text": "Configure your AI model provider: Claude (Anthropic), ChatGPT (OpenAI), or a local Ollama instance. Enter API keys and select default models."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "LLM provider configuration", "alt": "LLM settings"}},
            {"type": "heading", "content": {"text": "Prompt Management", "level": 3}},
            {"type": "paragraph", "content": {"text": "Customize the prompts used by each AI agent. Override system defaults to tailor the AI behavior for your specific use case."}},
            {"type": "heading", "content": {"text": "Slide Template Library", "level": 3}},
            {"type": "paragraph", "content": {"text": "Upload PowerPoint files to create reusable slide design collections. Each slide becomes a template variation with quality metrics and content slot analysis."}},
            {"type": "screenshot", "content": {"image_path": None, "caption": "Slide template library", "alt": "Template library"}},
        ],
    },
    {
        "title": "Tips & Best Practices",
        "slug": "tips",
        "blocks": [
            {"type": "heading", "content": {"text": "Writing Effective Prompts", "level": 3}},
            {"type": "paragraph", "content": {"text": "Be specific about the audience and desired outcome. Mention data sources explicitly. Use numbered lists in your prompt to request specific slide structures."}},
            {"type": "heading", "content": {"text": "Working with Arabic & RTL", "level": 3}},
            {"type": "paragraph", "content": {"text": "Select 'Arabic' or 'Bilingual' in Step 1 to generate RTL content. The entire UI can be switched to Arabic using the language toggle in the navigation."}},
            {"type": "warning", "content": {"text": "When using bilingual mode, ensure your data files contain both English and Arabic labels for charts and tables."}},
        ],
    },
    {
        "title": "Keyboard Shortcuts",
        "slug": "keyboard-shortcuts",
        "blocks": [
            {"type": "paragraph", "content": {"text": "Use these keyboard shortcuts to navigate the application more efficiently."}},
            {"type": "shortcut_table", "content": {"rows": [
                {"key": "Ctrl + N", "action": "New presentation"},
                {"key": "Ctrl + S", "action": "Save current step"},
                {"key": "Ctrl + Enter", "action": "Submit / Generate"},
                {"key": "Escape", "action": "Close modal or panel"},
                {"key": "←  →", "action": "Navigate slides (Step 4/5)"},
                {"key": "1-5", "action": "Jump to step (workspace)"},
                {"key": "F", "action": "Full-screen preview (Step 4)"},
                {"key": "Ctrl + Z", "action": "Undo text edit"},
            ]}},
        ],
    },
]


async def seed_default_guide(db: AsyncSession) -> int:
    """Seed default guide sections and blocks. Returns count of sections created."""
    for idx, section_data in enumerate(SEED_DATA):
        section = GuideSection(
            title=section_data["title"],
            slug=section_data["slug"],
            order_index=idx,
        )
        db.add(section)
        await db.flush()

        for bidx, block_data in enumerate(section_data["blocks"]):
            block = GuideBlock(
                section_id=section.id,
                order_index=bidx,
                block_type=block_data["type"],
                content_json=block_data["content"],
            )
            db.add(block)

    await db.flush()
    return len(SEED_DATA)
