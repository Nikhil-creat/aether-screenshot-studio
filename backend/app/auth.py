"""Minimal JWT auth (PBKDF2 password hashing, SQLite users). Set AETHER_JWT_SECRET in production."""
import os, hashlib, hmac, sqlite3, time, secrets
import jwt
SECRET = os.getenv("AETHER_JWT_SECRET") or secrets.token_hex(32)
DB = os.getenv("AETHER_DB", "aether.db")
def _db():
    c = sqlite3.connect(DB); c.execute("create table if not exists users(email text primary key, salt blob, pw blob, created real)"); return c
def _hash(pw: str, salt: bytes) -> bytes: return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
def register(email: str, pw: str):
    if len(pw) < 8: raise ValueError("password must be at least 8 characters")
    salt = os.urandom(16); c = _db()
    try: c.execute("insert into users values(?,?,?,?)", (email.lower(), salt, _hash(pw, salt), time.time())); c.commit()
    except sqlite3.IntegrityError: raise ValueError("email already registered")
def login(email: str, pw: str) -> str:
    row = _db().execute("select salt,pw from users where email=?", (email.lower(),)).fetchone()
    if not row or not hmac.compare_digest(_hash(pw, row[0]), row[1]): raise PermissionError("invalid credentials")
    return jwt.encode({"sub": email.lower(), "exp": time.time() + 86400}, SECRET, algorithm="HS256")
def verify(token: str) -> str:
    return jwt.decode(token, SECRET, algorithms=["HS256"])["sub"]
