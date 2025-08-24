from __future__ import annotations

from dataclasses import dataclass, field
from ipaddress import IPv4Address, IPv4Network, ip_address, ip_network
from typing import Dict, List, Optional, Tuple


@dataclass
class RouterTrieNode:
    children: Dict[int, "RouterTrieNode"] = field(default_factory=dict)
    next_hop: Optional[str] = None
    prefix: Optional[str] = None


class RouterTrie:
    """Binary radix trie for IPv4 longest-prefix matching."""

    def __init__(self) -> None:
        self.root: RouterTrieNode = RouterTrieNode()
        # Maintain a simple map for listing existing routes quickly
        self._prefix_to_next_hop: Dict[str, str] = {}

    # ---------------------------
    # Public API
    # ---------------------------
    def insert(self, prefix: str, next_hop: str) -> None:
        """Insert or update a route.

        Args:
            prefix: CIDR notation, e.g., "192.168.0.0/16".
            next_hop: Any string identifying the next hop, e.g., "Router-A".
        """
        network = self._parse_ipv4_network(prefix)
        bits = self._network_prefix_bits(network)

        node = self.root
        for bit in bits:
            if bit not in node.children:
                node.children[bit] = RouterTrieNode()
            node = node.children[bit]

        node.next_hop = next_hop
        node.prefix = prefix
        self._prefix_to_next_hop[prefix] = next_hop

    def lookup(self, ip: str) -> Optional[Tuple[str, str]]:
        """Return the (longest_match_prefix, next_hop) for an IP if any.

        Args:
            ip: Dotted IPv4 string, e.g., "192.168.1.42".
        """
        address = self._parse_ipv4_address(ip)
        bits = self._ip_bits(address)

        node = self.root
        best_prefix: Optional[str] = node.prefix if node.next_hop is not None else None
        best_next_hop: Optional[str] = node.next_hop

        for bit in bits:
            if bit not in node.children:
                break
            node = node.children[bit]
            if node.next_hop is not None:
                best_prefix = node.prefix
                best_next_hop = node.next_hop

        if best_prefix is None or best_next_hop is None:
            return None
        return best_prefix, best_next_hop

    def delete(self, prefix: str) -> bool:
        """Delete a route by its prefix. Returns True if deleted, False if not found."""
        network = self._parse_ipv4_network(prefix)
        bits = self._network_prefix_bits(network)

        node = self.root
        stack: List[Tuple[RouterTrieNode, int]] = []  # (parent, bit)

        # Traverse to target node, keeping a stack of parents
        for bit in bits:
            if bit not in node.children:
                return False
            stack.append((node, bit))
            node = node.children[bit]

        if node.next_hop is None:
            return False

        # Clear route at the node
        node.next_hop = None
        node.prefix = None
        self._prefix_to_next_hop.pop(prefix, None)

        # Prune nodes bottom-up if they are leaf and have no route
        while stack:
            parent, bit = stack.pop()
            child = parent.children.get(bit)
            if child is None:
                break
            if len(child.children) == 0 and child.next_hop is None:
                # Safe to delete this edge
                del parent.children[bit]
            else:
                break

        return True

    def list_routes(self) -> List[Tuple[str, str]]:
        """Return a list of (prefix, next_hop) pairs."""
        return sorted(self._prefix_to_next_hop.items())

    # ---------------------------
    # Internal helpers
    # ---------------------------
    def _parse_ipv4_network(self, prefix: str) -> IPv4Network:
        try:
            net = ip_network(prefix, strict=False)
        except ValueError as exc:
            raise ValueError(f"Invalid prefix '{prefix}': {exc}") from exc
        if not isinstance(net, IPv4Network):
            raise ValueError("Only IPv4 prefixes are supported")
        return net

    def _parse_ipv4_address(self, addr: str) -> IPv4Address:
        try:
            ip = ip_address(addr)
        except ValueError as exc:
            raise ValueError(f"Invalid IP address '{addr}': {exc}") from exc
        if not isinstance(ip, IPv4Address):
            raise ValueError("Only IPv4 addresses are supported")
        return ip

    def _ip_bits(self, address: IPv4Address) -> List[int]:
        value = int(address)
        bits: List[int] = []
        for i in range(31, -1, -1):
            bits.append((value >> i) & 1)
        return bits

    def _network_prefix_bits(self, network: IPv4Network) -> List[int]:
        address_bits = self._ip_bits(network.network_address)
        return address_bits[: network.prefixlen]


