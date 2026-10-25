"""Run three generated multilingual smoke documents against a deployed staging API."""
from __future__ import annotations
import os
import sys
import requests


def generated_documents():
    return [
        "Chapter A\nA quiet street emptied after rain. The visitor opened a note.\n\nThe following morning, the visitor entered the office.\n\"Are you ready?\" the clerk asked.\nA knock came at the door. Who was there?\n",
        "Sura ya kwanza\nAsubuhi kulikuwa kimya. Mgeni alifungua daftari.\n\nKesho yake, mgeni akatoka nyumbani akaingia kwa office.\n\"Uko tayari?\" akauliza.\nMtu akabisha mlangoni. Nani huyo?\n",
        "Capítulo inicial\nLa calle quedó vacía. La visitante guardó una nota.\n\nAl día siguiente, entró en la oficina.\n\"¿Estás lista?\" preguntó la persona encargada.\nDe pronto, llamaron a la puerta. ¿Quién era?\n",
    ]


def main():
    base_url = os.environ.get("STAGING_API_URL", "").rstrip("/")
    if not base_url:
        print("Set STAGING_API_URL to the staging API base URL.", file=sys.stderr)
        return 2
    endpoint = base_url + "/api/stories/split"
    docs = generated_documents()
    counts = []
    for idx, document in enumerate(docs, start=1):
        response = requests.post(endpoint, json={
            "document": document,
            "options": {"auto_episode_count": True, "preserve_full_text": True,
                        "generate_titles": True, "target_episode_length": "auto"},
        }, timeout=90)
        response.raise_for_status()
        result = response.json()
        assert result["episode_count"] == len(result["episodes"]), f"doc {idx}: count mismatch"
        assert "".join(ep["text"] for ep in result["episodes"]) == document, f"doc {idx}: text changed"
        assert all(ep["title"] for ep in result["episodes"]), f"doc {idx}: missing title"
        counts.append(result["episode_count"])
        print(f"PASS generated document {idx}: {result['episode_count']} episodes; text preserved")
    if len(set(counts)) < 2:
        raise AssertionError("Generated staging documents did not produce varying autonomous counts")
    print("STAGING GATE PASSED: all three generated documents validated.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
