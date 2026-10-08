# Category cleanup + Futuristic image fix — 2026-10-05 PT

Deploy: 0f8eb40a-2897-4e1e-b318-3e103d4deba8 (https://0f8eb40a.promptshare-6is.pages.dev) → https://promptshare.fun
SEED_REVISION 20261005-catfix-futimg1 · SW promptshare-shell-v80 · backup: .publish/before-catfix-futimg-20261005/

Root cause (B): fut-q-*.webp (18) + street-q-*.webp (3) were never in dist/media/images; Pages SPA fallback served
index.html (200 text/html) and the zone cached it under /media/* for 7 days. comic raygun seed pointed at
comic-q-raygun_freeze.webp (underscore) but file is comic-q-raygun-freeze.webp.
Fix: copied files from /workspace/promptshare-street-fut into dist+overlay; seed mediaUrl ?v=20261005img1 for the 21;
raygun path fixed; functions/media/[[path]].ts now 404s (no-store) when an image/video path would return HTML.

Retags (tags in functions/lib/seed.ts):
- seed_cyberpunk_origami_truck  Paper hauler      cyberpunk → vehicles
- seed_cyberpunk_steam_crosswalk Steam crosswalk  cyberpunk → street
- seed_fantasy_lightning_grass  Storm grass       fantasy → nature
- seed_fantasy_mushroom_rain    Mushroom rain     fantasy → nature
- seed_fantasy_moss_stone       Moss monolith     fantasy → nature
- seed_fantasy_aurora_beach     Aurora beach      fantasy → landscapes
- seed_fantasy_desert_bloom     Spell bloom       fantasy → landscapes
- seed_fantasy_carved_door      Rune door         fantasy → street
- seed_space_cloud_row          Cloud continents  space → nature
- seed_space_volcano_cut        Planet cutaway    space → nature
- seed_vehicles_bike_rain       Rain commute      vehicles → street
- seed_cities_q_rooftop_towers  Rooftop towers    cities (International) → us-cities
- seed_architecture_roof_garden Roof garden       architecture → cyberpunk
