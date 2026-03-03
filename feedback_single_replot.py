# Replot feedback image for a single exposure or CVS question.
# Run the cells above (plot_scene_graph, _parse_annot_*, _lap_roots, LABEL_MAP) then run this
# in a new notebook cell, or copy this into a new cell and set folder_name / stem.

from pathlib import Path

folder_name = "exposure8"  # e.g. exposure1, exposure20, cvs3
stem = "001223"           # image index (no .jpg); must have {stem}_sg_annot.txt in folder

questions_root = Path("/Users/jingyingwang/Downloads/surgQ/questions")
exposure_dir = questions_root / folder_name
annot_path = exposure_dir / f"{stem}_sg_annot.txt"
if not annot_path.exists():
    raise FileNotFoundError(f"Missing {annot_path}")

relations = _parse_annot_relations(annot_path)
source = _parse_annot_source(annot_path)
lap_roots = _lap_roots()
if source not in lap_roots:
    raise ValueError(f"Unknown source '{source}' in {annot_path}")
image_root, label_root = lap_roots[source]

# (sub, area, sub, small) is not a new line (self-relation); the shared node must still be drawn.
# plot_scene_graph treats subj==obj as no line and adds the node at its centroid so it is not missing.
# For "area" only: label that node with (strength), e.g. (sub, area, sub, small) -> "(small)".
single_replot_display = {}
for subj, rel, obj, strength in relations:
    if rel.strip().lower() == "area" and strength and str(strength).strip():
        single_replot_display[obj] = f"({strength})"
base_display = name_display_map if "name_display_map" in dir() else {}
name_display_map_merged = {**base_display, **single_replot_display}

plot_scene_graph(
    stem,
    relations=relations,
    image_root=str(image_root),
    label_root=str(label_root),
    label_map=LABEL_MAP,
    output_root=str(exposure_dir),
    name_display_map=name_display_map_merged or None,
)
print(f"Saved {exposure_dir / (stem + '_feedback.jpg')}")
