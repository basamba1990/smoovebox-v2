"""
parse_valentina_excel.py
Parse les données de Valentina pour produire 3 fichiers CSV structurés :
- skills.csv
- skill_compatibility.csv
- skill_prerequisites.csv

Mise à jour : Intègre les 4 scores bruts (P, C, T, D) extraits des images FEU et TERRE.
"""

import pandas as pd
import os
import json

OUTPUT_DIR = "/home/ubuntu/smoovebox-v2/supabase/seeds"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Compétences
COMPETENCES = [
    ("Créativité", "Calyxis", "Feu", "CRÉATION", "CRÉER"),
    ("Innovation", "Calyxis", "Feu", "CRÉATION", "CRÉER"),
    ("Imagination", "Calyxis", "Feu", "CRÉATION", "CRÉER"),
    ("Initiative", "Calyxis", "Feu", "ACTION", "AGIR"),
    ("Persévérance", "Calyxis", "Feu", "ACTION", "AGIR"),
    ("Pitch", "Sylvara", "Terre", "COOPERATION_COMMUNICATION", "COMMUNIQUER"),
    ("Prise de parole", "Sylvara", "Terre", "COOPERATION_COMMUNICATION", "COMMUNIQUER"),
    ("Argumentation", "Sylvara", "Terre", "COOPERATION_COMMUNICATION", "COMMUNIQUER"),
    ("Analyse", "Sylvara", "Terre", "ACTION", "RÉSOUDRE"),
    ("Esprit critique", "Sylvara", "Terre", "ACTION", "RÉSOUDRE"),
    ("Organisation", "Cattleya", "Air", "CRÉATION", "PILOTER"),
    ("Gestion de projet", "Cattleya", "Air", "CRÉATION", "PILOTER"),
    ("Leadership", "Cattleya", "Air", "CRÉATION", "PILOTER"),
    ("Résolution de problèmes", "Cattleya", "Air", "ACTION", "RÉSOUDRE"),
    ("Travail d'équipe", "Neptunus", "Eau", "COOPERATION_COMMUNICATION", "COOPÉRER"),
    ("Écoute", "Neptunus", "Eau", "COOPERATION_COMMUNICATION", "COOPÉRER"),
    ("Contribution", "Neptunus", "Eau", "COOPERATION_COMMUNICATION", "COOPÉRER"),
    ("Autonomie", "Neptunus", "Eau", "ACTION", "AGIR"),
]

skills_rows = []
for name, territory, element, energy, sub_energy in COMPETENCES:
    skills_rows.append({
        "name": name,
        "territory": territory,
        "element": element,
        "energy": energy,
        "sub_energy": sub_energy,
        "pure_score": 0.0,
    })

skills_df = pd.DataFrame(skills_rows)
skills_df.to_csv(f"{OUTPUT_DIR}/skills.csv", index=False)
print(f"[OK] skills.csv: {len(skills_rows)} compétences exportées")

# 2. Compatibilité (avec scores bruts P, C, T, D)
# Données extraites des images pour FEU et TERRE
with open("/home/ubuntu/extracted_data.json", "r") as f:
    EXTRACTED_DATA = json.load(f)

# Données AIR et EAU (scores totaux uniquement car images non fournies)
# Ces données proviennent du script original dans pasted_content_3.txt
AIR_DATA = [
    {"A": "Organisation", "B": "Gestion de projet", "SCORE": 9.7},
    {"A": "Organisation", "B": "Leadership", "SCORE": 7.2},
    {"A": "Organisation", "B": "Résolution de problèmes", "SCORE": 7.9},
    {"A": "Gestion de projet", "B": "Organisation", "SCORE": 5.1},
    {"A": "Gestion de projet", "B": "Leadership", "SCORE": 8.2},
    {"A": "Gestion de projet", "B": "Résolution de problèmes", "SCORE": 8.0},
    {"A": "Leadership", "B": "Organisation", "SCORE": 4.2},
    {"A": "Leadership", "B": "Gestion de projet", "SCORE": 5.5},
    {"A": "Leadership", "B": "Résolution de problèmes", "SCORE": 6.2},
    {"A": "Résolution de problèmes", "B": "Organisation", "SCORE": 4.9},
    {"A": "Résolution de problèmes", "B": "Gestion de projet", "SCORE": 5.8},
    {"A": "Résolution de problèmes", "B": "Leadership", "SCORE": 6.6},
]

EAU_DATA = [
    {"A": "Travail d'équipe", "B": "Écoute", "SCORE": 9.7},
    {"A": "Travail d'équipe", "B": "Contribution", "SCORE": 9.3},
    {"A": "Travail d'équipe", "B": "Autonomie", "SCORE": 6.0},
    {"A": "Écoute", "B": "Travail d'équipe", "SCORE": 5.7},
    {"A": "Écoute", "B": "Contribution", "SCORE": 8.9},
    {"A": "Écoute", "B": "Autonomie", "SCORE": 6.0},
    {"A": "Contribution", "B": "Travail d'équipe", "SCORE": 5.8},
    {"A": "Contribution", "B": "Écoute", "SCORE": 8.9},
    {"A": "Contribution", "B": "Autonomie", "SCORE": 7.1},
    {"A": "Autonomie", "B": "Travail d'équipe", "SCORE": 6.0},
    {"A": "Autonomie", "B": "Écoute", "SCORE": 6.0},
    {"A": "Autonomie", "B": "Contribution", "SCORE": 7.1},
]

compat_rows = []

# Ajouter FEU et TERRE avec scores détaillés
for territory in ["FEU", "TERRE"]:
    for entry in EXTRACTED_DATA[territory]:
        compat_rows.append({
            "skill_a": entry["A"],
            "skill_b": entry["B"],
            "score_p": entry["P"],
            "score_c": entry["C"],
            "score_t": entry["T"],
            "score_d": entry["D"],
            "total_score": entry["SCORE"]
        })

# Ajouter AIR et EAU avec scores totaux (scores bruts mis à None ou calculés si possible)
# Pour AIR et EAU, on met les scores bruts à None ou on estime si nécessaire.
# Ici, on garde total_score et on met les autres à None.
for entry in AIR_DATA:
    compat_rows.append({
        "skill_a": entry["A"],
        "skill_b": entry["B"],
        "score_p": None,
        "score_c": None,
        "score_t": None,
        "score_d": None,
        "total_score": entry["SCORE"]
    })

for entry in EAU_DATA:
    compat_rows.append({
        "skill_a": entry["A"],
        "skill_b": entry["B"],
        "score_p": None,
        "score_c": None,
        "score_t": None,
        "score_d": None,
        "total_score": entry["SCORE"]
    })

compat_df = pd.DataFrame(compat_rows)
compat_df.to_csv(f"{OUTPUT_DIR}/skill_compatibility.csv", index=False)
print(f"[OK] skill_compatibility.csv: {len(compat_rows)} paires exportées")

# 3. Prérequis (vide pour le moment)
prereq_df = pd.DataFrame(columns=["skill_name", "prerequisite_name", "note"])
prereq_df.to_csv(f"{OUTPUT_DIR}/skill_prerequisites.csv", index=False)
print(f"[OK] skill_prerequisites.csv: 0 entrées (vide)")
