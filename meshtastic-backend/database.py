# database.py
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import create_engine, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

# SQLite database file will be created in the same folder
SQLALCHEMY_DATABASE_URL = "sqlite:///./meshtastic.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

class Node(Base):
    __tablename__ = "nodes"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    long_name: Mapped[Optional[str]] = mapped_column(String(50))
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)
    last_heard: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    device_config: Mapped[Optional[dict]] = mapped_column(JSON)
    short_name: Mapped[Optional[str]] = mapped_column(String(4))
    role: Mapped[str] = mapped_column(String(10), default="tracker")
    color: Mapped[str] = mapped_column(String(20), default="#38bdf8")
    door_state: Mapped[Optional[str]] = mapped_column(String(20))
    fixed_latitude: Mapped[Optional[float]] = mapped_column(Float)
    fixed_longitude: Mapped[Optional[float]] = mapped_column(Float)

class Position(Base):
    __tablename__ = "positions"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.node_id"))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Telemetry(Base):
    __tablename__ = "telemetry"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.node_id"))
    battery_level: Mapped[Optional[int]] = mapped_column(Integer)
    voltage: Mapped[Optional[float]] = mapped_column(Float)
    temperature: Mapped[Optional[float]] = mapped_column(Float)
    humidity: Mapped[Optional[float]] = mapped_column(Float)
    gate_is_open: Mapped[Optional[bool]] = mapped_column(Boolean)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    sender_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.node_id"))
    receiver_node_id: Mapped[str] = mapped_column(String(16), index=True)
    text_payload: Mapped[str] = mapped_column(String)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

# Create the tables in the database
Base.metadata.create_all(bind=engine)