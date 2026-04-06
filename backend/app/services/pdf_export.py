import os

import jinja2
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.presentation import Presentation
from app.models.slide import PresentationSlide
from app.services.brand_loader import load_brand_for_presentation


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
        html = slide_tmpl.render(
            slide=slide, content=content, design=design, brand=brand_dict,
            slide_number=idx + 1, total_slides=len(slides),
            include_notes=include_notes, is_rtl=is_rtl,
            layout=slide.layout or content.get('layout', 'title_bullets'),
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
