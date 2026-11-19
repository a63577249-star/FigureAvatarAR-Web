const e=`# Changelog\r
\r
Notable changes to WebSfM. The format follows\r
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).\r
\r
## [Unreleased]\r
\r
### Added\r
- **Aligned photos open in Allmaps.** Export ▸ Allmaps writes one Georeference Annotation\r
  per aligned photo, the IIIF format Allmaps reads, so the scans on your IIIF image server\r
  open in Allmaps Viewer warped onto the map. You give the photos' IIIF address with\r
  \`{name}\` or \`{stem}\` for each file name, and the project keeps it for the next export;\r
  the control points are the ground grid Photos\r
  on the map draws each photo with (13 × 13 rays cast onto the tie points, in WGS 84,\r
  thin plate spline), and the mask is the photo's frame, a film scan's fiducial frame,\r
  without what lies past the horizon. Needs a georeferenced sparse model. Checked against\r
  Allmaps itself: \`@allmaps/annotation\` 1.0.0-beta.38 parses the file (169 control\r
  points, a 48-point mask), and \`@allmaps/transform\` 1.0.0-beta.53's thin plate spline\r
  through them lands within 0.011 m (median), 0.17 m (95th percentile) and 0.75 m (at the\r
  frame's edge) of WebSfM's own ray cast at 2,232 pixels between the grid's nodes: a\r
  synthetic 4,000 × 3,000 px photo tilted 15° with barrel distortion (k1 −0.12) over\r
  30 m hills, at 0.10 m ground pixel size. The export reads each photo's \`info.json\` from\r
  the server: a copy served at another size (a smaller derivative) gets its control points\r
  scaled to it, one served in another shape (cropped or turned) is left out, and the Image\r
  API version is taken from it; the log says what it found. End to end: four example\r
  photos served as static IIIF tiles at half size were warped by Allmaps' own renderer\r
  (\`@allmaps/maplibre\` 1.0.0-beta.44) from the exported file, and neighbouring photos meet\r
  without a step at the paths crossing their seams.\r
- **Keep using one version.** Every release from now on also stays at its own address,\r
  which never updates (\`websfm.app/v/0.9.0/\`): About ▸ Version ▸ Keep using … opens it,\r
  and About lists the other versions. websfm.app itself stays the newest version. A\r
  **Pinned** badge beside the name marks an old version. All versions share your projects;\r
  a project remembers the newest version that opened it, and an older version refuses to\r
  open it rather than drop what the newer one added on its next save. The same version runs\r
  the same algorithms and defaults; a different GPU, browser or thread count can still\r
  change a result slightly.\r
- **Sparse Model names pairs that may be false matches.** After the run, every pair is\r
  checked against the finished model, and a warning names a pair that holds a photo in\r
  place while most of that photo's other pairs disagree; View ▸ Inspect ▸ Matches shows\r
  the check in a Model column (may be false, disagrees, overruled, agrees), sorts and\r
  filters by it, and colours those pairs in the graph; \`stats matches\` in the console lists\r
  them. Each pair's score is saved with the model. South Building (128 photos, default\r
  matching): no warning on the healthy model; 77 of 1,238 pairs marked overruled, of which\r
  66 share no point in COLMAP's model (false), 6 share 15 or more (true wide-baseline\r
  pairs), so overruled is shown calmly. False pairs planted in the real SfM input (real\r
  keypoints that fit one planar map, 104–682 matches, the photo's true pairs cut to 2–3\r
  of 15–20 matches): no false warning in 24 Aukerman and 5 South Building trials; the\r
  planted pair is overruled whenever its photo stays in the model. SfM never let a planted\r
  pair move a photo, so the warning itself is so far tested on synthetic blocks only (a\r
  planted false pair is flagged, no true pair is). Two rules came from these runs: a\r
  photo is judged by its pairs, not its matches, and one with more than two agreeing pairs\r
  is never held. 17.9 M matches over 900 photos take 3.4 s.\r
- **Everything you click can be typed in the console.** \`run\` takes every step a workflow\r
  can run unattended, with its settings (\`run dense minViews=3 mesh preset=high\`), and\r
  the edits you make by hand are commands too (\`gcp disable "GCP 12"\`, \`product main\r
  "DEM 2"\`, \`image rename\`, \`sensor set\`, \`region clear\` …); hovering an Activity line\r
  shows its command. Before, \`run\` knew nine stages at their defaults and only pairs could\r
  be edited by name; it now knows fifteen (the Tools edits Filter, Normals, ICP, Clean,\r
  Smooth and Decimate besides), each setting checked against what the Workflow Builder\r
  allows, and 37 edits of images, groups, sensors, products, layers, GCPs, scale bars,\r
  the region and the orientation. **help edit** and **help run dense** list them.\r
- **Matching shows its steps.** The progress dialog of Match Features lists the passes the\r
  run can take (finding similar images, matching the pairs, re-testing gated pairs,\r
  repairing a split graph, detecting the gaps again, finding turned photos) with a bar and\r
  count for the running one; a pass that runs only when the graph needs it is marked ◌,\r
  "runs only if needed". Before, everything after the pair pass shared the last tenth of\r
  one bar: on Rachel the turned-photo search detected 23 photos again and matched 1,058\r
  pairs again (about 10 minutes) with the bar standing near 100 %. The detecting part now\r
  counts in images.\r
- **Flights in opposite directions match with SuperPoint, DISK and ALIKED.** When matching\r
  leaves pieces apart, or held to the block only by weak pairs, a small SIFT look at\r
  their photos measures how each is turned against the main block, and photos turned a\r
  quarter turn or more are detected again turned and matched again (Match Features ▸\r
  Repair a split graph ▸ Find turned photos, on by default). Learned features hold only\r
  about ±15° of rotation, so TMA flights at 115° and 290° stayed apart. Rachel's 58 scans\r
  imported bare (SuperPoint at 5,000 px, LightGlue, all pairs): bridge repair joined the\r
  block only by pairs of under 30 inliers and the best model placed 13 photos; the search\r
  (58 looks, 840 probe pairs, 66 s) turned 23 photos of two pieces by 180°, detected them\r
  again and matched 1,058 pairs again (9.5 min), leaving none apart, and the best model\r
  placed 28. With the scans also treated as film, 49 of 58, each roll's focal solved to\r
  6,069–6,217 px against the certificates' ≈ 6,140.\r
- **WebSfM asks whether scans are film.** When photos carry no camera tags and look like\r
  scans (roll numbers in the names, large square frames, greyscale, or a scanner's tags),\r
  Sensors and Sparse Model ask whether to **Treat as film**; a film sensor without a focal\r
  then starts from a 6-inch lens on 9-inch film instead of a digital camera's guess.\r
  Rachel's 58 TMA scans, imported bare, started at the scan width (10,141 px against a true\r
  ≈ 6,140) and registered 16; as film the guess is −3.5 % on the verticals and −0.3 % on\r
  the obliques. The focal from pair geometry stays off for film: on the same scans the\r
  vertical pairs, looking along near-parallel axes, scattered from 0.25 to 1.67 × the image\r
  size. A film sensor without fiducial marks now keeps the scan's pixels in depth maps,\r
  Find GCPs and exports, as its sparse run does; before, every photo of it was skipped.\r
- **See and change which photos use which sensor.** Images ▸ Group by ▸ Sensors lists the\r
  photos under their sensors: drag photos onto another sensor, or right-click ▸ Set sensor\r
  or New sensor from selection. Clicking a sensor's photo count in Sensors selects its\r
  photos. Before, a photo's sensor showed only in its details, and moving one meant the\r
  Split camera group dialog.\r
- **Mask the film frame of each scan.** Tools ▸ Images ▾ ▸ Auto mask ▸ Edges ▸ **Film frame** finds\r
  where the photograph begins on every scan, past any bright scanner bed and the dark film\r
  border with its fiducials, dials and data strip, and masks the frame, with an inset for\r
  the notches and rounded corners; no fiducials needed. A side that lands far from the\r
  other scans of the same size (dark ground or sky at the edge) takes theirs. Each side\r
  is the median brightness across the middle 60 % of the scan (a white data card does not\r
  lift it), and the photograph starts where it stays bright for 3 % of the side. On 30\r
  TMA scans (three cameras) it matched the frame mask drawn from the fiducials: 30\r
  cameras, 12,466 ≥3-view points against 12,279, registration check median 1.13 px against\r
  1.23, 162 of 250 pairs against 153 (no masks: 27 cameras, 17.6 px), while keeping 67–81 %\r
  of each scan against 69–75 %. Frame and Text together gave the same pairs as Frame\r
  alone there: the print sits on the frame. On 37 Casa Grande scans every side agreed with\r
  its camera's other scans to 1.5 % but for three a frame, which took the median.\r
- **Mask the text on film scans.** Tools ▸ Images ▾ ▸ Auto mask ▸ **Mask text** finds and reads\r
  the frame numbers, data strips, data cards and annotations on the photos and masks them,\r
  so the same print on every frame no longer matches between frames; text a camera prints\r
  at the same place is masked on all of its photos, even where glare hid it. It runs\r
  PaddleOCR's PP-OCRv5 mobile detector and English recogniser in the browser (13 MB,\r
  downloaded once with your permission), one photo per worker, and keeps what it read on\r
  each photo, so a second run with other settings only redraws the masks. A line is\r
  masked when it reads with at least 0.9 confidence and three letters or digits, or, with\r
  Recurring text, when a reading of at least 0.5 sits at the same place on at least three\r
  frames (and 20 %) of a camera, placed through the fiducials where every frame has them.\r
  On a Casa Grande scan with a town the detector boxed 300 regions, the buildings among\r
  them reading below 0.9 or as one or two characters, while "ARIZ CSR-D", "1:25,000" and\r
  "9-6-78" printed on the photograph read at 0.98–1.00; on TMA scans the side data line\r
  ("F31 USN GS T 12A … 27 68"), the frame number and the data card read at 0.93–1.00. A\r
  10k-px scan is read at 1/4 in 960-px tiles: about 8.5 s on one thread and 350 MB. On\r
  30 TMA scans (three cameras, no pose priors) text masks alone registered 30 cameras\r
  against 27 unmasked, 11,582 ≥3-view points against 6,343, registration check median\r
  2.0 px against 17.6 px; a frame mask from the fiducials did better still (30 cameras,\r
  12,279 points, 1.2 px, 153 of 250 pairs against 239), and on TMA and Casa Grande all\r
  printed text lies outside it, so on film mask the frame first: Text adds what is\r
  printed inside the photograph.\r
- **Read the focal length and date printed on film photos.** Tools ▸ Images ▾ ▸ **Read\r
  text…** lists the text read on each photo and the calibrated focal length and flight\r
  date a camera's photos agree on (each photo votes once), and sets that focal length on\r
  a film camera with one click. Readings are fixed for the usual OCR confusions (O for\r
  0, l for 1) and a bare number counts only near a common lens (88, 152, 210, 305 mm),\r
  after hist_sfm's rules: "152.86" and "UAGI 6056 151,78" give 152.86 and 151.78 mm,\r
  "9-6-78" 6 Sep 1978, "22-8.80" 22 Aug 1980 and the end of a TMA data line "… 12 27 68"\r
  27 Dec 1968, matching the flight dates of the Casa Grande, Iceland and TMA test scans.\r
  A focal length whose leading digits are not on the scan (a TMA data card cut off at the\r
  photograph's edge reads "3.46 mm") is completed into the 6 in band when exactly one\r
  completion fits, and the dialog says so: the TMA R camera votes 153.46 mm on 10 of 10\r
  scans, the value of its calibration; Casa Grande reads 152.86 mm whole on 22 of 22\r
  (certificate 152.865).\r
- **Match large sets without positions in a fraction of the time.** Match Features ▸\r
  Pairing ▸ **Similar images** pairs each photo with the 20 photos that look most like it,\r
  and up to 20 more spread over the scene, found from the features already detected,\r
  instead of matching every pair; it is where the dialog starts for more than 200 photos\r
  without camera positions. The spread-out picks tie each strip to its neighbouring\r
  strips: on Mill19 building (1,940 oblique photos, 17.5 M keypoints, no positions) the 20\r
  most similar were all from a photo's own strip, and a strip of 77 hung off one end,\r
  105–355 m from PixSfM's poses; with them 31,871 pairs (1.7 %, matched in 570 s against\r
  5.4 h exhaustively) placed 1,931 cameras with the worst 5.5 m off and the median 0.26 m\r
  (k 50: 62,151 pairs, 1,054 s, worst 4.0 m). On South Building and quarry they added\r
  16–23 % pairs for the same cameras and accuracy; on a TMA block 165 cameras against 167\r
  (earlier runs of k 20 alone gave 164 and 167). The same project gives the same pairs on\r
  every run. Each photo's\r
  descriptors are summarised in one VLAD vector over a 64-word codebook learned from the\r
  project itself (Jégou et al. 2010, with the intra-normalisation of Arandjelović &\r
  Zisserman 2013), so it works with every detector and downloads nothing. Measured without\r
  camera priors, WebGPU matching: quarry (347 photos) exhaustive 60,031 pairs in 156 s →\r
  346 cameras, 129,274 points, RTK camera error 24.1 cm RMS; Similar images 4,881 pairs\r
  (8 %) in 79 s → all 347 cameras, 130,544 points, 23.0 cm (10 per photo: 2,514 pairs in\r
  43 s, 347 cameras, 23.5 cm). South Building (128): 1,568 pairs (19 %), the same 128\r
  cameras and 4.8 mm median against COLMAP's model as exhaustive; 783 pairs (10 per\r
  photo) 4.7 mm. Finding the similar photos took 6 s and 11–20 s. Film scans start on it\r
  too, where they started on Sequential: on a TMA block (258 scans, three cameras, masked\r
  fiducials, the same keypoints for every pairing) Similar images registered 164 cameras,\r
  footprint preselection 140, exhaustive 96 and Sequential with Find revisits 71 (file\r
  names sort camera by camera, so capture order misses the links between them); 37 raw\r
  Casa Grande scans (fiducials and data strip unmasked): 32 cameras with 10 per photo,\r
  30 exhaustive.\r
- **Sequential matching joins a second pass over the same place.** Match Features ▸\r
  Sequential ▸ **Find revisits** (on by default) also matches each photo with the 5 photos\r
  that look most like it, wherever they are in the sequence, so two laps or a strip flown\r
  back become one model. South Building (two laps, no priors): Sequential alone left 43 of\r
  128 photos apart even after re-detecting them at full size; with Find revisits, 131 more\r
  pairs (found in 7 s) registered all 128 cameras, 5.2 mm median against COLMAP's model.\r
- **The DEM's vertical accuracy in survey terms.** When a project has a DEM, the Quality\r
  Report export adds *DEM accuracy at the checkpoints (ASPRS 2023, NVA)*: the DEM's height\r
  at each checkpoint against its surveyed height, as RMSE_V with the checkpoints' declared\r
  accuracy counted in, the mean error and the blunders, and the standard's "tested to\r
  meet" sentence with at least 30 checkpoints. Checkpoints outside the DEM or on a gap are\r
  counted and left out.\r
- **Diagrams in the help.** Twenty-one glossary entries now show a figure: ground sample\r
  distance, lens distortion, baseline and parallax, RANSAC, focal length and field of\r
  view, triangulation, the pinhole model, the principal point, statistical outlier\r
  removal, DEM of difference, mesh smoothing, surface normals, contour lines, DEM\r
  binning, cut and fill volume, gauge freedom, the Lowe ratio test, tracks, the COG\r
  pyramid, the match graph and camera pose. Each is drawn from computed geometry\r
  (the distortion from the radial model, the uncertainty ellipses from the rays, the\r
  smoothing and the contours by running the algorithms), not sketched.\r
- **Accuracy at the checkpoints in survey terms.** The Quality Report export has a section\r
  *Accuracy at the checkpoints (ASPRS 2023)* with RMSE_H, RMSE_V and RMSE_3D, the\r
  checkpoints' declared survey accuracy counted in as the ASPRS Positional Accuracy\r
  Standards (Edition 2) ask, and the GCP tab shows RMSE_H / RMSE_V. The section lists per\r
  axis the mean error, standard deviation and RMSE, flags a mean error over 25 % of the\r
  RMSE and residuals over three times it, and writes the standard's "tested to meet … for a\r
  X cm RMSE_H horizontal positional accuracy class" sentence only with at least 30\r
  checkpoints that declare their accuracy; with fewer it gives the figures marked as not\r
  compliant. Checked against the standard's worked example (a 1 cm fit to checkpoints\r
  surveyed at 2 cm gives 2.24 cm). The figures describe the adjusted block; a DEM or\r
  orthophoto adds its own error.\r
\r
- **Every ribbon button says what it does.** Hovering a button in Import, Reconstruct,\r
  Evaluate, Export and Other, or View ▸ Inspect, now shows one line on what it does (the\r
  formats an export writes, the stage a Reconstruct button runs) instead of its label\r
  again; the console's \`help\` shows the same lines. The full list, with each command's\r
  place in the ribbon and its guide article, is in\r
  [docs/features.md](docs/features.md), generated from the ribbon so it stays complete.\r
- **Measure on the map without a DEM or orthophoto.** On the 2D map, Tools ▸ Measure ▾ ▸\r
  Ruler and Area now work over the basemap, the photos or the footprints alone: the\r
  measuring window's Layer is **Map**. Lengths and areas are taken on the WGS 84\r
  ellipsoid (Vincenty's distances, an equal-area projection for areas), so they are\r
  ground values in any project CRS, a map in degrees included, and saved ones follow a\r
  change of CRS instead of going stale. Checked against Vincenty's Flinders Peak to\r
  Buninyong line (54,972.271 m), the WGS 84 quarter meridian and the closed-form area of\r
  latitude/longitude cells (within 1e-6 at 1 km, 1.3e-5 at 110 km). Profile and Volume\r
  still need a DEM, and the model frame still needs a raster to measure on.\r
\r
### Changed\r
- **Build Mesh textures the mesh from the photos.** A new Texture step, on by default,\r
  bakes the photo texture onto the mesh the run makes, so one run gives a textured mesh\r
  instead of a vertex-coloured one and a second copy from Tools ▸ Mesh ▸ Texture. It runs\r
  Texture Mesh's own bake at the chosen Texture resolution (Full, Medium or Draft, as that\r
  dialog's cards); the vertex colours stay for viewers that ignore the texture. Turn it off\r
  for a quick look at the shape, or to decimate and texture with the tool. Without\r
  registered photos the mesh keeps its vertex colours, and a workflow whose Texture Mesh\r
  block follows Build Mesh leaves the texturing to that block. It is a setting because it\r
  costs time: on the 347-photo aerial block the texture took 3.5 min against 140 s for the\r
  mesh (0.8.0 ▸ Mesh size follows the block).\r
- **Every export says what it writes, and lets you pick it.** Export ▸ Point Cloud, Mesh,\r
  3D Tiles, DEM and Orthophoto have a Source list of every cloud, mesh or product of that\r
  kind, with its size and which is the main one. It starts on the one you have selected,\r
  else a textured mesh, the main mesh or the main dense cloud, so a project with a dense\r
  cloud no longer exports its sparse model by default, and a textured mesh made with Tools\r
  ▸ Mesh ▸ Texture is no longer passed over for the mesh it came from. Model JSON, SfM\r
  Project, Undistorted Images and Allmaps name the main sparse model when there are several.\r
- **Every dialog has the same title bar.** The Inspect tables (Image Table, Camera Poses,\r
  Control & Markers, Matches) and the image and product information now show their title\r
  like every other dialog, with counts in a line under it and their controls beside the\r
  close button; the Image Table's tabs sit in a row of their own.\r
- **The log says why a georeference was dropped.** A georeference is kept only while what\r
  it was fitted on stays the same; when it is dropped, the console now says what changed\r
  (the camera positions, the GCPs, the photos, the cameras, the sparse model or the CRS,\r
  with how many records) and to run Reconstruct ▸ Georeference again. A rebuilt sparse\r
  model logs it as information, anything else as a warning; Detail lists the records.\r
- **Photos on the map follow the ground.** View ▸ Map ▸ Photos now places each photo of\r
  the sparse model by its aligned camera: a 13 × 13 grid of rays per photo is cast onto a\r
  surface of the tie points, so a photo follows the relief and its lens distortion is\r
  corrected, and a film scan shows only what is inside its fiducial frame. It works\r
  without footprints, on the CRS map once the model is georeferenced and in Model Frame;\r
  a photo outside the sparse model is still stretched into its footprint. Before, every\r
  photo was a flat stretch between the four corners of its footprint, which needed\r
  imported poses and ignored the lens and everything between the corners. The layer now\r
  starts with every photo (Layers can show the selected one alone), and when the model is\r
  not georeferenced the map says the photos are placed by their footprints and how to\r
  change that. The grid is cast only for the photos drawn, on the main thread: about\r
  0.3 ms a photo and 70 ms for the tie-point surface of 300,000 points (synthetic timing,\r
  one core).\r
- **The console log reads the same everywhere.** Each line's source names the part of\r
  WebSfM it comes from, as the ribbon does (Sparse, Georeferencing, Fiducials, System …),\r
  each step ends in one green line with its result and time, and the per-photo and\r
  per-pair lines moved to Detail. Before, one step was logged under up to three sources\r
  (Reconstruction, SfM, Compute), 31 success lines came from the middle of a run (one per\r
  registered photo), the dense cloud, DEM, orthophoto, mesh and reflectance map had no\r
  closing line, a worker's warnings arrived as plain lines, and numbers took the\r
  browser's language ("1.234" in German). Logs saved before show under the new names.\r
  The wording too: a failure reads "what failed: why" (it came in four forms, and some\r
  errors named no step at all), and the lines shown by default say bundle adjustment,\r
  calibration and tie point instead of BA, intrinsics and sparse point; solver internals\r
  moved to Detail. 529 warning, error and flagged lines were read by hand.\r
- **Rolling shutter is on by default.** Sparse Model ▸ Rolling shutter now estimates the\r
  readout time unless you turn it off; it acts only on photos with a capture time, so a\r
  camera with a mechanical or global shutter solves to a readout near 0, and a project\r
  that already ran Sparse Model keeps its last settings. On a DJI Mavic\r
  Air 2 block (104 photos, 5 RTK GCPs, each left out in turn as the checkpoint), the\r
  horizontal checkpoint error fell from 21.5 to 3.8 cm. With 4 GCPs the vertical error\r
  rose from 42 to 52 cm, because the GCP-anchored adjustment barely bends the block\r
  (it keeps the focal fixed below 5 GCPs and weighs each mark at 1 px against the tie\r
  points); with the GCP marks weighted harder, On was equal or better vertically too\r
  (26.8 vs 27.8 cm). Metashape on the same splits: Off 21.4 / 33.2 cm, Regularized\r
  21.9 / 16.1 cm (camera references off, as the EXIF heights are above sea level).\r
- **Quality Report ▸ Sparse in plain words.** Its tiles and table say tie points,\r
  reprojection and "before / after bundle adjustment" in full (it said Pre-BA, Post-BA,\r
  Keypts and Obs), and it follows the app's language, with numbers and dates as that\r
  language writes them. Compare runs and the report export use the same words.\r
- **Edit Mask is on the Picture tab, Edit GCPs in Reconstruct ▸ Georeferencing.** Open a\r
  photo and Edit Mask sits beside its Mask toggle; Edit GCPs and Find GCPs share one\r
  button's space before Georeference. Tools ▸ Images ▾ now holds only the tools that work\r
  on many photos at once.\r
- **Auto mask runs like the other tools, and masks the edges and the text in one run.**\r
  Its settings are two numbered steps, Edges (Off, Fixed strip or Film frame) and Text,\r
  and Run writes the masks in the progress window, where the dialog used to stay open\r
  with Apply buttons per image size while settings could still change under a run.\r
  **Photos** limits a run to one sensor, such as one film roll. With Edges and Text both\r
  on, the text is added to the edge mask, so If a mask exists ▸ Replace keeps both.\r
- **Film scans get one sensor per roll.** Scans that name no camera are grouped by the\r
  roll in their file name (\`CA214732V0046.tif\` → CA214732V), and by scan format within\r
  it, instead of by exact image size. On the TMA Rachel set (58 scans) exact sizes made 7\r
  sensors: frames of one roll cropped a pixel apart were split over several, while the R\r
  cameras of three flights shared one, as did CA215731L and CA215732V on Melville (both\r
  10130 × 9872 px, focal lengths 154.40 and 153.46 mm). By roll it is 12 sensors, one per\r
  camera of its reference calibration. Scans without a frame number in the name are\r
  still grouped by size.\r
\r
### Performance\r
- **Texturing a mesh is about four times faster.** Tools ▸ Mesh ▸ Texture now spreads its\r
  photo work over every processor core: finding which photos see each face, and copying\r
  the photos' pixels into the atlas, run side by side, one share of the photos per core;\r
  the log says how many cores took part. The textured mesh is the same, byte for byte, as\r
  before. Quarry (347 photos, a 653,708-triangle mesh, 7 pages of 4,096 px, GPU\r
  z-buffers): 195 s on one worker → 53 s on 8 (visibility 65 → 12 s, bake 124 → 23 s);\r
  the pages' JPEGs are identical to the previous version's and between 1 and 8 workers.\r
- **Bundle adjustment of very large projects fits in the browser.** When the exact solve\r
  would need more memory than the browser gives a bundle adjustment, WebSfM now solves the\r
  camera system iteratively without storing it, the way Ceres does for large problems. A\r
  project of thousands of photos that mostly see each other (one building or site) would\r
  before have run out of memory or taken hours; aerial blocks keep the exact solve to\r
  about 10,000 photos. The log says when a solve ran this way. On Bundle Adjustment in the\r
  Large: final-1936 from 3,929 s to 114 s at the same cost (Ceres 353 s), in 1.1 GB where\r
  the old path needed its 2.2 GB reduced matrix twice; final-3068 from over 2 h to 226 s,\r
  7 % below Ceres' final cost; final-4585 from over 2 h to 822 s, 0.3 % below Ceres' cost\r
  (Ceres 1,018 s). The exact solve now runs wherever its predicted memory fits, instead of\r
  stopping at a 1 GiB factor. Observations are also kept in the 32-bit form they arrive\r
  in, and the solve's large buffers are allocated once instead of every step, which cuts a\r
  bundle adjustment's peak memory by 13–18 % on mid-size problems (15 % in the browser on\r
  final-961) with bit-identical results. In Chrome the three large problems took 156, 295\r
  and 924 s in at most 2.0 GB.\r
- **Less memory for large Sparse Model runs.** Placing photos now keeps each waiting\r
  photo's matches to the model in a compact form, which was most of the memory the sparse\r
  reconstruction itself used while photos were being placed. On a synthetic block of\r
  3,025 photos with 3,700 tie points each, the largest JavaScript memory sampled during\r
  the run fell from 0.73 to 0.42 GB with the same cameras and points; at 1,024 photos the\r
  memory live while placing photos fell from 178 to 50 MB.\r
\r
### Fixed\r
- **Exported meshes show their colours in other programs.** A GLB without a texture had no\r
  material, so viewers drew it with glTF's default, which is fully metallic and turned the\r
  vertex colours near black. It now has an unlit material for vertex colours (a plain grey,\r
  lit one without them), and the colours are written as glTF expects them, as linear\r
  light in 16 bits: sRGB 128 is stored as 0.216, as IEC 61966-2-1 gives.\r
- **Thumbnails, video frames and masks no longer come out black on some GPUs.** With\r
  Chrome drawing canvases on the GPU through Vulkan (seen on Linux with NVIDIA), every\r
  image WebSfM made from a canvas read back black: list thumbnails, the frames of an\r
  imported video, saved masks, Evaluate's product images and the image viewer's pixel\r
  probe. These canvases are now kept in memory instead. Measured in Chrome with Vulkan:\r
  an Aukerman thumbnail averaged 0, 0, 0 before and 116, 143, 69 (the photo's grass)\r
  after; a unit test fails on a canvas that is read back from the GPU.\r
- **The new-version prompt says what it is doing.** After you press Reload it says it is\r
  switching, instead of claiming the new version is already active in another tab, and\r
  when the tab has to finish something first it names it (saving the project, an import,\r
  a run), so it is clear the reload follows by itself.\r
- **The orthophoto no longer redraws when another layer changes.** Moving a layer's\r
  Opacity slider or turning Photos on or off left the orthophoto and DEM on the map\r
  instead of taking them off and drawing them again from scratch. The Layers panel no\r
  longer repeats the basemap choice the ribbon's Basemap menu makes.\r
- **The Image Table keeps its column names on top.** Scrolling the Metadata tab no longer\r
  draws the thumbnails over the header row, and the Metadata, Intrinsics and Extrinsics\r
  tabs now look like the ribbon's tabs.\r
- **An excluded pair stays excluded.** A pair you exclude from reconstruction in the\r
  match list (or with \`pair disable\`) is no longer switched back on when Detect and Match\r
  Features matches it again or matches are imported over it.\r
- **A model made mostly of oblique photos comes out level.** Where a film flight's sparse\r
  model holds more obliques than verticals, the aerial orientation, the products' frame and\r
  the 3D view take up from the vertical photos, found by comparing each look with the\r
  sparse cloud's ground plane, or from the ground plane itself when every photo is oblique.\r
  Rachel's first run kept 12 left obliques and 4 verticals and came out about 60° off\r
  level, because up followed the larger group; a nadir block (within 25° of its ground)\r
  is unchanged.\r
- **An orthophoto fades smoothly on the map.** Moving its Opacity slider in View ▸ Map ▸\r
  Layers now only changes its transparency, as it does for a DEM, instead of redrawing\r
  the orthophoto on every step.\r
- **Ribbon menus stay open while photos are added.** A menu such as Tools ▸ Measure ▾ no\r
  longer closes each time the console writes a new line, as it did while a large import\r
  decoded its photos.\r
- **Mask editing keeps your tool when you open another photo.** The Eraser, Rectangle or\r
  Smart Select you picked, the brush size and the overlay opacity now carry over from\r
  photo to photo instead of going back to the Brush at 20 px on each one.\r
- **A film scanner's tags no longer pass for the camera.** The make and model a scanner\r
  writes (Better Light Model Super10K on the TMA scans) no longer name a sensor, and its\r
  exposure, ISO and scan date no longer show as the photo's; Show information lists them\r
  as *Scanned with*. Exposure times written as a fraction in XMP now show as 1/120 s\r
  instead of 1/NaN s.\r
- **Film scans with placeholder GeoTIFF tags are added as photos.** A scan whose tags only\r
  relabel its own pixel grid (1-unit pixels, a corner at 0,0, no CRS) now goes to Images\r
  instead of Reference Data, whichever way the grid is flipped. In a dropped batch that\r
  holds both, the photos are added right away instead of waiting for each reference\r
  raster to load. On a TMA set of 395 scans, the 172 vertical scans (pixel grid flipped\r
  so it fills 0…width × 0…height) had all been imported as orthophotos, and the other\r
  223 waited behind them.\r
- **Changing the basemap keeps your place on the map.** Switching View ▸ Map ▸ Basemap (or\r
  the satellite source) now leaves the map where you had panned and zoomed it, instead of\r
  jumping back to the whole project.\r
- **Bridge repair aims at the main block.** When matching leaves part of a block joined\r
  only by a few weak pairs, Match Features now repairs it against the main block itself.\r
  Before, a separate group of photos larger than any well-tied part of the main block\r
  could become the target instead: every part of the main block was then reported as\r
  "hanging by a thread" and only pairs towards the separate group were tried. A weak pair\r
  retried by bridge repair now also keeps its first result when the retry comes out\r
  worse, fails or is cancelled, so a block cannot lose the link it had. And with MAGSAC++\r
  (bridge repair's, or Match Features ▸ Estimator), a pair of a flat scene or a\r
  pure rotation is labelled as such again: its homography is tested at the same tolerance\r
  RANSAC's has used since 0.8 (a planar pair at 1 px noise read H/F 0.66 instead of\r
  ≥ 0.9, below the 0.8 flag), so it no longer seeds the reconstruction.\r
- **COLMAP exports agree with their own cameras.** Export ▸ COLMAP (and NVM, OpenMVG)\r
  now writes every keypoint of a photo in the frame of its PINHOLE camera. Before, only\r
  the keypoints a 3D point observes were moved out of the lens (or the film scan's\r
  pixels): the others, and the database's, sat up to the whole distortion off their\r
  camera, which COLMAP's \`point_triangulator\` and \`mapper\` then used as they were. Pair\r
  geometries fitted to the keypoints as detected are left out for those photos (COLMAP\r
  estimates them again), a workspace with the original photos says they still carry the\r
  lens (Export ▸ Undistorted images writes photos that match), and every model export\r
  says when cameras were solved with a rolling shutter, which these formats cannot hold.\r
- **NVM and OpenMVG files round-trip to the same pixel.** An imported NVM model put every\r
  measurement half an image off (they are about the image centre, and were read as\r
  pixels); NVM and OpenMVG exports wrote their measurements half a pixel off the camera\r
  beside them. A model without a principal point (NVM, Bundler) now takes the image\r
  centre exactly.\r
- **OpenSfM import keeps the lens.** Import ▸ Other SfM now reads an OpenSfM camera's\r
  distortion (perspective, Brown, fisheye) instead of importing it as a pinhole, and says\r
  which projections it cannot keep (spherical, dual).\r
- **Metashape export: only control is control.** A GCP turned off, or one without a\r
  height, is no longer exported as an enabled marker reference (one without a height went\r
  in at 0 m and pulled the block down in Metashape); GCP accuracies in a feet CRS are\r
  converted to the metres Metashape reads.\r
- **Sparse Model no longer refuses large blocks that fit in memory.** Its memory check now\r
  counts the keypoints in each match and the tracks they join into before the run, instead\r
  of guessing them from the number of keypoints, so it sizes the bundle adjustment from\r
  what the matches hold. Mill19 building (1,940 photos, 17.5 M keypoints, Similar images):\r
  the old guess put the bundle adjustment at 3.6 GB, over the 3.5 GB WebAssembly ceiling,\r
  and refused; the count gives 11.0 M observations and 2.3 M points (the largest\r
  adjustment held 9.7 M and 2.2 M), 2.3 GB, and the run registers 1,935 cameras in 601 s.\r
  A 60-photo subset gives the same model as before.\r
- **Film: clicked fiducials and reseau crosses no longer shift the frame by half a scan\r
  pixel.** Detect fiducials, the template retry, a click in the viewer, Detect reseau and\r
  imported marks now all store a fiducial at the same point of its pixel, so a scan\r
  calibrated from clicks or reseau crosses gets the same film frame as one from detected\r
  marks. Before, the detectors stored pixel centres and the others pixel edges, and the\r
  fit read both as centres: a principal-point error of about 0.7 px (about 10 µm at 15 µm\r
  per pixel) on scans calibrated by hand or by the reseau, which positions-only blocks\r
  carry into the ground (about 0.2 m at 3 km with a 152 mm lens). Saved projects are\r
  updated on open (project format 5): detected marks move by half a pixel so their fit is\r
  unchanged; models already built keep their frame until the next Sparse run. The viewer\r
  also draws detected marks on the mark itself instead of half a pixel up and left.\r
- **Escape closes the dialog opened last.** Escape now closes whichever dialog sits on\r
  top, every dialog included, where before it went down a fixed list that a new dialog\r
  could be missing from; a dialog that cannot be dismissed (New Project before the first\r
  project) now keeps Escape instead of closing the one under it.\r
- **A photo that failed to register gets a fresh try.** Each later registration pass now\r
  tries a photo's pose with other random samples, so a photo whose first draw missed its\r
  true matches is no longer refused the same way on every pass. The number of samples\r
  also follows the lowest inlier share the pose check accepts (unchanged at its default).\r
- **A crashed operation says which one it was.** When an operation's WebAssembly code\r
  crashes, its error now names the operation, and the browser console keeps where in the\r
  code it happened. Before, a crash in a background job showed only "memory access out of\r
  bounds". Found while hunting such an error that a browser test logged in 2 of 3 full\r
  runs; it has not come back at this version in 120 repeats of that test, 3 runs of the\r
  tests before it and 2 full Chromium runs, so its cause is still open.\r
\r
## [0.8.0] — 2026-11-12\r
\r
### Added\r
- **Merge blocks that do not overlap.** Import ▸ WebSfM Project now brings the other\r
  project's solved model too and places it in this one by photos both solved, GCPs and\r
  markers marked in both, or both georeferences (*Its model* and *Place it by*), as\r
  Metashape's Align Chunks and Merge Chunks do. The merged model becomes the main one, and\r
  the one it was merged into stays in the list; each block keeps its own shape and lens,\r
  and Optimize Cameras adjusts them together. Importing into a project without a model now\r
  brings the other model in as it is; *Leave behind* keeps the old behaviour (photos only,\r
  then Match only new pairs and Add to the model, which needs overlap). Shared photos along\r
  one flight line are placed by their camera directions as well as their centres, which\r
  their nearly collinear centres alone leave open. Tested against known truth: unit tests\r
  move a block by a known similarity and place it back by each of the three ways, and a\r
  browser test merges a 5-photo model moved by a similarity into a copy missing two of its\r
  cameras, which land back within 10⁻⁶ of the block's span. On real blocks: GeoScan PUTI\r
  split into a west (240 photos) and an east (102) block with 102 photos left out between\r
  them, each placed by its RTK positions, merged by both georeferences to 3.8 / 8.3 cm at\r
  11 check points (H / V RMS), where the whole 444-photo block solved at once gives 3.4 /\r
  11.1 cm at 15; Casa Grande 1978 (film, blocks of 20 and 17 photos with their GCPs) merged\r
  to 1.68 / 1.50 m by the GCPs and 1.09 / 1.29 m by the georeferences, at 11 check points.\r
  A merge took 12–47 s.\r
- **How well the focal is fixed.** The Quality Report's Calibration card shows the\r
  refined focal with its ± (how well the photos fixed it), and says when a nadir block\r
  without camera positions or GCPs cannot fix it at all, so its heights scale with it.\r
  The bundle adjustments that settle the lens report each camera group's standard\r
  deviations, marginal over every pose and point (one extra factorisation at the\r
  solution); the log gives fx ± σ and the share of the camera-to-ground distance it moves\r
  heights by, in place of a note that fired on every set. Unit tests check the σ against\r
  the spread of the solved focal over 40 noise draws (with camera positions, and without\r
  control on tilted photos) and against a dense numerical covariance. On a 444-photo RTK block\r
  the focal is 5,671.1 ± 0.3 px with the positions in the solve (5,638.8 ± 1.4 from the\r
  photos alone, 5,675.3 in Metashape): the ± is the precision under the lens model and the\r
  entered accuracies, not the error, which the check points measure. The extra\r
  factorisation added no measurable time (Reconstruct 80 s either way).\r
\r
### Changed\r
- **The example opens where its walkthrough starts.** Opening the Aukerman example now\r
  brings the ribbon's Reconstruct tab to the front, and the console is open the first time\r
  you start WebSfM (Other ▸ Console closes it, and it stays as you leave it).\r
- **Weak photo pairs are verified, not dropped at random.** Match Features now tries the\r
  best-scoring matches first when it checks a pair's geometry (PROSAC), and tries up to\r
  10,000 samples instead of 1,000 (RANSAC iterations). A pair whose good matches are a\r
  minority, such as a side-lap bridge or a wide baseline, used to be found only by chance:\r
  on synthetic pairs with 30 % true matches, 31 of 100 were found, now 100 of 100 (15 %:\r
  1 → 98). A pair with nothing in common still gives up after 1,000 samples. On blocks whose\r
  pairs overlap well nothing changes but a little time: quarry and GeoScan PUTI with RTK\r
  keep their accepted pairs (6,589 / 6,591 and 2,625 / 2,626) and checkpoints, matching\r
  149 → 154 s and 120 → 125 s; Iceland 1980 and Casa Grande 1978 film register the same\r
  123 and 37 photos (GCP fit 1.03 → 1.04 m). The Strict matching preset no longer lowers\r
  the sample count.\r
- **Cancel stops only the run.** Cancelling a Reconstruct or Tools run now stops just the\r
  workers that run was using: importing photos, building their previews, map and DEM\r
  previews and the segmentation tool carry on, and a worker that was idle keeps what it\r
  had loaded (the GPU matcher's cache, the learned models). A cancel is logged as a\r
  cancel, no longer as an error. Before, Cancel restarted every worker.\r
- **Truer heights from RTK-only drone blocks.** With RTK or PPK camera positions in the\r
  solve, Auto self-calibration now always solves the lens's decentring (p1, p2) instead of\r
  testing whether it lowers the reprojection error. With the camera heights held, even a\r
  decentring too small to show there moved the ground under them. GeoScan PUTI (444\r
  photos, RTK only, GCPs as checkpoints): p1, p2 now Metashape's (0.00019 / −0.00006\r
  against 0.00017 / −0.00007), checkpoints H / V 3.5 / 9.2 → 3.7 / 7.8 cm, mean height\r
  +7.5 → +5.5 cm (Metashape 2.4 / 6.4 cm, +4.1); UseGeo (224 undistorted photos, its\r
  positions at ±3 / 5 cm) even against its LiDAR (offset 2.7 → 3.0 cm, edge dome −3.5 →\r
  −2.4 cm, RMS 5.4 → 5.3 cm). Where the positions are consumer GPS, or GCPs hold the\r
  block, the test stays: keeping p1, p2 there gave PUTI at ±10 / 20 m checkpoints H 9 →\r
  45 cm, Casa Grande 1978 1.09 / 1.01 → 1.12 / 1.05 m and Iceland 1980 the same.\r
- **GCPs and RTK positions hold the model more firmly.** In the bundle adjustment a tie\r
  point now counts as precisely as it was measured, at the size Detect Features ran at,\r
  so GCPs and accurate camera positions carry their stated weight against it. Before,\r
  a tie point found on a photo detected at a quarter of its size counted 16 times what it\r
  measured. Same day, \`main\` against the change, same detection and matching: Iceland\r
  1980 film (detected at 1/4.8) checkpoints 1.97 / 2.46 → 1.74 / 1.02 m (Metashape\r
  1.54 / 0.97), Casa Grande 1978 1.25 / 1.18 → 1.09 / 1.01 m; quarry with RTK checkpoints\r
  6.4 / 30.2 → 4.6 / 21.6 cm and cameras against RTK 10.4 / 5.4 → 6.3 / 4.4 cm; PUTI with\r
  RTK checkpoints 3.4 / 11.1 → 3.5 / 9.2 cm, cameras 1.8 / 1.2 → 0.55 / 0.88 cm (Metashape\r
  0.5 / 1.0). The DEMs follow: Iceland against its reference DEM NMAD 2.44 → 1.28 m\r
  (Metashape 1.38), Casa Grande RMSE / NMAD 1.41 / 0.68 → 1.38 / 0.59 m, coverage\r
  unchanged. Tie-point residuals, registered cameras and run times are unchanged. With\r
  consumer GPS (PUTI's RTK positions given 2 / 2 / 4 m of noise at the 10 / 20 m default\r
  accuracy) the block's shape stays the same (26.5 / 14.6 → 26.6 / 15.2 cm), and a run\r
  without positions or GCPs solves exactly as before.\r
- **Close-range photos are detected at more of their resolution.** Detect Features ▸\r
  Resolution rule now defaults to *By project type*: in an object project each photo is\r
  detected at two thirds of its long side, 2,400 to 4,000 px; aerial projects keep one\r
  size for every photo, as before. On ETH3D's 6,048 px photos, 2,400 px registered 20 of\r
  26 cameras of *office* and 8 of 14 of *pipes*; 4,000 px registers every camera of all six\r
  scenes, at similar pose error (median: courtyard 6.7 → 7.5 mm, delivery_area 2.86 → 2.62\r
  mm, pipes 3.9 → 1.6 mm). The keypoint limit stays as set in that band: scaling it to\r
  ~28k with the area changed the error within noise and took 2–4× the matching time\r
  (courtyard 93 → 352 s on the CPU). Aerial blocks were mixed, so they keep the fixed\r
  size: Scale with image size gained on the Iceland 1980 film scans (check points 1.97 /\r
  2.46 → 1.45 / 1.96 m, 124 of 125 photos against 123) and lost height on a 42 MP drone\r
  block (UseGeo 1, cameras against the reference 3.8 / 6.1 → 3.8 / 9.6 cm), at 2.5× the\r
  time on the GPU and 3.8× on the CPU. Projects that chose a rule keep it.\r
- **Hold to a reference DEM sets the heights of a block placed by drone GPS.** With camera\r
  positions and no GCPs, the model is now placed in the frame the hold solved it in, its\r
  height set between the camera positions and the DEM by their accuracies; before, a fit\r
  to the camera positions afterwards put it back on the GPS heights and the DEM only\r
  corrected the shape. Evaluate ▸ Accuracy shows the source as *reference DEM*. With three\r
  or more GCPs nothing changes. On a 444-photo RTK block with its positions loosened to\r
  ±1.3 / 1.8 m (drone GPS) and the Copernicus DEM at its declared ±2 m, the 15 check\r
  points' heights went from 101.6 to 17.3 cm RMS (mean +100 → −11 cm), horizontally\r
  15.3 → 12.6 cm; a firmer ±0.5 m gave 29 cm. A rigid shift of the block changes no image\r
  residual, so its height is set in closed form (least squares between the positions and\r
  the held tie points) rather than left to the iterative solve. The DEM sets the height\r
  only when its vertical datum and the control's are declared; otherwise it holds the\r
  shape alone (undeclared EXIF heights 52 m from the DEM's geoid had pulled a 346-photo\r
  block 45 m and shrunk it 6 %). The hold is no firmer than the DEM agrees with the\r
  photos: σ is at least their local disagreement about a smooth surface. On a quarry\r
  where Copernicus disagrees by 5.6 m, its ±2 m had bent the block (V 13.4 → 16.8 cm);\r
  now the shape stays and the heights move from +3.00 to +2.37 m toward the DEM, which\r
  itself lies ~1.4 m high there. On a 178-photo 1970s Antarctic block (camera positions\r
  ±10 m, REMA held on half the rock outcrops), the scanned photos disagree with REMA by\r
  20 m on the steep rock, so the hold stays soft: the tie points' heights on the other\r
  half went from −7.7 to −6.4 m median against REMA (NMAD 13.3 → 12.9 m). With these\r
  checks it is no longer marked Experimental.\r
- **Add to the model is no longer Experimental.** Sparse Reconstruction ▸ Add to the model\r
  places new photos in a finished model as well as a full rebuild does, in about half the\r
  time. On a 347-photo quarry with its last 60 photos added, both registered 346 photos,\r
  the camera centres agreed to 4.7 cm RMS and both fitted the GPS alike (H 23.5 / 21.9 cm),\r
  in 34 s against 72 s; on South Building (98 + 30 photos) both registered all 128 and\r
  matched COLMAP's cameras alike (0.14 % of the block), in 15 s against 29 s.\r
- **Less noise on flat ground in aerial dense clouds.** Build Dense Cloud ▸ Point position\r
  puts each point at the mean depth of its own depth map and the maps that agree with it,\r
  so their noise averages out; Auto does this for aerial and mapping projects and keeps\r
  each map's own depth for object captures. On the same depth maps of a 347-photo aerial\r
  block with airborne LiDAR, the dense cloud's scatter about flat ground fell from 5.1 to\r
  4.0 cm, and the points within 10 cm of the LiDAR rose from 92.9 to 97.4 % (16 % fewer\r
  points). On six close-range ETH3D scenes the mean lowered F1 at 2 cm by 0.17 on average\r
  (more accurate, less complete), so object captures keep the old behaviour; choose\r
  **Mean of the agreeing views** or **Own depth map** to override Auto.\r
- **Mesh size follows the block.** Build Mesh ▸ Octree depth is Auto by default: it picks\r
  the depth for leaves of about 8 point spacings of the dense cloud, lowered until the mesh\r
  stays within the card's triangle limit (Coarse 250 k, Balanced 1 M, Fine 4 M), and the\r
  step names the depth and size before you run. A small block keeps depth 8 as before; a\r
  347-photo aerial block now gets depth 9 at Balanced (0.65 M triangles instead of 0.15 M,\r
  mesh 140 s instead of 46 s, the tab at 9.8 GB instead of 8.0 GB; texturing 3.5 min either\r
  way) and depth 10 at Fine (2.8 M triangles, 171 s, 19 GB). The limit is there because\r
  depth 11 on that block (11 M triangles) solved and then outgrew the 32 GB the tab had.\r
  The cards used to set depth 6 / 8 / 10 on every project; a depth typed in by hand is\r
  still used as is, with a warning when it predicts more than 4 M triangles.\r
- **DEM and orthophoto size follow the block.** At Auto a DEM keeps about one point per\r
  cell up to 8,192 px a side (built in blocks past 4,096), and an orthophoto takes two photo\r
  pixels a cell up to 16,384 px, instead of both stopping at 4,096 px; each Grid step says\r
  what Auto chose, and for the orthophoto the photos' own GSD. A small block's DEM stays as\r
  it was; its orthophoto gets finer, since it no longer follows the DEM's cells. On a\r
  347-photo aerial block at Auto: DEM 8,192 px instead of 4,096 (91 s instead of 40 s),\r
  orthophoto 11,581 px instead of 4,096 (560 s instead of 253 s, the tab at 13.5 GB\r
  instead of 9.1 GB, GeoTIFF 220 MB instead of 31 MB; the photos read at 86 % of native\r
  instead of 34 %). Set the photos' GSD for a full-resolution orthophoto.\r
- **Colour balance follows the camera's exposure.** The orthophoto's Colour balance and\r
  the texture's colour levelling start each photo's gain from the exposure in its EXIF\r
  (time, ISO, aperture), so a flight whose auto-exposure changed comes out even. Before,\r
  every gain was pulled towards 1 and held within two stops of it, which gave back part of\r
  a real exposure trend: on a simulated 60-photo strip whose exposure drifts fourfold, the\r
  levelled photos still differed by 96 % from one end to the other; centred on the EXIF\r
  exposure, 0.2 %. On a 347-photo aerial block whose exposure varies 10.2× (f/2.8 at\r
  ISO 320 to f/5.6 at ISO 125), no channel gain is clamped any more (10–11 before; four\r
  photos need 0.21–0.25), the orthophoto's overall level is unchanged (median gain 1.077\r
  against 1.066), and the texture's seams are as before (mean step 12.6 levels). A block\r
  shot at one exposure is unchanged.\r
\r
### Performance\r
- **Depth maps keep the GPU busier.** Each finished map's filtering and preview now run\r
  while the next map is matched on the GPU, instead of the GPU waiting for them, and the\r
  depth filter's 3×3 median is computed by a fixed comparison network. The maps are\r
  exactly the same. Depth Maps on ETH3D courtyard (38 photos, Full, Medium): 147 → 135 s\r
  (−9 %, both passes −10 %), the same depth-map digest; the filter alone 340 → 200 ms per\r
  2.6 MP map.\r
- **Reading a large streamed cloud takes half the memory.** A tool that reads points from a\r
  large cloud now keeps only the points it needs as each octree node arrives, so its peak\r
  is those points plus one node, not about twice the cloud's data. A failed or cancelled\r
  read or export frees its LAZ decoder's memory, and the viewer keeps at most four\r
  decoders open.\r
\r
### Fixed\r
- **The time left is not inflated by a run's start-up.** The progress window now measures\r
  how fast a run goes from its first finished photo, pair or map, and a time left that has\r
  halved replaces the one shown at once. On the example's Detect Features, each worker's\r
  first photo took 8–12 s (loading and compiling) and every later one about 2 s; measured\r
  from the start, the estimate said 6 minutes for a 21 s run (and up to 20 minutes on a\r
  cold browser), and held it on screen for 15 s.\r
- **Depth maps without a GPU say when they are starting.** On the CPU, Build Depth Maps now\r
  shows "Starting the CPU threads…" before its first map, the console says how many threads\r
  started and how long it took, and warns when the threaded build cannot start (each map\r
  then runs on one thread, many times slower). Before, the run sat at 0 % for several\r
  seconds without a word, and the time left counted that wait as map time. Measured on the\r
  example without a GPU (42 maps at 600 px):\r
  Chrome 278 s, Firefox 244 s, both on 19 threads, about 7 s of it starting the threads.\r
- **Depth maps on the GPU in Firefox take seconds, not minutes.** Firefox reports finished\r
  GPU work on a 100 ms timer, and Build Depth Maps took each of those waits for a slow GPU:\r
  it cut every map into ever smaller commands, each followed by another wait. It now\r
  measures the browser's wait before the first map ("Preparing the GPU…") and queues\r
  several short commands per wait; a laptop GPU still gets commands of at most 30 ms. On\r
  the example in Firefox with WebGPU (42 maps at 600 px, both passes; Quadro RTX 5000):\r
  about 115 s per map, which would have been some 80 minutes for the stage and made the\r
  run move to the CPU after its second map, now 1 s per map and 77 s for the stage.\r
  Chrome, whose wait is 0.2 ms, runs as before (29.7 and 29.2 s before, 27.1 s after).\r
- **Switching projects no longer writes into the wrong one.** Opening another project while\r
  one was open could save a piece of the old project's state (a camera pose, a layer's\r
  visibility) into the new project's folder, if a save fired during the switch. Saves now\r
  wait until the switch is done. "Project opened" shows only when the project did open.\r
- **A crashed worker no longer spoils the rest of the session.** When a worker's\r
  WebAssembly crashes, WebSfM replaces that worker and fails only the jobs it held; before,\r
  later calls ran on the broken instance. A worker that cannot load fails with its cause\r
  after three tries instead of retrying without end, and a message a worker cannot read\r
  fails its job instead of leaving it waiting.\r
- **Matching moves to the CPU when the GPU is lost.** After three GPU errors in a row, Match\r
  Features matches the remaining pairs on the CPU and says so in its summary. Before, every\r
  later pair first paid a failed GPU call.\r
- **Detect Targets can be cancelled.** Cancel stops the run (markers already placed stay),\r
  and a failure is reported instead of the progress bar simply closing.\r
- **Photos register at any model scale.** Registering a photo (P3P) solved poorly when the\r
  model's points lay very close together in its units: points a hundredth of a unit apart\r
  found no pose. The solver now centres and scales them, and works the same from 10⁻⁴ to\r
  10⁴.\r
- **A raised Min matches no longer lets false pairs in as weak.** A pair whose matches pile\r
  onto a few spots in one photo is rejected, also when Min matches is above the weak-pair\r
  floor; before, it could be kept as a weak pair. The match log now also labels a flat\r
  scene's pairs as planar, as it was meant to.\r
- **A part of a streamed cloud that fails to load is tried again.** The viewer retries it\r
  after 1 s and 2 s and logs the failure, instead of leaving a hole until the page was\r
  reloaded.\r
- **Very large buffers count against the memory budget.** A buffer of 2–4 GiB was recorded\r
  as 0 bytes, so a run could plan beyond its memory budget.\r
- **Dialogs close on Escape.** Shortcuts, What's New, Reseau and Panoramic now close on\r
  Escape also when the focus is outside them.\r
- **Guided track extension follows the rolling shutter.** With Rolling shutter on, guided\r
  track extension now looks for a point where the rolling-shutter model puts it. Before, it\r
  searched at the global-shutter projection, so near the top and bottom of a photo taken\r
  at speed (about 5 px at 10 m/s, a 30 ms readout and 2.7 cm GSD) the keypoint was outside\r
  the search window and the observation was lost. A unit test with a 30 px shift at the\r
  frame edges: 20 of 20 points extended (4 before), in JS and in the WebAssembly search.\r
- **Long corridors keep their sub-pixel fit.** The bundle adjustment now works about the\r
  cameras' centre, so a block far from where the model started (a long corridor, a seed\r
  with a short baseline) no longer gains a reprojection floor from number rounding. A\r
  perfect strip 3,000 seed baselines from the start reprojected at 0.09 px from rounding\r
  alone; it now stays at 0.0002 px.\r
- **A tab left on an old version says it must reload.** When a tab that kept working\r
  through an update later opens a dialog, the 3D view or a worker of the version it\r
  started on, and that file is gone, the update prompt now says this tab is out of date\r
  and it reloads once its work ends. Before, the run failed with "Failed to fetch\r
  dynamically imported module" or a worker error and no hint that a reload fixes it.\r
  websfm.app now answers a missing file with 404 instead of the start page.\r
- **A broken COPC file is refused instead of hanging.** Importing a COPC file whose\r
  hierarchy pages point at each other, or whose entries point outside the file, now stops\r
  with an error. Before, the first kind kept a worker busy with the progress stuck until\r
  Cancel, and the second reached the reader with impossible sizes.\r
- **Matches near the frame edge survive verification when the lens is known.** Photos whose\r
  camera group has a lens calibration (imported, or entered in the Sensors table) now have\r
  their matches verified with the lens taken out, as fisheye photos already were. A wide\r
  lens bends the epipolar lines past the 2 px gate in the outer ring of the frame, so\r
  verification threw those matches away; they are the ones that fix k2 and k3 and tie\r
  strips together. Synthetic pair through an assumed 94° lens (k1 −0.13, k2 0.11), 80 %\r
  forward overlap: true matches kept beyond ¾ of the half-diagonal below 50 % → at least\r
  98 %, in every band. Photos without a known lens are verified as before.\r
- **Camera-position accuracies stay on their axes.** The bundle adjustment now applies a\r
  camera position's horizontal and vertical accuracy in the directions they belong to,\r
  whatever pair of photos started the model. Before, they were applied along the model's\r
  own axes, which match the survey's only when the model was started from a nadir pair: in\r
  an oblique or terrestrial block an RTK position's loose height could act sideways and its\r
  tight horizontal along the vertical. A unit test solves one block in two model frames 90°\r
  apart with σ 1 / 1 / 100 cm and one position 0.5 m off in height: the camera centres\r
  agree to 6 mm (32 cm before). Nadir blocks change only within noise: quarry with RTK\r
  checkpoints H / V 4.59 / 21.6 → 4.67 / 21.9 cm, cameras against RTK 6.32 / 4.42 → 6.26 /\r
  4.39 cm; GeoScan PUTI with RTK checkpoints 3.70 / 7.76 → 3.71 / 7.74 cm, cameras 0.55 /\r
  0.89 cm both.\r
- **Detect Targets places fewer false ArUco markers.** A 4×4 ArUco marker must now read\r
  exactly, and once a model exists, a marker found far from where its GCP should appear is\r
  left out and counted in the log. Before, one wrong cell was corrected, so about one random\r
  pattern in 20 inside a dark square (a window, a solar cell) read as a marker of the\r
  default 4X4_50 dictionary and became a mark of a real GCP. A unit test reads 300 random\r
  patterns: at most 4 decode (about 15 before).\r
- **Oblique forward flights over flat ground start from the right camera pose.** Reconstruct\r
  now uses the photos' recorded attitude, or a third photo's camera position, to choose\r
  between the two poses a pair of photos of flat ground allows, and in aerial projects\r
  falls back to the photos looking down. Before, it always took the pose that put the\r
  ground at the more uniform depth, which is the wrong one for a camera flying towards\r
  where it looks at less than about 45° below the horizon (low oblique drone flights, video\r
  along the view, vehicle cameras over fields, water or roads), and every seed pair made the\r
  same mistake. When no evidence decides, the log says so and a seed retry tries the other\r
  pose. Unit tests on flat ground at 30° pitch, forward flight: the old rule picks a\r
  baseline 94° off; the attitude picks the true one at 80°, 45°, 30° and 20° pitch, and a\r
  third photo's position at 30°. The SfM golden scenes keep their seeds and models.\r
- **A single flight strip is no longer georeferenced at a random tilt.** Placed by camera\r
  positions alone, a single strip or corridor now takes its roll about the flight line\r
  from the photos looking down (aerial projects) or from imported omega, phi, kappa;\r
  otherwise Georeference says so and asks for GCPs or a second strip. Before, the\r
  positions' noise let the fit pass while the model could be turned about the line by any\r
  angle (a median of 90° over a simulated 30-photo strip, at 1.5 m and at 3 cm GPS\r
  accuracy). Unit tests: the roll reported for one strip exceeds 1°, two strips 60 m apart\r
  report under 0.1°, an aerial strip comes out level within 0.5° over five noise draws,\r
  and an object project's strip is refused.\r
- **COLMAP, OpenSfM and transforms.json line up with their images.** Models, cameras,\r
  keypoints and matches exchanged with COLMAP, OpenSfM and nerfstudio's transforms.json\r
  now take the half-pixel difference in where these tools put a pixel's centre into\r
  account. Before, an exported model was half a pixel off its photos in every image, about\r
  a pixel between strips flown in opposite directions in COLMAP dense or a Gaussian\r
  splatting trainer, and an imported one had the mirror error. Unit tests check that a\r
  centred principal point exports as COLMAP writes it and comes back exactly, and that a\r
  fundamental matrix and a homography keep the same points on them.\r
- **Camera positions in a foot-based CRS are weighed in metres.** In a project whose CRS\r
  is in feet (a US state plane), RTK camera positions are now recognised as survey-grade,\r
  positions without an accuracy get the 5 m default, and the GNSS antenna offset is\r
  applied at its true length. Before, all three were read in feet: a 0.1 m threshold\r
  became 0.1 ft, the default 5 ft, and the lever arm about a third of its length. A unit\r
  test builds the same positions in UTM metres and in US survey feet and checks both\r
  give the same verdict and the same 5 m default.\r
- **Conformal fiducial transform works with y-up certificates.** Film calibration with\r
  the *Conformal* transform now fits a calibration certificate whose y axis points up\r
  (the usual case) as well as *Affine* does. Before, it could not represent the flip\r
  between the certificate and the scan rows, and every keypoint went through a\r
  near-singular map (134,722 µm RMS on a synthetic 230 mm frame, now 4.7 µm). *Affine*,\r
  the default, and *Projective* were not affected.\r
- **Continuing a stopped matching run matches every pair.** Continue now matches again the\r
  pairs that failed or were cut off by Cancel before the stop. Before, such a pair could be\r
  counted as done although it had no saved result, and was then never matched.\r
- **Huge clouds with stray points import again.** Importing or editing a very large cloud\r
  whose extent is far larger than its data (a few stray points at 0, 0, 0 in a UTM\r
  cloud, or millions of points in one spot) no longer fails with "Cannot read properties\r
  of undefined (reading 'idx')". The octree build numbered its deepest cells past what\r
  its index could hold; a unit test splits a cluster down to the deepest level.\r
- **A run that fails at its start no longer locks the project.** If a Reconstruct or Tools\r
  run failed before it got going, its progress window now closes and the error is\r
  logged. Before, the window could stay open, and opening, switching or deleting\r
  projects was refused until the page was reloaded.\r
- **Workflow Builder's Dense Model block replaces the main dense cloud when asked.** With\r
  *Replace the main dense cloud* on, a workflow now replaces it as the Build Dense Cloud\r
  dialog does, instead of adding "Dense cloud 2, 3, …" on every run. The Depth Maps, Dense,\r
  DEM, Orthophoto, Mesh and Texture blocks now turn their settings into a run by the same\r
  code as their dialogs, so a block runs exactly as its dialog would; unit tests check each\r
  block against its dialog, with the defaults and with Replace on.\r
- **Optimize cameras and Gradual selection keep GCPs and positions at full weight.**\r
  Both tools now weigh a tie point as the reconstruction does, one pixel of the size\r
  Detect Features ran at. Before, they re-solved with every tie at one full-size pixel, so\r
  on a film or downsampled project Optimize cameras after adding GCPs pulled the model\r
  back towards its tie-only shape (by 23× at a detection scale of 1/4.8), partly undoing\r
  what the GCPs and RTK positions had corrected. The reprojection error still fell, so\r
  the acceptance check could not see it. A unit test checks that both tools hand the\r
  solver ties at 1/16 for a project detected at a quarter of the size, and GCP marks at\r
  their own accuracy.\r
- **Georeference from camera positions applies the GNSS antenna offset.** With a lever\r
  arm set in the Sensors table (its GNSS antenna offset), Georeference now\r
  fits the model to the antenna's position in each photo, as the bundle adjustment\r
  already did. Before, the final fit paired the camera centre with the antenna, so every\r
  product of a block placed by RTK or PPK positions without GCPs was shifted by the arm,\r
  the full vertical offset on a nadir block (often 5–30 cm on drones), and Evaluate ▸\r
  Pose Residuals showed a ± pattern between strips flown in opposite directions. A unit\r
  test flies a lawnmower block with a (0.10, 0.05, −0.30) m arm: a ground point now lands\r
  within 1 mm of its true position (0.29 m before) and every pose residual is under 1 mm.\r
- **Georeferenced PLY, STL and GLB exports keep their millimetres.** A cloud or mesh\r
  exported in map coordinates now reads back where it was: binary PLY writes the\r
  positions in double precision, GLB keeps a rounded offset as its node translation, and\r
  STL is written relative to an offset named in its header and the log. Before, all\r
  three stored map coordinates in single precision, which rounds a UTM northing to\r
  0.5 m. LAS, LAZ, COPC, ASCII PLY, XYZ and OBJ were already exact. A local-frame export\r
  is unchanged. Unit tests export points at (512345.678, 5432109.876, 312.345) through\r
  each writer, including the streamed PLY export of a large cloud, and read them back\r
  within 1 mm.\r
- **A failed rerun no longer loses the saved model.** When Reconstruct unloads the old\r
  model to make room and the run then fails or is cancelled, WebSfM now reads the saved\r
  model back. Before, the next ordinary action (hiding a layer, renaming a cloud) saved\r
  the empty placeholder over it, and the solved cameras, the georeference and the\r
  secondary models were gone from the project. Nothing is saved while the old model is\r
  unloaded; a store test unloads a model, toggles a layer, fails the run and checks that\r
  nothing was written and the cameras and points came back.\r
- **A georeference survives reopening the project.** A project placed by its photos' GPS\r
  could lose its georeference when it was opened again, until Georeference ran once more:\r
  the check that retires a fit whose poses or GCPs changed saw the project half-restored,\r
  or a photo's position half-rewritten, and took it for a change. It now waits for the\r
  project to finish opening, and positions are never written through an empty value. A\r
  camera-position or marker file that names the photos in another case or without the\r
  extension also retired it on every reopen, when its rows took the photos' names; the\r
  names no longer count, and projects saved that way keep their georeference again (a\r
  GeoScan PUTI half placed by its RTK file came back without one). A project saved with a\r
  photo's positions read twice (for example after adding photos) needs Georeference once\r
  more.\r
- **Build Mesh keeps to its memory budget.** A mesh solved in tiles now plans its workers\r
  with what the open project already holds, sends each worker only its tile's points,\r
  starts each tile on a fresh worker, and frees the workers before the tiles are joined.\r
  Quarry at depth 11 (73 M points, 16 GB budget): the tab's peak 32.1 → 15.1 GB, the same\r
  11.1 M-triangle mesh, in 676 s instead of 540 s (four workers fit the budget, not six).\r
  Step by step: planning and freeing 25.4 GB, per-tile points 19.3 GB, a fresh worker per\r
  tile 15.1 GB (a worker's heap grew past its estimate tile after tile).\r
- **Importing camera positions again updates them.** Importing a camera file a second\r
  time now replaces each photo's position, even when the file names the photos without\r
  the extension or in another case. Before, such a re-import (or one after reopening the\r
  project) added a second copy of every position, and bundle adjustment counted each\r
  camera's prior once per import, as if the positions were more accurate than stated.\r
- **Complete third-party notices.** About ▸ Licenses now lists everything WebSfM includes\r
  from others, each with its license text, and every copy of the app carries the same list\r
  as THIRD_PARTY_NOTICES.txt. The list was kept by hand and had fallen behind: it named 15\r
  of the 48 npm packages the build bundles and 7 of the 75 Rust crates in the WebAssembly\r
  modules, and lacked the Rust standard library, the service worker's Workbox, the EPSG\r
  dataset's terms (IOGP's ownership must be acknowledged), the geoid grids' source and\r
  the full license texts of the models a deploy serves. The build now finds the packages\r
  (from the app, its workers and the service worker), \`npm run build:wasm\` the crates,\r
  and THIRD_PARTY.md in the repository says what else is someone else's: the vendored\r
  Poisson crate (which now carries its license files), the AprilTag, ArUco and MicaSense\r
  code, the models and the data. The video-import test now uses four CC0 example photos\r
  in place of South Building images, whose license is not stated.\r
- **Fusion keeps to its memory budget.** Build Dense Cloud no longer goes past the memory\r
  budget (Settings ▸ Compute) once the slabs are fused, and the tab gives the memory back\r
  as soon as the cloud is built. The fusion workers' merge buffers stayed allocated through\r
  the join and the level-of-detail octree; they are now released when the last slab is\r
  done. A large dense cloud is also kept in memory the workers share (in a cross-origin\r
  isolated tab, as websfm.app is), so the octree build and Build Mesh read it instead of\r
  copying it, and a saved cloud loads the same way. On a 347-photo aerial block\r
  (73 M points): at a 16 GB budget the tab peaked at 11.9 GB against a plan of 12.9 GB\r
  (14.6 GB before) and held 4.9 GB afterwards (14.5 GB before); at 8 GB, 8.1 GB against\r
  8.0 GB (10.2 GB before). The fusion plan also no longer counts on room the open project's\r
  clouds already take.\r
- **A very fine mesh finishes.** Build Mesh at a high octree depth no longer stops after\r
  the solve with no message; it colours the mesh and saves it. Chrome leaves a\r
  \`Float64Array\` of 2^28 elements (2 GiB) or more unfilled when one \`fill()\` covers it;\r
  the vertex-colour index of a 5.6 M-vertex mesh grew to that size, held no empty slot,\r
  and its search never ended. Every such array is now filled in pieces. The index's hash\r
  also mixes the whole key now: cells a power of two apart in the packed grid had landed\r
  in a few slots (a quadratic slow-down), and colouring is about 20 % faster (67 M points\r
  onto 4.2 M vertices: 64 + 31 s instead of 79 + 40 s). On a 347-photo aerial block,\r
  depth 11: 11.1 M triangles in 551 s, colouring and joining the 48 tiles 86 s, the tab\r
  at 35.7 GB.\r
\r
## [0.7.0] — 2026-11-09\r
\r
### Added\r
- **Experimental features are marked.** An amber **Experimental** badge sits beside\r
  rolling shutter, the multispectral rig, the reflectance map, Hold to a reference DEM,\r
  AprilTag and ArUco detection, and Add to the model; its hover text says what has not\r
  yet been checked on real data. They work, but compare their results with a reference\r
  (check points, a calibration panel) before relying on them. A badge goes when its\r
  checks pass: rolling shutter needs a DJI block with independent check points, the\r
  multispectral rig and reflectance map a real flight with a held-out panel, the DEM\r
  hold its benches against withheld check points, the tags real photos of printed\r
  tags, and Add to the model a comparison with a full rebuild.\r
- **COPC export.** Export ▸ Point Cloud has a **COPC** format (\`.copc.laz\`): LAZ 1.4\r
  stored as a level-of-detail octree, which QGIS, Potree and PDAL read a part at a time.\r
  A streamed cloud is written from its own octree, node for node, without being loaded;\r
  another is written with the georeference and downsample chosen. Colour, classes and\r
  other attributes, and the CRS as WKT, go in. A 300,000-point export reads in PDAL 2.10\r
  (readers.copc and readers.las) and laspy 2.7's CopcReader with every point; laspy's\r
  bounded queries return exactly the points a brute-force count finds in each box.\r
- **Whole Metashape projects.** Import ▸ **Metashape** now also opens a project (a \`.psz\`,\r
  or the folder of a \`.psx\`): besides the calibration, camera poses, markers and scale\r
  bars, its tie points come in as keypoints and matches (the unaligned photos' too),\r
  its aligned cameras and tie points as a sparse model in metres, and its mesh in the\r
  same frame. The dense cloud, DEM and orthomosaic are in formats of Metashape's own, so\r
  the dialog names those to export as LAS/LAZ or GeoTIFF. On a six-photo Metashape 2.2.2\r
  project the imported cameras reproject the tie points exactly as Metashape's own\r
  camera.project does (median 0.856 px, p90 2.195, max 11.175 over the same 349\r
  projections).\r
- **Runs show their steps.** The progress dialog of Sparse Model, Depth Maps, Dense\r
  Cloud and a mesh in tiles lists the run's steps under the bar (for Depth Maps:\r
  PatchMatch, the geometric pass of the Full method, the cross-view filter), ticks the\r
  ones done and gives the running one its own count and bar; a step the run leaves out\r
  is struck through. The bar on top still shows the whole run.\r
- **Keypoints and matches from text or CSV.** Import ▸ **Keypoints & Matches** reads what\r
  another detector or matcher writes: keypoints as an \`image,x,y\` table, one file per\r
  image or Lowe's \`.key\`, and matches as COLMAP's match list, an \`imageA,imageB,indexA,\r
  indexB\` table, or matched points by position (\`imageA,xA,yA,imageB,xB,yB\`), whose\r
  points become the keypoints. A dialog shows what the files hold and what to import,\r
  and the matches are verified as Match Features verifies its own (RANSAC at its default\r
  thresholds, on every worker), unless you say they already are. In the browser test,\r
  60 true and 6 false matches of a made-up two-view geometry keep 58–61 inliers.\r
- **Bundler files.** Import ▸ **Other SfM** reads a Bundler \`bundle.out\` with its\r
  \`list.txt\` as a sparse model, besides VisualSFM NVM, OpenMVG, OpenSfM and\r
  transforms.json; the imported cameras see each point within 0.01 px of where the file\r
  says.\r
- **A folder offered before a big batch of photos.** When the photos you add would bring\r
  a project in browser storage to 3 GB of photos or more, WebSfM asks once whether to\r
  move it to a folder on disk first (Chrome, Edge), and adds the photos there; Keep in\r
  browser adds them as before. Firefox and Safari, which cannot use folders, say it in\r
  the log. Keypoints, matches, depth maps and products take several times the photos,\r
  and a browser may limit or clear its storage.\r
- **Copy for bug report.** Other ▸ System info has a button that copies your browser and\r
  OS, GPU, CPU cores, memory, WebGPU and storage as a few lines of text, to paste into a\r
  bug report; nothing about the project is included, and nothing is sent anywhere. The\r
  console's Save TXT starts with the same lines, and System info now names the browser.\r
- **A toolbox while you mark a scale-bar point.** After *Mark point in photos* in Set\r
  Real-World Scale, a small Scale bar toolbox stays over the workspace: which point is\r
  being marked, in how many photos so far, and *Back to scale bars* or *Stop*.\r
- **Multispectral cameras.** Photos from a MicaSense RedEdge or Altum are read band by\r
  band: each band becomes its own sensor, the photos of one trigger form a capture, and\r
  captures of the calibration panel are disabled when imported, so alignment leaves them\r
  out. Matching pairs only the reference band (green) between captures and every other\r
  band with its own capture's reference image, and Sparse Model ▸ 5 · Camera rig solves\r
  one pose per capture, each band at its lens offset refined from the photos; a band\r
  that matches nothing, such as thermal, takes its capture's pose. On the MicaSense\r
  sample captures, the band offsets the camera records predict how each band lines up\r
  with green to within 0.7–1.5 px (RedEdge-MX, Altum), against 6–31 px when read the\r
  other way round. On a synthetic 15-capture block with four bands, offsets recorded\r
  0.15–0.2° wrong were solved to the truth within 0.01° (plus the 0.048° a 5 cm lever\r
  arm at 60 m turns into), and the thermal band placed within 5 cm. Not yet run on a\r
  real multispectral flight.\r
- **Reflectance maps for NDVI.** Reconstruct ▸ Products ▸ **Reflectance** puts every band\r
  of a MicaSense camera onto the DEM in reflectance, calibrated with the panel photos, the\r
  sun sensor or both, and adds it to Reference Data, shown as NDVI; Style bands… picks\r
  any band, a composite or NDVI, NDRE and GNDVI by the bands' names. Each cell takes the\r
  capture that sees it most from above, every band read from that capture's raw values\r
  through the camera's own radiometric model (black level, gain, exposure, vignetting),\r
  ported from MicaSense's MIT-licensed processing code; a thermal band is in °C. The\r
  GeoTIFF has one 32-bit band per lens, named as QGIS and GDAL read them. On MicaSense's\r
  sample captures the panel radiance and irradiance of all five RedEdge-MX bands come\r
  within 0.1 % of MicaSense's own test values, and the sun-sensor irradiance of the Altum\r
  and the 10-band RedEdge-MX Dual exactly. Not yet checked on a full flight.\r
- **GCP targets marked for you.** Tools ▸ Images ▸ **Detect targets…** finds the centre of\r
  each GCP's checker mat where the model expects it, or of every AprilTag 36h11 tag or\r
  ArUco marker in every photo, and places the mark, flagged as detected with a score, for you to check in\r
  Edit GCPs. A checker mat is looked for from its coordinates through the georeference,\r
  or from its marks in two other photos. An AprilTag needs no model, even before Align:\r
  tag 7 marks the GCP with 7 as the only number in its name, or a new marker "Tag 7".\r
  Marks you placed yourself always stay. In a GCP's marks view (double-click it in the\r
  sidebar) ✓ accepts a detected mark and **Accept** takes them all; from the keyboard,\r
  A accepts the highlighted one, X removes it and S moves on. On synthetic mats (turned, blurred, noisy, the\r
  guess 20 px off) the centre is found to within 0.1 px; on the Aukerman example the\r
  place it searches for a removed mark lies within 3 px of where the mark was. On\r
  rendered tags (turned, in perspective, blurred, noisy, two bits wrong) the tag's centre\r
  is found to within 0.1–0.3 px; a 20 MP photo takes about 2.5 s per worker, photos run\r
  on all workers. ArUco reads OpenCV's 4X4, 5X5 and 6X6 dictionaries (choose yours under\r
  Dictionary), correcting as many wrong cells as OpenCV does for each (none for 4X4_1000,\r
  5 for 6X6_250); on rendered markers the centre is within a third of a pixel. Metashape\r
  coded targets are not read.\r
- **Dialogs remember their settings.** The Reconstruct dialogs (Detect Features, Match\r
  Features, Sparse Model, Depth Maps, Dense Cloud, DEM, Orthophoto, Mesh, Reflectance) and Texture Mesh, Contour Lines,\r
  Co-register DEM, Align to Reference and Detect Targets open on the settings of their\r
  last run in the project, and **Presets ▾** in the title bar saves a set under a name\r
  for the next project of the same kind, brings it back, or resets to the defaults. Only\r
  what differs from the defaults is kept, so a setting renamed in a later version falls\r
  back to its default. Match Features' "only new pairs", Co-register DEM's "apply to" and\r
  the contours' output follow the project each time. Detect Features keeps each detector's\r
  settings, so a preset brings back the detector with its own values.\r
- **The orthophoto as a web map.** Export ▸ Orthophoto ▸ **MBTiles** or **XYZ tiles**\r
  cuts it into Web Mercator map tiles, from the zoom that shows the whole area to the\r
  first one as fine as its pixels, in PNG, JPEG or WebP: one file for QGIS, QField or\r
  MapLibre, or a \`{z}/{x}/{y}\` zip for a web server. The finest tiles are resampled from\r
  the stored orthophoto and every coarser one is built from its four children, so the\r
  orthophoto is read once. MBTiles uses the SQLite library WebSfM already loads for COLMAP\r
  databases, only when it is needed; GDAL 3 reads the result in place.\r
- **Hold a model to a reference DEM.** Georeference ▸ **Hold to a reference DEM** rebuilds\r
  the sparse model with its tie points over stable ground held to a reference DEM's\r
  heights, so a block with only drone GPS or a few GCPs cannot dome or dish; the GCPs or\r
  camera positions still place it. Choose the reference (or fetch the Copernicus DEM\r
  around the cameras), its height uncertainty (its declared vertical accuracy, else\r
  2 m) and optionally a layer of stable ground. Each tie point seen in three or more\r
  photos is held along the vertical only, those far from the DEM's height are left out,\r
  and the focal length and distortion are re-estimated over two rounds, as with GCPs.\r
  Quality Report ▸ Accuracy ▸ Reference DEM Hold shows how many points were held and\r
  their height against the DEM before and after. On a synthetic nadir block that domes\r
  under GPS alone (σ 2 m, k1 self-calibrated), shape error 0.45 → 0.08 m and height\r
  against the ground 0.70 → 0.07 m RMS; real benches (historical photos against REMA,\r
  drone blocks with RTK checks) are still to come.\r
- **Rolling shutter for drones without a mechanical shutter.** Sparse Model ▸ 4 · Rolling\r
  shutter ▸ **Estimate the readout time** solves each camera group's readout time in\r
  bundle adjustment, with each camera's motion taken from the photos taken just before\r
  and after it (their capture times). Off by default until a real drone block with check\r
  points measures the gain. A global-shutter solve hides the effect in a bent block with\r
  small residuals: on a synthetic two-strip block (10 m/s, 30 ms readout, 50 m) it fit to\r
  0.017 px while the points were 8.1 cm off in shape; with the readout time solved (30.005\r
  ms recovered from 0) the shape error was 0.003 mm. On 54 photos of a DJI Mavic Air 2\r
  (whole-second capture times) it found a 25.7 ms readout, the camera positions fitted\r
  the drone's GPS 20 % closer (0.75 against 0.94 RMS) and self-calibration moved the\r
  principal point less (5.3 against 11.7 px), at about the same reprojection (0.86 against\r
  0.88 px RMS); no check points there, so the default stays off. The model keeps each camera's readout, so GCP\r
  and check-point marks are triangulated from the pose at their own row, and the GCP\r
  guides and Detect targets look where that row sees them. Depth maps, orthophotos,\r
  textures and Export ▸ Undistorted Images read each such photo resampled onto its\r
  middle-row pose, every pixel moved by where the camera was when its row was read (the\r
  photo's sparse points give the depth that takes), so the dense cloud and the mosaic\r
  follow the corrected block. On the Mavic Air 2 photos with depth maps at 1,000 px, where\r
  the shift is under a pixel, the products came out the same within noise as with the\r
  setting off (depth-map cost median 0.282 against 0.279, 9.5 against 9.8 million dense\r
  points, orthophoto seams 1.89 against 1.91 × the interior). At 2,000 px (High) the\r
  depth maps matched slightly better (cost median 0.210 against 0.215 over the 54 maps,\r
  p95 0.695 against 0.697, 78.5 against 78.3 % of the pixels kept in fusion, 39.3 against\r
  41.2 million points) and the mosaic was unchanged (seams 1.88 against 1.87 ×).\r
- **Metashape interchange, both ways.** Import ▸ **Metashape Cameras**\r
  reads the XML of Metashape's Export Cameras or Export Markers and takes, as you choose,\r
  the calibration of each camera, the positions and orientations of the aligned cameras\r
  as priors in the project's coordinate system, the markers with the marks placed in\r
  Metashape (a disabled marker as a check point), and the scale bars between markers or\r
  cameras (a disabled one as a check). A calibration made at another photo\r
  size is scaled to the project's photos; terms WebSfM has no place for (k4, b1, b2) are\r
  named with how far they move a corner. Export ▸ SfM Project ▸ **Metashape XML** writes\r
  the registered cameras, their calibration, the GCPs with their marks and the scale bars\r
  back, for\r
  Metashape's Import Cameras and Import Markers. On the Aukerman example the imported\r
  cameras land where Metashape 2.2's own Omega Phi Kappa export puts them (1e-6 m, 1e-8\r
  in rotation), and Metashape 2.2 projects points through the exported cameras to within\r
  0.0001 px of WebSfM.\r
- **Photos left out of a large survey get a pose.** When matching leaves photos apart from\r
  the main block, or hanging on it by a few weak pairs, Match Features now detects them\r
  again at full size together with the photos of the main block they share most pairs\r
  with, and matches their pairs again (Match ▸ Repair a split graph ▸ **Detect gaps again\r
  at full size**, on by default). It acts only on SIFT photos detected at under 0.8× of\r
  their size, and not when the gap is more than half the block. Bridge repair now also\r
  finds pieces that hang on the main block by pairs of fewer than 30 inliers (100 in\r
  all), which it used to count as joined. On the Starbuck glacier survey (171 film scans\r
  of 10,400 px, detected at 0.38× by the automatic resolution), 43 photos in two flight\r
  lines hung on the block by 3 weak pairs; detecting them and 28 partners again took\r
  17 minutes and left 2 apart, and the sparse model posed 161 photos instead of 125\r
  (detection and matching 25 min instead of 6; detecting all 171 at full size poses 163\r
  in 48 min).\r
- **Camera groups that mix cameras are pointed out.** A sensor whose photos come in\r
  several scan formats, or whose film rolls fit its fiducial layout badly, gets a ⑂ in the\r
  Sensors list and a warning in Sparse Reconstruction, and right-click ▸ **Split camera\r
  group…** splits it, by the suggestion, by scan format or by roll. A scan batch has one\r
  exact size, so sizes a few pixels apart count as other cameras, unless every frame was\r
  cropped to its own size; a roll misfits when its fiducial residual is three times the\r
  rest's and over half a scan pixel. A fiducial layout estimated from the photos is\r
  estimated again per group. On the Melville glacier scans (173 photos, 20 rolls) grouped\r
  by camera position, the suggestion splits L and V into 6 groups by scan size and finds\r
  the roll whose marks fit at 171 µm against 21 µm; the sparse cameras then lie 13.3 m RMS\r
  (median 6.0 m) from the reference positions instead of 28.0 m (12.6 m), as close as\r
  Metashape's 9 groups by focal length and size (13.0 m). Grouping by focal length alone,\r
  as a calibration import does, made it worse (32.8 m). The DEM (depth maps at Medium)\r
  lies 7.0 m NMAD from REMA on stable rock instead of 8.2 m (Metashape 5.0 m), and its\r
  warped outer flight lines are mostly gone: after one 10 m shift north, 5.2 m instead\r
  of 7.1 m, against Metashape's 5.5 m.\r
- **Co-register a DEM onto a reference DEM.** Tools ▸ Products ▸ **Co-register DEM…**\r
  compares a DEM with an imported reference DEM on stable ground and removes the offset,\r
  either from a co-registered copy of the DEM or from the georeference, so every product\r
  built after it lands on the reference. Its steps follow xDEM, each optional: a horizontal\r
  shift (Nuth & Kääb), the median vertical shift, and a tilt (a plane, or for the DEM a\r
  quadratic surface). Moved, the georeference keeps the move through every refit until\r
  you remove it. Quality Report ▸ DEM vs reference opens it in place of *Move the control\r
  onto the reference*, which edited the control points. Nuth & Kääb (2011) and xDEM are\r
  now cited (About ▸ References, the Quality Report's methods). On Melville (Find GCPs\r
  control, 20 m DEM) the DEM lay 1.1 m east and 7.9 m north of REMA; its NMAD on stable\r
  rock went from 6.9 m to 5.2 m with both shifts, 5.0 m with a plane, 4.9 m with a\r
  quadratic surface. Moved through the georeference (both shifts and a plane), the DEM\r
  rebuilt afterwards measured 5.1 m, with 0.5 m of shift left. Metashape's DEM of the\r
  same photos is at 5.0 m as built and 4.5 m once co-registered the same way, so the\r
  step closes most of the gap, not all of it.\r
\r
- **Co-register a DEM without a reference of your own.** In Tools ▸ Products ▸\r
  **Co-register DEM…**, **Copernicus DEM (30 m)** fetches the free global Copernicus DEM\r
  (made from TanDEM-X) over the DEM and uses it as the reference DEM. Only the part of\r
  the 1° tiles under the DEM is read, from Microsoft's Planetary Computer, which needs no\r
  account; the reference is imported with its datum (EGM2008) and its stated accuracy\r
  (σ 2.8 m horizontal, 2.4 m vertical). TanDEM-X itself needs a DLR login, and the AWS\r
  copy of the Copernicus DEM cannot be read from a browser (no CORS).\r
- **A preview of each Sentinel-2 scene.** Find GCPs ▸ **Sentinel-2…** shows the chosen\r
  scene's whole tile beside the list, with a box on the window that will be read, so\r
  cloud over the area shows before you fetch it. The preview is the catalogue's own\r
  343 px quicklook, about 45 KB a scene.\r
### Changed\r
- **Each sparse model keeps its own lens.** A model now stores the lens and film frame its\r
  cameras were solved in, and depth maps, orthophotos, textures, GCP tools and exports\r
  built from it use that lens, not the camera groups' current values or the last run's.\r
  Editing a camera group no longer changes a finished model; to start the next run from\r
  what a model solved, use Sensor table ▸ Estimated ▸ **Use for next run**. Imported\r
  models keep their own lens too: a COLMAP import keeps each camera's distortion\r
  (SIMPLE_RADIAL, RADIAL, OPENCV, FULL_OPENCV, OPENCV_FISHEYE; it was dropped) and\r
  undistorts its observations with it, and a Metashape model import does the same with\r
  the adjusted lens. Secondary models keep their own lens (they took the main model's).\r
  Projects are migrated to format 4 on opening: each model gets exactly the lens it was\r
  drawn with, so products and saved depth maps stay as they were; a model other than the\r
  main one is marked as such in the Quality Report, since its own run's lens was not\r
  recorded. The sensors CSV (Estimated) now writes the solved lens; it wrote the camera\r
  group's.\r
- **A faulty GPU no longer spoils depth maps.** Depth Maps checks the GPU's matching cost\r
  on the first map against the CPU's; when they disagree, that map, the rest of the run\r
  and later runs are computed on the CPU, and the log says so. The check now judges the\r
  median difference: the RMS it judged before reached 7e-3 on a correct NVIDIA GPU (its\r
  texture filter rounds a few low-texture pixels far off) and only warned. A correct\r
  GPU's median is 1.4e-4 on five Aukerman photos and ≤ 1.3e-5 on synthetic scenes; the\r
  shader with its homography sign flipped gave 2e-1 and moved the run, which is moved\r
  above 1e-2. The CPU's cost is now the reference itself (the check and the tests call\r
  the Rust code a CPU run uses), instead of a third copy in JavaScript, and both kernels\r
  are held to the same depth accuracy on six synthetic scenes (best-K, ACMH, a shallow\r
  plane, the sparse window, the planar prior on a textureless strip, the geometric pass):\r
  the CPU kernel on every push, the GPU kernel on a software GPU in the nightly browser\r
  tests.\r
- **A tidier project folder.** A project's folder now holds only \`project.json\` at its\r
  top, with the small documents (GCPs, poses, sensors, scale bars …) in \`data/\`, the\r
  model and its binary files in \`reconstruction/\`, and the log, last dialog settings,\r
  run journals and migration copies in \`internal/\`. A project from an earlier version\r
  is moved over when it is opened (project format 3); its model's files follow as it is\r
  read, or with its next save. The fixtures of formats 1 and 2 open with everything they\r
  held and end with nothing but \`project.json\` at the top.\r
- **Import ▸ Interoperability names the tools.** The buttons are now WebSfM Project,\r
  COLMAP, Metashape, Other SfM and Keypoints & Matches, each with a tooltip that says\r
  what it reads, and each opens a dialog that shows what the files hold and asks what\r
  of it to import. The COLMAP and Other SfM dialogs now start with what the file holds\r
  ticked; before, everything started unticked.\r
- **No upper limit on keypoints or detection resolution.** Max keypoints in Detect\r
  Features (SIFT, SuperPoint, DISK, ALIKED), the LightGlue keypoint budgets in Match\r
  Features and the detection resolution take any number; the keypoint fields say how much\r
  more matching work a value means than the default, and Detect Features warns when a\r
  photo at the chosen resolution needs Tiling or cannot be made at all.\r
  One SIFT pass holds about 64 MP: measured at 60 bytes per pixel of WebAssembly memory\r
  (16 MP 0.9 GB, 64 MP 3.7 GB), and 74 MP no longer fit the 4 GiB a module can address.\r
  The old 10,000 px limit allowed a 100 MP square scan, which failed the same way.\r
- **Greyed-out controls say why.** Hover a disabled button, field or option in any\r
  dialog, panel or toolbox to see what it is missing or what to do first, as the ribbon\r
  already did.\r
- **Georeference laid out like the other dialogs.** The coordinate system and the\r
  control on hand sit under Source, the three methods are cards (Adjust with GCPs, Hold\r
  to a reference DEM, Transform only) that say on hover why one cannot be chosen, and\r
  each method's steps say what it will do.\r
- **About ▸ Licenses easier to read.** Each entry fits on one line with a short note of\r
  what WebSfM uses it for, and a full license text opens under *License text* instead of\r
  filling the list.\r
- **Export dialogs laid out like the Tools dialogs.** The formats are cards, each saying\r
  what its file holds, followed by numbered steps: ① Format, ② the export's own\r
  settings, ③ the coordinate system of a DEM or orthophoto GeoTIFF, then the file name.\r
  What the dialog exports, and the source of camera poses or calibration, sit above the\r
  steps as Source.\r
- **Image lists in the Quality Report are links.** The images of each match component\r
  (Matching), the images not registered and those an extension added (Sparse) are listed\r
  in columns, and a click on a name opens the image; a click on a row of the Matching\r
  table does too. A long list shows its first 48 names and a *Show all* button.\r
- **Each step listed once, in every processing dialog.** Every step is a group headed by\r
  what it will do in a few words (Depth Maps: ① 1,500 px · 10 views, ② 7×7 · 5 sweeps ·\r
  Fast, ③ median 10 %, ④ ≥ 2 views agree); a click on the header opens or closes it.\r
  Open, a step shows what it does and the choices you make per project; **Show advanced\r
  settings** in the footer (the same switch as in Settings ▸ Display) adds the finer\r
  settings of every open step, and a closed step stays closed. Each dialog remembers\r
  which steps you opened or closed. A step that is switched off reads "off" but stays\r
  as usable as the others. The Advanced section that repeated\r
  the steps is gone from the Reconstruct dialogs (Detect and Match Features, Sparse\r
  Model, Depth Maps, Dense Cloud, DEM, Orthophoto, Mesh) and the Tools dialogs with\r
  finer settings (Texture, Filter Cloud, Classify Points, Clean and Smooth Mesh, Align to\r
  Reference, Detect Fiducials, Contour Lines).\r
- **Dialogs laid out alike.** Every processing dialog now shows its steps with what each\r
  will do, keeps the settings whose defaults suit almost every project under one\r
  **Advanced settings** section, and leaves only the choices you make per project in\r
  view. Dense Cloud, Orthophoto and Texture Mesh gain quality cards: **Light / Medium /\r
  Full** point density (every 4th, 2nd or every pixel), **Fast / Balanced** mosaics (nadir\r
  seams with feathering against graph cut with multiband blending, 68 s against 116 s\r
  on an 80-photo quarry block) and **Draft / Medium / Full** texture resolution. DEM,\r
  Orthophoto, Classify Points and Contour Lines move their tuning under Advanced; Sparse\r
  Model and Depth Maps show their steps' effects above it instead of inside it.\r
- **Measuring in one window.** Ruler, Area, Profile and Volume show their result in the\r
  measuring window itself, under the point buttons, instead of in a second panel; on the\r
  2D map the window's **Layer** field picks the raster to measure, and Profile and Volume\r
  start on the map's DEM. Tools ▸ Measure no longer lists the map's layers: the ribbon\r
  stays the same whatever is loaded. The window opens at the top left, out of the way of\r
  the drawing.\r
- **Every project on the start screen gets the same line.** Under each project's name\r
  come, in fixed columns, an icon for where it is stored (a folder on disk or this\r
  browser, the folder's name on hover), its CRS (**Local** without one), its size and\r
  when it was last edited. A folder project now shows its size too, whenever the browser\r
  can still read the folder without asking.\r
- **The live sparse view stays put.** While Sparse Reconstruction runs with the 3D view\r
  in front, the progress card stays in the view's corner from start to end, and the\r
  rest of the app is dimmed only lightly. The card used to start in the middle, move to\r
  the corner with the first cameras and come back for the last steps, and the earlier\r
  clouds flashed up before the finished model replaced the live one.\r
- **Guide and Glossary tabs move and close like the main tabs.** Drag a tab in the\r
  Guide or the Glossary to put it elsewhere in the strip, and right-click it for\r
  **Close**, **Close others**, **Close to the left**, **Close to the right** and **Close\r
  all**, as on the tabs of images and products.\r
- **A shorter guide.** Every guide article now says what a setting does and when to\r
  change it, in a few sentences; the hover help of a setting is the same short text.\r
  Test results and the history of each setting are gone from the app (they stay in this\r
  changelog). The guide is half as long, about 24,000 words instead of 51,000.\r
- **Help for every tool setting.** The settings of Filter, Crop, Transform, Merge,\r
  Align to reference (ICP), Estimate normals, Distance to reference, Clean mesh, Smooth,\r
  Decimate, Sample to points, Contours, Slope/aspect/hillshade, Clip to polygon and\r
  Optimize cameras now carry a **?**: hover it for what the setting does and when to\r
  change it, as in the Reconstruct dialogs. Each tool has its own article under\r
  **Tools** in the Guide, and the Guide's articles are named as the dialogs they explain\r
  (*Build Dense Cloud*, *Build DEM*, …).\r
- **Footprints from Poses in numbered steps.** Tools ▸ Model ▾ ▸ **Footprints from\r
  poses…** now lays out its settings as *1 · Ground* and *2 · Cameras*, each with a line\r
  saying what it does to this project: what the corners land on, in which height datum,\r
  and how many poses get a footprint and why the others are skipped. **Ground** is a\r
  row of buttons, and the manual intrinsics have their own help.\r
- **One look for every dialog's buttons and menu paths.** The import dialogs for GCPs,\r
  camera poses, calibration, fiducials and footprints, and the New Project dialog, use\r
  the same buttons as every other dialog. Import ▸ **WebSfM Project** and **SfM\r
  Project** lose the "…" no other large ribbon button has, and the guide and glossary\r
  write menu paths with ▸, as the app does. Messages that named commands the app does not\r
  have (*Densify*, *Depth maps → Densify*, *Mesh ▸ Clean mesh*) now name the real ones.\r
\r
### Performance\r
- **Faster matching of large photo sets, and fewer overlapping pairs missed.** Match\r
  Features' quick check, which skips pairs that do not overlap, now samples each photo\r
  once per run instead of once per pair, and a pair that only just missed it gets a\r
  second look on a larger sample. On Agisoft's PUTI set (444 photos, 98,346 pairs)\r
  matching took 132 s instead of 236 s on the GPU and 287 s instead of 369 s on the CPU;\r
  picking and copying the samples per pair and a log line per skipped pair had been 140 s\r
  of main-thread work. The second look finds pairs the check had skipped: South Building\r
  970 instead of 951 of the 1,067 pairs COLMAP verifies with 100+ inliers, UseGeo 3,329\r
  accepted pairs instead of 3,020 (camera heights 6.1 instead of 8.4 cm RMS against the\r
  reference, matching +19 % on the CPU). No set of the ten measured got worse.\r
- **Depth maps on the GPU about a third faster.** Each PatchMatch sweep now runs only the\r
  pixels it updates, so the GPU no longer spends half its threads waiting, and each\r
  candidate plane's warp is set up once instead of at every window pixel. On six ETH3D\r
  scenes (Medium, Quadro RTX 5000) Depth Maps took 722 s instead of 1,127 s (courtyard\r
  141 instead of 227 s), with the same F1 score on every scene. The first change alone\r
  gives bit-identical dense clouds; the second moves 0.06 % of the points.\r
- **No long wait to compare GPU and CPU depth maps.** When the GPU is slow, Depth Maps\r
  still computes one map on the CPU to compare, but now gives up on it as soon as the CPU\r
  is clearly slower, and goes on with the GPU. It decides after each pyramid level: it\r
  gives up once the CPU has taken as long as the GPU would for the whole map, or is on\r
  course for twice that. On the Melville glacier scans at High, the comparison map took\r
  78 minutes against 94 s on the GPU. On the example project at 2,400 px it gave up\r
  after 42 s, when it was on course for 648 s (GPU 14 s).\r
- **Faster bundle adjustment from about 100 photos.** Sparse Model's bundle adjustment now\r
  spreads its heaviest step over all the threads it has, where a block of 100–300 photos\r
  used one to four. On the 347-image quarry it took 35 s instead of 43 s (Sparse Model\r
  73 s instead of 81 s) with the same cameras, points and GNSS fit; on 36 public BAL\r
  problems it went from a median 1.46× to 1.06× of Ceres' time, up to 2.6× faster\r
  (dubrovnik-88), with the same final costs.\r
\r
### Fixed\r
- **Camera files with accuracy columns named as GeoScan and Agisoft write them.** Import ▸\r
  Camera Positions now recognises headers such as \`# file\`, \`WGS84_lat\`, \`WGS84_H\` and\r
  \`Std Dev e (m)\`, so an RTK file's own accuracies are mapped instead of the 5 m default.\r
  With the default the positions barely count: on Agisoft's PUTI sample (444 photos, RTK\r
  at 1–2 cm) the solve came out the same as without them, and with the file's accuracies\r
  its 15 checkpoints are 3.4 cm across and 11.1 cm in height (with the lens below; 3.1 /\r
  7.2 cm with the lens solved as before).\r
- **Drone blocks without ground control no longer bend into a dome.** Sparse Model's\r
  self-calibration now solves the whole lens, including decentring (p1, p2) where it\r
  clearly lowers the reprojection error, and fits it to the keypoints as the photos\r
  recorded them. On the 347-image quarry without GCPs or RTK in the solve, the cameras\r
  against RTK went from 30 / 67 cm (horizontal / vertical RMS) to 22 / 13 cm; Metashape\r
  2.2.2 gives 13 / 12 cm on the same photos. The solved lens matches Metashape's (focal\r
  4403.4 against 4403.1 px, principal point within 1.1 px, p1/p2 within 0.00005). Before,\r
  each pass's radial estimate was folded into the keypoints and one composed k1–k3 fitted\r
  to the sum, which could not express decentring. The decentring terms are kept only when\r
  the first solve that frees them lowers the RMS by 1 % against the same solve without\r
  them: quarry 3.8 %; South Building, four ETH3D scenes and UseGeo 0.0–0.2 %, where they\r
  are dropped and the cameras stay within 1 % of before, except UseGeo's vertical\r
  (8.18 → 8.37 cm, +2 %). Not a gain everywhere: on PUTI (444 photos) with its RTK\r
  positions in the solve, the checkpoints' height went from 7.2 to 11.1 cm, and without\r
  them its ground sits about 1 m off in height (a focal-length offset), so its lens is\r
  still being worked on.\r
- **Bundle adjustment no longer stops on a hard start.** When its first steps overshoot,\r
  Sparse Model's bundle adjustment now keeps damping them until one improves the model,\r
  instead of stopping after eight tries with the model where it was. Checked against Ceres\r
  on the 98 public BAL problems (Bundle Adjustment in the Large): the three largest Ladybug\r
  problems had stopped after one iteration at 28× Ceres' final cost and now end within\r
  0.2–2.9 % of it, and the other 31 problems re-run came out bit for bit the same. Over the 95\r
  problems both solved, the final cost is a median 0.00004 % from Ceres' (84 within 1 %),\r
  at a median 1.4× its time; the three largest do not finish within 2 h (docs/BENCHMARKS.md).\r
- **Distant points no longer slow bundle adjustment.** A tie point very far from the\r
  cameras (background, horizon) could keep Sparse Model's bundle adjustment from taking\r
  full steps, so it crept towards the solution and stopped short. It now converges as if\r
  the point were not there. On the public BAL problem dubrovnik-173 it took 16 s and 21\r
  iterations instead of 131 s and 100 to end within 0.02 % of Ceres' cost (it had stopped\r
  1.3 % above); none of the 46 problems re-run ended worse, and the 347-image quarry,\r
  which has no such points, came out the same.\r
- **One highlighted row in the sidebar.** Clicking an image, GCP, product, reference\r
  raster or vector layer now moves the highlight there; before, a cloud you had clicked\r
  (or a run had just added) stayed highlighted next to it. DEM, orthophoto, reference\r
  raster and vector rows highlight when clicked. The cloud last chosen is still the one\r
  the tools open on.\r
- **Cancel in Reconnect project folder no longer leaves an empty app.** With no project\r
  open, Cancel (or Esc) goes back to the project list, or to New Project when there is\r
  none.\r
- **Quality Report ▸ Sparse shows the residuals to two decimals.** The image table's\r
  RMS, Median and Max columns were rounded to whole pixels (0.71 px read "1").\r
- **The Quality Report's image tables fit short windows.** On a short screen (a laptop),\r
  Sparse squeezed its image table into a sliver that scrolled but never showed a whole\r
  row; each part of a section now keeps its height and the section scrolls. The stat\r
  tiles also leave a space between a number and its unit.\r
- **TIFF photos keep their camera details.** A TIFF that stores its tags after the\r
  pixels, as MicaSense cameras write them, came in without make, model or focal length,\r
  so its camera group read "Sensor 1 · NaN mm" and the band went unread; its metadata is\r
  now read from the whole file. Found importing MicaSense's Altum-PT sample captures:\r
  exifr's chunked reader found 53 of their 99 tags.\r
- **Exported camera angles taken where each camera is.** Export ▸ Camera Poses\r
  (estimated, georeferenced) now gives each camera's omega/phi/kappa against grid north\r
  and the vertical at that camera, as Metashape and Pix4D do, not at the georeference's\r
  origin. The two differed by the change of meridian convergence across the block:\r
  0.0002° on a small site, about 0.3° over 6 km near the poles. Checked against\r
  Metashape-convention XML written and read back: within 0.00001°.\r
- **Omega, phi and kappa read the way Metashape and Pix4D write them.** Camera poses\r
  imported with orientation angles now point the way their file meant, in footprints and\r
  as priors for Sparse Model; before, WebSfM turned them the opposite way, so a 60°\r
  kappa put a footprint's corners about 200 m off at 100 m flying height. Export ▸\r
  Camera Poses writes the same convention. Angles WebSfM took from a drone's gimbal\r
  were right and stay right: opening a project saved by an earlier version converts\r
  them (project format 2). Checked against Metashape 2.2's own Omega Phi Kappa export\r
  on 42 Aukerman photos: the same rotation to 1e-8.\r
- **Splitting a camera group keeps the original fiducial layout where it cannot be\r
  estimated.** Sensors ▸ right-click ▸ **Split camera group…** copied every group after\r
  the first from the first group, after its layout had been estimated from its own\r
  photos; a group whose layout could not be estimated then kept the first group's,\r
  not the camera's.\r
- **Co-register DEM moves the georeference only from a DEM built in it.** Applied to the\r
  georeference, it read the DEM's coordinates as the current fit's whenever the DEM was\r
  out of date for any reason. A DEM built before the georeference was refitted now\r
  blocks the run (rebuild it first), and one built in the co-registered georeference\r
  adds to the move even when it is out of date for another reason, such as a rebuilt\r
  dense cloud. **Co-register** also waits while the Copernicus DEM is still downloading.\r
- **Match Features no longer promises a full-size detection it skips.** With LightGlue,\r
  or when matching a selection, *5 · Repair a split graph* said pieces still apart would\r
  be detected again at full size; the run never does that there, and the line now says so.\r
- **The match view shows the tie points joined through other photos.** A pair's view\r
  in **Matches** listed "via PnP" tie points in its legend but never drew them: the tie\r
  points both photos see in the model, which this pair did not match directly. They are\r
  now drawn in blue, and the legend calls them **via other photos**. With them, the\r
  view's counts add up to the list's **Used** column.\r
- **Cancelling Project folder… keeps the project list.** On the start screen, cancelling\r
  the folder dialog of **Project folder…** left an empty workspace with a nameless\r
  project; the list now stays open until a folder has opened. **Move to folder…** and\r
  **Move to browser storage** from the list's ⋯ menu also keep it open while no project\r
  is open.\r
- **Gradual selection no longer reports unsaved changes.** On a project with depth maps,\r
  Tools ▸ Model ▸ **Gradual selection…** showed *Unsaved changes: Failed to execute\r
  'removeEntry' … modifications are not allowed*. Retiring the depth maps deleted each\r
  depth file twice at once, once with the image's preview and once in the sweep of all\r
  maps, and the browser refuses one of two overlapping deletes of the same file (22 of\r
  400 in a test). Deletes of one file now wait their turn, as its writes already did.\r
- **Retry faint images shows its checkbox again.** In Detect Features ▸ Advanced ▸\r
  *3 · Detect (SIFT)*, the checkbox sat alone in the middle of the dialog, away from\r
  its label; it is now an **Enabled** checkbox under it, like the others. It is on by\r
  default.\r
- **Setting help stays on screen.** A setting's help box that fits neither below nor\r
  above its label (*Repair a split graph* in Match Features) now moves up until all of\r
  it, **Read more** included, is in the window, and scrolls when it is taller than the\r
  window.\r
- **DISK without a GPU error.** Detect Features and Find GCPs now run DISK on the CPU\r
  from the start, instead of first trying the GPU, logging an ONNX Runtime error\r
  ("MaxPool … The Indices output is not supported yet") and then falling back to the CPU.\r
  DISK's keypoint step reads MaxPool's indices, which ONNX Runtime's WebGPU path cannot\r
  produce, so the GPU attempt failed every time; the keypoints are unchanged.\r
- **Detect Features says when Append has nothing to do.** With every image already\r
  detected, the dialog now says that **Append** would skip them all and keeps **Run**\r
  disabled until you choose **Overwrite**, instead of closing without detecting anything.\r
  When only some images lack keypoints, the button says how many it will detect.\r
- **Time left through the whole matching run.** The Matching Features progress bar now\r
  keeps moving, with its time estimate, while the gate rescue and bridge repair run after\r
  the last pair, and names the pass it is on. Before, the bar sat at 99% with no estimate\r
  through both; the pair pass now fills the bar to 90% when either can follow.\r
\r
## [0.6.1] — 2026-10-31\r
\r
### Changed\r
- **Folder choices shown in Firefox and Safari.** New project ▸ **In a folder…** and the\r
  project list's **Project folder…** now appear greyed out in browsers that cannot keep\r
  a project in a folder on disk, and say that it needs Chrome, Edge or another\r
  Chromium-based browser, instead of being hidden.\r
- **Photo names in a project folder.** A project's \`images\` folder now holds an\r
  \`index.csv\` that says which stored file is which photo, by its name in WebSfM and the\r
  file name it was imported with. The photos are stored under an internal id, since two\r
  can share a name; the list is kept up to date as photos are added, renamed or removed,\r
  and written when an older project is opened.\r
\r
## [0.6.0] — 2026-10-31\r
\r
### Added\r
- **Reduce overlap.** Tools ▸ Images ▾ ▸ **Reduce overlap…** disables the photos of a\r
  heavily overlapping block that the depth maps do not need, keeping every part of the\r
  surface in at least **Photos per point** photos (6), so the dense stages run on fewer.\r
  It counts which photos see each sparse point from the camera geometry (in frame, and\r
  within a **Viewing angle** of the side the point's own photos see it from), not from\r
  the tracks, which name only the photos that matched it; the dialog shows the result as\r
  you change a setting. Quarry (347 photos, a median of 29 seeing each point; WebGPU depth\r
  maps, Medium): all photos took 1,724 s of depth maps and 138 s of fusion. At 6 per\r
  point it keeps 145 photos, 646 s + 59 s, and the 0.5 m DEM covers 97.8 % of the full\r
  one's cells, median difference 0.006 m, NMAD 0.17 m. At 3 it keeps 87, 346 s + 35 s, but\r
  covers only 89.9 % (NMAD 0.19 m), which is why the default is 6.\r
- **Disable photos.** Right-click images ▸ **Disable** leaves them out of every later\r
  run (Sparse Reconstruction, depth maps, the dense cloud, the orthophoto and mesh\r
  texture) while their features, matches and pose stay; **Enable** brings them back.\r
  The image list dims them and tags them *off*, the run dialogs count without them, and\r
  each run logs how many it left out. Saved with the project; older projects open with\r
  every photo enabled. A browser test disables a photo of the five-photo fixture, gets\r
  four depth maps, and finds it still disabled after a reload.\r
- **Duplicate a project.** The project list's **⋯** menu ▸ **Duplicate** copies a\r
  project, to try other settings on the copy while the original stays as it is. A\r
  browser project is copied into this browser, a folder project into another folder you\r
  pick (**Duplicate…**). The copy is checked file by file like a move, gets its own id\r
  and the name *… (copy)*, and leaves out an unfinished run's journal. Browser tests in\r
  Chromium, Firefox and WebKit open the copy and change it without touching the original.\r
- **DEMs of chosen classes, for canopy and building heights.** Build DEM ▸ **Points ▸\r
  Classes…** builds the top surface of the classes you tick in a classified cloud (high\r
  vegetation by default); with a DTM and the DEM of difference that is a canopy height\r
  model. A browser test builds a DEM of a classified cloud's building class and gets\r
  the roof alone.\r
- **Detect or match only some images.** Right-click images in the image list ▸ **Detect\r
  features…** or **Match features…** opens the usual dialog for those images alone: they\r
  are detected again, or only their pairs are matched, and every other image and pair\r
  keeps its result. A browser test detects one photo of five again and matches back\r
  exactly its four pairs.\r
- **Adding photos no longer rebuilds every depth map.** Build Depth Maps ▸ **Keep valid\r
  depth maps** (on) keeps each saved map whose camera and settings are unchanged and\r
  computes only the others, so after Sparse Reconstruction ▸ Add to the model with\r
  Existing cameras ▸ Fixed only the new photos' maps are made; the step's line says how\r
  many are kept. The check across views still runs over every map. It is a setting\r
  because a full run would also rebuild the kept maps with the new photos as neighbours;\r
  turn it off for that. A browser test keeps all five maps of an unchanged run byte for\r
  byte, and after one camera moves computes that map alone.\r
- **Join two projects.** **Import ▸ WebSfM Project…** brings another project's photos\r
  into this one with their features, the matches between them, their sensors, GCP marks\r
  and camera positions, so two flights, two days or a colleague's block need no new\r
  detection or matching; Match only new pairs then matches across the blocks, and\r
  Sparse Reconstruction ▸ Add to the model places them in this model. A photo both\r
  projects hold is kept once, a sensor with the same calibration is shared, and a GCP\r
  already here keeps its position. The other project's model and products stay behind.\r
  Cancel stops between batches and keeps the photos already in. On the 77-photo Aukerman\r
  survey, lap 2 (44 photos) joined to a model of lap 1 (33) placed 43 of them (the one\r
  left out fails in a rebuild too) with the cameras 1.07 m RMS from their GPS positions,\r
  against 1.14 m for a rebuild of all 77, in 45 s against 85 s.\r
  A browser test imports the 5-photo test project into an empty one (Chromium and\r
  Firefox) and builds the same 5-camera model from what came.\r
- **Buildings and vegetation in a classified cloud.** Classify ground is now **Classify\r
  points** (Tools ▸ Point Cloud): after the ground it labels **Building** and **Low**,\r
  **Medium** and **High vegetation** (LAS 6, 3, 4, 5) among the points above it, as two\r
  more steps that can each be turned off, so the cloud exports with the classes GIS\r
  tools expect. Roofs and walls are found as large flat surfaces high enough above the\r
  ground (a wall alone, such as a retaining wall, is not a building), vegetation as what\r
  scatters or is green, banded by height at 1 and 3 m; a car stays unclassified. Every\r
  point also gets its height above the ground (\`heightAboveGround\`, metres), to colour\r
  by in Symbology and exported to LAS/LAZ and PLY. On a\r
  synthetic site 99.6 % of building points and every tree point land in their class; on\r
  UseGeo's 16 M-point MVS cloud the run takes 5.9 s against 1.2 s for the ground alone,\r
  and roofs, crowns and olive rows come out right by eye. Not yet scored against a\r
  labelled set. The Quality Report's **Methods and references** now names the ground\r
  filter and the class rules with their papers when a cloud was classified.\r
- **Add photos to an aligned model.** Sparse Reconstruction has a **Mode**, *Add to the\r
  model* or *Rebuild*: adding registers only the images the model lacks, starting from\r
  its cameras and points, and with **Existing cameras ▸ Fixed** every camera already in\r
  it stays exactly where it was, so depth maps, clouds, meshes, DEMs, orthophotos and the\r
  georeference built from it stay current. *Refined* then lets every camera move with\r
  the new ones (Optimize cameras); *Auto* keeps them fixed when something was built from\r
  them. Match Features gets **Match only new pairs**, on by itself when some images are in\r
  no pair yet, so only each new photo's pairs are matched. Photos a run could not place\r
  get **Try again…** in Quality Report ▸ Sparse, which reopens the dialog with looser\r
  registration gates. The model's frame is rebuilt\r
  from the detected keypoints and checked against the pixels the model saved (0.00002 px\r
  apart on the synthetic tests, with and without self-calibration), and a project whose\r
  features were detected again is told to rebuild. On the synthetic block, cameras added\r
  to a model of two thirds of it land 0.1 % of the camera spacing from the truth, where\r
  a run of every image puts them at 0.06–0.09 %. On the Aukerman example (32 images\r
  built, depth maps made, then 10 more added), adding took 3.7 s against 10.6 s for a\r
  rebuild of all 42, matching the new pairs 44 s against 84 s, all 10 images joined, the\r
  32 depth maps stayed, and the cameras sit 1.23 m RMS from their GPS positions against\r
  1.26 m for the rebuild (1.09 m with Refined).\r
- **Projects keep opening in newer versions.** A project saved by this or a later\r
  version of WebSfM opens in every version after it: when the way projects are saved\r
  changes, opening an older project brings it up to date where it is saved, and the\r
  console says what changed. Before, a beta could refuse projects saved by the one\r
  before it. A small saved project per format version is part of the tests, and each\r
  must still open with everything it held.\r
- **Continue a long run after the tab closed.** When a browser tab closes during Detect\r
  Features, Match Features or Build Depth Maps (out of memory, an update, a crash),\r
  opening the project again offers to **Continue** the run, doing only the work that is\r
  missing with the settings it was started with, or to **Discard** it. Each run keeps a\r
  small journal of what it has saved: every image's features, the matched pairs (saved\r
  about once a minute while matching), every depth map through both passes of the Full\r
  method and the filter (whose writes are now staged, so a filter that stops leaves the\r
  maps intact). A continued run gives the same result byte for byte as one that never\r
  stopped (browser tests kill the page during detection, the pair loop, and depth pass 1\r
  and pass 2).\r
- **See what your browser lacks, and what it costs.** When WebSfM starts in a browser\r
  that is missing something it uses, the note at the bottom right now lists each gap in\r
  plain terms ("Depth maps, matching and the learned matchers run on the CPU", "Projects\r
  are kept in browser storage only"), in Chrome too when it has no WebGPU, instead of a\r
  general warning on every browser but Chrome. **Other ▸ System info ▸ Browser support**\r
  shows every feature with what it is for. Firefox now runs the app's browser test suite\r
  as well as Chromium (100 of 110 tests passed at first; the fixes are below).\r
- **Open a project file into a folder.** Opening a \`.websfm\` file now asks whether to\r
  keep the project in this browser or in a folder on your disk, where it is unpacked\r
  straight away, so a file larger than the browser allows still opens. Only where\r
  folders are possible (Chrome, Edge); elsewhere it goes into the browser, as before.\r
- **See where each project is saved.** The project list shows a project's folder (its\r
  icon and name) or *In this browser* with its size, and at its foot how much WebSfM\r
  holds in this browser, with a warning and **Ask the browser to keep it** when the\r
  browser may clear that storage. **Project settings ▸ Where it is saved** has **Move\r
  to folder…** (or **Move to browser storage**) and **Export project file…**, and says\r
  when the project was last exported. A coordinate system looked up on epsg.io is\r
  saved in the project, so it opens offline in another browser.\r
- **Work with every DEM and orthophoto, not only the main one.** Any DEM or orthophoto\r
  in the sidebar now opens in a tab of its own, goes on the map, takes a symbology and\r
  downloads, where before these were greyed out until it was set as main. Main still\r
  decides what the next step uses. Several of a kind can be on the map at once, each a\r
  layer of its own in View ▸ Map ▸ Layers; a new build takes the place of the main one\r
  before it there. On a product's tab, the ribbon's Export, In Layers, Symbology and\r
  Remove act on that product (Remove did nothing on a product tab before). Measurements\r
  are kept per product; those saved before stay on the main one. A project saved before\r
  shows its main DEM and orthophoto on the map again.\r
- **Show information on every sidebar row.** Right-click a vector layer (an imported\r
  shapefile or contour lines), a reference raster, a sensor, a control point or the\r
  matches and choose **Show information**, as on clouds and products. A vector layer\r
  lists its polygons or lines, vertices, image links, contour levels and extent; a\r
  reference raster its CRS, size, GSD, bands, accuracy, elevations and vertical datum,\r
  and whether it was fetched from Sentinel-2; a sensor its calibration and lens\r
  coefficients; a point its position, σ, marks and residual; the matches the pairs\r
  tried, verified, excluded and used, their inliers, and how many images are in a pair.\r
  Layers imported from now on also show their source CRS and import time.\r
- **Every export opens a dialog.** Camera Poses, Calibration, Camera Fiducials, Image\r
  Fiducials, Footprints, Keypoints and Matches now ask for a format and a file name\r
  before they download, like the other exports, and the sidebar's **Download…** on a\r
  vector layer or on the matches opens the same dialog. New formats: tab-separated\r
  text for the camera and fiducial tables, GeoJSON points for camera poses, CSV for\r
  keypoints and matches (or the matched pair list alone), and KML or WGS 84 GeoJSON\r
  for footprints and other vector layers. Keypoint and match files are named after\r
  the project instead of the time of export, and the calibration file is\r
  \`<project>-calibration\` instead of \`-sensors\`. Every export dialog shows what the\r
  chosen format holds under **Format**. The Export tab's buttons no longer end in\r
  "…", since all of them open a dialog.\r
- **Export the poses and calibration the reconstruction estimated.** Export ▸ Camera\r
  Poses offers **Source ▸ Estimated by the reconstruction**: the poses bundle\r
  adjustment ended with, in the project CRS when the model is georeferenced (scaled or\r
  oriented like a point cloud export otherwise). Before, it wrote only imported poses\r
  and was greyed out without any. Export ▸ Calibration likewise writes the refined\r
  focal length and principal point, per camera group or per image. Estimated poses use\r
  the omega/phi/kappa convention of the pose import: a unit test turns an imported pose\r
  into the solver's camera and back, and gets the same position and angles to 1e-9°.\r
  The dialog can also leave out the angles or the accuracies.\r
- **Type a zoom into an image or raster tab.** Click the zoom percentage at the right of\r
  the tab's status bar and type a value; Enter or clicking elsewhere applies it, Esc keeps\r
  the old zoom.\r
- **Hide the bug-report button.** Settings ▸ General ▸ Notices ▸ **Bug report button**\r
  turns off the round button at the bottom right. Other ▸ About ▸ **Report a bug** opens\r
  the same GitHub page.\r
- **References say what each paper is used for.** Other ▸ About ▸ References lists,\r
  under each paper, the glossary entries that explain the method it describes; a click\r
  opens the entry. The learned detectors and LightGlue are now cited by the Keypoint\r
  entry, so every paper names at least one.\r
\r
### Changed\r
- **A tidier start screen.** The project picker that opens on start is now two columns,\r
  your projects and **+ New project** on the left, **Open existing** and **Try an\r
  example** on the right, with the version and the browser storage in a strip along\r
  the foot. Each project takes two lines: the scene type is the icon before its name,\r
  and the version that created it shows only when it is not this one (hover a project\r
  for both). The dropdown from the project name keeps one column, in the same order.\r
- **Self-calibrated distortion stays exact when the principal point moves.** When\r
  bundle adjustment moves a camera's principal point, the tie points are corrected for\r
  distortion again about the new centre, so the depth maps undistort the images exactly\r
  as the sparse model did. Before, each correction stayed centred where it was made, and\r
  dense could differ from sparse by up to 0.18 px (South Building). The reconstruction\r
  log now gives, per sensor, how far the principal point moved and how many times the\r
  tie points were corrected again, and warns if the two still differ by more than\r
  0.25 px. On synthetic blocks with an off-centre principal point (28.8 px), camera\r
  positions are 2–4× closer to the truth. On real blocks the cameras are unchanged\r
  within noise (South Building, ETH3D, quarry vs RTK, Casa Grande and Iceland check\r
  points), and runs take 0–7 % longer.\r
- **A full browser storage no longer loses work.** Whatever finds browser storage full\r
  (adding images, a dense cloud, a mesh, a DEM, any save, as well as depth maps) asks to\r
  move the project to a folder on disk, then saves there and carries on; during a run,\r
  stopping ends it, as before. The browser copy is removed and the project reopened\r
  from the folder once nothing runs or waits to be saved. The "Unsaved changes" card\r
  says when storage is full, with **Move to folder…**, or, without folders (Firefox,\r
  Safari), how to free space; **Dismiss** forgets changes that cannot be saved, which\r
  before kept the card up for good. The point-cloud octree a large import builds is\r
  written by its worker, outside this, and still fails the import when storage is full.\r
- **Export project file, not "Save a copy".** **Other ▸ Export Project** and the project\r
  list's **Export project file…** write the \`.websfm\` file, named for what they do: the\r
  project stays where it is. Its dialog says what leaving out the derived data costs\r
  (depth maps, DEMs and orthophotos have to be built again; it said they rebuild on\r
  demand) and no longer mentions a 4 GB limit, which ZIP64 lifted; in Firefox and\r
  Safari it warns about a large file. Menu items that only ask "are you sure?" no\r
  longer end in "…" (**Delete**, **Remove from WebSfM**, **Convert to source image**),\r
  and the project list draws the capture type with the app's icons.\r
- **Settings in groups.** The General and Map & 3D tabs of Settings put their settings\r
  under headings (Appearance, Help and dialogs, During a run, Notices; Map, 3D view)\r
  instead of one long list of switches.\r
- **What's New without glossary links.** Its text no longer underlines the glossary\r
  terms it names, which in a changelog was nearly every line.\r
\r
### Performance\r
- **Safari uses every core.** WebSfM now asks for cross-origin isolation with the\r
  header Safari understands (COEP \`require-corp\` instead of \`credentialless\`), so the\r
  bundle adjustment, depth maps and the learned detectors run on threads there as in\r
  Chrome and Firefox. Every cross-origin request the app makes (basemap tiles, epsg.io,\r
  STAC, models) already goes through CORS, so nothing is blocked: live OpenStreetMap\r
  tiles load in Chromium, Firefox and WebKit under the new header, and the shared-memory\r
  browser test now runs in WebKit too. A self-hosted copy needs the new header\r
  ([docs/deployment.md](docs/deployment.md)).\r
- **Sparse Reconstruction spends less time outside the bundle adjustment.** Placing each\r
  photo now scores its pose hypotheses on every core, guided track extension searches\r
  every camera on its own core, and the residual statistics that each bundle adjustment\r
  logs are computed without the slow sorts they used; the model is the same to the last\r
  bit. Quarry (347 photos): the time outside the bundle adjustment fell from 31.4 to\r
  25.3 s, the whole sparse run from 67.2 to 62.4 s (16 threads), with identical camera\r
  poses and points. Guided track extension then went from 3.8 to 1.5 s (the run 63.3 → 60.0 s, back to back).\r
\r
### Fixed\r
- **Depth maps on integrated graphics no longer freeze the screen.** The graphics card\r
  now gets each pass in short pieces (about 30 ms each), so a laptop's integrated GPU,\r
  which also draws the screen, stays responsive and is not reset by the system for a\r
  long command; when a map is slow on the card, the next is computed on the processor to\r
  compare, and the run (and the session) continues on the faster. On a dedicated NVIDIA card\r
  the maps are unchanged (identical filter counts over 42 maps; the GPU path varies in\r
  the last bits between runs anyway) and the run takes about 5 % longer.\r
- **Long ribbon menus can be scrolled.** Scrolling a ▾ menu taller than the window\r
  closed it, so its last rows could not be reached on a small screen (or in Firefox,\r
  whose rows are taller).\r
- **Error notes can be clicked while the browser note is open.** The note at the bottom\r
  right that opens the console sat under the browser note in the same corner.\r
- **System info shows WASM SIMD correctly.** It said *Not supported* in every browser:\r
  its test module was malformed.\r
- **Moving a project while it saves.** A move to or from a folder could fail with "copy\r
  did not verify" when a file was being written meanwhile, such as the console log,\r
  which the move itself writes to. The copy is now checked without the log, which\r
  follows on its own, and a file's half-written temporary copy is never counted.\r
- **Convert to source image works after a reopen.** In a reopened project, Reference\r
  data ▸ right-click ▸ **Convert to source image** removed the raster and then failed\r
  with "Unsaved changes: A requested file … could not be found", which **Retry saving**\r
  could not clear; the file is now read before the raster is removed. The item now asks\r
  first and says what it does, and a Sentinel-2 window fetched by Find GCPs no longer\r
  offers it, since it is never a photo.\r
- **A reopened project counts every match pair it tried.** Pairs that matching rejected\r
  are now saved too, so **Total pairs** in the sidebar is the same after a reopen, and\r
  matching does not try those pairs again. The JSON match export still lists only the\r
  pairs with matches.\r
- **Product names stay readable in a narrow sidebar.** An outdated DEM or orthophoto\r
  squeezed its name to nothing; the name now keeps its room, the pixel size is left out\r
  below 320 px, and **outdated** becomes a **!** (with the same tooltip) below 260 px.\r
- **The "Unsaved changes" message matches the rest of the app.** It is a card in the\r
  lower left, styled like an error notification, instead of a dark red bar across\r
  the window.\r
- **Photos taken from the ground no longer show upside down.** In an Object capture\r
  project, the 3D view and Orient model take which way is up from the photos' own\r
  up direction when the cameras look up at their subject, as at a building from the\r
  street. On South Building (128 frames) the view's up was 180° off before and is\r
  right now. An aerial project still assumes the cameras look down; when the photos\r
  look up instead, the sparse run warns that the scene type is probably wrong, since\r
  its automatic orientation then turns the model over.\r
- **The Image Table's estimated angles match the imported ones.** Its Extrinsics ▸\r
  Estimated view showed omega, phi and kappa of the solver's camera axes (looking down\r
  +z with y down), so a camera looking straight down read 180°. It now uses the\r
  convention of the imported poses, and shows positions in the project CRS when the\r
  model is georeferenced.\r
- **An orthophoto too large for PNG or JPEG no longer says "coming soon".** The export\r
  dialog added "coming soon" to every greyed format, after the reason it was greyed.\r
- **The Guide's tab strip no longer overflows.** With operations open, the strip could\r
  show a stray scrollbar over the tabs. Home now stays at the left and only the operation\r
  tabs scroll, as in the Glossary, and a newly opened tab scrolls into view.\r
\r
## [0.5.0] — 2026-10-28\r
\r
### Added\r
- **A Beta badge, and projects that say why they cannot open.** A **Beta** badge beside\r
  the name (ribbon, project picker, About) says that features and the project format\r
  still change between versions. Each project now records the format it was saved in,\r
  and one this version cannot read, or one saved by a newer version, stops with a\r
  message that says so, both when opened and when imported from a \`.websfm\` file.\r
  Projects saved before count as the first format. The badge goes away at 1.0.\r
- **Show information on products.** Right-click a sparse cloud, dense cloud, mesh, DEM\r
  or orthophoto in the sidebar and choose **Show information** for its facts: cameras,\r
  tie-points, mean track length and reprojection error for a sparse cloud; points,\r
  normals and storage for a dense cloud; size, GSD, extent, frame and elevation range\r
  for a DEM, with the cloud it was built from (DEMs built from now on); surface,\r
  coverage and blend for an orthophoto.\r
- **Sentinel-2 as a Find GCPs reference.** Find GCPs ▸ **Sentinel-2…** lists the\r
  Sentinel-2 scenes over the search area and fetches the one you choose as a reference\r
  orthophoto, with no file to download and no account. Only the window over the area is\r
  read from the 10 m red, green and blue bands on AWS Open Data, stretched from its own\r
  reflectances so that snow and ice keep their texture, and imported in the scene's UTM\r
  zone with σ XY 8 m (Sentinel-2's geolocation is about 11–12.5 m CE95). The scenes\r
  cover Antarctica too: 21 under 20 % cloud over Neko Harbour.\r
- **Find GCPs: a search area, and footprints on offer.** Find GCPs ▸ Search area takes a\r
  polygon layer to search inside, and under it a line says where Auto will look: the\r
  georeferenced orthophoto, the photos' footprints, their GPS, or the whole reference.\r
  With only GPS or camera poses, **Compute footprints…** opens Footprints from poses\r
  over the dialog; with nothing at all, a warning asks for a search area.\r
- **Align to and measure against a survey too large to load.** An imported LAS/LAZ that\r
  is streamed from its octree can now be the reference of Align to reference (ICP) and\r
  Cloud distance, and Transform moves it as a whole. The reference is read around the\r
  source, at full detail up to 12 M points; a transformed cloud gets a new octree,\r
  quantised for its new coordinates. Align to reference also takes a streamed cloud as\r
  the source: the alignment is found on a sample of up to 2 M of its points, and every\r
  point then moves into a new streamed cloud.\r
- **Sources for every method.** Each glossary entry now lists the papers behind the\r
  method it explains, About ▸ References lists every method WebSfM implements, and the\r
  exported Quality Report ends with the methods this project used and their references,\r
  ready for a paper's methods section. WebSfM itself is citable via \`CITATION.cff\`.\r
- **What's New.** Other → What's New lists every release, newest first, with a badge\r
  counting the changes since you last opened it. Changes shows each entry's headline\r
  and first sentence, Full the whole entry. websfm now has numbered releases (0.2.0 to\r
  0.4.0 so far), cut with \`npm run release\`.\r
- **Keyboard shortcuts in one list.** Press **?** (or Other → Shortcuts) to see every\r
  shortcut and modifier gesture, grouped by where it works and filterable by action or\r
  key. Tooltips spell keys for the platform (⌘Z on a Mac). Plain mask-editing letters\r
  no longer fire with Shift held, and Ctrl+Alt+Z no longer undoes a mask.\r
- **Find GCPs aligns historical film with a satellite image.** The coarse look is now a\r
  learned matcher (DISK, or SuperPoint when installed, with LightGlue; SIFT stays\r
  selectable), with both rasters read at the same ground resolution and the\r
  orthophoto turned to the expected rotation. Scale and rotation come from the\r
  orthophoto's georeference, the photos' GPS, or the footprints of the near-vertical\r
  photos, else a sweep. The fine tiles match the same way. A reference with three or\r
  more bands is read as the mean of bands 1–3 (Reference band). On Rachel Glacier\r
  (1960s film against Sentinel-2 RGB), where SIFT found no alignment, 13 of 17 tiles\r
  align and the 30 candidates lie a median 7 m (at most 24 m) from where an\r
  independent Metashape solution of the block (hist-sfm) puts them; on Stubb 6 m\r
  (14 m), on Pequod 6 m (22 m).\r
- **DEM vs reference: co-registration, and moving the control onto the reference.**\r
  Quality Report ▸ Products now co-registers a DEM in a CRS to the reference DEM (Nuth &\r
  Kääb): the horizontal offset, and the NMAD once it is removed. **Move the control onto\r
  the reference** shifts every control and check point by that offset, refills its\r
  height from the reference DEM and refits. On Rachel Glacier, whose Find GCPs control\r
  took positions from Sentinel-2 and heights from REMA, the DEM sat 11.7 m north of\r
  REMA; after the move, NMAD on stable rock fell from 8.8 m to 5.4 m (hist-sfm's DEM:\r
  6.4 m), with medium-quality depth maps. With 90 Find GCPs candidates (the new default)\r
  instead of 30 the median bias after the move is +0.7 m instead of +2.8 m.\r
- **Find GCPs ▸ Candidates** sets how many candidates are proposed (default 90, was a\r
  fixed 30). Their heights pin the georeference's tilt: on Rachel Glacier 30 left the\r
  DEM 2.8 m high after moving the control onto REMA, 90 left it 0.7 m high.\r
- **Find GCPs by terrain.** Coarse matcher ▸ Terrain fits the sparse cloud to a\r
  reference DEM by ICP, with scale, starting from the same prior (footprints, GPS, a\r
  georeferenced orthophoto), and proposes tracks on the aligned surface. For when no\r
  reference image shows what the photos do: snow, cloud, or a DEM as the only\r
  reference. On Rachel Glacier against REMA: RMS 9.5 m in under a minute, candidates a\r
  median 13 m (at most 28 m) from the Metashape solution.\r
- **Meshes in tiles.** Build Mesh ▸ Advanced ▸ Tiles (Auto by default): a scene whose\r
  Poisson solve would not fit in memory is solved in tiles on the scene's own octree\r
  grid and welded along the grid edges the tiles share; every tile trims against the\r
  scene's support level, and floating pieces are judged on the joined mesh. The tiles\r
  solve on as many workers as the memory budget holds. The quarry at depth 10 (95 M\r
  points; one solve ≈ 18 GB) now builds: 2.8 M triangles in 4.5 min on 7 workers (14 min\r
  on one).\r
  Where a trimmed area or hole crosses a seam the tiles can end it slightly differently.\r
- **Matching repairs a split graph.** When matching leaves the block in pieces (the\r
  vertical and oblique cameras of a mapping flight, a facade and its roof), the most\r
  promising pairs between each piece and the main block are matched again with looser\r
  gates: near misses first, then pairs preselection skipped whose footprints overlap.\r
  On by default (Detect and Match Features ▸ step 5); the log says how many pieces\r
  joined.\r
- **DEM support layer.** Every DEM records which cells points landed in and which the\r
  gap interpolation filled. **Export ▸ DEM ▸ Support layer** writes it as a GeoTIFF\r
  (percentage measured per cell), and **Quality Report ▸ Products** gives the RMSE of\r
  measured and interpolated cells apart against a reference DEM.\r
- **DEM vs reference on stable ground.** **Quality Report ▸ Products** can limit the\r
  comparison to a polygon layer of stable ground (rock, roads) and to an area of\r
  interest, so a historical DEM is judged on terrain that has not changed. The\r
  exported report names both layers.\r
- **Find GCPs: stable ground and footprints.** A polygon layer (rock outcrops, built-up\r
  areas) can limit candidates to ground that has not changed since the photos, so\r
  candidates on a glacier or a pit face no longer reach the control. Without a\r
  georeferenced orthophoto, the search now starts from the photos' imported or\r
  computed footprints before their GPS positions, which places scans from an archive\r
  that come with footprints but no GPS.\r
- **Import a folder of masks (View ▸ Masks ▸ Import folder…).** One mask file per\r
  image, paired by name: the image's own name in a mask folder, COLMAP's\r
  \`IMG_0001.jpg.png\` or Metashape's \`{filename}_mask\`. The dialog shows what pairs\r
  before importing, can replace or merge with existing masks, and decodes the files on\r
  every worker. TIFF masks now import everywhere (1-bit CCITT Group 4 included), and a\r
  0/1 file reads 1 as kept.\r
- **DEM of difference against the background terrain.** The Volume tool's base can be\r
  the global terrain the Terrain basemap shades (Mapzen Terrain Tiles, about 30 m\r
  cells, EGM96 converted to the DEM's datum where it can be), so a DEM in a CRS can be\r
  compared without importing a reference DEM. Tools ▸ Measure ▸ DEM of difference now\r
  needs only a DEM in a CRS and picks the terrain when there is no reference DEM. The\r
  result names the coarse base and says what it can show; tiles stop at 85° latitude.\r
- **File name for exports.** Every export dialog (point cloud, mesh, model, COLMAP,\r
  3D Tiles, undistorted images, DEM, orthophoto, measurements) and the contour,\r
  terrain, clip and section tools have an optional **File name**. Empty, the file is\r
  named as before, and the field shows that name; a typed one names every file the\r
  export writes, the .wld / .prj beside an image included. Cloud names in file names\r
  keep letters of any script now (Süd, not S_d).\r
- **Photos on the map (View ▸ Map ▸ Photos).** The source images are drawn on the 2D\r
  map, each warped into its footprint from Footprints from poses (a projective map of\r
  the image onto the footprint's corners, drawn as a mesh of triangles), to check a\r
  camera's position and angles at a glance and see the area before reconstructing.\r
  The Photos layer sits in the Layers panel with an opacity and a choice between the\r
  selected image (the default, from its display image) and every image (from the\r
  thumbnails); only the photos in view are drawn.\r
- **Contours go on the map.** Tools ▸ Products ▾ ▸ Contours adds the lines to the 2D\r
  map as a layer of its own, listed in the sidebar's Products section and in the Layers\r
  panel (index contours heavier, the height in the hover label, "Contours" in the\r
  legend), with a map checkbox and a GeoJSON download in its right-click menu. Downloading straight away (GeoJSON or\r
  DXF) is now an option of the dialog, off by default; a DEM without a CRS is still\r
  always downloaded. Before, the lines only went to the browser's downloads folder.\r
- **Orthophoto export without an alpha band.** Export Orthophoto has an **Alpha band**\r
  checkbox (on by default) for GeoTIFF and PNG; unticked, the file has three bands and\r
  the empty pixels take a **NODATA value** (0–255), which a GeoTIFF records as GDAL\r
  NODATA. A real pixel equal to it moves one level, so it never reads as a hole. A JPEG\r
  uses the value for its empty pixels, which were always black before.\r
\r
### Changed\r
- **Setting help and word explanations look different.** A setting label with advice\r
  in the Guide now has a small **?** after it, and a word with a glossary entry a\r
  dotted underline, as in the help text; both still open on hover. Before, both had\r
  the same dashed underline. Image Quality ▸ **Blurry below**, Detect Fiducials ▸\r
  **Detection type** and Find GCPs ▸ **Role** now have Guide sections of their own.\r
- **A rebuild adds a product instead of replacing it.** Building a dense cloud, mesh,\r
  DEM or orthophoto again adds a new one ("DEM 2") beside the old ones and makes it the\r
  main one, the input the next step uses; the build dialogs' new **Output ▸ Replace the\r
  main …** (off by default) replaces the main one instead. Right-click a product ▸\r
  **Set as main** to use another one; the map and the product tab show the main DEM and\r
  orthophoto. A sparse rebuild or edit (Optimize cameras, Gradual selection) no longer\r
  removes the products built on the old model, and a new DEM no longer removes the\r
  orthophoto built on the old one: they are kept and marked **outdated**, with the\r
  reason in the tooltip and in Show information, and the tools still offer them as\r
  inputs, named so. It is an option, not a pure win, because every kept product costs\r
  storage, and memory for a cloud. The depth maps and the georeference are still\r
  retired with the model they belong to. Each DEM and orthophoto is now saved in a file\r
  of its own.\r
- **Clearing the console asks first.** The developer console's **Clear** button asks\r
  before it deletes the project's log, saved copy included, since a cleared log cannot\r
  be brought back. The typed \`clear\` command still only empties the view.\r
- **Find GCPs reads like the other tool dialogs.** Its settings are numbered steps\r
  (Match, Pick candidates) with a line on what each does, and the results are steps 3 and\r
  4: the run's numbers as tiles, the candidates on both images, a sortable table, and the\r
  candidate under review with its close-ups and fields. Click a row or a number on an\r
  image to review it, and ‹ › to step through them.\r
- **Merge thins only where the clouds overlap.** With a Dedupe cell, a cell holding\r
  points of two or more clouds keeps only the first cloud's (in the order listed), and\r
  every other cell keeps all its points. It used to resample the whole merged cloud to\r
  one point per cell, thinning far more than the seam.\r
- **Region keeps towers and tree lines.** Fit to sparse / Fit to dense still leaves out\r
  stray points, but past the outermost 2 % on each side the box now follows points that\r
  continue without a gap, so tall structures above the 98th percentile of heights are no\r
  longer cut off.\r
- **The Region and the orientation survive Optimize cameras and Gradual selection.**\r
  Both edits keep the model's frame, so the box and the up direction drawn on it carry\r
  over (the log says so) instead of being set aside as drawn on an older model.\r
- **Classify ground shows the cloth's size.** The dialog's cloth line says how many cloth\r
  points the cloud needs at the chosen resolution, and for a cloud in memory the coarser\r
  resolution it will use past 4 million. On a streamed cloud, the log now says how many\r
  tiles used a coarser cloth than asked.\r
- **Clean contour lines from a photogrammetric DEM.** Contours smooths the DEM's heights\r
  before tracing (Smooth the DEM first, 2 cells) and drops lines shorter than 20 cells,\r
  so surface noise no longer traces as thousands of tiny rings. On the Aukerman example's\r
  DSM the lines went from 31,436 (96 % of them under 20 cells long) to 733, with the\r
  terrain and tree crowns kept. Both are settings; 0 gives the exact trace. Drop lines\r
  shorter than is now in cells of the DEM.\r
- **ICP aligns to a reference without normals as well as to one with them.** Align to\r
  reference (ICP) estimates the reference's normals where it is matched, so an imported\r
  survey cloud gets point-to-plane matching without running Estimate normals first. On\r
  the Aukerman dense cloud it converges in 34–40 iterations to 0.5 mm, where\r
  point-to-point had not converged after 100.\r
- **More accurate, more complete depth maps on a GPU (Method: Full).** Depth Maps ▸\r
  Advanced ▸ Method: Full runs three passes, ACMH view selection, planar priors that span\r
  textureless areas, and a pass that makes each map agree with its neighbours; Fast is the\r
  former single best-K pass. Auto, the default, uses Full on a GPU and Fast without one.\r
  On six ETH3D scenes (ETH3D's own evaluator) the F1 score at 2 cm rises from 62.0 to 66.2,\r
  better on every scene (ACMH +1.4, planar priors +0.7, geometric pass +2.0), against\r
  COLMAP's 58.4. Depth maps take about 2–4× as long: ETH3D 2.2–3×, the 347-image quarry\r
  block 7 → 26 min. The geometric pass works from the saved first-pass maps, so memory\r
  stays flat (quarry: 1.9 GB projected). On aerial blocks the surface is smoother (median\r
  height noise −20 to −29 %) with about 10 % fewer points. Methods after Xu & Tao (ACMH\r
  2019, ACMP 2020).\r
- **Much fuller dense clouds of objects and interiors.** In an object-capture project the\r
  depth filter now keeps a pixel that one other view confirms (aerial projects still need\r
  two), so plain walls, floors and edges seen in only two photos stay in the cloud. On\r
  six ETH3D scenes, scored by ETH3D's own evaluator, the F1 score at 2 cm rises from 57.1\r
  to 62.0, with every scene better (office 43.2 → 55.2); at Medium quality that is above\r
  COLMAP's 58.4 at a higher resolution. The Consistent views field is blank (auto) by\r
  default; a number there still applies to any project.\r
- **Sharper depth at object edges.** Depth maps compare image patches with each pixel\r
  weighted by how close it is to the patch centre and how similar its grey value is (as\r
  COLMAP does), so the far side of an edge no longer pulls a depth across it. On six\r
  ETH3D scenes (scored by ETH3D's own evaluator) the F1 score at 2 cm rises from 56.4 to\r
  57.1, better on five scenes and equal on the sixth; an aerial block is unchanged. No extra time on the\r
  GPU, about 10 % without one.\r
- **Fuller dense clouds.** Depth maps now compare each image with up to 10 neighbours\r
  instead of 6 and run 5 refinement sweeps instead of 3, so more of the surface gets a\r
  depth. On six ETH3D scenes (dense from the true cameras, scored by ETH3D's own\r
  evaluator) the F1 score at 2 cm rises from 53.6 to 56.4 on average, better on every\r
  scene (office 37.8 → 43.0, playground 36.0 → 41.8). Depth maps take about 9 % longer on the GPU and about\r
  2.2× as long without one (a 42-image block: 211 → 465 s); both values stay adjustable in\r
  the Depth Maps dialog.\r
- **More features on faint images.** An image that finds fewer than half the keypoint\r
  cap is detected again at half the contrast threshold, so plain walls, interiors and\r
  uniform fields get enough matches to register. On ETH3D (six scenes, camera centres\r
  vs the ground-truth cameras) every scene registers as many cameras or more (office\r
  18 → 20 of 26, playground 34 → 35 of 38) and five are more accurate (delivery_area\r
  4.0 → 2.9 mm, playground 3.6 → 1.3 mm median); quarry (53 of 347 images retried):\r
  14 % more sparse points and 0.766 → 0.738 m against RTK without priors, for 31 % more\r
  matching time; South Building (6 of 128 retried) is unchanged. Detect Features ▸\r
  Advanced ▸ Retry faint images turns it off.\r
- **Large cloud and mesh exports ask where to save first.** In Chrome and Edge, an export\r
  over about 256 MB opens the save dialog when you start it and writes the file there\r
  when it is done, instead of a download at the end. A 552 MB PLY download could be\r
  cancelled by the browser the first time; Firefox and Safari still download.\r
- **Tool dialogs read like the Reconstruct ones.** The Tools dialogs that run on a\r
  cloud, mesh, DEM or the model (Filter, Crop, Transform, Merge, Estimate normals,\r
  Classify ground, Align to reference, Distance to reference, Clean, Smooth, Decimate,\r
  Sample, Contours, Slope/aspect/hillshade, Clip to polygon, Optimize cameras, Gradual\r
  selection, Detect fiducials) now show their settings as numbered steps in run order,\r
  each with a live line saying what it will do to your data. A step that is switched\r
  off is dimmed. Drop-down lists are drawn like the other fields and are only as wide\r
  as their longest choice, and File name is a wider field without a help link.\r
- **The app is called WebSfM** in its interface, messages, help and the name it installs\r
  under, and in the LAS files it writes. Links, the \`.websfm\` project files and saved\r
  settings are unchanged.\r
- **DEMs take each cell's median height by default** (was the maximum). In a cell on a\r
  slope the maximum is the cell's highest corner: on Rachel Glacier's rock at 20 m cells\r
  it stood 14 m above the reference DEM (NMAD 8.2 m), the median 0.7 m (5.9 m). On flat\r
  Casa Grande the two agree within 0.1 m, so Max remains for small cells over roofs and\r
  canopy. A cloud too big for the median's buffer takes the mean, and the log says so.\r
- **Reference DEMs past 2 GB are read over the project.** A DEM too large for one buffer\r
  (a REMA 2 m tile, 25,100² cells) is no longer refused when the project's images have\r
  positions or it has GCPs: only the window over them (half their extent around them, at\r
  least 1 km) is read, at a coarser cell size if even that does not fit (Casa Grande's\r
  30,000 × 36,990 reference at 2 m instead of 1 m), and the map still draws the whole\r
  file.\r
- **Fusion on all workers.** Over saved depth maps, fusion spreads its slabs over up\r
  to 8 workers, as many as the memory budget holds; the finished slabs wait in\r
  WebAssembly memory, outside the tab's buffers. Quarry, 347 maps: 478 → 308 s at\r
  Medium, 922 → 200 s at half the merge cell (208 M points), the same cloud.\r
- **Text clouds past 89 million points.** XYZ and ASCII PLY imports past the browser's\r
  2 GB buffer cap continue in WebAssembly memory, up to about 715 million points.\r
- **WebAssembly memories are shared out.** A tab holds only about 125 of them (Chrome\r
  reserves address space for each), so arrays made together share one, and an\r
  allocation the browser refuses falls back to an ordinary buffer where it fits.\r
- **Dense clouds past the browser's buffer limits.** Fusion keeps its merge cells, and\r
  a finished cloud past 2 GB, in WebAssembly memory, which Chrome's 2 GB per-buffer cap\r
  and 16 GB of buffers per tab do not apply to. One piece of fusion holds up to about\r
  1.07 billion merge cells (was 134 million) and a cloud up to about 1.4 billion points\r
  (was 178 million); such a cloud saves, reopens and gets its octree like any other, and\r
  is drawn through the octree. The merge cells no longer count against the tab's\r
  buffers, so fusion may use the whole memory budget.\r
- **Meshes past 4 GB.** A Poisson solve too large for a 32-bit WebAssembly heap (4 GB)\r
  runs on a 64-bit build of the solver (16 GB) in browsers with 64-bit WebAssembly\r
  memory, and a 32-bit solve that runs out is retried there. The 64-bit build gives the\r
  same mesh and is about a sixth slower, so it runs only when needed; the log says\r
  which one ran. A dense cloud past 178 million points can be meshed (quarry, 208 M\r
  points, depth 9: 586 k triangles in 3.6 min). A solve past 16 GB stops with a message\r
  that says so, instead of a bare "unreachable".\r
- **The memory budget follows the machine.** Settings ▸ Compute ▸ Memory safety limit is\r
  half the memory the browser reports by default and can be raised to all of it; it\r
  stopped at 6 GB by default and 12 GB by hand, written when Chrome reported at most\r
  8 GB (Chrome 156 reports up to 32). Runs keep at most 12 GB of it in buffers, as\r
  before; fusion may use the rest. A saved manual limit is kept.\r
- **Layers panel: the layers on the map, as in a GIS.** View ▸ Map ▸ Layers opens a\r
  small panel over the 2D map listing the layers on it (imported reference rasters\r
  and polygon files, the DEM, the orthophoto and contour lines) in one stack, top\r
  first. The sidebar holds everything; a layer goes into the panel with its sidebar\r
  checkbox or In Layers on its ribbon tab (formerly On Map), and a newly built DEM,\r
  orthophoto or contour set goes there by itself. In the panel, drag a row or use\r
  ▲ ▼ to change what draws on top, untick it to hide it without taking it off, or\r
  take it off with ✕. Each row is one line; the selected one's opacity slider and\r
  Zoom to sit in a strip below the list, and the basemap is the last row. The order\r
  and what is hidden are saved with the project; a layer added later goes on top.\r
  Before, the order was fixed (reference rasters, then the DEM, then the orthophoto).\r
- **Footprints are an overlay; the Shapefiles section is gone.** The image footprints\r
  from Footprints from poses are drawn above every layer, and View ▸ Map ▸ Footprints\r
  shows and hides only them (it hid contour lines and imported polygons too). They\r
  have no sidebar row: an image's expanded row says whether it has one, and a\r
  right-click on a footprint or Export ▸ Footprints downloads them as GeoJSON or\r
  removes them. Contour lines are listed in Products and imported polygon files in\r
  Reference Data, each a layer with its own checkbox and opacity.\r
- **GCPs toggle on the map.** View ▸ Map ▸ GCPs shows or hides the GCP and marker\r
  symbols, as Cameras does for the camera positions. Editing GCPs always shows them.\r
- **Every processing dialog reads in steps.** Sparse Model, Depth Maps, Dense Cloud,\r
  DEM, Orthophoto, Mesh and Texture now show their settings as numbered steps in the\r
  order the run applies them, like Detect and Match Features, each with a line on what\r
  it does to this project with the current values (for example "42 depth maps at up\r
  to 1,500 px" or "About 3 points per cell"). A step that cannot matter is dimmed and\r
  says why. Depth Maps had its groups in reverse order, and DEM and Orthophoto had none.\r
  The guide articles follow the same order.\r
- **Map layers have a checkbox in the sidebar.** DEM, orthophoto, reference rasters,\r
  contour lines and polygon files go on the 2D map (into its Layers panel) with a\r
  checkbox on their row, like a cloud's 3D checkbox, instead of the ◉ marker and the\r
  right-click menu alone (which stays, as Add to / Remove from Layers). A layer the\r
  map cannot place yet (a product to rebuild, a raster without a CRS) has it greyed,\r
  with the reason as its tooltip.\r
\r
### Performance\r
- **Remove outliers up to 4× faster.** The outlier filter finds each point's neighbours\r
  with the k-d tree the other cloud tools use, instead of a grid whose dense cells held\r
  hundreds of candidates; it keeps exactly the same points. ETH3D dense clouds: pipes\r
  (3.5 M points) 45 → 11 s, terrace (9.1 M) 58 → 26 s, courtyard (10.1 M) 51 → 32 s.\r
- **Filter and Classify ground on a streamed cloud use every core.** The tiles go to all\r
  workers at once, each with its share of the memory limit, and the outlier filter reads\r
  every tile once instead of twice. Rachel Glacier (51 M points, 8 workers): Filter\r
  332 → 62 s, the same 48,469,854 points kept.\r
- **Octrees build on every worker.** A large LAS/LAZ import, a streamed edit and the\r
  octree of a dense cloud past 4 M points sort the points into chunks once, then build\r
  the chunks on all workers. Rachel Glacier: import 77 → about 60 s (the LAZ decoding is\r
  most of what is left), a filtered cloud's octree 52 → 35 s.\r
- **Decimate splits a large mesh over the workers.** From half a million triangles the\r
  mesh is decimated in blocks, one per worker, with their shared vertices held in place,\r
  then once more across the seams. A 4.5 M triangle terrain: 26 → 7.7 s on 8 workers.\r
  The error is the same or slightly smaller than one pass over the whole mesh (RMS and\r
  largest distance of the input's vertices, on 2 M and 3.9 M triangle terrains and a 2 M\r
  triangle sphere).\r
- **Classify ground's cloth 1.4× faster.** Its springs skip the bounds tests away from\r
  the edges; the result is identical. Rachel Glacier streamed, 8 workers: 1,382 →\r
  1,088 s, the same 13,761,563 ground points.\r
- **Remove outliers and Estimate normals use every core.** From a million points the cloud\r
  is split into slabs over the worker pool, each with a margin wide enough that the\r
  outlier filter keeps exactly the points one worker would. On the Aukerman dense cloud\r
  (2.1 M points, 6 workers): outliers 7.4 → 4.0 s, normals 7.6 → 3.2 s.\r
- **Slope, aspect and hillshade about 40 % faster.** The DEM's nodata test runs once per\r
  cell instead of nine times: a 64-million-cell DEM 9.9 → about 6 s.\r
- **Depth maps without a GPU use every core for each map.** Each depth map now runs on all\r
  cores at once instead of one core per map, so the run no longer depends on how many maps\r
  fit the memory budget side by side. A 42-image block on the CPU: 465 → 263 s, the same\r
  maps whatever the number of cores.\r
- **Bundle adjustment of small blocks on every core.** A block under about 128 cameras now\r
  builds and reduces its bundle-adjustment system on all cores instead of one, in\r
  fixed point chunks, so every browser gets the same result. A 42-image block: SfM\r
  18.7 → 12.1 s (bundle adjustment 12.4 → 6.1 s); quarry (347 images, whose interim\r
  solves are small): 72.2 → 66.5 s. The sums are added in a different order, so the\r
  last digits differ; on a synthetic block with known cameras the error to the truth is\r
  the same (5.014 → 5.009), and the RTK camera check is unchanged.\r
- **Fewer stalls while long runs work.** Bookkeeping the page did itself while the workers\r
  computed — converting descriptors before SfM, per-pair match checks, each saved depth\r
  map's statistics — now takes a fraction of the time. On quarry (347 images): before\r
  SfM 4.9 → 1.8 s of a blocked page, during matching about 5 s less; on a 42-image\r
  block's depth maps 5.3 → 1.3 s. Results are unchanged.\r
- **Large projects open faster.** A check that a georeference still fits its evidence\r
  re-serialised every camera, image and pose each time one of them was restored, even\r
  with no georeference to check; it now runs only when there is one. Quarry (347\r
  images, a dense cloud and a mesh): reopen 9.7 → 1.2 s.\r
- **Fusion plans on every worker.** Over saved depth maps, fusion's planning passes (cost\r
  statistics, scene bounds, the cloud-size estimate, slab outlines) are now shared out\r
  over the workers that fuse the slabs, with the same plan and cloud. Quarry (347 maps\r
  at Low, 8 workers): fusion 58 → 37.5 s, the same 21,442,726 points. Fusion's\r
  per-pixel loops also stopped allocating a point per pixel (60.6 → 58.0 s before that).\r
- **Small orthophotos on several workers.** An orthophoto that fits in one or two\r
  2,048-pixel blocks is now cut into 1,024-pixel blocks, so more workers share it; the\r
  same pixels. The graph-cut seamlines also price each seam edge once per change\r
  instead of once per move. A 1,401 × 1,722 ortho of a 42-image block: 16.0 → 13.3 s\r
  (the seam cut 3.5 → 3.0 s).\r
- **Depth maps without a GPU, faster.** Each depth hypothesis now prepares its\r
  reference window once instead of once per source photo, and a pixel no longer re-scores\r
  a plane it has already scored. A 42-image block at Medium on the CPU: 277 → 216 s, the\r
  same depth maps.\r
- **Feature detection on every worker.** SIFT now detects as many images at once as the\r
  worker pool and the memory budget allow, instead of at most four. Quarry (347 images,\r
  8 workers): 161 → 86 s; a 42-image block 23 → 19 s; the same keypoints.\r
- **Faster meshes.** The surface solve's screening terms skip the products that are\r
  always zero, the same mesh in less time. A 42-image block (61 k samples, depth 8):\r
  Build Mesh 22.5 → 18.0 s; a 1 M-sample depth-10 terrain: solve 384 → 244 s, its\r
  coarsest levels 32 → 4.7 s each. The solver's coefficients are bit for bit the same.\r
- **Matching without a GPU uses the whole worker pool.** Each image pair now goes to an\r
  idle worker instead of the next one in turn, which could still be busy with a slower\r
  pair. Quarry (347 images, 1,909 pairs, WASM matcher): 429 → 297 s, the same matches.\r
- **Sparse reconstruction outside bundle adjustment.** The model's reprojection\r
  statistics, the self-calibration fit and guided track extension stopped allocating per\r
  observation, and guided extension only tries the cameras that can see a point. Each\r
  self-calibrating solve now moves the keypoints on all cores (in WebAssembly), and the\r
  composed lens for dense is fitted once, at the end. Guided extension searches camera\r
  by camera. Quarry (347 images): 82 → 77 s, then 84 → 73 s (SfM stages 70 → 60 s;\r
  the ten keypoint folds 8.9 → 2.2 s, guided extension 5.6 → 3.7 s), the identical model.\r
- **Depth maps on large scans, and the cross-view filter.** On a block of 58 film\r
  scans (97 MP) at High: masks and grey planes are built once per image instead of for\r
  every map they serve, the speckle filter is 5.7× faster (same output), previews are\r
  at most 2,048 px, greyscale scans are cached as one channel, and the next map's\r
  images are prepared while the current one matches. The cross-view filter checks each\r
  map against at most 12 overlapping views with enough parallax, and sizes its workers\r
  by memory: 30 → 4.4 min. Depth maps and filter together: 54 → 26 min. Fusion\r
  compares each map with at most 12 views too, and its planning passes read only depth\r
  and cost: 22 → 7.8 min, the same cloud for the planning change.\r
\r
### Fixed\r
- **Matches ▸ Used in model counts matched pairs.** It counted every pair of images\r
  that share a tie-point, and a track seen in three images joins a pair that was never\r
  matched, so it could exceed the number of pairs (546 of 232). It now counts the\r
  verified pairs that share at least one tie-point in the model.\r
- **The mobile warning fits a phone's screen.** On a phone the page no longer pans\r
  sideways and the warning no longer runs past the screen's edge. The ribbon is wider\r
  than a phone, and mobile Chrome widened the whole page to fit it; the app now clips it.\r
- **Lists in the glossary and help boxes are indented.** Their bullets and numbers sat\r
  left of the text's margin.\r
- **Panoramic split of a portrait strip.** A strip scanned upright (taller than wide)\r
  was cut into segments that were mirror images, so the model came out mirrored and no\r
  georeference could fit it; the segments are now the strip turned a quarter.\r
- **Section keeps classes, other scalar fields and normals,** and its automatic slice\r
  thickness comes from the point spacing on the surface: on terrain it was several times\r
  too thick (the spacing was taken from the box's volume).\r
- **Footprints in a feet CRS.** With the global terrain as the ground, terrain heights in\r
  metres were compared with camera heights in feet; they are now converted, and the\r
  Ground elevation and Flying height fields are labelled in the project's unit.\r
- **No false "points outside the extent" warning on a cloud's octree.** A point within\r
  half a millimetre of the cloud's edge could round past it when stored, and the build\r
  then warned about a broken file header, even for a computed cloud.\r
- **Clip to polygon reprojects a GeoJSON file.** A file in longitude/latitude (standard\r
  GeoJSON, as QGIS writes it) or one that names its CRS is moved into the raster's CRS;\r
  it used to be taken as it was and reported as not overlapping.\r
- **One backend line per depth-map run.** Depth maps split over the worker pool printed\r
  "backend = WASM (CPU)" (and, without a GPU, its warning) once per worker; the console\r
  now shows it once.\r
- **Spinners keep turning with reduced motion.** With reduced motion on (Settings, or\r
  the system: remote desktop sessions often ask for it), the loading spinners and the\r
  indeterminate progress bar stopped and looked like a hang; they now keep moving,\r
  while decorative motion still stops.\r
- **Importing masks of large scans no longer knocks out the GPU.** Each imported mask\r
  was drawn into a GPU-backed canvas before it was saved; three 10,000-pixel scan masks\r
  at once ran Chrome's GPU process out of memory, and after three crashes the tab fell\r
  back to software rendering: matching and depth maps then ran on the CPU emulation,\r
  many times slower, with no error. Workers now draw such pixels on the CPU.\r
- **DISK no longer retries WebGPU on every tile.** Its WebGPU path lacks an operator;\r
  the first failure now keeps every later input on the CPU instead of only larger ones.\r
- **Local products of a historical block are level.** A block that mixes vertical\r
  photos with unbalanced left and right obliques (TMA film) took its vertical from the\r
  mean viewing direction, 21° off on Rachel Glacier, so the local DEM and ortho were\r
  projected onto a tilted plane and Find GCPs could not align them with a map. The\r
  viewing directions are now a trimmed mean that keeps the block's verticals (0.3° off).\r
- **High-quality depth maps on big blocks no longer run the tab out of memory.** A\r
  worker now waits while more than two of its finished maps are still being saved (a\r
  slow disk queued 0.6 GB per map on the page), the cross-view filter starts on a\r
  fresh pool and splits by memory, not by map count.\r
- **Film scans in dense, orthophoto and exports.** Depth maps and orthophotos of a\r
  film block failed at once with "could not be cloned": the fiducial transforms\r
  reached the workers as Vue proxies.\r
- **A DEM from a large georeferenced cloud read only the top of its octree** (the cell\r
  size was compared in metres against model units): 8,270 of 60 M points.\r
- **16-bit WhiteIsZero TIFFs no longer import as negatives.** The native decoder\r
  inverted them twice; it now matches the JavaScript fallback bit for bit. 1-bit\r
  (bilevel) TIFF scans, CCITT Group 4 included, now import through the native decoder.\r
- **The map legend matches the map.** It listed one purple camera triangle while camera\r
  positions from EXIF draw as blue triangles, and drew GCPs as diamonds while the map\r
  drew squares. The legend now lists exactly the symbols on the map, cameras by the\r
  source of their position (EXIF, imported, model), control and check points apart,\r
  and leaves out what a ribbon toggle hides; GCPs draw as diamonds on the map too.\r
\r
## [0.4.0] — 2026-10-21\r
\r
### Added\r
- **Turntable (View ▸ Camera ▸ Turntable).** The 3D view turns the model slowly about\r
  its up direction, for presenting a result or checking a dense cloud; dragging steers\r
  it, and it carries on when you let go. Its toolbox sets the seconds per turn and\r
  **Record one turn** saves exactly one turn of the view as a looping video (WebM, or\r
  MP4 in Safari). A new guide article, **The 3D View**, covers navigation, the view\r
  presets and the turntable.\r
- **Example project and tutorial.** New users without photos of their own can open an\r
  example from the New Project dialog (**New here? Open the example project**) or the\r
  project picker (**Try an example**): 42 drone photos of Aukerman Park, Ohio, from\r
  OpenDroneMap (public domain, about 50 MB). The images are imported as a drop would\r
  import them, and the guide opens a new **Tutorial: Your First Reconstruction** that\r
  walks through every stage to a DEM and an orthophoto, with what to expect at each.\r
  Hosts put the examples on their server with \`npm run fetch:examples\`\r
  (\`VITE_EXAMPLE_BASE_URL\` points elsewhere); a missing example says so and leaves no\r
  empty project behind.\r
- **Detect reseau (Tools ▸ Images ▾ ▸ Film scans).** For cameras that expose a grid of\r
  crosses onto every frame, such as the KH-9 mapping camera, the crosses are found in\r
  every scan and each scan is corrected for how it sat on the scanner and how its film\r
  has stretched or warped, centimetre by centimetre. On a synthetic satellite block\r
  with deformed film, checkpoint errors fell from tens of metres to under one pixel.\r
  Self-calibration on Auto keeps the camera's certificate values for such a camera.\r
- **Half-frame film scans.** Archives that scan a frame in two overlapping halves\r
  (\`<frame>_a\` and \`<frame>_b\`, as for the KH-9 mapping camera) can now be stitched\r
  into one frame in Detect reseau ▸ Half frames. The crosses on each half place it on\r
  the film and correct its deformation, ground control marks move to the stitched\r
  frame, and the halves are removed. On real KH-9 scans the stitched frame's crosses\r
  lie on their grid to 6 µm.\r
- **Panoramic satellite strips (Tools ▸ Images ▾ ▸ Film scans ▸ Split panoramic\r
  strips).** KH-9 and KH-4 panoramic frames are long strips of curved film that no\r
  frame camera describes. Each strip is now cut into segments, each resampled exactly\r
  into the image a frame camera turned to that part of the scan would take, and\r
  reconstructed like any frame images. Six Casa Grande KH-9 panoramic strips, of\r
  which two images registered before, now register as 96 of 96 segments. The\r
  satellite's motion during the scan is not modelled yet, so accuracy is coarse: tens\r
  to hundreds of metres on a synthetic block that moves as a real one does.\r
- **DEMs finer than 4,096 cells a side.** A DEM whose chosen cell size needs a bigger\r
  grid (a satellite frame at its native resolution) is no longer coarsened to fit: it is\r
  built block by block as a full-resolution Cloud-Optimized GeoTIFF, which the GeoTIFF\r
  export delivers. Its tab and the map draw it at full resolution as you zoom in,\r
  coloured and hillshaded. Readouts, profiles, volumes, the GCP check, contours,\r
  terrain derivatives, clips, the ASCII export and an orthophoto built on it all read\r
  the full-resolution grid (coarser only past their memory limits, which the log names).\r
- **Watch the sparse model grow.** During Sparse Reconstruction the 3D view draws the\r
  cameras registered so far and their points, in colour, updated every couple of\r
  seconds, and zooms out as the model expands. You can orbit and zoom it while it\r
  grows; the rest of the app is dimmed and locked until the run ends, and the progress\r
  bar sits in the view's corner.\r
- **Raster size in pixels, shown before the run.** The DEM and Orthophoto dialogs set\r
  the size by cell size or by pixels on the long side, and show the size the run will\r
  build (pixels, cell size, uncompressed size) and any cap before it starts.\r
- **Orthophotos and DEMs past 4 GB.** The stored GeoTIFF becomes a BigTIFF when it\r
  needs to, so a fine orthophoto is no longer coarsened to fit 4 GB. Rasters are capped\r
  at 65,535 pixels a side.\r
- **DEM and orthophoto GeoTIFFs in another CRS.** The GeoTIFF and COG exports can\r
  write a reprojected copy in any CRS (bilinear or nearest), block by block. The product\r
  itself stays as built, and heights keep their vertical datum.\r
- **Duplicate images are caught.** Adding an image whose name and size match one\r
  already in the project asks once per batch: skip the duplicates, or add them as\r
  separate images ("photo (2).jpg").\r
- **Camera positions on the map can be hidden** (View ▸ Map ▸ Cameras).\r
- **Long runs look after themselves.** While a stage or workflow runs, the screen is\r
  kept on so the computer does not sleep mid-run, and the tab's title shows the stage\r
  and its percentage, or "Waiting for you" when a workflow stops to ask something.\r
  Turn on **Notify when a run ends** (Settings ▸ General) for a desktop notification\r
  when a run ends, or a workflow needs you, while you work in another tab.\r
- **A stage that fails says so.** When a stage logs an error, a red note names it and\r
  shows the first error; click it to open the console. Before, the progress bar just\r
  closed and the reason was only in the log.\r
- **The Workflow Builder checks image files before a run.** When a run contains a\r
  block that reads pixels, every image's file is checked first. A moved, renamed or\r
  deleted file is restored from project storage where the project has a copy, and the\r
  rest are named in a warning before anything starts, instead of failing mid-run.\r
- **Footprints from poses follow the terrain.** Each image corner now lands where its\r
  ray meets a DEM: the global terrain behind the Terrain basemap, or an imported\r
  reference DEM. Before, footprints were cast onto one flat plane, so over relief they\r
  were too small or too large, and so was the overlap that preselection matches by.\r
  The terrain is the new default ground. The dialog asks which vertical datum the\r
  camera heights are in and converts the DEM to it. The flat plane and the\r
  height-above-ground plane remain.\r
- **Heights convert between ellipsoid and geoid.** GCPs and reference DEMs declare\r
  their vertical datum: ellipsoidal (WGS 84), EGM2008, EGM96, another geoid or local.\r
  Filling or checking a GCP's height from a DEM, and comparing a DEM with a reference,\r
  convert between the ellipsoid and the two global geoid models. The difference is up\r
  to about 100 m, and tens of metres over Antarctica. **Convert heights to…** in the GCP\r
  table changes a set of GCP heights to another datum. The geoid grids are part of the\r
  app and work offline.\r
- **GCPs straight off a reference orthophoto or DEM**: right-click an imported\r
  reference raster and choose Add GCP here, or move the selected GCP there. X/Y comes\r
  from the click and Z from a reference DEM. The accuracy comes from the raster's\r
  pixel size and its declared accuracy, so a project can be georeferenced with no\r
  survey data at all.\r
- **Accuracy & datum…** on each Reference Data row declares a raster's horizontal\r
  accuracy and, for a DEM, its vertical datum, accuracy and offset. Before, only a\r
  low-confidence import asked for these, so Fill Z could refuse with no way to fix it.\r
- **Quality gates and editable recipes in the Workflow Builder**: a Quality Gate\r
  block checks a Quality Report metric (registered images, reprojection error, track\r
  length, dense coverage …) after a stage and, when it fails, pauses, stops or jumps\r
  ahead to a named block; Go to jumps unconditionally. Jumps only go forward, so every\r
  run ends. The recipe text can now be edited and applied: a wrong line is refused with\r
  its line number and nothing changes. Point-cloud filter, normals, ICP and the mesh\r
  Clean, Smooth and Decimate tools are now blocks, each working on the previous\r
  block's result.\r
- **ALIKED** learned detector, with its own LightGlue matcher. Freely licensed\r
  (BSD-3-Clause / Apache-2.0) like DISK, and about four times faster to detect.\r
- **MAGSAC++** as an alternative to RANSAC for checking each image pair (Match\r
  Features ▸ Estimator). RANSAC stays the default: on the test sets both give the same\r
  accuracy.\r
- **COPC point clouds read in place**: a \`.copc.laz\` file is imported as it is and\r
  read node by node from its own octree, so a 93 million-point survey opens in seconds\r
  instead of minutes. The 3D view, crop, DEM, exports and 3D Tiles work on it as on any\r
  other large cloud.\r
\r
### Changed\r
- **Sparse Reconstruction uses every core for its bundle adjustment.** Where the page\r
  can share memory with its workers (it can when served as the app is: Chrome,\r
  cross-origin isolated), the bundle adjustment runs on up to 16 threads, and gives the\r
  same result as on one, bit for bit. On 1,600 synthetic cameras it took 20–36 s instead\r
  of 62–120 s; on the 347-image quarry set 43 s instead of 92 s.\r
- **Orthophotos build on several workers, and faster on one.** Over saved depth maps,\r
  the blocks are shared among the compute workers: as many as the build predicts to be\r
  fastest, since each extra worker keeps a smaller cache of maps and photos. A worker\r
  that finishes early takes over blocks from a busier one. Photos are decoded a few at\r
  a time ahead of when they are needed and kept without their unused alpha channel,\r
  depth maps are read without their normals, and the per-cell passes do less work. The\r
  orthophoto is the same, pixel for pixel. Quarry at 12,000 pixels across: 18 minutes\r
  on one worker before, now 14 on one and under 6 on six.\r
- **Imported images stop depending on the original files.** Once an image's copy is\r
  written to the project, websfm reads the copy, so moving, renaming or deleting the\r
  originals afterwards (or a cloud-sync folder freeing them) no longer breaks images in\r
  the open session.\r
- **Workflow Match blocks pick their pairing per project.** A new Match Features block\r
  starts on **auto** pairing: Preselect when images have camera positions, Sequential\r
  for video frames, otherwise Exhaustive, the same as the Match Features dialog. A\r
  workflow used to match a video set exhaustively.\r
- **A long orthophoto or DEM reports its progress.** The progress bar names the block\r
  or group being built, and the log says how far the run has got (blocks done, or map\r
  visits while a group of blocks is still open) and roughly how long is left: after half\r
  a minute, then after 1, 2 and 4 minutes, then every 5, so a long run does not fill the\r
  log. A fine orthophoto used to stay silent until the end.\r
- **Counts read as English.** Log lines, reports and dialogs say "1 image" and\r
  "3 images" instead of "image(s)", and the verb agrees where it follows.\r
- **Georeferencing moved to the Reconstruct tab**, between Sparse and Dense, where it\r
  belongs in the pipeline: Find GCPs, Georeference and Scale Bars. Edit GCPs is a mode,\r
  so it stays a tool, now in Tools ▸ Images ▾ next to Edit mask. Every Tools group is\r
  now a menu.\r
- **Orthophoto seams**: the mosaic now chooses where seams run by graph cut, so they\r
  avoid roofs and tree crowns, and hides them by multiband blending, which keeps each\r
  photo's detail instead of averaging two photos across the seam band. Both are\r
  settings in Build Orthophoto (Seamlines, Seam blending); the old nearest-nadir seams\r
  and feathering are still offered. Colour balance may now correct a photo by up to\r
  ±2 stops (was ±1), for flights whose auto-exposure drifted.\r
- **Fisheye lenses: k4 in Auto self-calibration**: a four-term fisheye now gets its k4\r
  refined last, after k1–k3. If that fit would fold the lens curve, the pass is solved\r
  again without k4 rather than discarded.\r
- **Console \`select\`** now selects an image by name; the 3D lasso is \`lasso\`.\r
\r
### Fixed\r
- An orthophoto over a DEM or mesh in a projected CRS was up to ten times slower than\r
  one in the model's local frame: the georeferenced frame is not exactly affine, so\r
  every cell took the full transform and no part of a photo was skipped as out of view.\r
  It now uses local fits checked against the exact frame. Quarry at 4,096 pixels across\r
  took 4 minutes instead of 14.\r
- Fusing a very large dense cloud (about 100 million points) failed near its end:\r
  Chrome holds at most 2 GB in one buffer and 16 GB for a tab, whatever the machine\r
  has. Fusion now finishes each slab straight into the cloud, splits a piece too large\r
  for one buffer, caps the memory budget at 12 GB and starts on fresh workers. Quarry\r
  at Medium, step 1, fuses 98 M points in under 10 minutes. Planning shows its\r
  progress, and the consistency check stops comparing once every pixel is settled.\r
- An orthophoto run no longer fails when the open project's clouds fill the tab:\r
  the photo cache leaves room for them and shrinks if the browser refuses memory.\r
  Orthophotos also decode fewer photos. On quarry the colour balance and seamline\r
  survey dropped from about 4 minutes to 1.5.\r
- A GeoTIFF nodata value of three characters or fewer ("255", "0") was read back as\r
  a different value by other programs.\r
- An orthophoto over very large scans (satellite frames past one canvas) refused to\r
  run, or fell back to depth-map colour: it reserved memory for each photo at its native\r
  size, and read photos at twice the resolution it asked for.\r
- In a floating-point Cloud-Optimized GeoTIFF with NaN as nodata, an empty cell\r
  turned the overview cells above it empty too, and partial edge tiles were padded with\r
  0 instead of nodata.\r
- After moving a project into a folder, its images, masks and products could no longer\r
  be read until it was reopened by hand. A moved project now reopens from its new\r
  location by itself, in both directions.\r
\r
## [0.3.0] — 2026-10-18\r
\r
### Added\r
- **Command console**: every ribbon command can be typed (by a short name, its id, or\r
  its id as words), taken from the ribbon itself, with per-command usage (\`help\r
  <command>\`, \`help <tab>\`). New commands: \`run detect match sparse\` and \`run workflow\r
  <name>\` through the workflow runner (\`continue\` / \`reuse\` / \`stop\` answer it),\r
  \`stats\` and \`stats matches\`, \`set sfm.minPnpInlierRatio 0.5\` for session-only tuning\r
  overrides (old → new echoed, key and type checked), \`pair disable|enable <A> <B>\` and\r
  \`select <image>\`. Ctrl+K (⌘K) opens the console with the cursor in the prompt; Tab\r
  also completes setting keys, stages and image names.\r
- **Measurement export**: Export ▸ Measurements… writes every saved measurement\r
  (rulers, areas, elevation profiles, volumes and 3D measurements) as CSV, one row\r
  each with its units in columns, or as GeoJSON lines and polygons with their values.\r
  GeoJSON is in the project CRS (heights kept) or in WGS 84 per RFC 7946; a\r
  measurement without a CRS is labelled with its frame and never placed on the map.\r
  Each saved-measurements list has its own Export… for just its records.\r
- **Video import**: Import ▸ Video (or dropping a video on the sidebar) extracts\r
  frames as images. The automatic mode scans the video and spaces the frames by how\r
  far the view moves, keeping the sharpest frame in each step and skipping blurry\r
  ones, up to a frame cap; a fixed interval (every N seconds or frames) is the\r
  alternative. The dialog shows how many frames it will extract before writing any.\r
  Frames are named \`<video>_<time>.jpg\`, share one sensor per video, and Match\r
  Features starts on Sequential pairing for them.\r
- **Level-of-detail point clouds**: a dense cloud of 4 million points or more gets an\r
  octree in the background (saved with the project, built once), and the 3D view then\r
  draws only a point budget's worth of it, the part in front of the camera in most\r
  detail, loading the rest as you move. The budget (5 million by default) is in\r
  Settings ▸ Map & 3D. Selection tools still see every point.\r
- **Streamed LAS/LAZ import**: a LAS or LAZ file too large to hold in memory is read\r
  in batches straight into its octree, so a 200-million-point survey imports (in a few\r
  minutes) and displays; LAZ is decoded a run of chunks at a time. Such a cloud is\r
  marked *streamed*. Build DEM grids it (also as a DTM of its ground class), reading\r
  the octree only as finely as the cell size needs; Crop copies a box of it into an\r
  ordinary cloud; Export writes LAS, LAZ, PLY or XYZ node by node. Selection (delete,\r
  keep only, assign class), an inverted crop, Filter and Classify ground run on it as\r
  it is, node by node or tile by tile, into a new streamed cloud.\r
- **3D Tiles with level of detail**: Export ▸ 3D Tiles can write a hierarchy of tiles\r
  that CesiumJS and other viewers stream in as the camera comes closer (the default from\r
  1 million points or 250,000 triangles). A point cloud is tiled by its octree, one tile\r
  per node with colour, classification and intensity, read node by node, so a streamed\r
  cloud of any size exports; a streamed LAS is placed in the CRS its file names. A mesh\r
  is split into a quadtree (terrain) or octree (object) of tiles and decimated per\r
  level, with tile borders kept so neighbours always meet; a textured mesh keeps its\r
  texture in the finest tiles.\r
- **Measure in 3D**: Tools ▸ Measure ▸ Measure in 3D measures distance, polylines and\r
  areas directly in the 3D view, picked on the surface of a mesh or on cloud points.\r
  Lengths are split into horizontal and height change, areas into surface area and\r
  footprint, all in metres once the project has a georeference or scale bars.\r
  Measurements can be saved with the project.\r
- **DEM of difference**: the volume tool can measure the computed DEM against an\r
  imported reference DEM, reporting gain, loss and net change inside a polygon\r
  (Tools ▸ Measure ▸ DEM of difference).\r
- **Reclassify by hand**: the 3D selection toolbox has an Assign class action, so\r
  points the ground filter got wrong (or any selection) can be set to a LAS class.\r
- **Textured meshes**: Tools ▸ Mesh ▸ Texture paints a mesh with the photos\r
  themselves, as a new mesh with an atlas of JPEG pages. Each triangle takes the photo\r
  that sees it largest, neighbouring triangles keep to the same photo so seams stay\r
  few, and tiny charts are merged into their neighbours. Exposure is levelled per photo\r
  (ignoring samples one photo sees differently) and then across every seam, so the\r
  two sides meet. A wall hidden behind a tree is still textured from the photo that\r
  hides least of it, and faces no photo sees can be kept in a flat colour or removed.\r
  An optional photo-consistency check leaves out what only some photos saw (people,\r
  cars), and photos scored blurrier by Image quality are used less.\r
  Crop, Clean and Smooth keep the texture (Clean's weld respects it), Sample to points\r
  takes its colours from it, and the workflow builder has a Texture Mesh block that can\r
  decimate first. Masks are respected, lenses\r
  and film scans are sampled through their own camera model, and the depth pass runs\r
  on the GPU when one is available. The 3D view shows the texture (Colour by ▸\r
  Texture), and it exports as GLB (pages embedded), OBJ (a zip with the material\r
  file and the pages) and 3D Tiles.\r
- **Installable app that works offline**: websfm can be installed from the browser\r
  and starts without a connection. A new version asks before reloading, and never\r
  interrupts a running task. Basemap areas viewed before stay available offline at\r
  lower detail, and the map says when it is offline instead of looking broken.\r
- **New app icon**: two cameras triangulating a point. The browser-tab icon has a\r
  transparent background and follows the browser's light or dark theme.\r
- **Ground classification and terrain models (DTM)**: Tools ▸ Point Cloud ▸ Classify\r
  ground labels every point as ground, above ground or low noise (standard LAS\r
  classes, kept in LAS/LAZ/PLY exports) with a cloth simulation filter. Build DEM ▸\r
  Points ▸ Ground only then makes a bare-earth DTM, and the new Fill enclosed gaps\r
  option interpolates the ground under removed buildings.\r
- **DEM vs reference DEM** in the Quality Report (Evaluate ▸ DEM vs Reference):\r
  bias, NMAD, RMSE, LE90 and overlap against an imported reference DEM, with a\r
  difference map and histogram, also in the exported report.\r
- **DEM and orthophoto symbology** (Products ▸ right-click ▸ Symbology…): colour\r
  ramp, height range and hillshade for the DEM; brightness, contrast and gamma for\r
  the orthophoto. Display only, kept across rebuilds.\r
- **Download from the sidebar**: right-click a point cloud, mesh, DEM or orthophoto\r
  for its export dialog (aimed at that item), or download a reference raster or\r
  source image as imported, a polygon layer as GeoJSON, or the match list.\r
- The **DEM / Orthophoto ribbon tab** offers the same actions for a computed and an\r
  imported raster: a computed one gains Symbology… and Remove, an imported one\r
  Download.\r
- **Orthophotos at the photos' own ground resolution**: no longer capped at 4,096\r
  pixels — up to about 28,000 pixels square. They are built in blocks and stored as a\r
  tiled Cloud-Optimized GeoTIFF, and the orthophoto tab and the 2D map draw them at\r
  full resolution as you zoom in.\r
- **Fiducial import and export** for film scans (Import / Export ▸ Image Fiducials\r
  and Camera Fiducials): each image's marks in pixels, and the camera's calibrated\r
  marks in mm with their slots, focal length and principal point, as CSV that\r
  imports back.\r
- **Fisheye and rational lens models**: sensors can use a Kannala–Brandt fisheye (one,\r
  two or four terms, as COLMAP's \`SIMPLE_RADIAL_FISHEYE\`, \`RADIAL_FISHEYE\` and\r
  \`OPENCV_FISHEYE\`) or OpenCV's rational model (k1–k6, p1, p2). Fisheye matches are\r
  verified in the pinhole frame and rays more than 75° off-axis are left out. Bundle\r
  adjustment fits fisheye cameras in the pixels the lens recorded, so self-calibration\r
  can refine the lens itself (up to k3) with the focal length and principal point; an\r
  uncalibrated fisheye (equidistant, all terms zero) reconstructs from EXIF alone. Depth\r
  maps use a fisheye's field up to 60° off-axis, and Optimize cameras handles fisheye\r
  models. COLMAP databases import these cameras instead of skipping them, and sensor CSVs read and write k4–k6 and a lens-model column.\r
\r
### Changed\r
- **Region box handles**: while the Region toolbox is open, the box has drag handles\r
  in the 3D view: one per face moves that face, the centre one moves the whole box.\r
  The number fields follow, and Apply stores it as before.\r
- **LAZ export keeps every point attribute**: a distance, a PLY scalar or a class\r
  above 31 is written as an extra-bytes field in LAZ as it already was in LAS, instead\r
  of being left out. Streamed clouds exported as LAZ keep them too.\r
- **ICP to a mesh matches the surface**: Align to reference pairs each point with the\r
  closest point on the mesh's triangles instead of the nearest vertex, so a coarse\r
  mesh aligns to the cloud's noise level (a 10 m mesh: 0.4 mm instead of 0.5 m).\r
- **Project files past 4 GB**: a \`.websfm\` file is written as ZIP64 when it needs to\r
  be, so large projects can be saved and reopened whole. Opening a project file no\r
  longer reads each stored file into memory.\r
- **Calibration import updates sensors instead of always adding one**: Import ▸\r
  Calibration shows where each row goes before importing, and lets you change it. A\r
  row updates the sensor with its label, or the project's only sensor. With an image\r
  column, rows become sensors for the images they name. An update only sets the values\r
  the file has. The import also reads a film camera's certificate in one row (focal\r
  length, pixel pitch, principal point and fiducial marks in mm), and asks whether the\r
  focal length is in mm or pixels.\r
- **Image Fiducials import reads one row per image**: files with an x and a y column\r
  per mark position (\`corner_top_left_x\`, \`midside_left_y\`, …) are recognised on drop\r
  and each mark goes to the slot its columns name.\r
- **Fiducial imports preview first**: Image and Camera Fiducials open a dialog showing\r
  what will be imported (matched images, marks replaced, the target sensor) instead of\r
  applying the file straight away.\r
- **Changing the project CRS asks first**: the confirmation lists what will be\r
  reprojected (GCPs, camera positions, footprints) and whether the georeference has to\r
  be redone. Project Settings shows the CRS name, not just its code.\r
- **Help boxes stack**: hovering a link inside a pinned help box opens another box on\r
  top, and hovering a new word replaces them all. Setting labels in the pipeline\r
  dialogs (Detect, Match, Sparse, Depth maps, Dense, Mesh, DEM, Orthophoto) explain\r
  themselves on hover, without separate \`?\` icons. Each box shows the setting's\r
  current value next to its default. Every setting in these dialogs and in Auto mask\r
  now has a Guide section.\r
- **More help**: new Guide pages for masks and for working offline, a note on very\r
  large scans, and glossary entries for ICP, normals, contours, slope/aspect/hillshade,\r
  cloud distance, outlier removal, mesh smoothing and decimation, gap filling, COG,\r
  seamlines, image sharpness and masks, linked from the tool dialogs.\r
- EPSG codes from imported files, projects, GCPs and poses now resolve from the\r
  built-in catalog (over 7,000 coordinate systems), so they work offline. epsg.io is\r
  only asked for codes newer than the catalog.\r
- Orthophotos built with an earlier version must be rebuilt (the storage format\r
  changed). The Cloud-Optimized GeoTIFF export is now the stored file itself (always\r
  DEFLATE). PNG and JPEG exports are full resolution and offered up to 8,192 × 8,192\r
  pixels. Orthophoto builds follow the memory budget in Settings ▸ Compute.\r
- Orthophotos are now mosaicked by default: each area comes from the photo looking\r
  most straight down on it, exposure is balanced between photos, and seams are\r
  cross-faded. The previous per-pixel "Best match" and "Average" modes remain\r
  available.\r
\r
### Performance\r
- **SfM on big blocks**: bundle adjustment solves its camera system exactly with a\r
  sparse Cholesky factorisation instead of a capped iterative solve, wherever the\r
  block has more than about 100 cameras. Registration scans only the image pairs a new\r
  camera touches, and re-solves of an already converged model stop sooner. Quarry\r
  (347 images) reconstructs in 135 s instead of 259 s and South Building in 48 s\r
  instead of 85 s, with the same cameras and accuracy against RTK; 1,600 synthetic\r
  cameras take 97 s instead of 353 s. Start-up on a large block with a calibrated lens no\r
  longer re-fits every image pair's epipolar geometry up front (1,600 synthetic\r
  cameras: 88 s → 3 s).\r
- **Outlier filter (statistical)**: about 16× faster on terrain and other surface-like\r
  clouds (a 2 M-point survey tile: 178 s → 11 s). Its neighbour grid was sized from\r
  the bounding box's volume, so on a surface each point compared against thousands of\r
  candidates; the grid now follows the occupancy, and the neighbour search is exact\r
  (results unchanged to 0.01 %).\r
\r
### Fixed\r
- Picking a CRS from the search list by clicking it did nothing in Project Settings\r
  and the import dialogs; the field went back to the old CRS.\r
- Calibration and camera-position imports no longer assign unrecognised columns by\r
  their position when the file has a header (a camera-position file's \`x_map\` became\r
  omega).\r
- **GCP import reads files with several coordinate pairs and image marks**: a point\r
  label column (\`gcp_label\`, \`point_label\`) is the name, a bare \`x\`/\`y\` beside an image\r
  column is the pixel position, \`x_map\`/\`y_map\` and \`*_acc\` columns are recognised, and\r
  lon/lat is preferred with WGS 84 preselected. A file of image marks without\r
  coordinates adds them to existing points of the same name, or adds markers.\r
- Dropped files with an \`image_file_name\` (or \`image_id\`) column are recognised: a\r
  camera-position list opens the camera import with lon/lat read as WGS 84, and a\r
  file with a \`gcp_label\` / \`point_label\` column opens the GCP import, instead of the\r
  "what is this file?" chooser.\r
- Depth maps of a two-image project (or an image only one neighbour overlaps) came out\r
  empty: Consistent views now drops to the number of views that image overlaps, and\r
  the log says so.\r
- Importing a mask without transparency (JPEG, plain black-and-white PNG) masked the\r
  whole image. Such files are now read by brightness: black is masked, white is kept.\r
- Very large scans: Auto mask, mask import and fiducial frame masks no longer try to\r
  build a canvas at full scan size, which the browser can't hold. Masks for these\r
  scans are stored at 8,192 px on the long side. Import, Invert and Clear work in the\r
  viewer; painting says it isn't available yet instead of "editing resumes…" forever.\r
- Orthophoto: a Max match cost the depth maps' own Minimum NCC already made\r
  meaningless now shows a warning instead of silently doing nothing.\r
- The Auto mask ribbon entry described sky/people masking it doesn't do.\r
- Help boxes opened from inside a dialog could not be clicked ("Read more" and their\r
  links did nothing).\r
- Help text could link a word inside another link (e.g. "SIFT" inside "SIFT\r
  descriptor"); stale help text was brought up to date with recent changes.\r
- Imported image fiducial observations were ignored by calibration and\r
  reconstruction until the project was reopened; they now land as detections.\r
- An orthophoto built at a chosen pixel size lost its coordinate frame, so Find GCPs\r
  refused it and the model-frame map could not place it.\r
- An imported orthophoto's tab showed "no data" under the cursor; it now reads the\r
  pixel's band values.\r
- Images without a focal length in their metadata (no EXIF) reconstructed on a guessed\r
  field of view that could be far off, which broke scenes or left most cameras out.\r
  The focal length is now estimated from the matched image pairs first (ETH3D\r
  playground and terrace: from broken to 34 of 38 and 23 of 23 cameras).\r
- A camera could be registered in the wrong place and stay there. After the\r
  reconstruction, each camera is now checked against the matches with its strongest\r
  partner images; cameras that disagree are taken out and registered again, or left\r
  out if they still disagree.\r
- COLMAP database import dropped the k4–k6 terms of \`FULL_OPENCV\` cameras without a\r
  warning.\r
- The same matches could reconstruct slightly differently in different sessions (the\r
  solver's input order followed random image ids); it now follows image names.\r
\r
## [0.2.0] — 2026-10-12\r
\r
### Added\r
- **Find GCPs** matches the orthophoto to a georeferenced reference coarse to fine.\r
  It tolerates rotation and a different resolution, finds a small block inside a\r
  regional reference, and starts from the photos' GPS when the orthophoto is not yet\r
  georeferenced. Each candidate shows a confidence, a residual and an accuracy taken\r
  from the reference's pixel size. Candidates are spread over the block, and none is\r
  added until you tick it.\r
- **Workflow Builder**: arrange pipeline steps as blocks, choose per step whether to\r
  reuse or rerun existing results, and save recipes and run history with the project.\r
- **Tools menus with floating toolboxes**, plus many new tools:\r
  - point clouds: normals, transform, point-pair alignment, ICP, cloud-to-cloud and\r
    cloud-to-mesh distance, sections;\r
  - meshes: clean, smooth, decimate, crop, sample to points, area and volume;\r
  - DEMs: contours (GeoJSON/DXF), slope, aspect, hillshade, clip to polygon;\r
  - model: optimize cameras, region of interest, orient model;\r
  - images: image quality.\r
- **Measurements** on DEMs, orthophotos and the 2D map: ruler, area, elevation\r
  profile (CSV export) and cut/fill volume. Measurements are named and saved.\r
- **Scale bars**: give an object capture real-world units from known distances. New\r
  "marker" points carry image marks but no surveyed position.\r
- **Rectangle and lasso selection** in the 3D viewer, to delete or keep points.\r
- **Gradual selection**: remove weak tie points from the sparse model and re-adjust.\r
- **Find GCPs**: match photos against a reference orthophoto to propose\r
  control-point candidates for review.\r
- **WebGPU feature matching**, with automatic fallback to the CPU.\r
- **DISK** learned detector, with its own LightGlue matcher.\r
- Computed DEMs and orthophotos can be shown on the 2D map. Projects without a CRS\r
  get a top-down map in the model's own frame.\r
- Orthophotos can be projected onto a DEM, the mesh or a fitted plane, at their own\r
  resolution.\r
- One-click suggestion of a projected CRS (UTM or polar stereographic) for\r
  geotagged projects.\r
- Image groups (folders) in the sidebar, a per-sensor GNSS antenna offset, and film\r
  width (mm) as the scale field for film scans.\r
- Extra point attributes (such as intensity and GPS time) survive import and are\r
  written to PLY and LAS exports.\r
- The theme can follow the operating system.\r
\r
### Changed\r
- Feature matching is reproducible: the same images now give the same matches in\r
  every project, where before a few percent of image pairs varied slightly.\r
- Sharper orthophotos: colour now comes from the original photos at full resolution\r
  instead of the lower-resolution depth maps.\r
- Dense clouds are more complete: fusion's matching-cost gate is now a fixed, looser\r
  default (0.8) instead of one adapted to each dataset, which was discarding real\r
  surface. On the ETH3D benchmark this closes the gap to COLMAP at 2 cm with no loss of\r
  accuracy.\r
- Camera positions from EXIF GPS now constrain bundle adjustment automatically.\r
- WebGPU is used automatically for dense depth maps when the browser supports it.\r
- SIFT uses RootSIFT descriptors and keeps coarse-scale keypoints first, which gives\r
  more multi-view tracks. Older projects are converted when matching runs.\r
- The default matching ratio changed from 0.75 to 0.8.\r
- Detection and matching settings are shown in the order they run, each with a live\r
  preview of its effect. A setting that would have no effect is greyed out with the\r
  reason.\r
- DEMs and orthophotos cover the dense core of the cloud by default. Choose\r
  "All points" to cover everything.\r
- Much larger projects fit in browser memory. A 347-image project now runs dense\r
  reconstruction at Medium quality where it was refused before, and fusion splits a\r
  cloud that does not fit in memory at once (tested at 69 M points).\r
- SuperPoint weights are no longer served by the app because of their\r
  non-commercial license. You can supply the file yourself.\r
\r
### Performance\r
- Feature detection runs more images in parallel: its memory limit now follows the\r
  machine budget in Settings ▸ Compute instead of a fixed 1 GB.\r
- Project opening: the slowest step went from 11.6 s to 0.18 s on a 300 k-point\r
  model. Keypoints and matches now load on demand, and a progress bar names each\r
  loading step.\r
- Bundle adjustment stops once it has converged (608 → 205 s on one dataset), and\r
  sparse reconstruction is a further 14–50 % faster.\r
- Meshing is 7.4× faster end to end, and the solve itself 15× faster.\r
- The dense cross-view filter runs in parallel and is about 3× faster\r
  (444 → 101 s). Fusion is about 2× faster on large sets.\r
- Saving after a 3D edit writes only the clouds that changed.\r
\r
### Fixed\r
- Building a mesh from a large dense cloud (around 17 million points or more) failed\r
  with "Map maximum size exceeded" after the surface was solved.\r
- Georeferencing in polar regions was off by metres. Error-free control at 80°S now\r
  fits to 0.07 mm, and measurements report ground values.\r
- Heights in 3D Tiles exports were scaled wrongly near the poles.\r
- GeoTIFF import now honours the tie point and the PixelIsPoint setting. Re-import\r
  affected rasters to correct them.\r
- Meshes showed "blob" artefacts. Meshing now also uses your cleaned cloud rather\r
  than the first dense cloud.\r
- Oblique drone captures are levelled, so DEMs and orthophotos are no longer tilted.\r
- Datasets that start with near-stationary bursts now reconstruct fully (one\r
  dataset: 7 → 127 of 127 cameras).\r
- 16-bit TIFFs had low contrast and gave few keypoints. Large TIFF batches used\r
  excessive memory.\r
- Tiled detection created duplicate keypoints, which cost matches.\r
- Dense clouds: sky could survive the filters, thin tall features collapsed, and very\r
  large fusions crashed or were wrongly refused.\r
- Renaming an image detached its GCP marks, poses and footprints.\r
- COLMAP database export contained no descriptors for saved projects.\r
- "Failed to create swap file" errors in folder-backed projects.\r
- Images whose source file disappears during a session are recovered from the\r
  project copy.\r
- Some LAS files with 8-bit colour imported black, and some LAZ files failed to load.\r
- Cancelling GPU matching did not stop the run.\r
\r
## [0.1.0-beta.1] — 2026-08-10\r
\r
First public beta.\r
\r
- Runs entirely in the browser. Projects are stored locally, can be saved and loaded\r
  as \`.websfm\` files, or kept in a folder on disk (Chromium browsers).\r
- SIFT and learned (SuperPoint + LightGlue) features. Pairs can be chosen by GPS\r
  proximity or capture sequence.\r
- Incremental structure-from-motion with bundle adjustment, lens self-calibration and\r
  Brown distortion. Scanned aerial film is supported through fiducial marks.\r
- Georeferencing from ground control points (with guided marking) or camera\r
  positions, in any proj4 CRS, including polar projections.\r
- Dense point clouds (optional WebGPU), screened-Poisson meshes, DEMs and\r
  orthophotos.\r
- Reference GeoTIFF DEMs and orthophotos can be imported and shown on the map.\r
- A Quality Report with an exportable HTML summary.\r
- Import and export: COLMAP models, PLY, LAS/LAZ, XYZ, GeoTIFF/COG, 3D Tiles,\r
  \`transforms.json\`, undistorted images.\r
- Smart (SAM2) masking, an in-app guide and a glossary.\r
`;export{e as default};
