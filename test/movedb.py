import sqlite3
import os

db_path = r"vakaadha.db"
output_folder = r"C:\Users\cvjg9\OneDrive\Desktop\sql_file"
output_file = os.path.join(output_folder, "vakaadha_dump.sql")

# Ensure output folder exists
os.makedirs(output_folder, exist_ok=True)

# Connect and dump
conn = sqlite3.connect(db_path)
with open(output_file, "w", encoding="utf-8") as f:
    for line in conn.iterdump():
        f.write(f"{line}\n")
conn.close()