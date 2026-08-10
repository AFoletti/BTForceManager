"""drop force special abilities json column

Revision ID: ca1a9468a197
Revises: f666a8ff05f2
Create Date: 2026-08-10 07:14:12.904502

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca1a9468a197'
down_revision: Union[str, Sequence[str], None] = 'f666a8ff05f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column('forces', 'special_abilities')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('forces', sa.Column('special_abilities', sa.JSON(), nullable=False, server_default='[]'))
