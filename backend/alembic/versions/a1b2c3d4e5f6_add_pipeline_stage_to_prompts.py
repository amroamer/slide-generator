"""add_pipeline_stage_to_prompts

Revision ID: a1b2c3d4e5f6
Revises: faac6581f805
Create Date: 2026-04-06 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'faac6581f805'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('prompt_configs', sa.Column('pipeline_stage', sa.String(50), nullable=True))
    # Populate from existing categories
    op.execute("UPDATE prompt_configs SET pipeline_stage = 'step2_plan' WHERE category LIKE 'planner%' OR category LIKE 'quick_action_plan%' OR category = 'quick_action.planner'")
    op.execute("UPDATE prompt_configs SET pipeline_stage = 'step3_content' WHERE category LIKE 'writer%' OR category LIKE 'quick_action_write%' OR category = 'quick_action.writer'")
    op.execute("UPDATE prompt_configs SET pipeline_stage = 'step4_design' WHERE category LIKE 'designer%'")
    op.execute("UPDATE prompt_configs SET pipeline_stage = 'step5_export' WHERE category LIKE 'export%'")
    op.execute("UPDATE prompt_configs SET pipeline_stage = 'global' WHERE pipeline_stage IS NULL")


def downgrade() -> None:
    op.drop_column('prompt_configs', 'pipeline_stage')
