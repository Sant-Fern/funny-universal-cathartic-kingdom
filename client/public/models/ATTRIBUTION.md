# Anatomical skeleton — attribution and model license

The anatomical model `anatomical-skeleton.glb` is an adaptation of **Écorché**:

Écorché (https://github.com/Charleeh/ecorche), CC BY-SA 4.0. Based on BodyParts3D, © The Database Center for Life Science, CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0.

- Model source: https://github.com/Charleeh/ecorche/blob/main/model/ecorche.glb
- Source data and original changes: [UPSTREAM_ATTRIBUTION.md](UPSTREAM_ATTRIBUTION.md).
- License for this adapted model: **Creative Commons Attribution-ShareAlike 4.0 International**, https://creativecommons.org/licenses/by-sa/4.0/ .
- The model license applies to the meshes and their derivatives; it is not a license declaration for the entire game's code.

## Changes for Funny Universal Cathartic Kingdom

Selected skeletal structures; removed muscles, eyes and soft ear/nasal structures. Retained 262 anatomical structures. Grouped the geometry into rigid joints for animation, changed scale and tint to aged ivory while preserving ambient occlusion, and simplified the mesh to 74,068 triangles. The adapted mesh is distributed under CC BY-SA 4.0.

`skeleton-manifest.json` records the source SHA-256, counts and changes. The reproducible adaptation script is `scripts/prepare-skeleton.mjs`. Download the source GLB from the source URL into `assets/sources/ecorche.glb`, run `npm ci`, then `node scripts/prepare-skeleton.mjs` from the project root.

Ranch geometry, procedural textures, pogo, bottle geometry and game animations are authored in the project and are not part of the upstream anatomical model.
