from __future__ import annotations

import base64
import json
import logging
import math
import re
from bisect import bisect_left, bisect_right
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

LOGGER = logging.getLogger("episode_splitter.audit")
CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "boundary_terms.json"

# These are structural markers, not story-specific content. Terms for narrative
# signals are loaded from the configurable JSON file above.
PAGE_MARKER = re.compile(r"(?im)^\s*={3,}\s*page\s+(\d+)\s*={3,}\s*$")
CHAPTER_MARKER = re.compile(
    r"(?im)^\s*(?:chapter|chapitre|cap[ií]tulo|sura|episode|ep\.?|season|msimu|sehemu)\s+[^\n]{1,100}\s*$"
)
END_MARKER = re.compile(
    r"(?im)^\s*(?:to be continued\s*!?|end of (?:the )?(?:chapter|episode|season)|mwisho wa (?:sura|sehemu)|continuar[aá])\s*[.!?]*\s*$"
)
DIALOGUE_LINE = re.compile(r"^\s*[\"'“‘«¿].{0,500}[\"'”’»?!…]\s*$")
WORD_RE = re.compile(r"[\wÀ-ÖØ-öø-ÿ'-]+", re.UNICODE)

STOP_WORDS = set((
    "a an and are as at be been being but by for from had has have he her hers him his i if in into is it its me my of on or our ours she so than that the their them then there these they this those to too was we were what when where which who why will with you your yours not no yes do did does can could would should may might must very just also only still now here there"
    " na ya wa ni kwa katika kutoka hadi lakini au kama kwamba yeye wao mimi sisi wewe hii hiyo hizi hizo yake yao yangu yako sana tena bado sasa basi kwani alikuwa walikuwa nikasema akasema alisema aka akawa kuwa kwenye baada kabla siku usiku asubuhi leo jana kesho"
    " el la los las un una unos unas y o de del en por para con sin que es era fue al lo le les se su sus yo tú él ella ellos ellas mi mis como cuando donde quien porque muy ya pero no sí"
    " le la les un une des du de et ou dans pour avec sans que est était je tu il elle nous vous ils elles mon ma mes son sa ses"
).split())


def load_config() -> dict[str, list[str]]:
    """Load multilingual signal vocabularies; deployments can edit this file."""
    try:
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return {key: [str(term).casefold() for term in values if str(term).strip()]
                for key, values in data.items() if isinstance(values, list)}
    except (OSError, json.JSONDecodeError) as exc:
        LOGGER.error(json.dumps({"event": "boundary_config_error", "error": str(exc)}))
        return {"time_jumps": [], "motion_verbs": [], "place_cues": [], "cliffhanger_cues": [], "closure_cues": []}


@dataclass
class Candidate:
    pos: int
    score: int = 0
    signals: list[str] = field(default_factory=list)
    hard: bool = False

    def add(self, points: int, signal: str, hard: bool = False) -> None:
        if signal not in self.signals:
            self.score += points
            self.signals.append(signal)
        self.hard = self.hard or hard


def _line_offsets(text: str):
    start = 0
    for line in text.splitlines(keepends=True):
        end = start + len(line)
        yield start, end, line
        start = end
    if start < len(text):
        yield start, len(text), text[start:]


def _contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.casefold()
    return any(term in lowered for term in terms)


def _build_candidates(text: str, config: dict[str, list[str]]) -> list[Candidate]:
    """Create scored boundaries at structural, paragraph, and sentence edges."""
    by_pos: dict[int, Candidate] = {}

    def candidate(pos: int) -> Candidate:
        pos = max(1, min(len(text) - 1, pos))
        if pos not in by_pos:
            by_pos[pos] = Candidate(pos)
        return by_pos[pos]

    lines = list(_line_offsets(text))
    for index, (start, end, line) in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            if start > 0 and start < len(text):
                candidate(start).add(0, "paragraph_boundary")
            continue

        if PAGE_MARKER.match(stripped) or CHAPTER_MARKER.match(stripped):
            if start > 0:
                candidate(start).add(2, "hard_page_or_chapter_break", hard=True)
            # Preserve the marker as part of the original text; end markers
            # close the preceding beat, while chapter headings start the next.
            if END_MARKER.match(stripped):
                candidate(end).add(2, "explicit_end_marker", hard=True)
            continue
        if END_MARKER.match(stripped):
            candidate(end).add(2, "explicit_end_marker", hard=True)

        lowered = stripped.casefold()
        if _contains_any(lowered, config.get("time_jumps", [])):
            candidate(start if start > 0 else end).add(3, "time_jump")

        motion = config.get("motion_verbs", [])
        places = config.get("place_cues", [])
        if _contains_any(lowered, motion) and _contains_any(lowered, places):
            candidate(start if start > 0 else end).add(2, "location_shift")

        if _contains_any(lowered, config.get("cliffhanger_cues", [])) or re.search(r"[?？！]\s*[\"'”’»)]*\s*$", stripped):
            candidate(end).add(5, "cliffhanger_cue")

        if _contains_any(lowered, config.get("closure_cues", [])):
            candidate(end).add(4, "scene_closure")

        # Dialogue cluster start: first quoted line after a non-dialogue line.
        if index > 0 and DIALOGUE_LINE.match(stripped):
            prev = lines[index - 1][2].strip()
            if prev and not DIALOGUE_LINE.match(prev) and start > 0:
                candidate(start).add(0, "dialogue_cluster_start")

        # Sentence end candidates include common punctuation and paragraph edges.
        if re.search(r"[.!?…。！？؟][\"'”’»)]*\s*$", stripped) and end < len(text):
            c = candidate(end)
            if not c.signals:
                c.add(0, "sentence_boundary")

    # Candidate positions that land inside a sentence or an open dialogue line
    # are penalized; paragraph and structural positions are naturally safer.
    for c in by_pos.values():
        left = text[:c.pos].rstrip()
        right = text[c.pos:].lstrip()
        if left and right and left[-1] not in ".!?…。！？؟\"'”’»)]}" and "paragraph_boundary" not in c.signals and not c.hard:
            c.add(-10, "mid_sentence_cut")
        straight_quotes = left.count('"') % 2
        curly_open = left.count('“') + left.count('‘')
        curly_close = left.count('”') + left.count('’')
        guillemet_open = left.count('«')
        guillemet_close = left.count('»')
        if straight_quotes or curly_open > curly_close or guillemet_open > guillemet_close:
            c.add(-5, "mid_dialogue_cut")
        # Avoid an empty or whitespace-only side.
        if not left or not right:
            c.score -= 100
    return [by_pos[p] for p in sorted(by_pos)]


def _choose_cuts(text: str, candidates: list[Candidate]) -> tuple[list[int], float]:
    """Dynamic programming maximizes scored cuts with auto-derived length bounds."""
    n = len(text)
    if n < 2 or not candidates:
        return [], float(max(1, n))

    positive = [c for c in candidates if c.score > 0 and 0 < c.pos < n]
    # Derive target size from document size and the number of meaningful candidate
    # boundaries. This is not an episode count; the DP determines the count.
    target = n / max(1, len(positive) + 1)
    min_len = max(1, int(target * 0.45))
    max_len = max(min_len + 1, int(target * 1.8))

    points = [Candidate(0, 0, ["document_start"], True)] + candidates + [Candidate(n, 0, ["document_end"], True)]
    points.sort(key=lambda c: c.pos)
    # Deduplicate positions (the builder already does so, but keep DP defensive).
    unique: list[Candidate] = []
    for p in points:
        if unique and unique[-1].pos == p.pos:
            unique[-1].score = max(unique[-1].score, p.score)
            unique[-1].signals = list(dict.fromkeys(unique[-1].signals + p.signals))
            unique[-1].hard = unique[-1].hard or p.hard
        else:
            unique.append(p)
    positions = [p.pos for p in unique]
    neg_inf = float("-inf")
    best = [neg_inf] * len(unique)
    prev = [-1] * len(unique)
    best[0] = 0.0

    for j in range(1, len(unique)):
        end_pos = positions[j]
        lo = bisect_left(positions, end_pos - max_len, 0, j)
        hi = bisect_right(positions, end_pos - min_len, 0, j)
        possible = range(lo, hi)
        # If the segment is shorter than the auto-derived minimum, allow it only
        # when no feasible predecessor exists (short source / hard segmentation).
        if lo >= hi:
            possible = range(max(0, j - 1), j)
        for i in possible:
            if best[i] == neg_inf:
                continue
            seg_len = end_pos - positions[i]
            ratio = seg_len / max(1.0, target)
            length_penalty = 1.8 * abs(math.log(max(0.01, ratio)))
            # The end of the document is not itself a cut; intermediate candidate
            # scores are rewarded. Hard breaks remain candidates, not forced cuts.
            reward = 0.0 if j == len(unique) - 1 else unique[j].score
            score = best[i] + reward - length_penalty
            if score > best[j]:
                best[j] = score
                prev[j] = i

    if prev[-1] == -1:
        # Fallback still preserves text: one episode for a document with no viable cuts.
        return [], target
    selected: list[int] = []
    cursor = len(unique) - 1
    while cursor > 0:
        prior = prev[cursor]
        if prior < 0:
            return [], target
        if cursor != len(unique) - 1 and unique[cursor].pos not in (0, n):
            selected.append(unique[cursor].pos)
        cursor = prior
    return sorted(set(selected)), target


def _page_starts(text: str) -> list[tuple[int, int]]:
    markers = [(m.start(), int(m.group(1))) for m in PAGE_MARKER.finditer(text)]
    if not markers:
        return [(0, 1)]
    result = [(0, max(1, markers[0][1] - 1))]
    result.extend(markers)
    # Keep starts sorted and remove duplicate offsets.
    dedup: dict[int, int] = {}
    for pos, page in result:
        dedup[pos] = page
    return sorted(dedup.items())


def _page_for_offset(offset: int, starts: list[tuple[int, int]]) -> int:
    page = 1
    for pos, value in starts:
        if pos > offset:
            break
        page = value
    return max(1, page)


def _title_for(text: str, used: set[str]) -> tuple[str, float]:
    """Create a deterministic title from salient words and lines in this episode."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?…。！？؟])\s+|\n+", text) if s.strip()]
    if not sentences:
        return "Untitled Passage", 0.0
    # Give the opening and final beats extra weight; no story-specific title list.
    weighted: Counter[str] = Counter()
    for index, sentence in enumerate(sentences):
        words = [w.casefold().strip("'-") for w in WORD_RE.findall(sentence)]
        weight = 1.8 if index == len(sentences) - 1 else (1.3 if index == 0 else 1.0)
        for word in words:
            if len(word) > 2 and word not in STOP_WORDS and not word.isdigit():
                weighted[word] += weight
    if not weighted:
        seed = " ".join(WORD_RE.findall(sentences[0])[:3]) or "Untitled Passage"
        title = " ".join(w.capitalize() for w in seed.split())[:72]
        return title, 0.2
    top = sorted(weighted.items(), key=lambda pair: (-pair[1], pair[0]))
    chosen = [word for word, _ in top[:3]]
    # Prefer a title that reads like a phrase by preserving source-word order.
    first_line_words = [w.casefold().strip("'-") for w in WORD_RE.findall(sentences[0])]
    last_line_words = [w.casefold().strip("'-") for w in WORD_RE.findall(sentences[-1])]
    ordered = []
    for word in first_line_words + last_line_words:
        if word in chosen and word not in ordered:
            ordered.append(word)
    ordered.extend(word for word in chosen if word not in ordered)
    title_words = ordered[:3]
    title = " ".join(word[:1].upper() + word[1:] for word in title_words).strip() or "Untitled Passage"
    base = title
    index = 2
    while title.casefold() in used:
        extra = next((w for w, _ in top[3:] if w.casefold() not in title.casefold()), None)
        title = f"{base} {extra.capitalize()}" if extra else f"{base} · {index}"
        index += 1
    used.add(title.casefold())
    confidence = min(1.0, 0.35 + (len(title_words) * 0.15) + (top[0][1] / max(1.0, sum(weighted.values()))))
    return title, round(confidence, 3)


def split_document(document: str, season: int = 1) -> dict[str, Any]:
    if not isinstance(document, str) or not document.strip():
        raise ValueError("document must be a non-empty text string")
    config = load_config()
    candidates = _build_candidates(document, config)
    cuts, target = _choose_cuts(document, candidates)
    offsets = [0] + cuts + [len(document)]
    page_starts = _page_starts(document)
    explicit_pages = [int(m.group(1)) for m in PAGE_MARKER.finditer(document)]
    total_pages = max(explicit_pages) if explicit_pages else 1
    episodes = []
    used_titles: set[str] = set()
    candidate_by_pos = {c.pos: c for c in candidates}

    for index, (start, end) in enumerate(zip(offsets, offsets[1:]), start=1):
        original = document[start:end]
        if not original:
            continue
        title, title_score = _title_for(original, used_titles)
        lines = original.splitlines()
        start_line = next((line.strip() for line in lines if line.strip()), "")
        end_line = next((line.strip() for line in reversed(lines) if line.strip()), "")
        start_page = _page_for_offset(start, page_starts)
        end_page = _page_for_offset(max(start, end - 1), page_starts)
        end_candidate = candidate_by_pos.get(end)
        cut_score = int(end_candidate.score) if end < len(document) and end_candidate else 0
        final_line = end_line.casefold()
        hook_score = 0.25
        if re.search(r"[?？！]", end_line):
            hook_score += 0.4
        if _contains_any(final_line, config.get("cliffhanger_cues", [])):
            hook_score += 0.4
        if end_candidate and "scene_closure" in end_candidate.signals:
            hook_score += 0.15
        hook_score = round(min(1.0, hook_score), 3)
        episode = {
            "number": len(episodes) + 1,
            "title": title,
            "page_range": [start_page, max(start_page, end_page)],
            "start_line": start_line,
            "end_line": end_line,
            "text": original,
            "hook_score": hook_score,
            "cut_score": cut_score,
        }
        episodes.append(episode)
        LOGGER.info(json.dumps({
            "event": "episode_title_decision", "episode_number": episode["number"],
            "title": title, "title_score": title_score, "page_range": episode["page_range"]
        }, ensure_ascii=False))

    # Auditable cuts contain positions/scores/signals only, never the user's story text.
    LOGGER.info(json.dumps({
        "event": "autonomous_split_decision", "decision": "autonomous",
        "method": "narrative-boundary-dp", "episode_count": len(episodes),
        "total_characters": len(document), "total_pages": total_pages,
        "auto_target_characters": round(target, 2),
        "cuts": [{"position": pos, "score": candidate_by_pos[pos].score,
                   "signals": candidate_by_pos[pos].signals} for pos in cuts if pos in candidate_by_pos]
    }, ensure_ascii=False))

    return {
        "season": season,
        "episode_count": len(episodes),
        "episodes": episodes,
        "metadata": {
            "method": "narrative-boundary-dp",
            "decision": "autonomous",
            "total_pages": total_pages,
        },
    }


def decode_document(payload: dict[str, Any]) -> str:
    document = payload.get("document")
    encoding = str(payload.get("document_encoding", "text")).casefold()
    if not isinstance(document, str):
        raise ValueError("document must be a string")
    if encoding == "base64":
        try:
            return base64.b64decode(document, validate=True).decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise ValueError("document is not valid base64-encoded UTF-8 text") from exc
    if encoding != "text":
        raise ValueError("document_encoding must be 'text' or 'base64'")
    return document
