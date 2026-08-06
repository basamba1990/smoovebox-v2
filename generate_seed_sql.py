"""
generate_seed_sql.py
Génère un script SQL d'insertion pour Supabase à partir des fichiers CSV.
"""
import pandas as pd
import os

SEED_DIR = "/home/ubuntu/smoovebox-v2/supabase/seeds"
OUTPUT_SQL = f"{SEED_DIR}/seed_valentina_data.sql"

def sanitize(val):
    if pd.isna(val):
        return "NULL"
    if isinstance(val, str):
        safe_val = val.replace("'", "''")
        return f"'{safe_val}'"
    return str(val)

with open(OUTPUT_SQL, "w") as f:
    f.write("-- seed_valentina_data.sql\n")
    f.write("-- Généré automatiquement\n\n")
    
    # Insertion des compétences
    f.write("-- Nettoyage\nTRUNCATE public.skill_compatibility CASCADE;\nTRUNCATE public.skills CASCADE;\n\n")
    
    skills_df = pd.read_csv(f"{SEED_DIR}/skills.csv")
    f.write("-- Insertion des compétences\n")
    for _, row in skills_df.iterrows():
        f.write(f"INSERT INTO public.skills (name, territory, element, energy, sub_energy, pure_score) VALUES ({sanitize(row['name'])}, {sanitize(row['territory'])}, {sanitize(row['element'])}, {sanitize(row['energy'])}, {sanitize(row['sub_energy'])}, {row['pure_score']});\n")
    
    f.write("\n-- Insertion de la compatibilité\n")
    compat_df = pd.read_csv(f"{SEED_DIR}/skill_compatibility.csv")
    for _, row in compat_df.iterrows():
        # Utilisation de sous-requêtes pour obtenir les IDs des compétences par leur nom
        f.write(f"INSERT INTO public.skill_compatibility (skill_a_id, skill_b_id, score_p, score_c, score_t, score_d, total_score) VALUES ((SELECT id FROM public.skills WHERE name = {sanitize(row['skill_a'])}), (SELECT id FROM public.skills WHERE name = {sanitize(row['skill_b'])}), {sanitize(row['score_p'])}, {sanitize(row['score_c'])}, {sanitize(row['score_t'])}, {sanitize(row['score_d'])}, {row['total_score']});\n")

print(f"[OK] Script SQL généré : {OUTPUT_SQL}")
