"""consolidate legacy snapshot and full_snapshot into force_snapshots

Revision ID: 07f5507d9f67
Revises: 5b7ca80172e3
Create Date: 2026-08-12 04:34:23.666097

"""
from typing import Sequence, Union
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '07f5507d9f67'
down_revision: Union[str, Sequence[str], None] = '5b7ca80172e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MAX_SNAPSHOTS_PER_FORCE = 3


def upgrade() -> None:
    """Migrate legacy snapshots/full_snapshots rows into force_snapshots
    (carrying over label/type/date/full state), enforce the same 3-per-force
    retention the live create endpoint uses, then drop the old tables."""
    conn = op.get_bind()

    full_snapshots = conn.execute(
        text("SELECT id, force_id, snapshot_id, force_data, created_at FROM full_snapshots")
    ).fetchall()

    snapshot_meta = {
        row.id: {"type": row.type, "label": row.label}
        for row in conn.execute(text("SELECT id, type, label FROM snapshots")).fetchall()
    }

    for fs in full_snapshots:
        meta = snapshot_meta.get(fs.snapshot_id, {})
        conn.execute(
            text(
                "INSERT INTO force_snapshots (force_id, created_at, label, waypoint_type, snapshot_json) "
                "VALUES (:force_id, :created_at, :label, :waypoint_type, :snapshot_json)"
            ),
            {
                "force_id": fs.force_id,
                "created_at": fs.created_at or datetime.now(timezone.utc).isoformat(),
                "label": meta.get("label") or "Migrated snapshot",
                "waypoint_type": meta.get("type") or "",
                "snapshot_json": fs.force_data,
            },
        )

    force_ids = [
        row.force_id
        for row in conn.execute(text("SELECT DISTINCT force_id FROM force_snapshots")).fetchall()
    ]
    for force_id in force_ids:
        ids = [
            row.id
            for row in conn.execute(
                text("SELECT id FROM force_snapshots WHERE force_id = :fid ORDER BY id DESC"),
                {"fid": force_id},
            ).fetchall()
        ]
        stale_ids = ids[MAX_SNAPSHOTS_PER_FORCE:]
        if stale_ids:
            conn.execute(
                text("DELETE FROM force_snapshots WHERE id IN :stale_ids").bindparams(
                    sa.bindparam("stale_ids", expanding=True)
                ),
                {"stale_ids": stale_ids},
            )

    op.drop_table("full_snapshots")
    op.drop_table("snapshots")


def downgrade() -> None:
    """Recreate the old (now-empty) tables. Data migrated forward by
    upgrade() is not moved back - force_snapshots is left as-is."""
    op.create_table(
        "snapshots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("force_id", sa.String(), sa.ForeignKey("forces.id"), index=True),
        sa.Column("type", sa.String()),
        sa.Column("label", sa.String()),
        sa.Column("created_at", sa.String()),
        sa.Column("current_warchest", sa.Integer()),
        sa.Column("starting_warchest", sa.Integer()),
        sa.Column("net_warchest_change", sa.Integer()),
        sa.Column("missions_completed", sa.Integer()),
        sa.Column("units", sa.JSON()),
    )
    op.create_table(
        "full_snapshots",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("force_id", sa.String(), sa.ForeignKey("forces.id"), index=True),
        sa.Column("snapshot_id", sa.String()),
        sa.Column("force_data", sa.JSON()),
        sa.Column("created_at", sa.String()),
    )
