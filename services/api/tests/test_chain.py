"""Polygon Amoy adapter against a fake JSON-RPC node (no network)."""

from typing import Any

from eth_account import Account
from hexbytes import HexBytes

from app.chain import AMOY_CHAIN_ID, DATA_PREFIX, PolygonAmoyAnchor, StubAnchor

KEY = "0x" + "11" * 32
HASH = "ab" * 32


class FakeNode:
    def __init__(self) -> None:
        self.sent: list[str] = []
        self.mined: dict[str, dict[str, Any]] = {}

    def __call__(self, method: str, params: list[Any]) -> Any:
        if method == "eth_getTransactionCount":
            return "0x7"
        if method == "eth_getBlockByNumber":
            return {"baseFeePerGas": hex(30 * 10**9)}
        if method == "eth_maxPriorityFeePerGas":
            return hex(25 * 10**9)
        if method == "eth_estimateGas":
            return hex(21_600)
        if method == "eth_sendRawTransaction":
            self.sent.append(params[0])
            return "0x" + f"{len(self.sent):064x}"
        if method == "eth_getTransactionByHash":
            return self.mined.get(params[0], {}).get("tx")
        if method == "eth_getTransactionReceipt":
            return self.mined.get(params[0], {}).get("receipt")
        raise AssertionError(method)


def test_anchors_hash_in_a_signed_amoy_transaction() -> None:
    anchor = PolygonAmoyAnchor(KEY, "http://fake")
    node = FakeNode()
    anchor._rpc = node  # type: ignore[method-assign]
    [receipt] = anchor.anchor_many([HASH])
    assert receipt.status == "pending"
    assert receipt.tx_hash is not None

    decoded = Account.recover_transaction(node.sent[0])
    assert decoded == Account.from_key(KEY).address

    from eth_account.typed_transactions import TypedTransaction

    tx = TypedTransaction.from_bytes(HexBytes(node.sent[0])).as_dict()
    assert tx["chainId"] == AMOY_CHAIN_ID
    assert tx["nonce"] == 7
    assert "0x" + bytes(tx["to"]).hex() == anchor.address.lower()
    assert tx["value"] == 0
    assert bytes(tx["data"]).hex() == DATA_PREFIX + HASH
    assert tx["maxPriorityFeePerGas"] >= 30 * 10**9

    # Mined with the right data → anchored; wrong data → failed.
    node.mined[receipt.tx_hash] = {
        "tx": {"input": "0x" + DATA_PREFIX + HASH},
        "receipt": {"status": "0x1", "blockNumber": hex(123456)},
    }
    verified = anchor.verify(HASH, receipt.tx_hash)
    assert (verified.status, verified.block_number) == ("anchored", 123456)
    assert anchor.verify("cd" * 32, receipt.tx_hash).status == "failed"


def test_stub_never_claims_an_anchor() -> None:
    stub = StubAnchor()
    assert [r.status for r in stub.anchor_many([HASH, HASH])] == ["not-anchored", "not-anchored"]
    assert stub.info().configured is False
