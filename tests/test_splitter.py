import base64
import json
import logging

from fastapi.testclient import TestClient

from app.main import app
from app.splitter import split_document

client = TestClient(app)


def make_english_document() -> str:
    beats = [
        "Chapter One\nThe rain eased over the quiet town. Mara checked the letter twice before folding it away.\n",
        "The following morning, Mara walked through the gate and entered the office. The clerk looked up from a stack of papers.\n",
        '"You came earlier than expected," the clerk said. Mara placed the sealed envelope on the desk.\n',
        "A knock came from the corridor. The clerk stopped speaking and stared at the door. Who could be waiting at this hour?\n",
        "The interview ended without an answer. Mara left in silence, keeping one hand over the empty pocket.\n",
    ]
    return "===== Page 1 =====\n" + "\n".join(beats) + "===== Page 2 =====\n" + (
        "Later that day, the hallway was empty. Mara returned to the gate and heard footsteps behind her.\n"
        "Before she could turn around, someone whispered her name.\n"
    )


def make_swahili_document() -> str:
    beats = [
        "Sura ya kwanza\nAsubuhi ilikuwa tulivu. Asha alifunga daftari na kusimama karibu na dirisha.\n",
        "Kesho yake, Asha akatoka nyumbani akaingia kwa gate. Alifika ofisini kabla ya wengine.\n",
        '"Umefika mapema," mlinzi alisema. Asha aliuliza kama ujumbe ulikuwa umeletwa.\n',
        "Giza ikashika. Mtu akabisha mlangoni, kisha kila mtu akanyamaza. Nani huyo?\n",
        "Mazungumzo yakaisha na Asha akaondoka. Alipofika barabarani, simu yake ikalia tena.\n",
    ]
    return "\n".join(beats)


def make_spanish_document() -> str:
    beats = [
        "Capítulo inicial\nLa plaza quedó vacía después de la lluvia. Elena guardó la nota dentro del bolso.\n",
        "Al día siguiente, Elena salió de casa y entró en la oficina. Nadie levantó la mirada.\n",
        '"¿Trajiste la copia?", preguntó el encargado. Elena dejó el sobre junto a la ventana.\n',
        "De pronto, alguien llamó a la puerta. ¿Quién era? El encargado cerró el cuaderno y esperó.\n",
        "La entrevista terminó sin acuerdo. Elena salió a la calle, pero una voz la llamó desde atrás.\n",
    ]
    return "\n".join(beats)


def test_count_is_autonomous_and_client_count_is_ignored(caplog):
    caplog.set_level(logging.INFO)
    docs = [make_english_document(), make_swahili_document(), make_spanish_document()]
    outputs = [split_document(doc) for doc in docs]
    assert all(out["episode_count"] == len(out["episodes"]) for out in outputs)
    assert all(out["episode_count"] >= 1 for out in outputs)
    # The source documents differ in structure and length; the engine decides the count.
    assert len({out["episode_count"] for out in outputs}) > 1

    response = client.post("/api/stories/split", json={
        "document": make_english_document(),
        "episode_count": 999,
        "options": {"desired_episode_count": 999, "auto_episode_count": True},
    })
    assert response.status_code == 200
    body = response.json()
    assert body["episode_count"] == len(body["episodes"])
    assert body["episode_count"] != 999
    assert "client_episode_count_ignored" in caplog.text


def test_full_text_is_preserved_verbatim_in_order():
    docs = [make_english_document(), make_swahili_document(), make_spanish_document()]
    for document in docs:
        result = split_document(document)
        reconstructed = "".join(episode["text"] for episode in result["episodes"])
        assert reconstructed == document
        assert all(episode["text"] for episode in result["episodes"])
        assert all(episode["start_line"] for episode in result["episodes"])
        assert all(episode["end_line"] for episode in result["episodes"])
    assert "===== Page 1 =====" in "".join(e["text"] for e in split_document(docs[0])["episodes"])
    assert "===== Page 2 =====" in "".join(e["text"] for e in split_document(docs[0])["episodes"])


def test_titles_are_generated_from_each_document_and_not_fixed():
    first = split_document(make_english_document())
    second = split_document(make_swahili_document())
    first_titles = [episode["title"] for episode in first["episodes"]]
    second_titles = [episode["title"] for episode in second["episodes"]]
    assert all(title.strip() for title in first_titles + second_titles)
    assert len({title.casefold() for title in first_titles}) == len(first_titles)
    assert first_titles != second_titles


def test_scores_and_audit_logs_show_autonomous_decisions(caplog):
    caplog.set_level(logging.INFO)
    result = split_document(make_swahili_document())
    assert result["metadata"]["method"] == "narrative-boundary-dp"
    assert result["metadata"]["decision"] == "autonomous"
    assert all(isinstance(episode["cut_score"], int) for episode in result["episodes"])
    assert all(isinstance(episode["hook_score"], float) for episode in result["episodes"])
    assert '"event": "autonomous_split_decision"' in caplog.text
    assert '"event": "episode_title_decision"' in caplog.text
    assert '"episode_count":' in caplog.text
    assert '"cuts":' in caplog.text


def test_base64_text_request_and_health_endpoint():
    document = make_english_document()
    encoded = base64.b64encode(document.encode("utf-8")).decode("ascii")
    response = client.post("/api/stories/split", json={
        "document": encoded,
        "document_encoding": "base64",
        "options": {"auto_episode_count": True, "preserve_full_text": True,
                         "generate_titles": True, "target_episode_length": "auto"},
    })
    assert response.status_code == 200
    assert "".join(e["text"] for e in response.json()["episodes"]) == document
    assert client.get("/health").json()["status"] == "ok"


def test_boundary_scores_match_the_defined_weights():
    from app.splitter import _build_candidates, load_config

    document = (
        "===== Page 1 =====\n"
        "The first paragraph ends here.\n\n"
        "The following morning, sunlight appeared.\n"
        "I walked into the office.\n"
        "Who was there?\n"
        "The interview ended.\n\n"
        "A new paragraph starts here.\n"
        "===== Page 2 =====\n"
        "The day continued.\n"
    )
    candidates = _build_candidates(document, load_config())
    def with_signal(signal):
        return [candidate for candidate in candidates if signal in candidate.signals]

    hard = with_signal("hard_page_or_chapter_break")
    time_jump = with_signal("time_jump")
    location = with_signal("location_shift")
    cliffhanger = with_signal("cliffhanger_cue")
    closure = with_signal("scene_closure")
    assert hard and any(c.score >= 2 for c in hard)
    assert time_jump and any(c.score == 3 for c in time_jump)
    assert location and any(c.score == 2 for c in location)
    assert cliffhanger and any(c.score == 5 for c in cliffhanger)
    assert closure and any(c.score == 4 for c in closure)
