# schemas.py
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, List

class PositionResponse(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class TelemetryResponse(BaseModel):
    battery_level: Optional[int] = None
    voltage: Optional[float] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    gate_is_open: Optional[bool] = None
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class NodeResponse(BaseModel):
    node_id: str
    long_name: Optional[str] = None
    is_approved: bool
    last_heard: Optional[datetime] = None
    short_name: Optional[str] = None
    role: str = "tracker"
    color: str = "#38bdf8"
    door_state: Optional[str] = None
    fixed_latitude: Optional[float] = None
    fixed_longitude: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)

class ConfigUpdateRequest(BaseModel):
    long_name: Optional[str] = None
    telemetry_interval: Optional[int] = None
    is_approved: Optional[bool] = None
    fixed_latitude: Optional[float] = None
    fixed_longitude: Optional[float] = None
    role: Optional[str] = None
    color: Optional[str] = None
    short_name: Optional[str] = Field(None, max_length=4)

class SendMessageRequest(BaseModel):
    sender_node_id: str 
    receiver_node_id: str 
    text_payload: str