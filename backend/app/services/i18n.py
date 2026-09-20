"""50+ language support with metric-preserving text fitting. Translation is pluggable."""
from __future__ import annotations
# code: (name, width expansion vs English, rtl)
LANGS = {
 "en":("English",1.0,False),"hi":("Hindi",1.15,False),"te":("Telugu",1.25,False),"ta":("Tamil",1.3,False),"kn":("Kannada",1.25,False),
 "ml":("Malayalam",1.35,False),"mr":("Marathi",1.15,False),"bn":("Bengali",1.15,False),"gu":("Gujarati",1.15,False),"pa":("Punjabi",1.15,False),
 "ur":("Urdu",1.1,True),"ar":("Arabic",1.05,True),"he":("Hebrew",0.9,True),"fa":("Persian",1.05,True),"es":("Spanish",1.25,False),
 "fr":("French",1.2,False),"de":("German",1.35,False),"it":("Italian",1.15,False),"pt":("Portuguese",1.2,False),"nl":("Dutch",1.2,False),
 "sv":("Swedish",1.1,False),"no":("Norwegian",1.05,False),"da":("Danish",1.1,False),"fi":("Finnish",1.3,False),"pl":("Polish",1.2,False),
 "cs":("Czech",1.1,False),"sk":("Slovak",1.1,False),"hu":("Hungarian",1.25,False),"ro":("Romanian",1.15,False),"bg":("Bulgarian",1.1,False),
 "el":("Greek",1.25,False),"tr":("Turkish",1.15,False),"ru":("Russian",1.2,False),"uk":("Ukrainian",1.15,False),"sr":("Serbian",1.1,False),
 "hr":("Croatian",1.1,False),"lt":("Lithuanian",1.15,False),"lv":("Latvian",1.15,False),"et":("Estonian",1.1,False),"id":("Indonesian",1.15,False),
 "ms":("Malay",1.15,False),"vi":("Vietnamese",1.1,False),"th":("Thai",1.0,False),"zh":("Chinese",0.6,False),"ja":("Japanese",0.8,False),
 "ko":("Korean",0.8,False),"sw":("Swahili",1.2,False),"af":("Afrikaans",1.2,False),"ne":("Nepali",1.15,False),"si":("Sinhala",1.25,False),
 "km":("Khmer",1.2,False),"my":("Burmese",1.2,False),"tl":("Filipino",1.25,False),
}
GLOSSARY = {
 "hi":{"Sign in":"साइन इन","Submit":"जमा करें","Cancel":"रद्द करें","Search":"खोजें","Settings":"सेटिंग्स","Home":"होम","Save":"सहेजें"},
 "te":{"Sign in":"సైన్ ఇన్","Submit":"సమర్పించు","Cancel":"రద్దు చేయి","Search":"శోధించు","Settings":"సెట్టింగ్‌లు","Home":"హోమ్","Save":"సేవ్ చేయి"},
 "es":{"Sign in":"Iniciar sesión","Submit":"Enviar","Cancel":"Cancelar","Search":"Buscar","Settings":"Ajustes","Home":"Inicio","Save":"Guardar"},
 "fr":{"Sign in":"Se connecter","Submit":"Envoyer","Cancel":"Annuler","Search":"Rechercher","Settings":"Paramètres","Home":"Accueil","Save":"Enregistrer"},
 "de":{"Sign in":"Anmelden","Submit":"Senden","Cancel":"Abbrechen","Search":"Suchen","Settings":"Einstellungen","Home":"Startseite","Save":"Speichern"},
}
def translate(text: str, lang: str, provider=None) -> dict:
    """provider: optional callable(text, lang)->str (NLLB / Argos / cloud MT). Falls back to UI glossary."""
    if lang not in LANGS: raise ValueError(f"unsupported language {lang}")
    if lang == "en": return {"text": text, "source": "identity"}
    if provider:
        try: return {"text": provider(text, lang), "source": "provider"}
        except Exception: pass
    g = GLOSSARY.get(lang, {}).get(text.strip())
    return {"text": g, "source": "glossary"} if g else {"text": text, "source": "untranslated"}

def fit_metrics(orig_text: str, new_text: str, lang: str, font_px: float, tracking_em=0.0) -> dict:
    """Keep the original text box width: shrink tracking first (down to -0.04em), then font size (down to 82%)."""
    ratio = len(new_text) / max(1, len(orig_text))
    if ratio <= 1.0: return {"font_px": font_px, "tracking_em": tracking_em, "rtl": LANGS[lang][2], "fits": True}
    t_room = tracking_em - (-0.04); gain = 1 - max(0.0, t_room) * 0.5
    need = ratio * gain
    scale = 1.0 if need <= 1.0 else max(0.82, 1.0 / need)
    return {"font_px": round(font_px * scale, 1), "tracking_em": max(-0.04, tracking_em - 0.04) if ratio > 1 else tracking_em,
            "rtl": LANGS[lang][2], "fits": need * scale <= 1.05}
