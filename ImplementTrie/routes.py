from fastapi import APIRouter, HTTPException, status

from models import LookupRequest, Route
from router_trie import RouterTrie


router = APIRouter()
trie = RouterTrie()


@router.post("/routes", status_code=status.HTTP_201_CREATED)
def add_route(route: Route):
    try:
        trie.insert(route.prefix, route.next_hop)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"prefix": route.prefix, "next_hop": route.next_hop}


@router.get("/routes")
def list_routes():
    routes = [{"prefix": p, "next_hop": nh} for p, nh in trie.list_routes()]
    return routes


@router.get("/lookup/{ip}")
def lookup(ip: str):
    try:
        result = trie.lookup(ip)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No matching route found")
    match_prefix, next_hop = result
    return {"ip": ip, "match_prefix": match_prefix, "next_hop": next_hop}


@router.delete("/routes/{prefix}")
def delete_route(prefix: str):
    try:
        deleted = trie.delete(prefix)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return {"deleted": True, "prefix": prefix}


