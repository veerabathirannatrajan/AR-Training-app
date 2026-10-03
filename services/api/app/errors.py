from fastapi import HTTPException, status


def api_error(
    status_code: int, code: str, message: str, retry_after_seconds: int | None = None
) -> HTTPException:
    """Error body shape shared with the clients: {"detail": {"code", "message", ...}}."""
    detail: dict[str, object] = {"code": code, "message": message}
    headers = None
    if retry_after_seconds is not None:
        detail["retryAfterSeconds"] = retry_after_seconds
        headers = {"Retry-After": str(retry_after_seconds)}
    return HTTPException(status_code=status_code, detail=detail, headers=headers)


def not_found(message: str) -> HTTPException:
    return api_error(status.HTTP_404_NOT_FOUND, "not-found", message)


def conflict(message: str) -> HTTPException:
    return api_error(status.HTTP_409_CONFLICT, "conflict", message)


def bad_request(message: str) -> HTTPException:
    return api_error(status.HTTP_422_UNPROCESSABLE_CONTENT, "validation", message)
