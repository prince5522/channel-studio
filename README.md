# Autonomous Episode Splitter API

A story-agnostic FastAPI service for splitting long-form text into episodes. The server computes episode count; clients must not control it. This package contains no real manuscript or story-specific fixture.

## Run locally

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check: `GET /health`

Split endpoint: `POST /api/stories/split`

```json
{
  "document": "Chapter A\\nA visitor entered the office.\\nA knock came at the door. Who was there?",
  "options": {
    "auto_episode_count": true,
    "preserve_full_text": true,
    "generate_titles": true,
    "target_episode_length": "auto"
  }
}
```

Plain UTF-8 text is the default. To submit base64-encoded UTF-8 text, send `document_encoding: "base64"`. The API ignores any client-supplied `episode_count`, `desired_episode_count`, `target_episode_count`, or `number_of_episodes`, and writes a warning to the audit log.

## Algorithm

1. Identify explicit page/chapter/episode and end markers while retaining their original characters.
2. Detect configurable multilingual time jumps, motion-plus-place shifts, dialogue starts, cliffhangers, and closure cues.
3. Score boundaries using the specified values: hard break +2, time jump +3, location shift +2, cliffhanger +5, closure +4, mid-dialogue −5, mid-sentence −10.
4. Use dynamic programming to maximize boundary scores while applying a length range derived from source length and the number of positive candidate boundaries. Episode count is an output of the optimization.
5. Generate episode titles from each episode's own salient terms and lines.
6. Return the original text slices without normalization, trimming, summarizing, or paraphrasing.

Edit `config/boundary_terms.json` to add language-specific time, motion, place, cliffhanger, and closure phrases. Structural marker patterns are documented in `app/splitter.py` and are language-neutral/configurable by extending that module.

## Audit logging

The service logs `autonomous_split_decision`, `episode_title_decision`, `client_episode_count_ignored`, and `api_split_complete` JSON events. Logs contain decision positions, scores, signals, title decisions, counts, and metadata; they deliberately do not log manuscript text.

## Tests and release gate

```bash
pytest
```

The test suite builds synthetic English, Swahili, and Spanish documents in code; it does not commit a manuscript fixture. A separate manual GitHub Actions workflow (`Staging validation gate`) calls a deployed staging API with three generated multilingual documents and checks autonomous count consistency, varying outputs, generated titles, and verbatim reconstruction. Configure a protected `production` GitHub Environment with required reviewers and only release after the staging gate succeeds and a lead reviews the change. A staging pass is **not** claimed until the workflow has actually run against a deployed staging URL.

## Integration notes

GitHub Pages serves static files and cannot run this FastAPI service. Deploy this package to a Python-capable backend host, then have the frontend call the deployed API URL over HTTPS. Do not place private server credentials in frontend JavaScript. PDF and DOCX parsing are intentionally outside this endpoint: convert those files to selectable text first and submit that text, or add a dedicated extraction layer with its own tests.
