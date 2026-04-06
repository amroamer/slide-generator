"""add_metrics_json_to_variations

Revision ID: c7a2e9f13b45
Revises: 6d4f40c1e044
Create Date: 2026-04-04 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c7a2e9f13b45'
down_revision: Union[str, None] = '6d4f40c1e044'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('template_variations',
        sa.Column('metrics_json', postgresql.JSON(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('template_variations', 'metrics_json')
