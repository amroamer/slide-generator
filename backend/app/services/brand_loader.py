"""Load brand profile for a presentation from its input settings."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand_profile import BrandProfile
from app.models.presentation_input import PresentationInput


async def load_brand_for_presentation(
    presentation_id: uuid.UUID, db: AsyncSession
) -> BrandProfile | None:
    """Load the brand profile associated with a presentation's input.
    Returns None if no profile is selected or not found."""
    inp = (await db.execute(
        select(PresentationInput).where(PresentationInput.presentation_id == presentation_id)
    )).scalar_one_or_none()

    if not inp or not inp.brand_profile_id:
        return None

    return (await db.execute(
        select(BrandProfile).where(BrandProfile.id == inp.brand_profile_id)
    )).scalar_one_or_none()
