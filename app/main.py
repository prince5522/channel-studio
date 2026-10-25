from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .splitter import decode_document, split_document

logging.basicConfig(level=logging.INFO, format="%(message)s")
API_LOGGER = logging.getLogger("episode_splitter.api")
app = FastAPI(title="Channel Studio Autonomous Episode Splitter", version="1.0.0")


class SplitOptions(BaseModel):
    auto_episode_count: bool = True
    preserve_full_text: bool = True
    generate_titles: bool = True
    target_episode_length: str = "auto"


class SplitRequest(BaseModel):
    document: str = Field(min_length=1)
    document_encoding: str = "text"
    options: SplitOptions = Field(default_factory=SplitOptions)
    season: int = Field(default=1, ge=1)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "autonomous-episode-splitter"}


@app.post("/api/stories/split")
async def split_story(request: Request) -> JSONResponse:
    try:
        payload: dict[str, Any] = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Request body must be a JSON object")

    supplied_count_fields = {"episode_count", "desired_episode_count", "target_episode_count", "number_of_episodes"}
    nested_options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
    supplied = sorted((set(payload) | set(nested_options)) & supplied_count_fields)
    if supplied:
        API_LOGGER.warning(json.dumps({
            "event": "client_episode_count_ignored", "fields": supplied,
            "message": "Episode count is computed by the server and client values were ignored."
        }))

    try:
        parsed = SplitRequest.model_validate(payload)
        document = decode_document({
            "document": parsed.document,
            "document_encoding": parsed.document_encoding,
        })
        result = split_document(document, season=parsed.season)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        API_LOGGER.exception(json.dumps({"event": "split_failed", "error_type": type(exc).__name__}))
        raise HTTPException(status_code=500, detail="Unable to split document") from exc

    # Options cannot override autonomous count or verbatim-preservation behavior.
    API_LOGGER.info(json.dumps({
        "event": "api_split_complete", "episode_count": result["episode_count"],
        "season": result["season"], "method": result["metadata"]["method"]
    }))
    return JSONResponse(content=result)
