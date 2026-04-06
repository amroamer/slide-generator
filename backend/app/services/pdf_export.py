import base64
import io
import os

import jinja2
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.presentation import Presentation
from app.models.slide import PresentationSlide
from app.services.brand_loader import load_brand_for_presentation


# RAG / semantic color map for chart rendering
SEMANTIC_COLORS = {
    "green": "#10B981", "on track": "#10B981", "on-track": "#10B981",
    "met": "#10B981", "healthy": "#10B981", "completed": "#10B981",
    "pass": "#10B981", "yes": "#10B981", "positive": "#10B981",
    "good": "#10B981", "low": "#10B981",
    "amber": "#F59E0B", "yellow": "#F59E0B", "warning": "#F59E0B",
    "attention": "#F59E0B", "at risk": "#F59E0B", "at-risk": "#F59E0B",
    "caution": "#F59E0B", "in progress": "#F59E0B", "partial": "#F59E0B",
    "medium": "#F59E0B",
    "red": "#EF4444", "critical": "#EF4444", "fail": "#EF4444",
    "failed": "#EF4444", "not met": "#EF4444", "off track": "#EF4444",
    "off-track": "#EF4444", "overdue": "#EF4444", "no": "#EF4444",
    "blocked": "#EF4444", "negative": "#EF4444", "high": "#EF4444",
    "neutral": "#6B7280",
}

SERIES_COLORS = ["#00338D", "#0091DA", "#483698", "#00A3A1", "#C6007E", "#FF6D00"]


def _detect_semantic_colors(labels: list[str]) -> dict[str, str] | None:
    """Return color map if >50% of labels match semantic keywords."""
    color_map = {}
    for label in labels:
        norm = label.lower().strip()
        for key, color in SEMANTIC_COLORS.items():
            if key in norm:
                color_map[label] = color
                break
    return color_map if len(color_map) > len(labels) * 0.5 else None


def _render_chart_to_base64(chart_data: dict, brand: dict | None = None) -> str | None:
    """Render chart_data JSON to a static matplotlib PNG, return as base64 string."""
    labels = chart_data.get("labels", [])
    datasets = chart_data.get("datasets", [])
    if not labels or not datasets:
        return None

    chart_type = (chart_data.get("chart_type") or "bar").lower().replace(" ", "_")
    primary = (brand or {}).get("primary_color", "#00338D")

    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    # Detect semantic/RAG colors
    semantic = _detect_semantic_colors(labels)

    if chart_type in ("pie", "donut", "doughnut"):
        values = []
        for v in (datasets[0].get("values") or datasets[0].get("data") or []):
            try:
                values.append(float(v))
            except (ValueError, TypeError):
                values.append(0)
        if semantic:
            colors = [semantic.get(l, SERIES_COLORS[i % len(SERIES_COLORS)]) for i, l in enumerate(labels)]
        else:
            colors = [SERIES_COLORS[i % len(SERIES_COLORS)] for i in range(len(labels))]

        wedge_kwargs = {}
        if chart_type in ("donut", "doughnut"):
            wedge_kwargs["wedgeprops"] = {"width": 0.5}

        ax.pie(values, labels=labels, colors=colors, autopct="%1.1f%%",
               startangle=90, textprops={"fontsize": 9}, **wedge_kwargs)
        ax.set_aspect("equal")

    elif chart_type in ("line",):
        x = range(len(labels))
        for di, ds in enumerate(datasets):
            values = []
            for v in (ds.get("values") or ds.get("data") or []):
                try:
                    values.append(float(v))
                except (ValueError, TypeError):
                    values.append(0)
            color = SERIES_COLORS[di % len(SERIES_COLORS)]
            ax.plot(x, values, marker="o", linewidth=2, color=color,
                    label=ds.get("label", f"Series {di + 1}"))
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, fontsize=9)
        ax.tick_params(axis="y", labelsize=9)
        ax.grid(axis="y", alpha=0.3)
        if len(datasets) > 1:
            ax.legend(fontsize=9)

    elif chart_type in ("area",):
        x = range(len(labels))
        for di, ds in enumerate(datasets):
            values = []
            for v in (ds.get("values") or ds.get("data") or []):
                try:
                    values.append(float(v))
                except (ValueError, TypeError):
                    values.append(0)
            color = SERIES_COLORS[di % len(SERIES_COLORS)]
            ax.fill_between(x, values, alpha=0.3, color=color)
            ax.plot(x, values, linewidth=2, color=color,
                    label=ds.get("label", f"Series {di + 1}"))
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, fontsize=9)
        ax.tick_params(axis="y", labelsize=9)
        ax.grid(axis="y", alpha=0.3)
        if len(datasets) > 1:
            ax.legend(fontsize=9)

    elif chart_type in ("horizontal_bar",):
        y = range(len(labels))
        bar_height = 0.8 / max(len(datasets), 1)
        for di, ds in enumerate(datasets):
            values = []
            for v in (ds.get("values") or ds.get("data") or []):
                try:
                    values.append(float(v))
                except (ValueError, TypeError):
                    values.append(0)
            offsets = [yi + di * bar_height - 0.4 + bar_height / 2 for yi in y]
            if semantic and len(datasets) == 1:
                colors = [semantic.get(l, SERIES_COLORS[0]) for l in labels]
            else:
                colors = SERIES_COLORS[di % len(SERIES_COLORS)]
            ax.barh(offsets, values, height=bar_height, color=colors,
                    label=ds.get("label", f"Series {di + 1}"))
        ax.set_yticks(range(len(labels)))
        ax.set_yticklabels(labels, fontsize=9)
        ax.tick_params(axis="x", labelsize=9)
        ax.grid(axis="x", alpha=0.3)
        if len(datasets) > 1:
            ax.legend(fontsize=9)

    else:
        # Default: bar / vertical_bar / column
        x = range(len(labels))
        bar_width = 0.8 / max(len(datasets), 1)
        for di, ds in enumerate(datasets):
            values = []
            for v in (ds.get("values") or ds.get("data") or []):
                try:
                    values.append(float(v))
                except (ValueError, TypeError):
                    values.append(0)
            offsets = [xi + di * bar_width - 0.4 + bar_width / 2 for xi in x]
            if semantic and len(datasets) == 1:
                colors = [semantic.get(l, SERIES_COLORS[0]) for l in labels]
            else:
                colors = SERIES_COLORS[di % len(SERIES_COLORS)]
            ax.bar(offsets, values, width=bar_width, color=colors,
                   label=ds.get("label", f"Series {di + 1}"))
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, fontsize=9)
        ax.tick_params(axis="y", labelsize=9)
        ax.grid(axis="y", alpha=0.3)
        if len(datasets) > 1:
            ax.legend(fontsize=9)

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    plt.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


def _get_cell_rag_color(value: str) -> str | None:
    """Return a RAG background color hex for a table cell value, or None."""
    norm = str(value).lower().strip()
    for key, color in SEMANTIC_COLORS.items():
        if key == norm or norm == key:
            return color
    return None


async def generate_pdf(presentation_id, slide_ids, include_notes, db: AsyncSession) -> str:
    """Generate PDF from presentation slides using WeasyPrint."""
    from weasyprint import HTML

    pres = (await db.execute(
        select(Presentation).where(Presentation.id == presentation_id)
    )).scalar_one()

    result = await db.execute(
        select(PresentationSlide)
        .where(PresentationSlide.presentation_id == presentation_id)
        .order_by(PresentationSlide.order)
    )
    slides = result.scalars().all()

    if slide_ids:
        slides = [s for s in slides if s.slide_id in slide_ids or str(s.id) in slide_ids]

    is_rtl = pres.language in ('arabic', 'bilingual')

    # Load brand profile
    brand = await load_brand_for_presentation(presentation_id, db)
    brand_dict = None
    if brand:
        brand_dict = {
            "primary_color": brand.primary_color,
            "secondary_color": brand.secondary_color,
            "accent_color": brand.accent_color,
            "text_color": brand.text_color,
            "background_color": brand.background_color,
            "font_heading": brand.font_heading,
            "font_body": brand.font_body,
            "table_header_color": brand.table_header_color or brand.primary_color,
            "table_header_text_color": brand.table_header_text_color,
        }

    template_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'templates', 'pdf')
    env = jinja2.Environment(loader=jinja2.FileSystemLoader(template_dir), autoescape=True)
    slide_tmpl = env.get_template('slide.html')

    slides_html = []
    for idx, slide in enumerate(slides):
        content = slide.content_json or {}
        design = slide.design_json or {}

        # Pre-render chart as base64 PNG image
        chart_image = None
        chart_data = content.get("chart_data")
        if chart_data and chart_data.get("labels") and chart_data.get("datasets"):
            chart_image = _render_chart_to_base64(chart_data, brand_dict)

        # Detect layout — auto-detect chart/table if present
        layout = slide.layout or content.get('layout', 'title_bullets')
        if chart_data and chart_data.get("labels") and chart_data.get("datasets"):
            layout = "title_chart"
        elif content.get("data_table") and content["data_table"].get("headers"):
            layout = "title_table"

        html = slide_tmpl.render(
            slide=slide, content=content, design=design, brand=brand_dict,
            slide_number=idx + 1, total_slides=len(slides),
            include_notes=include_notes, is_rtl=is_rtl,
            layout=layout, chart_image=chart_image,
        )
        slides_html.append(html)

    doc_tmpl = env.get_template('document.html')
    full_html = doc_tmpl.render(slides=slides_html, title=pres.title, is_rtl=is_rtl, brand=brand_dict)

    safe_title = (pres.title or "presentation").replace("/", "_").replace("\\", "_")[:80]
    output_dir = f"/app/outputs/{presentation_id}"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f"{safe_title}.pdf")

    HTML(string=full_html).write_pdf(output_path)
    return output_path
