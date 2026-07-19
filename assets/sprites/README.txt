Dream Realms per-model sprite sheet output folder.

Use tools/sprite-baker.html to export one PNG/JSON pair per model.
Copy class sheets into assets/sprites/classes/, mob sheets into assets/sprites/mobs/, and prop/object sheets into assets/sprites/props/.
Copy sprite-index.json into assets/sprites/.
Runtime loads this index and falls back to procedural rendering when a sheet, PNG, JSON, or frame is missing.
