# PixelChat External PNG Assets

STEP 21 uses real public PNG file paths.

Required test asset:

`public/assets/pixelchat/nature/trees/tree-01.png`

The matching public URL is:

`/assets/pixelchat/nature/trees/tree-01.png`

`testTree` in the central Asset Library uses that URL through `sprite.src`.

Suggested structure:

```text
public/assets/pixelchat/
└── nature/
    └── trees/
        └── tree-01.png
```

The PNG only supplies the visual sprite. Render size and anchor remain in `render.bounds` and `render.anchor`. Collision and footprint remain separate gameplay data.
