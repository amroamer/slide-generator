"""add template_variation_id to slides

Revision ID: b8e3f2a91c47
Revises: 17c072585b9d
Create Date: 2026-04-06

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b8e3f2a91c47'
down_revision: Union[str, None] = '17c072585b9d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('presentation_slides', sa.Column('template_variation_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_slides_template_variation', 'presentation_slides', 'template_variations', ['template_variation_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    op.drop_constraint('fk_slides_template_variation', 'presentation_slides', type_='foreignkey')
    op.drop_column('presentation_slides', 'template_variation_id')
