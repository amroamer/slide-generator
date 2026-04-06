"""create_brand_profiles

Revision ID: e4b8c2d1f567
Revises: d9f3a7e21c84
Create Date: 2026-04-05 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e4b8c2d1f567'
down_revision: Union[str, None] = 'd9f3a7e21c84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('brand_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('logo_path', sa.String(500), nullable=True),
        sa.Column('logo_position', sa.String(20), nullable=False, server_default='top-right'),
        sa.Column('logo_size', sa.String(20), nullable=False, server_default='medium'),
        sa.Column('primary_color', sa.String(20), nullable=False, server_default='#00338D'),
        sa.Column('secondary_color', sa.String(20), nullable=False, server_default='#0091DA'),
        sa.Column('accent_color', sa.String(20), nullable=False, server_default='#483698'),
        sa.Column('background_color', sa.String(20), nullable=False, server_default='#FFFFFF'),
        sa.Column('text_color', sa.String(20), nullable=False, server_default='#1A1A2E'),
        sa.Column('text_secondary_color', sa.String(20), nullable=False, server_default='#6B7280'),
        sa.Column('chart_colors', postgresql.JSON(), nullable=True),
        sa.Column('font_heading', sa.String(100), nullable=False, server_default='Arial'),
        sa.Column('font_body', sa.String(100), nullable=False, server_default='Arial'),
        sa.Column('font_size_title', sa.Integer(), nullable=False, server_default='28'),
        sa.Column('font_size_subtitle', sa.Integer(), nullable=False, server_default='18'),
        sa.Column('font_size_body', sa.Integer(), nullable=False, server_default='14'),
        sa.Column('font_size_caption', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('slide_header', postgresql.JSON(), nullable=True),
        sa.Column('slide_footer', postgresql.JSON(), nullable=True),
        sa.Column('slide_accent_line', postgresql.JSON(), nullable=True),
        sa.Column('slide_background_style', sa.String(20), nullable=False, server_default='solid'),
        sa.Column('slide_gradient', postgresql.JSON(), nullable=True),
        sa.Column('table_header_color', sa.String(20), nullable=True),
        sa.Column('table_header_text_color', sa.String(20), nullable=False, server_default='#FFFFFF'),
        sa.Column('table_alternate_row', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('table_alternate_color', sa.String(20), nullable=False, server_default='#F5F7FA'),
        sa.Column('table_border_color', sa.String(20), nullable=False, server_default='#E5E7EB'),
        sa.Column('table_style', sa.String(20), nullable=False, server_default='striped'),
        sa.Column('chart_style', sa.String(20), nullable=False, server_default='modern'),
        sa.Column('chart_show_grid', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('chart_show_legend', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('chart_legend_position', sa.String(20), nullable=False, server_default='bottom'),
        sa.Column('chart_bar_radius', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('brand_profiles')
