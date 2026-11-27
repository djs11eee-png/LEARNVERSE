from __future__ import annotations

import functools
import ipaddress
from urllib.parse import urlparse

from fastapi import Request


@functools.lru_cache(maxsize=16)
def _parse_trusted_networks_cached(
    cidrs: tuple[str, ...],
) -> tuple[tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...], frozenset[str]]:
    networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = []
    literals: set[str] = set()
    for item in cidrs:
        token = item.strip()
        if not token:
            continue
        try:
            networks.append(ipaddress.ip_network(token, strict=False))
        except ValueError:
            literals.add(token)
    return tuple(networks), frozenset(literals)


def _is_trusted_ip(
    host: str,
    networks: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...],
    literals: frozenset[str],
) -> bool:
    if host in literals:
        return True
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(addr in net for net in networks)


def _normalize_ip(candidate: str) -> str | None:
    cleaned = candidate.strip()
    if not cleaned:
        return None
    try:
        return str(ipaddress.ip_address(cleaned))
    except ValueError:
        return None


def get_real_client_ip(request: Request, trusted_proxies: list[str]) -> str:
    """
    Safely resolves the true client IP behind Nginx reverse proxy.
    - If the immediate socket peer is NOT in `trusted_proxies`, X-Forwarded-For
      and X-Real-IP are ignored to prevent IP spoofing bypass of rate limiters.
    - If the immediate peer IS a trusted proxy, parses X-Forwarded-For from right
      to left and returns the right-most valid untrusted IP (or falls back to X-Real-IP).
    """
    peer_host = (request.client.host if request.client else "") or "127.0.0.1"
    networks, literals = _parse_trusted_networks_cached(tuple(trusted_proxies))

    if not _is_trusted_ip(peer_host, networks, literals):
        return _normalize_ip(peer_host) or peer_host

    xff = request.headers.get("x-forwarded-for")
    if xff:
        hops = [part.strip() for part in xff.split(",") if part.strip()]
        # Traverse right-to-left: stop at the first hop that is not a trusted proxy
        for hop in reversed(hops):
            norm = _normalize_ip(hop)
            if norm and not _is_trusted_ip(norm, networks, literals):
                return norm
        # If all hops in XFF are internal/trusted, use the left-most valid IP
        for hop in hops:
            norm = _normalize_ip(hop)
            if norm:
                return norm

    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip:
        norm = _normalize_ip(x_real_ip)
        if norm:
            return norm

    return _normalize_ip(peer_host) or peer_host


def verify_same_origin(request: Request, allowed_origins: list[str] | None = None) -> bool:
    """
    Verifies that state-changing requests originate from the same site.
    Mirrors `scripts/discussions.mjs`:
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) -> 403
    """
    origin = request.headers.get("origin")
    if not origin:
        return True
    normalized_origin = origin.strip().rstrip("/")
    if allowed_origins:
        allowed_set = {item.strip().rstrip("/") for item in allowed_origins if item.strip()}
        if normalized_origin in allowed_set:
            return True
    try:
        parsed_origin = urlparse(origin)
    except ValueError:
        return False
    if not parsed_origin.netloc:
        return False
    req_host = request.headers.get("host", "")
    return parsed_origin.netloc.lower() == req_host.lower()
