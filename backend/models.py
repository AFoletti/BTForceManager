from sqlalchemy import String, Integer, Boolean, Text, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Force(Base):
    __tablename__ = "forces"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    image: Mapped[str] = mapped_column(String, default="")
    starting_warchest: Mapped[int] = mapped_column(Integer, default=0)
    current_warchest: Mapped[int] = mapped_column(Integer, default=0)
    wp_multiplier: Mapped[int] = mapped_column(Integer, default=5)
    current_date: Mapped[str] = mapped_column(String, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    special_abilities: Mapped[list] = mapped_column(JSON, default=list)
    other_actions_log: Mapped[list] = mapped_column(JSON, default=list)


class Mech(Base):
    __tablename__ = "mechs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="Operational")
    pilot_id: Mapped[str] = mapped_column(String, default="")
    bv: Mapped[int] = mapped_column(Integer, default=0)
    weight: Mapped[int] = mapped_column(Integer, default=0)
    image: Mapped[str] = mapped_column(String, default="")
    history: Mapped[str] = mapped_column(Text, default="")
    warchest_cost: Mapped[int] = mapped_column(Integer, default=0)
    activity_log: Mapped[list] = mapped_column(JSON, default=list)


class Elemental(Base):
    __tablename__ = "elementals"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="")
    commander: Mapped[str] = mapped_column(String, default="")
    gunnery: Mapped[int] = mapped_column(Integer, default=0)
    antimech: Mapped[int] = mapped_column(Integer, default=0)
    suits_destroyed: Mapped[int] = mapped_column(Integer, default=0)
    suits_damaged: Mapped[int] = mapped_column(Integer, default=0)
    bv: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="Operational")
    image: Mapped[str] = mapped_column(String, default="")
    history: Mapped[str] = mapped_column(Text, default="")
    warchest_cost: Mapped[int] = mapped_column(Integer, default=0)
    activity_log: Mapped[list] = mapped_column(JSON, default=list)


class Pilot(Base):
    __tablename__ = "pilots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="")
    gunnery: Mapped[int] = mapped_column(Integer, default=0)
    piloting: Mapped[int] = mapped_column(Integer, default=0)
    injuries: Mapped[int] = mapped_column(Integer, default=0)
    dezgra: Mapped[bool] = mapped_column(Boolean, default=False)
    history: Mapped[str] = mapped_column(Text, default="")
    warchest_cost: Mapped[int] = mapped_column(Integer, default=0)
    activity_log: Mapped[list] = mapped_column(JSON, default=list)
    combat_record: Mapped[dict] = mapped_column(JSON, nullable=True)
    achievements: Mapped[list] = mapped_column(JSON, default=list)


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), index=True)
    name: Mapped[str] = mapped_column(String, default="")
    cost: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    objectives: Mapped[list] = mapped_column(JSON, default=list)
    recap: Mapped[str] = mapped_column(Text, default="")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_mechs: Mapped[list] = mapped_column(JSON, default=list)
    assigned_elementals: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[str] = mapped_column(String, default="")
    in_game_date: Mapped[str] = mapped_column(String, default="")
    completed_at: Mapped[str] = mapped_column(String, nullable=True)
    sp_budget: Mapped[int] = mapped_column(Integer, nullable=True)
    sp_purchases: Mapped[list] = mapped_column(JSON, default=list)
    total_tonnage: Mapped[int] = mapped_column(Integer, nullable=True)
    op_for_units: Mapped[list] = mapped_column(JSON, default=list)


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), index=True)
    type: Mapped[str] = mapped_column(String, default="")
    label: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[str] = mapped_column(String, default="")
    current_warchest: Mapped[int] = mapped_column(Integer, default=0)
    starting_warchest: Mapped[int] = mapped_column(Integer, default=0)
    net_warchest_change: Mapped[int] = mapped_column(Integer, default=0)
    missions_completed: Mapped[int] = mapped_column(Integer, default=0)
    units: Mapped[dict] = mapped_column(JSON, default=dict)


class FullSnapshot(Base):
    __tablename__ = "full_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), index=True)
    snapshot_id: Mapped[str] = mapped_column(String, default="")
    force_data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String, default="")
