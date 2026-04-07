"""add parsed_data_text to presentation_inputs

Revision ID: 674edbb46129
Revises: c4d5e6f7a8b9
Create Date: 2026-04-07 01:09:42.210239

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '674edbb46129'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "presentation_inputs",
        sa.Column("parsed_data_text", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("presentation_inputs", "parsed_data_text")
