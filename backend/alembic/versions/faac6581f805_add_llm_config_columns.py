"""add_llm_config_columns

Revision ID: faac6581f805
Revises: e4b8c2d1f567
Create Date: 2026-04-06 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'faac6581f805'
down_revision: Union[str, None] = 'e4b8c2d1f567'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('llm_configs', sa.Column('display_name', sa.String(100), nullable=True))
    op.add_column('llm_configs', sa.Column('provider_type', sa.String(50), nullable=True))
    op.add_column('llm_configs', sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('llm_configs', sa.Column('last_tested_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('llm_configs', sa.Column('last_test_status', sa.String(20), nullable=True))
    op.add_column('llm_configs', sa.Column('last_test_latency_ms', sa.Integer(), nullable=True))
    op.add_column('llm_configs', sa.Column('last_test_error', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('llm_configs', 'last_test_error')
    op.drop_column('llm_configs', 'last_test_latency_ms')
    op.drop_column('llm_configs', 'last_test_status')
    op.drop_column('llm_configs', 'last_tested_at')
    op.drop_column('llm_configs', 'is_active')
    op.drop_column('llm_configs', 'provider_type')
    op.drop_column('llm_configs', 'display_name')
