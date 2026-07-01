from typing import Any, Literal
from urllib.parse import urljoin

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator
from starlette.background import BackgroundTask

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatCompletionRequest(BaseModel):
    apiKey: str = Field(min_length=1)
    baseUrl: str = "https://api.deepseek.com"
    model: str = "deepseek-chat"
    messages: list[ChatMessage]
    temperature: float | None = None
    max_tokens: int | None = None
    stream: bool = False

    @field_validator("baseUrl")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        value = value.strip().rstrip("/") or "https://api.deepseek.com"
        if not value.startswith(("http://", "https://")):
            raise ValueError("baseUrl must start with http:// or https://")
        return value


def build_upstream_payload(payload: ChatCompletionRequest) -> dict[str, Any]:
    body: dict[str, Any] = {
        "model": payload.model or "deepseek-chat",
        "messages": [message.model_dump() for message in payload.messages],
        "stream": payload.stream,
    }
    if payload.temperature is not None:
        body["temperature"] = payload.temperature
    if payload.max_tokens is not None:
        body["max_tokens"] = payload.max_tokens
    return body


@router.post("/chat/completions")
async def chat_completions(
    payload: ChatCompletionRequest,
):
    upstream_url = urljoin(f"{payload.baseUrl}/", "chat/completions")
    headers = {
        "Authorization": f"Bearer {payload.apiKey}",
        "Content-Type": "application/json",
    }
    upstream_payload = build_upstream_payload(payload)

    timeout = httpx.Timeout(60.0, connect=10.0, read=None if payload.stream else 60.0)

    if not payload.stream:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(upstream_url, headers=headers, json=upstream_payload)
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.text or "AI provider request failed",
                )
            return response.json()

    client = httpx.AsyncClient(timeout=timeout)
    request = client.build_request("POST", upstream_url, headers=headers, json=upstream_payload)
    response = await client.send(request, stream=True)

    if response.status_code >= 400:
        error_text = await response.aread()
        await response.aclose()
        await client.aclose()
        return JSONResponse(
            status_code=response.status_code,
            content={"detail": error_text.decode("utf-8", errors="replace") or "AI provider request failed"},
        )

    async def stream_response():
        async for chunk in response.aiter_bytes():
            yield chunk

    async def close_upstream():
        await response.aclose()
        await client.aclose()

    return StreamingResponse(
        stream_response(),
        media_type=response.headers.get("content-type", "text/event-stream"),
        background=BackgroundTask(close_upstream),
    )
