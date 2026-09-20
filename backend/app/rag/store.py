"""RAG design knowledge base (ChromaDB). Swap for Pinecone/FAISS behind the same interface."""
import chromadb
from sentence_transformers import SentenceTransformer
from .tokens import synthesize_tokens as _synth

class DesignKB:
    def __init__(self, path="./.chroma", embed_model="all-MiniLM-L6-v2"):
        self.client = chromadb.PersistentClient(path=path)
        self.fonts = self.client.get_or_create_collection("fonts", metadata={"hnsw:space": "cosine"})
        self.tokens = self.client.get_or_create_collection("tokens", metadata={"hnsw:space": "cosine"})
        self.enc = SentenceTransformer(embed_model)

    def _emb(self, texts): return self.enc.encode(texts, normalize_embeddings=True).tolist()

    def ingest_fonts(self, records: list, batch=512):
        """records: {id, family, weight, category, license, description, css_url}"""
        for i in range(0, len(records), batch):
            b = records[i:i + batch]
            docs = [f"{r['family']} {r['weight']} {r['category']} {r.get('description','')}" for r in b]
            self.fonts.upsert(ids=[r["id"] for r in b], documents=docs, embeddings=self._emb(docs),
                              metadatas=[{k: v for k, v in r.items() if k != "id"} for r in b])

    def match_font(self, descriptor: str, k=3):
        r = self.fonts.query(query_embeddings=self._emb([descriptor]), n_results=k)
        return [{"id": i, "distance": d, **m} for i, d, m in zip(r["ids"][0], r["distances"][0], r["metadatas"][0])]

    def match_tokens(self, descriptor: str, system: str | None = None, k=5):
        r = self.tokens.query(query_embeddings=self._emb([descriptor]), n_results=k,
                              where={"system": system} if system else None)
        return r["metadatas"][0]

    @staticmethod
    def synthesize_tokens(layers: list) -> dict:
        return _synth(layers)
