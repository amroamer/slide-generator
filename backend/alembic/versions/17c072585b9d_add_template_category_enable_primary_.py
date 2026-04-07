"""add_template_category_enable_primary_fields

Revision ID: 17c072585b9d
Revises: a1b2c3d4e5f6
Create Date: 2026-04-06 21:53:32.782413

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '17c072585b9d'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # TemplateCollection new fields
    op.add_column('template_collections', sa.Column('slide_type_category', sa.String(50), nullable=True))
    op.add_column('template_collections', sa.Column('mapped_slide_types', postgresql.JSON(), nullable=True))
    op.add_column('template_collections', sa.Column('extracted_colors', postgresql.JSON(), nullable=True))

    # TemplateVariation new fields
    op.add_column('template_variations', sa.Column('auto_name', sa.String(200), nullable=True))
    op.add_column('template_variations', sa.Column('custom_name', sa.String(200), nullable=True))
    op.add_column('template_variations', sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('template_variations', sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('template_variations', 'is_primary')
    op.drop_column('template_variations', 'is_enabled')
    op.drop_column('template_variations', 'custom_name')
    op.drop_column('template_variations', 'auto_name')
    op.drop_column('template_collections', 'extracted_colors')
    op.drop_column('template_collections', 'mapped_slide_types')
    op.drop_column('template_collections', 'slide_type_category')
