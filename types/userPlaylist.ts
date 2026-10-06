/**
 * A playlist a signed-in user made for themselves. Private: stored under
 * `user_playlists/{uid}/playlists/{id}` and readable by its owner only.
 */
export interface UserPlaylist {
  id: string;
  title: string;
  description?: string;
  /** Storage path of the user's own cover image, when they picked one. */
  image_path?: string;
  /** Artwork of the first tracks, newest last — drawn as the 2×2 collage. */
  cover_paths: string[];
  track_count: number;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms. */
  updatedAt: number;
}

export type UserPlaylistTrackKind = "nasheed" | "surah";

interface PlaylistTrackBase {
  title: string;
  /** Artist or reciter name. */
  subtitle: string;
  /** Storage path or http URL. */
  image_path?: string;
  /** Storage path, resolved at play time. */
  audio_path: string;
}

export interface NasheedPlaylistTrackInput extends PlaylistTrackBase {
  kind: "nasheed";
  nasheed_id: string;
  artist_id: string;
  moods?: string[];
}

export interface SurahPlaylistTrackInput extends PlaylistTrackBase {
  kind: "surah";
  reciter_id: string;
  /** The surah doc id under the reciter — together with `reciter_id` unique. */
  surah_id: string;
  surah_number: number;
}

/** What a track row hands to "Add to playlist". */
export type UserPlaylistTrackInput =
  | NasheedPlaylistTrackInput
  | SurahPlaylistTrackInput;

/** A track as stored in a playlist's `tracks` subcollection. */
export type UserPlaylistTrack = UserPlaylistTrackInput & {
  /** Doc id, see `trackKeyFor`. */
  key: string;
  /** Epoch ms. */
  addedAt: number;
};

export interface UserPlaylistDraft {
  title: string;
  description?: string;
  /** An existing Storage path or URL as the cover, e.g. the artist's image. */
  image_path?: string;
}
