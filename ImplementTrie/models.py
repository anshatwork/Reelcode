from pydantic import BaseModel


class Route(BaseModel):
    prefix: str
    next_hop: str


class LookupRequest(BaseModel):
    ip: str


