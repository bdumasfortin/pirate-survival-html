# ART GUIDELINES

## Core Visual Pillars

Clarity is King: Because this is a survival game, players must instantly recognize what is a resource (tree, rock), what is a threat (crab, enemy pirate), and what is background. Visual noise must be kept low.

Inviting yet Dangerous: The world should look lush and inviting (tropical paradise), but enemies and hazards should have sharper visual language to indicate danger.

"Chunky" & Tactile: Objects should feel solid and weighty, like toy pieces on a board game map. They should look satisfying to smack with a cutlass or pickaxe.

## Perspective & Camera
Strict Orthographic Top-Down

Vertical "Pop": While the camera is top-down, tall objects (trees, rocks, walls) should have a slight "front face" visible, to give them height relative to the ground.

## Line Work & Definition

Colored Outlines: Avoid harsh, solid black outlines.

Instead, use outlines that are a darker shade of the object's fill color. This provides the definition needed for a survival game without sacrificing the clean, cute aesthetic.

Alternative: A "clean vector" style with no outlines, relying entirely on contrasting colors.

## Color Palette & Texture
Palette: Vibrant, saturated, tropical colors.

Water: Deep teals and bright turquoises.

Land: Warm, buttery sands and lush, healthy greens.

Accents: Rich browns for wood/pirate gear, bright reds/yellows for enemies or critical items.

Texture Use: Minimal. Do not use noisy photo textures.

Use simple repeating patterns for large areas (e.g., a subtle wavy pattern for water, little specks for sand).

Detail should be conveyed through shape, not complex internal texture.

## Asset Specifics

Water: Needs layers. A shallow, lighter turquoise near the shore, dropping off to a deeper teal. Add simple white circles or wavy lines at the edges for foam.

Characters & Enemies:

Proportions: "Chibi" style. Large heads, small bodies. This emphasizes expression and hats (crucial for pirates!).

Readability: The player should always stand out. Enemies should look clearly distinct from background elements (e.g., bright red against green grass).

## AI prompting

### Style block
Add this to the start of every prompt for consistency:

[Style Block]: 2D game asset sprite, view directly from overhead looking straight down, 90-degree angle top-down plan view, ZERO perspective. Clean vector art style, chunky tactile toy-like feel. Vibrant saturated tropical color palette. Thick colored outlines that are a darker shade of the fill color. Isolated on solid white background. --no isometric, 3d render, front view, side view, angled view, shadows

### Prompts

#### Pirate
[Style Block], a chibi pirate character sprite. Since the view is directly overhead, the image is dominated by a very large, wide dark brown tricorn pirate hat with a skull emblem on top. A small circle of body and little shoulders with a blue shirt are barely visible sticking out from under the front rim of the hat to show orientation. Chunky, round shapes.

#### Palm tree
[Style Block], a palm tree canopy seen directly from above. It looks like a thick, rounded starburst shape made of lush green palm fronds radiating outwards from a small central point. The fronds are wide with rounded tips, not spiky, to emphasize the chunky toy aesthetic. No trunk is visible. The outline is a deep dark green.

#### Berry bush
[Style Block], A berry bush viewed from straight above. An irregular, lumpy rounded mass of lush green leaves. Unlike the starburst tree, this is a tighter clump. Large, chunky, bright red berries are dotted distinctively on top of the green mass. Deep green outline.

#### Big rock
[Style Block], A large mineable rock node viewed from straight above. It is a heavy, irregularly shaped grey boulder silhouette. The top surface has thick, chunky cracks and distinct bright orange mineral veins showing on the flat "roof" of the rock. It looks firmly firmly planted. Dark slate grey outline.

#### Small rock
[Style Block], A small, single pick-upable stone viewed from straight above. A simple, smooth, rounded grey pebble shape. It is much smaller than the mineable rock, looking loose and simple. Dark grey outline.

#### Crab
[Style Block], An enemy crab viewed from straight above. A wide, bright red oval carapace body. Two large, chunky, menacing pincers stick out prominently from the "front" edge, clearly defining its facing direction. Small legs stick out the sides. Looks spiky and aggressive. Deep red outline.

#### Wolf
[Style Block], An enemy wolf viewed from straight above. A large, shaggy grey oval shape representing the main body fur. A narrower snout shape with two distinct pointed ears sticks out from the front to indicate direction. Chunky fur texture implied by the outline shape. Looks predatory. Dark grey outline.

#### Kraken
[Style Block], A giant enemy Kraken sea monster viewed from straight above. A massive central, bulbous head hub in deep purple and angry red. Eight thick, wavy tentacles radiate outwards flat against the surface, covered in large chunky round suckers. Deep purple outline.

#### Cutlass
[Style Block], A pirate cutlass sword weapon attachment viewed straight from above (flat). A thick, curved silver blade ending in a chunky brass handguard hilt. It is a simple, solid, recognizable sword silhouette designed to be attached to a character sprite. Dark metallic outline.