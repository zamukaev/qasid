# Nasheed collections

Curated and rule-based nasheed lists, stored in Firestore `collections/{id}`.
Pure logic: `utils/collections.ts` (checked by `npm run check:collections`).

## Workflow

1. Edit `scripts/collections/collections.json`.
2. `npm run collections:build -- --dry-run` — validates the file and prints
   every collection with its track count and every artist's `is_listed`.
3. `npm run collections:build` — writes it.

Rerun the build after adding nasheeds or changing their `tags`, `year`,
`playlist_id` or artist: the tracks are denormalized on the doc and do not
update by themselves. A collection removed from the file is set to
`is_active: false`, never deleted.

## Definition fields

| Field        | Required | Notes                                                 |
| ------------ | -------- | ----------------------------------------------------- |
| `id`         | yes      | `[a-z0-9_]+`, becomes the doc id                      |
| `name_en`    | yes      |                                                       |
| `name_ar`    | no       |                                                       |
| `desc`       | no       |                                                       |
| `image_path` | no       | Storage path, like on artists and playlists           |
| `shelf`      | yes      | `collections`, `eras` or `featured` — the home rail   |
| `sort_order` | yes      | order within the shelf, ascending                     |
| `is_active`  | no       | defaults to `true`                                    |
| `source`     | yes      | see below                                             |

### Sources

- `{ "type": "manual", "track_ids": ["nasheed_id", …] }` — your order.
- `{ "type": "rule", "rule": { … } }` — sorted by popularity. Conditions
  combine with AND, at least one is required:
  - `"unlisted_artists": true` — artists with `is_listed: false`
  - `"tags": ["ramadan", "eid"]` — any of these tags
  - `"year_from": 2000`, `"year_to": 2009` — inclusive; nasheeds without a
    `year` never match
- `{ "type": "legacy_playlist", "playlist_id": "beast_mode" }` — mirrors
  `nasheeds.playlist_id`, sorted by title like the 1.1.0 app. Transitional.

Lists are capped at 200 tracks.

## Nasheed years

Era rules match on `nasheeds.year`, set from
`scripts/collections/nasheed-years.json`: an array of
`{ "id", "artist", "title", "year" }`, where `year` is a number or `null`
(clears it). `artist` and `title` are only there so the file is readable.

1. `npm run years:set -- --export` — writes every nasheed with its current
   year (refuses to overwrite the file without `--force`).
2. Fill in the years you know; leave the rest `null`.
3. `npm run years:set -- --dry-run` — lists each change; an unknown id or a
   bad year aborts before anything is written.
4. `npm run years:set`, then `npm run collections:build`.

`--file <path>` uses another file, e.g. one artist's years only.

## Uploading singles (unknown authors, artists with 1–2 nasheeds)

1. Upload the files to Storage. The folder is the artist id, `unknown` for
   an unknown author:
   - `nasheeds/{artist id}/{audio}`
   - `banners/{artist id}/{image}`
   - `avatars/{artist image}`, for a new artist only (`avatars/unknown.webp`
     once, for the unknown artist; it is also the Trending cover in 1.1.0
     when one of its tracks leads)
2. Write `scripts/collections/singles.json` (format:
   `scripts/collections/singles.example.json`). Leave `artist` out for an
   unknown author; `artist.image` defaults to `{id}.webp`; `moods`, `tags`
   and `year` are optional.
3. `npm run seed:singles -- --dry-run` — validates the file, checks every
   file exists in Storage and lists what will be created or updated.
4. `npm run seed:singles` — writes, then runs `collections:build`.

New artists are created with `is_active: false` and `is_listed: false`:
no "new artist" push (`onArtistCreated` skips them), absent from every
artist list in 1.1.0 and 1.2.0 and from artist search, but their page opens
from the player. Existing artists are never modified. Nasheed ids are
`{artist id}_{audio file stem}`, so a rerun updates the same docs and keeps
their counters.

When such an artist reaches 3 nasheeds, `collections:build` sets
`is_listed: true`; set `is_active: true` by hand to show it in the lists (no
push is sent: that only fires on create).

## Artists: `is_listed`

`is_listed` is `false` for the shared `unknown` artist (put every nasheed of
an unknown author on it) and for artists with fewer than 3 nasheeds. Their
tracks surface through a `unlisted_artists` rule instead of their own rail
entry. The build script owns this field — do not edit it by hand.

## Migration plan (1.1.0 still in production)

The 1.1.0 app reads `playlists` and `nasheeds.playlist_id`, never
`collections` or `is_listed`.

1. **Done — data:** collections are built alongside the old data. Keep
   assigning curated tracks through `playlist_id`; `legacy_playlist` mirrors
   it.
2. **Done in code — protecting 1.1.0** (needs `firebase deploy --only
   functions`): the playback function no longer raises `popularity_score` on
   artists with `is_listed: false`, and `seed-nasheed-artists.ts` gives an
   artist with `is_listed: false` no `publishedAt`. 1.1.0's Popular and New
   artist rails order by those fields without filtering, and Firestore leaves
   out docs that lack the ordered field. Deploy this before adding the
   `unknown` artist or a small artist, and seed those with `is_listed: false`.
3. **1.2.0 — the app reads collections:** the "Collections" and "Through the
   Years" rails come from `collections` (`services/collections-service.ts`,
   `nasheeds/collection/[id]`), and artist rails and the artist list skip
   `is_listed: false` (search still finds them). "Featured Playlists" still
   reads `playlists`, so the admin playlist picker keeps working; the
   `featured` collections are its mirror for step 4. A shelf this build does
   not know is ignored, so later releases can add shelves safely.
4. **Once 1.1.0 is gone:** move "Featured Playlists" to the `featured`
   shelf, turn the legacy sources into `manual` ones, then remove `playlists`,
   `playlist_id`, `PlaylistPickerModal` and its rule.
