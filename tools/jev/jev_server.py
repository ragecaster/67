#!/usr/bin/env python3
"""Local Jev-style decision server for the Terrari67 bot.

Loads NanoJev (C-Tianyu/NanoJev, a 0.6B "nano replica of Jev": Qwen3-0.6B backbone + candidate-set
scoring head) once and serves typed decisions in one forward pass per question, no text generation:

  POST /v1/systemone
  {"state": "...", "questions": {"next": {"type": "choice", "instructions": "...",
                                          "criteria": {"fight": "...", "retreat": "..."}}}}
  -> {"answers": {"next": {"type": "choice", "choice": "fight", "probabilities": {...}}}, "ms": 41.2}

Question types: choice (criteria = {id: description}), boolean (criteria optional {"true": ..., "false": ...}),
score (criteria = list of ordered level descriptions). Same shape as OpenJev's /v1/systemone.

Run:  tools/jev/.venv/bin/python tools/jev/jev_server.py [--device mps|cpu] [--dtype fp16|fp32] [--port 8167]
Setup (once): see tools/jev/README.md
"""
import argparse, json, math, os, sys, time, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / "models" / "nanojev"
sys.path.insert(0, str(MODEL_DIR / "source" / "scripts"))


class Engine:
    def __init__(self, device="mps", dtype="fp16", max_length=1024):
        os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1")
        import torch
        from safetensors.torch import load_file
        from transformers import AutoConfig, AutoModel, AutoTokenizer
        import predict_toy_decisions as P
        self.P, self.torch = P, torch
        if device == "mps" and not torch.backends.mps.is_available():
            device = "cpu"
        self.device = torch.device(device)
        cfg = json.loads((MODEL_DIR / "config.json").read_text())
        self.tok = AutoTokenizer.from_pretrained(str(MODEL_DIR / "tokenizer"), local_files_only=True)
        if self.tok.pad_token_id is None:
            self.tok.pad_token = self.tok.eos_token
        body_cfg = AutoConfig.from_pretrained(str(MODEL_DIR / "backbone_config"), local_files_only=True)
        body_cfg.use_cache = False
        body = AutoModel.from_config(body_cfg, attn_implementation="sdpa").float()
        DecisionModel = P.load_decision_model_class()
        model = DecisionModel(body, cfg["set_head"])
        model.load_state_dict(load_file(str(MODEL_DIR / "best.safetensors"), device="cpu"), strict=True)
        self.dtype = torch.float16 if (dtype == "fp16" and self.device.type != "cpu") else torch.float32
        model.to(device=self.device, dtype=self.dtype).eval()
        # the decision head is tiny: keep it in fp32 for stable probabilities
        for name in ("norm", "scalar", "set_project", "set_attention", "set_output"):
            if hasattr(model, name):
                getattr(model, name).float()
        self.model, self.max_length = model, max_length
        self.lock = threading.Lock()
        self.calls = 0

    def decide(self, state, questions, temperature=1.0):
        P, torch = self.P, self.torch
        payload = {"states": [{"id": "s", "state": state, "questions": questions}]}
        examples = P.prepare_examples(payload, self.tok, self.max_length)
        t0 = time.perf_counter()
        with self.lock, torch.inference_mode():
            # the backbone runs in fp16/fp32; the head casts its own inputs
            head_dtype = torch.float32
            orig_norm = self.model.norm.forward
            def norm32(x):
                return orig_norm(x.to(head_dtype))
            self.model.norm.forward = norm32
            try:
                logits, _ = self.model(examples, self.tok.pad_token_id)
            finally:
                self.model.norm.forward = orig_norm
            if self.device.type == "mps":
                torch.mps.synchronize()
        ms = (time.perf_counter() - t0) * 1000
        answers = {}
        for ex, row in zip(examples, logits):
            k = len(ex["candidate_ids"])
            probs = (row[:k].float() / temperature).softmax(-1).cpu().tolist()
            answers[ex["qid"]] = P.answer_from_probabilities(ex, probs)
        self.calls += 1
        return {"answers": answers, "ms": round(ms, 1), "model": "NanoJev-0.6B (unified-games-v1)", "device": str(self.device)}


def make_handler(engine):
    class H(BaseHTTPRequestHandler):
        def _send(self, code, obj):
            body = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self._send(204, {})

        def do_GET(self):
            if self.path.startswith("/health"):
                self._send(200, {"ok": True, "model": "NanoJev-0.6B", "device": str(engine.device), "calls": engine.calls})
            else:
                self._send(404, {"error": "POST /v1/systemone"})

        def do_POST(self):
            if not self.path.startswith("/v1/systemone"):
                return self._send(404, {"error": "unknown endpoint"})
            try:
                req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                res = engine.decide(req["state"], req["questions"], float(req.get("temperature", 1.0)))
                self._send(200, res)
            except Exception as e:  # report bad requests instead of crashing the server
                self._send(400, {"error": f"{type(e).__name__}: {e}"})

        def log_message(self, *a):
            pass
    return H


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--device", default="mps")
    ap.add_argument("--dtype", default="fp16")
    ap.add_argument("--port", type=int, default=8167)
    ap.add_argument("--bench", action="store_true", help="time a few decisions and exit")
    a = ap.parse_args()
    t0 = time.time()
    engine = Engine(a.device, a.dtype)
    print(f"NanoJev loaded on {engine.device} ({engine.dtype}) in {time.time() - t0:.1f}s", flush=True)
    if a.bench:
        state = ("Terraria. Player life 64/200, defense 12. Depth: caverns, 40 tiles below the surface. "
                 "Holding: The 67 (sword). Enemies: Mewing Skeleton 3 tiles left, Crashout Bat 6 tiles up-right. "
                 "Inventory: 2 healing potions, 120 dirt blocks. Current task: mining iron ore.")
        qs = {"action": {"type": "choice", "instructions": "What should the player do right now?",
                         "criteria": {"fight": "Attack the nearest enemy.", "retreat": "Move away from the enemies.",
                                      "heal": "Drink a healing potion.", "continue": "Keep mining iron ore."}},
              "danger": {"type": "boolean", "instructions": "Is the player in danger of dying soon?"}}
        for i in range(6):
            r = engine.decide(state, qs)
            print(json.dumps(r))
        return
    srv = ThreadingHTTPServer(("127.0.0.1", a.port), make_handler(engine))
    print(f"Jev decision server on http://127.0.0.1:{a.port}/v1/systemone", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
