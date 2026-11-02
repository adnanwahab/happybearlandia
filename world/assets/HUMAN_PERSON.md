# Clothed human asset

`human-person.glb` is an original, procedural low-poly human released under CC0-1.0. It contains no external textures, network resources or third-party character assets.

The model is approximately 1.82 meters tall, stands on Y=0, uses +Y up and faces +Z. Named mesh/material parts are `TShirt`, `Pants`, `Skin`, `Hair` and `Shoes`. The shirt can be recolored independently. It is an unrigged standing model; skeleton and walking animations are not included.

Rebuild from the HappyBearLandia project directory:

```sh
bun scripts/generate-human-person.mjs
```

The world uses shared instanced parts through `world/render/people/human-renderer.js`, with a deterministic shirt palette per person ID. The Living City render sample remains bounded independently from the simulated population.
