# SwiftShift Movers, photo and film sources

Every photo in `public/images/` and every film in `public/videos/` is
stock media sourced for the same subject it shows. No photo or film is
claimed to be the real SwiftShift Movers crew, truck or customers,
because no client photos were provided. All media is captioned on the
site as stock atmosphere footage or photos.

All 15 JPEG files were re-encoded to JPEG, quality about 82, longest
side capped at 1600px, which strips all EXIF, IPTC, XMP and C2PA
metadata. A segment level byte scan on 2026-11-22 found no APP1
(EXIF/XMP), APP13 (IPTC) or APP11 (C2PA) segments in any file. One raw
byte coincidence (the letters XMP inside compressed image data in
step-book.jpg) was checked by parsing the JPEG segments: there is no
XMP segment in the file.

## Photos

| File | Subject | Source |
|---|---|---|
| `hero.jpg` | Yellow truck on the road at sunset | https://www.sunnyskyz.com/uploads/2026/03/58e6x-truck-hero.webp (page: https://www.sunnyskyz.com/feel-good-stories.php?start=204&week=pastweek) |
| `home-shifting.jpg` | Family packing moving boxes at home | https://www.habitat-planete.fr/wp-content/uploads/2023/10/envato-elementsu5x9p.jpg |
| `office-shifting.jpg` | Office packed in moving boxes, chair wrapped | https://porchgroupmedia.com/wp-content/uploads/2018/01/office-moving-boxes-bg.jpg |
| `step-unpack.jpg` | Couple unpacking boxes in a new home | https://locksmiths-york.co.uk/wp-content/uploads/2022/03/New-house-checklist.jpg |
| `packing.jpg` | Sealed box on a dolly, from the Packing film | Frame of the Packing and Unpacking film below |
| `loading.jpg` | Worker at a freight truck, from the Loading film | Frame of the Loading and Transport film below |
| `about.jpg` | Mover carrying a box inside a truck, from the About film | Frame of the About film below |
| `step-book.jpg` | Packing at home, from the Home film | Frame of the Home Shifting film below |
| `step-pack.jpg` | Boxes ready to load, from the Packing film | Frame of the Packing and Unpacking film below |
| `step-transport.jpg` | At the truck, from the Loading film | Frame of the Loading and Transport film below |
| `poster-about.jpg` | Poster frame for the About film | Frame of the About film below |
| `poster-home.jpg` | Poster frame for the Home Shifting film | Frame of the Home Shifting film below |
| `poster-office.jpg` | Poster frame for the Office Shifting film | Frame of the Office Shifting film below |
| `poster-packing.jpg` | Poster frame for the Packing film | Frame of the Packing and Unpacking film below |
| `poster-loading.jpg` | Poster frame for the Loading film | Frame of the Loading and Transport film below |

## Films

The 5 films use the same stock footage subjects as the canonical
SwiftShift Movers site films, from the same stock sources. Each film
was re-encoded as video/mp4 (H.264, faststart) with its OWN distinct
synthesized soundtrack muxed inside the file, composed with
`scripts/make-soundtracks.py` (Python stdlib only) and mastered to
about -15 dB RMS with most energy in the 400 to 2000 Hz band and near
0 percent below 150 Hz. Measured numbers are in `README.md`.

| File | Subject | Source page |
|---|---|---|
| `film-about.mp4` | Movers loading boxes inside a truck | https://videos.pexels.com/video-files/9507645/9507645-hd_1280_720_25fps.mp4 (Pexels) |
| `film-home.mp4` | Couple arranging and packing moving boxes at home | https://assets.mixkit.co/videos/42127/42127-720.mp4 (Mixkit) |
| `film-office.mp4` | Professional movers handling large boxed goods at a loading bay | https://videos.pexels.com/video-files/4296840/4296840-hd_1280_720_50fps.mp4 (Pexels) |
| `film-packing.mp4` | Courier sealing a box with tape on a dolly | https://assets.mixkit.co/videos/31346/31346-720.mp4 (Mixkit) |
| `film-loading.mp4` | Worker loading a freight truck | https://assets.mixkit.co/videos/13066/13066-720.mp4 (Mixkit) |
