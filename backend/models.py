from typing import Optional

from sqlalchemy import String, Integer, Boolean, Float, Text, JSON, LargeBinary, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Force(Base):
    __tablename__ = "forces"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    image: Mapped[str] = mapped_column(String, default="")
    image_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    image_mime_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    starting_warchest: Mapped[int] = mapped_column(Integer, default=0)
    current_warchest: Mapped[int] = mapped_column(Integer, default=0)
    wp_multiplier: Mapped[int] = mapped_column(Integer, default=10)
    current_date: Mapped[str] = mapped_column(String, default="")
    starting_date: Mapped[str] = mapped_column(String, default="3025-01-01")
    notes: Mapped[str] = mapped_column(Text, default="")
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
    image_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    image_mime_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
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
    image_data: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    image_mime_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
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


class ForceSnapshot(Base):
    """Full-state, restorable point-in-time backup of a force (roster,
    missions, pilot records, Warchest, per-force config, images). Backs the
    Campaign Snapshots tab; automatically created on mission create/complete
    and downtime cycles (never manually) - see routers/force_snapshots.py
    for the retention/merge rules. `snapshot_json` uses the same shape as
    `GET /api/forces/{id}/export`, except images are embedded as base64 data
    instead of live URLs so a snapshot stays correct even if the image is
    later replaced/removed."""

    __tablename__ = "force_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), index=True)
    created_at: Mapped[str] = mapped_column(String, default="")
    label: Mapped[str] = mapped_column(String, default="")
    waypoint_type: Mapped[str] = mapped_column(String, default="")
    snapshot_json: Mapped[dict] = mapped_column(JSON, default=dict)


class SpecialAbility(Base):
    __tablename__ = "special_abilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")


class ForceSpecialAbility(Base):
    __tablename__ = "force_special_abilities"

    force_id: Mapped[str] = mapped_column(String, ForeignKey("forces.id"), primary_key=True)
    ability_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("special_abilities.id"), primary_key=True
    )


class AchievementDefinition(Base):
    __tablename__ = "achievement_definitions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    icon: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    condition: Mapped[str] = mapped_column(String, default="")


class PilotAchievement(Base):
    __tablename__ = "pilot_achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pilot_id: Mapped[str] = mapped_column(String, ForeignKey("pilots.id"), index=True)
    achievement_id: Mapped[str] = mapped_column(String, ForeignKey("achievement_definitions.id"))
    earned_at: Mapped[str] = mapped_column(String, nullable=True)


class SpChoice(Base):
    __tablename__ = "sp_choices"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    cost: Mapped[float] = mapped_column(Float, default=0)


class MissionSpPurchase(Base):
    __tablename__ = "mission_sp_purchases"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    mission_id: Mapped[str] = mapped_column(String, ForeignKey("missions.id"), index=True)
    choice_id: Mapped[str] = mapped_column(String, ForeignKey("sp_choices.id"), nullable=True)
    cost_at_purchase: Mapped[float] = mapped_column(Float, default=0)
    name_at_purchase: Mapped[str] = mapped_column(String, default="")


class PilotSpecialAbility(Base):
    __tablename__ = "pilot_special_abilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")


class PilotSpaAssignment(Base):
    __tablename__ = "pilot_spa_assignments"

    pilot_id: Mapped[str] = mapped_column(String, ForeignKey("pilots.id"), primary_key=True)
    spa_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pilot_special_abilities.id"), primary_key=True
    )


class DowntimeAction(Base):
    __tablename__ = "downtime_actions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, default="")
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String, default="")
    formula: Mapped[str] = mapped_column(Text, default="")
    flags: Mapped[list] = mapped_column(JSON, default=list)


class MechCatalogEntry(Base):
    __tablename__ = "mech_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    mul_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=True, index=True)
    chassis: Mapped[str] = mapped_column(String, index=True, default="")
    model: Mapped[str] = mapped_column(String, default="")
    bv: Mapped[int] = mapped_column(Integer, default=0)
    tonnage: Mapped[int] = mapped_column(Integer, default=0)
    year: Mapped[int] = mapped_column(Integer, nullable=True)
    techbase: Mapped[str] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, nullable=True)
    walk: Mapped[int] = mapped_column(Integer, default=0)
    max_walk: Mapped[int] = mapped_column(Integer, default=0)
    jump: Mapped[int] = mapped_column(Integer, default=0)
    max_jump: Mapped[int] = mapped_column(Integer, default=0)
    heat: Mapped[int] = mapped_column(Integer, default=0)
    dissipation: Mapped[int] = mapped_column(Integer, default=0)
    dissipation_efficiency: Mapped[int] = mapped_column(Integer, default=0)
    components: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[str] = mapped_column(String, default="")
