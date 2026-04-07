"""add layout_template_key to variations

Revision ID: c4d5e6f7a8b9
Revises: b8e3f2a91c47
Create Date: 2026-04-07

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b8e3f2a91c47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('template_variations', sa.Column('layout_template_key', sa.String(50), nullable=True, server_default='full_width'))

def downgrade() -> None:
    op.drop_column('template_variations', 'layout_template_key')
