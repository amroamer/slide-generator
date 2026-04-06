"""create_guide_sections_and_blocks

Revision ID: d9f3a7e21c84
Revises: c7a2e9f13b45
Create Date: 2026-04-05 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd9f3a7e21c84'
down_revision: Union[str, None] = 'c7a2e9f13b45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('guide_sections',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=300), nullable=False),
        sa.Column('slug', sa.String(length=300), nullable=False),
        sa.Column('is_visible', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )
    op.create_table('guide_blocks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('section_id', sa.UUID(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.Column('block_type', sa.String(length=50), nullable=False),
        sa.Column('content_json', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_visible', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['guide_sections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('guide_blocks')
    op.drop_table('guide_sections')
