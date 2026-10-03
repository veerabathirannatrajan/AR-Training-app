"""Blockchain anchoring of certificate hashes.

`ChainAnchor` is the interface; the API uses `StubAnchor` ("not anchored yet") unless a Polygon
Amoy test wallet is configured with ARMT_POLYGON_PRIVATE_KEY (fund it from the Amoy faucet).
`PolygonAmoyAnchor` writes each certificate hash into a zero-value transaction to the wallet's
own address (input data = "ARMT" + the 32 hash bytes), which anyone can look up on PolygonScan.
"""

import json
import logging
import urllib.request
from dataclasses import dataclass
from decimal import Decimal
from functools import lru_cache
from typing import Any, Protocol

from app.config import settings

log = logging.getLogger("uvicorn.error")

AMOY_CHAIN_ID = 80002
AMOY_NETWORK = "polygon-amoy"
AMOY_EXPLORER = "https://amoy.polygonscan.com"
# "ARMT" in ASCII, so anchoring transactions are recognisable in the explorer.
DATA_PREFIX = "41524d54"
GWEI = 10**9
# Polygon PoS requires a priority fee of at least 25 gwei.
MIN_PRIORITY_FEE = 30 * GWEI


@dataclass
class AnchorReceipt:
    status: str  # not-anchored | pending | anchored | failed
    network: str | None = None
    tx_hash: str | None = None
    block_number: int | None = None
    error: str | None = None


@dataclass
class ChainInfo:
    adapter: str
    configured: bool
    network: str
    chain_id: int | None
    address: str | None
    balance: str | None
    explorer_url: str | None
    message: str | None


class ChainAnchor(Protocol):
    adapter: str
    configured: bool

    def anchor_many(self, hashes: list[str]) -> list[AnchorReceipt]:
        """Submits one anchoring transaction per hash."""
        ...

    def verify(self, hash_hex: str, tx_hash: str | None) -> AnchorReceipt:
        """Checks that `tx_hash` is mined and carries `hash_hex`."""
        ...

    def info(self) -> ChainInfo: ...


def explorer_tx_url(tx_hash: str | None) -> str | None:
    return None if tx_hash is None else f"{AMOY_EXPLORER}/tx/{tx_hash}"


class StubAnchor:
    """No blockchain configured: every certificate stays "not anchored yet"."""

    adapter = "stub"
    configured = False
    MESSAGE = (
        "Not anchored yet: Polygon Amoy anchoring is off. Set ARMT_POLYGON_PRIVATE_KEY on the "
        "API to a test wallet funded from the Amoy faucet to turn it on."
    )

    def anchor_many(self, hashes: list[str]) -> list[AnchorReceipt]:
        return [AnchorReceipt(status="not-anchored", error=self.MESSAGE) for _ in hashes]

    def verify(self, hash_hex: str, tx_hash: str | None) -> AnchorReceipt:
        return AnchorReceipt(status="not-anchored", error=self.MESSAGE)

    def info(self) -> ChainInfo:
        return ChainInfo(
            adapter=self.adapter,
            configured=False,
            network=AMOY_NETWORK,
            chain_id=AMOY_CHAIN_ID,
            address=None,
            balance=None,
            explorer_url=AMOY_EXPLORER,
            message=self.MESSAGE,
        )


class RpcError(Exception):
    pass


class PolygonAmoyAnchor:
    adapter = "polygon-amoy"
    configured = True

    def __init__(self, private_key: str, rpc_url: str) -> None:
        from eth_account import Account  # heavy import, only when anchoring is configured

        self._account = Account.from_key(private_key)
        self._rpc_url = rpc_url
        self._request_id = 0

    @property
    def address(self) -> str:
        return str(self._account.address)

    def _rpc(self, method: str, params: list[Any]) -> Any:
        self._request_id += 1
        body = json.dumps(
            {"jsonrpc": "2.0", "id": self._request_id, "method": method, "params": params}
        ).encode()
        request = urllib.request.Request(
            self._rpc_url,
            data=body,
            headers={"Content-Type": "application/json", "User-Agent": "armt-api"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:  # noqa: S310 (fixed RPC URL)
            reply = json.loads(response.read())
        if reply.get("error"):
            raise RpcError(str(reply["error"].get("message", reply["error"])))
        return reply.get("result")

    def _data(self, hash_hex: str) -> str:
        return "0x" + DATA_PREFIX + hash_hex.lower()

    def anchor_many(self, hashes: list[str]) -> list[AnchorReceipt]:
        if not hashes:
            return []
        try:
            nonce = int(self._rpc("eth_getTransactionCount", [self.address, "pending"]), 16)
            latest = self._rpc("eth_getBlockByNumber", ["latest", False])
            base_fee = int(latest.get("baseFeePerGas", "0x0"), 16)
            try:
                priority = max(int(self._rpc("eth_maxPriorityFeePerGas", []), 16), MIN_PRIORITY_FEE)
            except RpcError:
                priority = MIN_PRIORITY_FEE
        except Exception as error:  # noqa: BLE001 (network errors of every kind)
            return [AnchorReceipt(status="failed", network=AMOY_NETWORK, error=str(error))
                    for _ in hashes]

        receipts: list[AnchorReceipt] = []
        for hash_hex in hashes:
            data = self._data(hash_hex)
            try:
                gas = int(
                    self._rpc(
                        "eth_estimateGas", [{"from": self.address, "to": self.address, "data": data}]
                    ),
                    16,
                )
                transaction = {
                    "type": 2,
                    "chainId": AMOY_CHAIN_ID,
                    "nonce": nonce,
                    "to": self.address,
                    "value": 0,
                    "data": data,
                    "gas": int(gas * 1.2),
                    "maxPriorityFeePerGas": priority,
                    "maxFeePerGas": base_fee * 2 + priority,
                }
                signed = self._account.sign_transaction(transaction)
                raw = signed.raw_transaction.hex()
                tx_hash = self._rpc("eth_sendRawTransaction", [raw if raw.startswith("0x") else "0x" + raw])
                nonce += 1
                receipts.append(AnchorReceipt(status="pending", network=AMOY_NETWORK, tx_hash=tx_hash))
            except Exception as error:  # noqa: BLE001
                log.warning("Anchoring %s failed: %s", hash_hex[:12], error)
                receipts.append(AnchorReceipt(status="failed", network=AMOY_NETWORK, error=str(error)))
        return receipts

    def verify(self, hash_hex: str, tx_hash: str | None) -> AnchorReceipt:
        if tx_hash is None:
            return AnchorReceipt(status="not-anchored")
        try:
            transaction = self._rpc("eth_getTransactionByHash", [tx_hash])
            if transaction is None:
                return AnchorReceipt(status="pending", network=AMOY_NETWORK, tx_hash=tx_hash)
            if str(transaction.get("input", "")).lower() != self._data(hash_hex):
                return AnchorReceipt(status="failed", network=AMOY_NETWORK, tx_hash=tx_hash,
                                     error="The transaction does not carry this certificate hash.")
            receipt = self._rpc("eth_getTransactionReceipt", [tx_hash])
            if receipt is None:
                return AnchorReceipt(status="pending", network=AMOY_NETWORK, tx_hash=tx_hash)
            if int(receipt.get("status", "0x0"), 16) != 1:
                return AnchorReceipt(status="failed", network=AMOY_NETWORK, tx_hash=tx_hash,
                                     error="The anchoring transaction was reverted.")
            return AnchorReceipt(status="anchored", network=AMOY_NETWORK, tx_hash=tx_hash,
                                 block_number=int(receipt["blockNumber"], 16))
        except Exception as error:  # noqa: BLE001
            return AnchorReceipt(status="pending", network=AMOY_NETWORK, tx_hash=tx_hash,
                                 error=f"Could not reach Polygon Amoy: {error}")

    def info(self) -> ChainInfo:
        balance: str | None = None
        message: str | None = None
        try:
            wei = int(self._rpc("eth_getBalance", [self.address, "latest"]), 16)
            balance = f"{Decimal(wei) / Decimal(10**18):.4f}"
            if wei == 0:
                message = "The wallet has no POL. Get test POL from the Amoy faucet."
        except Exception as error:  # noqa: BLE001
            message = f"Could not reach Polygon Amoy: {error}"
        return ChainInfo(
            adapter=self.adapter,
            configured=True,
            network=AMOY_NETWORK,
            chain_id=AMOY_CHAIN_ID,
            address=self.address,
            balance=balance,
            explorer_url=f"{AMOY_EXPLORER}/address/{self.address}",
            message=message,
        )


@lru_cache(maxsize=1)
def get_anchor() -> ChainAnchor:
    if settings.polygon_private_key:
        try:
            return PolygonAmoyAnchor(settings.polygon_private_key, settings.polygon_rpc_url)
        except Exception as error:  # noqa: BLE001
            log.error("ARMT_POLYGON_PRIVATE_KEY is not a valid key (%s); anchoring is off.", error)
    return StubAnchor()
